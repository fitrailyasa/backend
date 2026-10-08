class TokenBlacklist
  def self.revoke!(payload)
    jti = payload["jti"]
    return if jti.blank?

    ttl = payload["exp"].to_i - Time.now.to_i
    ttl = 1 if ttl < 1
    Rails.cache.write(key(jti), true, expires_in: ttl)
  end

  def self.revoked?(payload)
    jti = payload["jti"]
    return false if jti.blank?

    Rails.cache.read(key(jti)).present?
  end

  def self.key(jti)
    "jwt:blacklist:#{jti}"
  end
end
