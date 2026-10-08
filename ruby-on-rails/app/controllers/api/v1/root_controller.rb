module Api
  module V1
    class RootController < BaseController
      ENDPOINTS = [
        { method: "GET", path: "/health", auth: "public", description: "Liveness probe" },
        { method: "GET", path: "/api/v1", auth: "public", description: "API index" },
        { method: "POST", path: "/api/v1/auth/register", auth: "public", description: "Register, returns token + user" },
        { method: "POST", path: "/api/v1/auth/login", auth: "public", description: "Login, returns token + user" },
        { method: "POST", path: "/api/v1/auth/refresh", auth: "bearer", description: "Issue a new token pair" },
        { method: "POST", path: "/api/v1/auth/logout", auth: "bearer", description: "Revoke the current token" },
        { method: "GET", path: "/api/v1/auth/me", auth: "bearer", description: "Current user" },
        { method: "GET", path: "/api/v1/users", auth: "admin", description: "List users" },
        { method: "POST", path: "/api/v1/users", auth: "admin", description: "Create a user" },
        { method: "GET", path: "/api/v1/users/me", auth: "bearer", description: "Current user profile" },
        { method: "PATCH", path: "/api/v1/users/me", auth: "bearer", description: "Update own profile" },
        { method: "GET", path: "/api/v1/users/{id}", auth: "admin", description: "Get a user" },
        { method: "PUT", path: "/api/v1/users/{id}", auth: "admin", description: "Replace a user" },
        { method: "PATCH", path: "/api/v1/users/{id}", auth: "admin", description: "Update a user" },
        { method: "DELETE", path: "/api/v1/users/{id}", auth: "admin", description: "Delete a user" },
        { method: "GET", path: "/api/v1/categories", auth: "public", description: "List categories" },
        { method: "GET", path: "/api/v1/categories/{id}", auth: "public", description: "Get a category" },
        { method: "POST", path: "/api/v1/categories", auth: "admin", description: "Create a category" },
        { method: "PUT", path: "/api/v1/categories/{id}", auth: "admin", description: "Replace a category" },
        { method: "PATCH", path: "/api/v1/categories/{id}", auth: "admin", description: "Update a category" },
        { method: "DELETE", path: "/api/v1/categories/{id}", auth: "admin", description: "Delete a category" },
        { method: "GET", path: "/api/v1/products", auth: "public", description: "List products, filter by category_id, tag_id, tag, min_price, max_price" },
        { method: "GET", path: "/api/v1/products/{id}", auth: "public", description: "Get a product" },
        { method: "POST", path: "/api/v1/products", auth: "admin", description: "Create a product" },
        { method: "PUT", path: "/api/v1/products/{id}", auth: "admin", description: "Replace a product" },
        { method: "PATCH", path: "/api/v1/products/{id}", auth: "admin", description: "Update a product" },
        { method: "DELETE", path: "/api/v1/products/{id}", auth: "admin", description: "Delete a product" },
        { method: "GET", path: "/api/v1/tags", auth: "public", description: "List tags" },
        { method: "GET", path: "/api/v1/tags/{id}", auth: "public", description: "Get a tag" },
        { method: "POST", path: "/api/v1/tags", auth: "admin", description: "Create a tag" },
        { method: "PUT", path: "/api/v1/tags/{id}", auth: "admin", description: "Replace a tag" },
        { method: "PATCH", path: "/api/v1/tags/{id}", auth: "admin", description: "Update a tag" },
        { method: "DELETE", path: "/api/v1/tags/{id}", auth: "admin", description: "Delete a tag" },
        { method: "GET", path: "/api/v1/orders", auth: "bearer", description: "List orders, filter by status (and user_id for admins)" },
        { method: "POST", path: "/api/v1/orders", auth: "bearer", description: "Create an order from items" },
        { method: "GET", path: "/api/v1/orders/{id}", auth: "bearer", description: "Get an order, owner or admin" },
        { method: "PATCH", path: "/api/v1/orders/{id}/status", auth: "bearer", description: "Update status, admin or owner cancelling a pending order" },
        { method: "DELETE", path: "/api/v1/orders/{id}", auth: "admin", description: "Delete an order" },
        { method: "GET", path: "/api/v1/products/{productId}/comments", auth: "public", description: "List comments for a product" },
        { method: "POST", path: "/api/v1/products/{productId}/comments", auth: "bearer", description: "Create a comment" },
        { method: "GET", path: "/api/v1/comments", auth: "public", description: "List comments, filter by product_id" },
        { method: "PATCH", path: "/api/v1/comments/{id}", auth: "owner or admin", description: "Update a comment" },
        { method: "DELETE", path: "/api/v1/comments/{id}", auth: "owner or admin", description: "Delete a comment" }
      ].freeze

      def show
        render_success("API index retrieved", {
          name: "backend-starter-rails",
          version: "1.0.0",
          prefix: "/api/v1",
          documentation: "/api/v1/docs",
          endpoints: ENDPOINTS,
          base_url: request.base_url
        })
      end
    end
  end
end
