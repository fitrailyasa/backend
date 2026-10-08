module Authenticatable
  extend ActiveSupport::Concern

  included do
    attr_reader :current_user, :current_token_payload
  end

  def authenticate!
    return if @authenticated

    token = bearer_token
    raise ApiError.new("Authentication token is missing", status: 401) if token.blank?

    payload = TokenIssuer.verify_access(token)
    raise ApiError.new("Token has been revoked", status: 401) if TokenBlacklist.revoked?(payload)

    user = User.find_by(id: payload["sub"])
    raise ApiError.new("Token is invalid", status: 401) unless user

    @current_user = user
    @current_token_payload = payload
    @authenticated = true
  end

  def require_admin!
    authenticate!
    return if current_user.admin?

    raise ApiError.new("This action is unauthorized", status: 403)
  end

  def bearer_token
    header = request.authorization.to_s
    scheme, value = header.split(" ", 2)
    return nil unless scheme&.casecmp("bearer")&.zero?

    value.to_s.strip.presence
  end
end
