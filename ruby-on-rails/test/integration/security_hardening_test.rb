require "test_helper"

class SecurityHardeningTest < ActionDispatch::IntegrationTest
  ALLOWED_ORIGIN = "http://localhost:5173".freeze

  test "responses carry the security headers" do
    get "/api/v1"

    assert_response :ok
    assert_equal "nosniff", response.headers["X-Content-Type-Options"]
    assert_equal "DENY", response.headers["X-Frame-Options"]
    assert_equal "no-referrer", response.headers["Referrer-Policy"]
    assert_equal "same-origin", response.headers["Cross-Origin-Opener-Policy"]
    assert_equal "camera=(), microphone=(), geolocation=()", response.headers["Permissions-Policy"]
    assert_equal "default-src 'none'", response.headers["Content-Security-Policy"]
  end

  test "responses do not leak the framework fingerprint" do
    get "/api/v1"

    assert_response :ok
    refute response.headers.key?("X-Powered-By")
    refute response.headers.key?("X-Runtime")
    refute response.headers.key?("Server")
  end

  test "middleware errors also use the standard envelope and headers" do
    post "/api/v1/auth/login",
         params: "{",
         headers: { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" }

    assert_response :bad_request
    assert_equal "nosniff", response.headers["X-Content-Type-Options"]
    assert_equal "Invalid JSON payload", json["message"]
  end

  test "cors reflects only allowlisted origins and varies on origin" do
    get "/api/v1", headers: { "Origin" => ALLOWED_ORIGIN }

    assert_response :ok
    assert_equal ALLOWED_ORIGIN, response.headers["Access-Control-Allow-Origin"]
    assert_includes response.headers["Vary"].to_s, "Origin"

    get "/api/v1", headers: { "Origin" => "https://evil.example" }
    assert_response :ok
    assert_nil response.headers["Access-Control-Allow-Origin"]
  end

  test "preflight requests are cached for at most 600 seconds" do
    options "/api/v1/products", headers: { "Origin" => ALLOWED_ORIGIN, "Access-Control-Request-Method" => "GET" }

    assert_response :success
    assert response.headers["Access-Control-Max-Age"].to_i <= 600
  end

  test "hsts is only sent on https responses when enabled" do
    get "/api/v1"
    assert_nil response.headers["Strict-Transport-Security"]

    ENV["ENABLE_HSTS"] = "true"
    https!
    get "/api/v1"
    assert_equal "max-age=31536000; includeSubDomains", response.headers["Strict-Transport-Security"]
  ensure
    ENV.delete("ENABLE_HSTS")
    https! false
  end

  test "oversized bodies are rejected with 413 and the error envelope" do
    post "/api/v1/auth/register",
         params: { name: "Big Person", email: "big@example.com", password: "password",
                   password_confirmation: "password", filler: "x" * 200_000 },
         as: :json

    assert_response 413
    assert_equal false, json["success"]
    assert_equal "Request body too large", json["message"]
    refute json.key?("errors")
    assert_nil User.find_by(email: "big@example.com")
  end
end
