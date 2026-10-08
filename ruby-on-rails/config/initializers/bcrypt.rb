rounds = ENV.fetch("BCRYPT_ROUNDS", Rails.env.test? ? "4" : "10").to_i
rounds = 4 if Rails.env.test? && rounds > 4
BCrypt::Engine.cost = rounds.clamp(4, 15)

if Rails.env.production?
  secret = ENV["JWT_SECRET"].to_s
  raise "JWT_SECRET must be at least 32 characters" if secret.length < 32
end
