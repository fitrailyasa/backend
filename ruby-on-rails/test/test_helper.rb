ENV["RAILS_ENV"] ||= "test"
ENV["SECRET_KEY_BASE"] ||= "test-secret-key-base-not-for-production-use"
ENV["JWT_SECRET"] ||= "test-jwt-secret-key-with-32-characters"
ENV["BCRYPT_ROUNDS"] ||= "4"
ENV["RATE_LIMIT_MAX"] ||= "1000"

require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    parallelize(workers: 1)

    setup { Rails.cache.clear }
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
