ENV["RAILS_ENV"] ||= "test"
ENV["SECRET_KEY_BASE"] ||= "test-secret-key-base-not-for-production-use"
ENV["JWT_SECRET"] ||= "test-jwt-secret-key-with-32-characters"
ENV["BCRYPT_ROUNDS"] ||= "4"
ENV["RATE_LIMIT_ENABLED"] ||= "false"
ENV["RATE_LIMIT_MAX"] ||= "1000"
ENV["AUTH_RATE_LIMIT_MAX"] ||= "1000"
ENV["CORS_ORIGINS"] ||= "http://localhost:3000,http://localhost:5173,http://localhost:4200"

require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    parallelize(workers: 1)

    setup do
      Rails.cache.clear
      LoginRateLimiter.reset!
    end
  end
end

module ApiIntegrationHelper
  def json
    JSON.parse(response.body)
  end

  def auth_headers(user)
    issued = TokenIssuer.issue(user)
    { "Authorization" => "Bearer #{issued[:token]}" }
  end
end

class ActionDispatch::IntegrationTest
  include ApiIntegrationHelper
end
