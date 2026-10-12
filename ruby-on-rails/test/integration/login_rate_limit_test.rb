require "test_helper"

class LoginRateLimitTest < ActionDispatch::IntegrationTest
  LOCK_MESSAGE = "Too many failed login attempts. Please try again later."

  setup do
    @user = User.create!(name: "Lockout User", email: "lockout@example.com", password: "password", role: "user")
  end

  test "three failures get 401 each and the fourth attempt is locked with 429" do
    3.times do
      post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
      assert_response :unauthorized
      assert_equal "These credentials do not match our records", json["message"]
      refute json.key?("errors")
    end

    post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json

    assert_response :too_many_requests
    assert response.headers["Retry-After"].to_i >= 1
    assert_equal LOCK_MESSAGE, json["message"]
    assert_equal false, json["success"]
    refute json.key?("errors")
  end

  test "a correct password is also locked out" do
    3.times do
      post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
      assert_response :unauthorized
    end

    post "/api/v1/auth/login", params: { email: @user.email, password: "password" }, as: :json

    assert_response :too_many_requests
    assert response.headers["Retry-After"].to_i >= 1
    assert_equal LOCK_MESSAGE, json["message"]
    refute json.key?("errors")
  end

  test "failures for an unknown email count toward the same counter" do
    3.times do
      post "/api/v1/auth/login", params: { email: "ghost@example.com", password: "wrong-password" }, as: :json
      assert_response :unauthorized
    end

    post "/api/v1/auth/login", params: { email: "ghost@example.com", password: "wrong-password" }, as: :json

    assert_response :too_many_requests
    assert_equal LOCK_MESSAGE, json["message"]
  end

  test "a successful login resets the email counter" do
    2.times do
      post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
      assert_response :unauthorized
    end

    post "/api/v1/auth/login", params: { email: @user.email, password: "password" }, as: :json
    assert_response :ok
    assert_equal @user.email, json.dig("data", "user", "email")

    # Only possible because the success cleared the counter; without the reset
    # the second failure here would already be locked out.
    3.times do
      post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
      assert_response :unauthorized
    end

    post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
    assert_response :too_many_requests
  end

  test "the lockout is per email and the key is normalized" do
    3.times do
      post "/api/v1/auth/login", params: { email: @user.email, password: "wrong-password" }, as: :json
      assert_response :unauthorized
    end

    # Mixed case of a locked email is still locked.
    post "/api/v1/auth/login", params: { email: " Lockout@Example.COM ", password: "password" }, as: :json
    assert_response :too_many_requests

    # Another account is unaffected.
    other = User.create!(name: "Other User", email: "other-lockout@example.com", password: "password", role: "user")
    post "/api/v1/auth/login", params: { email: other.email, password: "wrong-password" }, as: :json
    assert_response :unauthorized
    post "/api/v1/auth/login", params: { email: other.email, password: "password" }, as: :json
    assert_response :ok
  end
end
