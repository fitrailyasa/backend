module Middleware
  # X-Forwarded-For / X-Forwarded-Proto are only meaningful behind a reverse
  # proxy. When TRUST_PROXY is off (the default) they are dropped before
  # ActionDispatch::RemoteIp sees them, so client-IP based limits and the HSTS
  # decision cannot be spoofed by a direct client.
  class TrustProxyHeaders
    STRIPPED = %w[HTTP_X_FORWARDED_FOR HTTP_CLIENT_IP HTTP_X_FORWARDED_PROTO].freeze
    TRUTHY = %w[true 1 yes on].freeze

    def initialize(app)
      @app = app
    end

    def call(env)
      STRIPPED.each { |key| env.delete(key) } unless self.class.enabled?
      @app.call(env)
    end

    def self.enabled?
      TRUTHY.include?(ENV["TRUST_PROXY"].to_s.strip.downcase)
    end
  end
end
