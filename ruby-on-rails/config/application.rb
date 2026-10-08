require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"
require "rails/test_unit/railtie"

require_relative "../lib/middleware/json_parse_errors"
require_relative "../lib/middleware/auth_rate_limiter"

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

    config.middleware.insert_before 0, Middleware::JsonParseErrors
    config.middleware.use Middleware::AuthRateLimiter
  end
end
