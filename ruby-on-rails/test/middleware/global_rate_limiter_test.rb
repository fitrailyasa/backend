require "test_helper"

class GlobalRateLimiterTest < ActiveSupport::TestCase
  KEYS = %w[RATE_LIMIT_ENABLED RATE_LIMIT_MAX RATE_LIMIT_WINDOW_MS].freeze

  def setup
    @saved = KEYS.to_h { |key| [key, ENV[key]] }
    @limiter = Middleware::GlobalRateLimiter.new(->(_env) { [200, { "content-type" => "application/json" }, ["{}"]] })
  end

  def teardown
    @saved.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    @limiter.reset!
  end

  def request_env(path = "/api/v1/products")
    Rack::MockRequest.env_for("http://example.org#{path}", "REMOTE_ADDR" => "203.0.113.9")
  end

  def enable(max:)
    ENV["RATE_LIMIT_ENABLED"] = "true"
    ENV["RATE_LIMIT_MAX"] = max.to_s
    ENV["RATE_LIMIT_WINDOW_MS"] = "60000"
  end

  test "over-limit requests get 429 with the envelope and Retry-After" do
    enable(max: 2)

    assert_equal 200, @limiter.call(request_env)[0]
    assert_equal 200, @limiter.call(request_env)[0]

    status, headers, body = @limiter.call(request_env)
    assert_equal 429, status
    assert headers["retry-after"].to_i >= 1
    payload = JSON.parse(body.each.to_a.join)
    assert_equal false, payload["success"]
    assert_equal "Too many requests, please try again later", payload["message"]
    refute payload.key?("errors")
  end

  test "health and the route index are excluded" do
    enable(max: 1)

    3.times do
      assert_equal 200, @limiter.call(request_env("/health"))[0]
      assert_equal 200, @limiter.call(request_env("/api/v1"))[0]
    end
  end

  test "limits are counted per client ip" do
    enable(max: 1)

    assert_equal 200, @limiter.call(request_env)[0]
    other = Rack::MockRequest.env_for("http://example.org/api/v1/products", "REMOTE_ADDR" => "203.0.113.10")
    assert_equal 200, @limiter.call(other)[0]
    assert_equal 429, @limiter.call(request_env)[0]
  end

  test "disabled by default in the test env" do
    ENV.delete("RATE_LIMIT_ENABLED")
    ENV["RATE_LIMIT_MAX"] = "1"

    3.times { assert_equal 200, @limiter.call(request_env)[0] }
  end

  test "reset clears the counters" do
    enable(max: 1)

    @limiter.call(request_env)
    @limiter.reset!
    assert_equal 200, @limiter.call(request_env)[0]
  end
end
