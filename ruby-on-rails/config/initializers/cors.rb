# Explicit allowlist only. The API authenticates with Bearer tokens, so
# credentials are never enabled and "*" can never be combined with them.
# Origins come from CORS_ORIGINS (comma separated); CORS_ORIGIN is kept as a
# legacy fallback.
origins_env = ENV["CORS_ORIGINS"].presence || ENV["CORS_ORIGIN"].presence ||
              "http://localhost:3000,http://localhost:5173,http://localhost:4200"
allowed_origins = origins_env.split(",").map(&:strip).reject(&:empty?)

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    if allowed_origins == ["*"]
      origins "*"
    else
      origins(*allowed_origins)
    end

    resource "*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             expose: %w[X-RateLimit-Limit X-RateLimit-Remaining X-RateLimit-Reset Retry-After],
             max_age: 600
  end
end
