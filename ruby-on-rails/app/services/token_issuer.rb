class TokenIssuer
  ALGORITHM = "HS256"

  def self.issue(user)
    {
      token: encode(user, "access", access_ttl, access_secret),
      refresh_token: encode(user, "refresh", refresh_ttl, refresh_secret),
      token_type: "Bearer",
      expires_in: access_ttl
    }
  end

  def self.verify_access(token)
    verify(token, access_secret, "access")
  end

  def self.verify_refresh(token)
    verify(token, refresh_secret, "refresh")
  end

  def self.access_ttl
    integer_env("JWT_EXPIRES_IN", 3600)
  end

  def self.refresh_ttl
    integer_env("JWT_REFRESH_EXPIRES_IN", 604800)
  end

  def self.encode(user, typ, ttl, secret)
    now = Time.now.to_i
    payload = {
      "sub" => user.id.to_s,
      "role" => user.role,
      "typ" => typ,
      "jti" => SecureRandom.uuid,
      "iat" => now,
      "exp" => now + ttl
    }
    JWT.encode(payload, secret, ALGORITHM)
  end

  def self.verify(token, secret, typ)
    payload, = JWT.decode(token, secret, true, { algorithm: ALGORITHM })
    raise ApiError.new("Token is invalid", status: 401) unless payload["typ"] == typ

    payload
  rescue ApiError
    raise
  rescue JWT::ExpiredSignature
    raise ApiError.new("Token has expired", status: 401)
  rescue JWT::DecodeError
    raise ApiError.new("Token is invalid", status: 401)
  end

  def self.access_secret
    ENV["JWT_ACCESS_SECRET"].presence || ENV["JWT_SECRET"].presence || fallback_secret
  end

  def self.refresh_secret
    ENV["JWT_REFRESH_SECRET"].presence || ENV["JWT_SECRET"].presence || fallback_secret
  end

  def self.fallback_secret
    "insecure-development-secret-key"
  end

  def self.integer_env(key, default)
    raw = ENV[key]
    return default if raw.nil? || raw.strip.empty?

    Integer(raw)
  rescue ArgumentError
    default
  end
  private_class_method :encode, :verify, :access_secret, :refresh_secret, :fallback_secret, :integer_env
end
