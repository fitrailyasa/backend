module Middleware
  # Fixed-window throttle for the public auth POSTs. In-process memory is enough
  # for a single Puma worker; swap the store if you run multiple machines.
  class AuthRateLimiter
    PATHS = %w[/api/v1/auth/register /api/v1/auth/login /api/v1/auth/refresh].freeze

    def initialize(app)
      @app = app
      @mutex = Mutex.new
      @hits = {}
    end

    def call(env)
      request = Rack::Request.new(env)
      path = request.path.to_s.sub(%r{/+\z}, "")
      return @app.call(env) unless request.post? && PATHS.include?(path)

      max = env_int("RATE_LIMIT_MAX", 100)
      window_ms = env_int("RATE_LIMIT_WINDOW_MS", 900_000)
      return @app.call(env) if max <= 0

      now = (Time.now.to_f * 1000).to_i
      key = request.ip.to_s.presence || "unknown"
      count = nil
      reset_at = nil

      @mutex.synchronize do
        entry = @hits[key]
        if entry.nil? || entry[:reset_at] <= now
          entry = { count: 0, reset_at: now + window_ms }
          @hits[key] = entry
        end
        entry[:count] += 1
        count = entry[:count]
        reset_at = entry[:reset_at]
        if @hits.size > 5000
          @hits.delete_if { |_id, value| value[:reset_at] <= now }
        end
      end

      headers = {
        "x-ratelimit-limit" => max.to_s,
        "x-ratelimit-remaining" => [max - count, 0].max.to_s,
        "x-ratelimit-reset" => (reset_at / 1000.0).ceil.to_s
      }

      if count > max
        retry_after = [((reset_at - now) / 1000.0).ceil, 1].max
        body = { success: false, message: "Too many requests, please try again later" }.to_json
        return [429, headers.merge("content-type" => "application/json", "retry-after" => retry_after.to_s), [body]]
      end

      status, response_headers, response = @app.call(env)
      headers.each { |name, value| response_headers[name] = value }
      [status, response_headers, response]
    end

    private

    def env_int(key, default)
      raw = ENV[key]
      return default if raw.nil? || raw.strip.empty?

      Integer(raw)
    rescue ArgumentError
      default
    end
  end
end
