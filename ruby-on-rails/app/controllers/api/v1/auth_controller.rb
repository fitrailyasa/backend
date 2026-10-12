module Api
  module V1
    class AuthController < BaseController
      LOCKOUT_MESSAGE = "Too many failed login attempts. Please try again later."

      def register
        body = json_body
        errors = blank_errors
        name = string_field(errors, body, "name", label: "Name", required: true, min: 2, max: 100)
        email = email_field(errors, body, required: true)
        password = password_field(errors, body, required: true, confirm: true)
        errors["email"] << "The email has already been taken." if email.present? && email_taken?(email)
        finish_validation!(errors)

        user = User.create!(name: name, email: email, password: password, role: "user")
        render_created("User registered successfully", ApiSerializer.auth(user, TokenIssuer.issue(user)))
      end

      def login
        body = json_body
        errors = blank_errors
        email = email_field(errors, body, required: true)
        if !body.key?("password") || body["password"].nil? || body["password"] == ""
          errors["password"] << "Password is required."
        elsif !body["password"].is_a?(String)
          errors["password"] << "Password must be a string."
        end
        finish_validation!(errors)

        ip = request.remote_ip.to_s
        if (retry_after = LoginRateLimiter.retry_after(email, ip))
          render_error(LOCKOUT_MESSAGE, status: 429, headers: { "Retry-After" => retry_after.to_s })
          return
        end

        user = User.find_by("LOWER(email) = ?", email)
        valid = user ? user.password_matches?(body["password"]) : User.password_matches_dummy?(body["password"])
        unless valid
          LoginRateLimiter.record_failure!(email, ip)
          raise ApiError.new("These credentials do not match our records", status: 401)
        end

        LoginRateLimiter.reset!(email)
        render_success("Login successful", ApiSerializer.auth(user, TokenIssuer.issue(user)))
      end

      def refresh
        body = json_body
        token = string_token(body["refresh_token"]) || string_token(body["token"]) || bearer_token
        raise ApiError.new("Refresh token is missing", status: 401) if token.blank?

        payload = TokenIssuer.verify_refresh(token)
        raise ApiError.new("Token has been revoked", status: 401) if TokenBlacklist.revoked?(payload)

        user = User.find_by(id: payload["sub"])
        raise ApiError.new("Token is invalid", status: 401) unless user

        render_success("Token refreshed successfully", ApiSerializer.auth(user, TokenIssuer.issue(user)))
      end

      def logout
        authenticate!
        TokenBlacklist.revoke!(current_token_payload)
        render_success("Logged out successfully", nil)
      end

      def me
        authenticate!
        user = User.find_by(id: current_user.id)
        raise ApiError.new("Token is invalid", status: 401) unless user

        render_success("Authenticated user retrieved", ApiSerializer.user(user))
      end

      private

      def string_token(value)
        return nil unless value.is_a?(String)

        value.strip.presence
      end
    end
  end
end
