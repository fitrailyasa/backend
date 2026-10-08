origins_env = ENV.fetch("CORS_ORIGIN", "*")

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    if origins_env == "*"
      origins "*"
    else
      origins(*origins_env.split(",").map(&:strip).reject(&:empty?))
    end

    resource "*",
             headers: :any,
             methods: %i[get post put patch delete options head],
             expose: %w[X-RateLimit-Limit X-RateLimit-Remaining X-RateLimit-Reset Retry-After]
  end
end
