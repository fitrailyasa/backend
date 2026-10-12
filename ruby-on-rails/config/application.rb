require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"
require "rails/test_unit/railtie"

require_relative "../lib/middleware/json_parse_errors"
require_relative "../lib/middleware/client_ip"
require_relative "../lib/middleware/auth_rate_limiter"
require_relative "../lib/middleware/global_rate_limiter"
require_relative "../lib/middleware/body_size_limit"
require_relative "../lib/middleware/trust_proxy_headers"
require_relative "../lib/middleware/security_headers"

Bundler.require(*Rails.groups)

module RubyOnRails
  class Application < Rails::Application
    config.load_defaults 7.2

    # API-only: no cookies, sessions, or view middleware beyond what render json needs.
    config.api_only = true
    config.autoload_lib(ignore: %w[assets tasks middleware])

    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc
    config.cache_store = :memory_store
    config.generators.system_tests = nil
    config.secret_key_base = ENV["SECRET_KEY_BASE"].presence || "dev-secret-key-base-not-for-production-use-32b"

    # Hardening: no X-Runtime header, tight default headers on every response
    # (HSTS is added by Middleware::SecurityHeaders when ENABLE_HSTS is on).
    config.middleware.delete Rack::Runtime
    config.action_dispatch.default_headers = {
      "X-Frame-Options" => "DENY",
      "X-Content-Type-Options" => "nosniff",
      "Referrer-Policy" => "no-referrer",
      "Cross-Origin-Opener-Policy" => "same-origin",
      "Permissions-Policy" => "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy" => "default-src 'none'"
    }

    config.middleware.insert_before 0, Middleware::JsonParseErrors
    config.middleware.insert_before 0, Middleware::SecurityHeaders
    config.middleware.insert_before ActionDispatch::RemoteIp, Middleware::TrustProxyHeaders
    config.middleware.use Middleware::GlobalRateLimiter
    config.middleware.use Middleware::BodySizeLimit
    config.middleware.use Middleware::AuthRateLimiter
  end
end
