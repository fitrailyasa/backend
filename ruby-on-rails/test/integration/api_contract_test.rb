require "test_helper"

class ApiContractTest < ActionDispatch::IntegrationTest
  test "health has no envelope" do
    get "/health"
    assert_response :ok
    body = json
    assert_equal "ok", body["status"]
    assert_kind_of Numeric, body["uptime"]
    assert body["timestamp"].present?
    refute body.key?("success")
  end

  test "api index is wrapped in the success envelope" do
    get "/api/v1"
    assert_response :ok
    assert_equal true, json["success"]
    assert_equal "API index retrieved", json["message"]
    assert json["data"]["endpoints"].any? { |entry| entry["path"] == "/api/v1/orders" }
  end

  test "register forces the user role and never returns the password" do
    post "/api/v1/auth/register",
         params: {
           name: "New Person",
           email: "new.person@example.com",
           password: "password",
           password_confirmation: "password",
           role: "admin"
         },
         as: :json

    assert_response :created
    data = json["data"]
    assert_equal "user", data["user"]["role"]
    assert_equal "Bearer", data["token_type"]
    assert_equal 3600, data["expires_in"]
    assert data["token"].present?
    assert data["refresh_token"].present?
    refute data["user"].key?("password")

    payload, = JWT.decode(data["token"], ENV.fetch("JWT_SECRET"), true, { algorithm: "HS256" })
    assert_equal "access", payload["typ"]
    assert_equal data["user"]["id"].to_s, payload["sub"]
    assert_equal "user", payload["role"]
    assert payload["jti"].present?
    assert payload["exp"] > payload["iat"]
  end

  test "duplicate email is a 422" do
    User.create!(name: "Existing User", email: "taken@example.com", password: "password", role: "user")

    post "/api/v1/auth/register",
         params: {
           name: "Another User",
           email: "taken@example.com",
           password: "password",
           password_confirmation: "password"
         },
         as: :json

    assert_response :unprocessable_entity
    assert_equal false, json["success"]
    assert_equal "Validation failed", json["message"]
    assert_includes json["errors"]["email"], "The email has already been taken."
  end

  test "short password is a 422" do
    post "/api/v1/auth/register",
         params: { name: "Short Pass", email: "short@example.com", password: "short", password_confirmation: "short" },
         as: :json

    assert_response :unprocessable_entity
    assert json["errors"]["password"].any?
  end

  test "bad credentials are a 401 without an errors object" do
    User.create!(name: "Login User", email: "login@example.com", password: "password", role: "user")

    post "/api/v1/auth/login", params: { email: "login@example.com", password: "wrong-password" }, as: :json

    assert_response :unauthorized
    assert_equal "These credentials do not match our records", json["message"]
    refute json.key?("errors")
  end

  test "logout blacklists the access token" do
    user = User.create!(name: "Logout User", email: "logout@example.com", password: "password", role: "user")
    issued = TokenIssuer.issue(user)
    headers = { "Authorization" => "Bearer #{issued[:token]}" }

    post "/api/v1/auth/logout", headers: headers, as: :json
    assert_response :ok
    assert_nil json["data"]

    get "/api/v1/auth/me", headers: headers
    assert_response :unauthorized
    assert_equal "Token has been revoked", json["message"]
  end

  test "refresh accepts the refresh token from the body" do
    user = User.create!(name: "Refresh User", email: "refresh@example.com", password: "password", role: "user")
    issued = TokenIssuer.issue(user)

    post "/api/v1/auth/refresh", params: { refresh_token: issued[:refresh_token] }, as: :json
    assert_response :ok
    assert_equal "Bearer", json["data"]["token_type"]
    refute_equal issued[:token], json["data"]["token"]
    refute json["data"]["user"].key?("password")
  end

  test "invalid json is a 400" do
    post "/api/v1/auth/login",
         params: "{",
         headers: { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" }

    assert_response :bad_request
    assert_equal "Invalid JSON payload", json["message"]
    refute json.key?("errors")
  end

  test "a normal user cannot list users" do
    user = User.create!(name: "Plain User", email: "plain@example.com", password: "password", role: "user")

    get "/api/v1/users", headers: auth_headers(user)
    assert_response :forbidden
    assert_equal "This action is unauthorized", json["message"]
    refute json.key?("errors")
  end

  test "comment changes are limited to the owner or an admin" do
    owner = User.create!(name: "Owner User", email: "owner@example.com", password: "password", role: "user")
    other = User.create!(name: "Other User", email: "other@example.com", password: "password", role: "user")
    category = Category.create!(name: "Audio", slug: "audio")
    product = Product.create!(category: category, name: "Speaker", slug: "speaker", price: 50, stock: 4)
    comment = Comment.create!(product: product, user: owner, body: "Original note")

    patch "/api/v1/comments/#{comment.id}",
          params: { body: "Hijacked" },
          headers: auth_headers(other),
          as: :json

    assert_response :forbidden
    assert_equal "Original note", comment.reload.body
  end

  test "duplicate slug is a 409" do
    admin = User.create!(name: "Admin User", email: "slug-admin@example.com", password: "password", role: "admin")
    Category.create!(name: "Electronics", slug: "electronics")

    post "/api/v1/categories",
         params: { name: "Electronics" },
         headers: auth_headers(admin),
         as: :json

    assert_response :conflict
    assert_match(/already been taken/, json["message"])
    refute json.key?("errors")
  end

  test "order total merges duplicate products and decrements stock" do
    user = User.create!(name: "Buyer", email: "buyer@example.com", password: "password", role: "user")
    category = Category.create!(name: "Gear", slug: "gear")
    product = Product.create!(category: category, name: "Cable", slug: "cable", price: 100, stock: 10)
    other = Product.create!(category: category, name: "Adapter", slug: "adapter", price: 50, stock: 5)

    post "/api/v1/orders",
         params: {
           items: [
             { product_id: product.id, quantity: 2 },
             { product_id: product.id, quantity: 3 },
             { product_id: other.id, quantity: 1 }
           ]
         },
         headers: auth_headers(user),
         as: :json

    assert_response :created
    data = json["data"]
    assert_equal 550, data["total"]
    assert_equal 2, data["items"].size
    cable = data["items"].find { |item| item["product_id"] == product.id }
    assert_equal 5, cable["quantity"]
    assert_equal 100, cable["price"]
    assert_kind_of Numeric, data["total"]
    assert_equal 5, product.reload.stock
    assert_equal 4, other.reload.stock
  end

  test "insufficient stock is a 409 and does not change stock" do
    user = User.create!(name: "Buyer Two", email: "buyer2@example.com", password: "password", role: "user")
    category = Category.create!(name: "Parts", slug: "parts")
    product = Product.create!(category: category, name: "Bolt", slug: "bolt", price: 10, stock: 1)
    orders_before = Order.count

    post "/api/v1/orders",
         params: { items: [{ product_id: product.id, quantity: 2 }] },
         headers: auth_headers(user),
         as: :json

    assert_response :conflict
    assert_match(/Insufficient stock/, json["message"])
    assert_equal 1, product.reload.stock
    assert_equal orders_before, Order.count
  end

  test "owner can cancel a pending order and stock is restored" do
    user = User.create!(name: "Buyer Three", email: "buyer3@example.com", password: "password", role: "user")
    category = Category.create!(name: "Tools", slug: "tools")
    product = Product.create!(category: category, name: "Wrench", slug: "wrench", price: 20, stock: 3)

    post "/api/v1/orders",
         params: { items: [{ product_id: product.id, quantity: 2 }] },
         headers: auth_headers(user),
         as: :json
    assert_response :created
    order_id = json["data"]["id"]
    assert_equal 1, product.reload.stock

    patch "/api/v1/orders/#{order_id}/status",
          params: { status: "paid" },
          headers: auth_headers(user),
          as: :json
    assert_response :forbidden
    assert_equal "pending", Order.find(order_id).status

    patch "/api/v1/orders/#{order_id}/status",
          params: { status: "cancelled" },
          headers: auth_headers(user),
          as: :json
    assert_response :ok
    assert_equal "cancelled", json["data"]["status"]
    assert_equal 3, product.reload.stock
  end

  test "delete returns the success envelope" do
    admin = User.create!(name: "Delete Admin", email: "delete-admin@example.com", password: "password", role: "admin")
    category = Category.create!(name: "Temp", slug: "temp")

    delete "/api/v1/categories/#{category.id}", headers: auth_headers(admin)
    assert_response :ok
    assert_equal true, json["success"]
    assert_nil json["data"]
    assert_nil Category.find_by(id: category.id)
  end
end
