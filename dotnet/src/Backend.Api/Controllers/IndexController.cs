using Backend.Api.Http;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1")]
public sealed class IndexController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        var baseUrl = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["Api:BaseUrl"] ?? "http://localhost:5080";
        return ApiResults.Ok("API index retrieved", new
        {
            name = "backend-starter-dotnet",
            version = "1.0.0",
            prefix = "/api/v1",
            documentation = "/api/v1/docs",
            endpoints = Endpoints,
            base_url = baseUrl
        });
    }

    private static readonly object[] Endpoints =
    [
        new { method = "GET", path = "/health", auth = "public", description = "Liveness probe" },
        new { method = "GET", path = "/api/v1", auth = "public", description = "API index" },
        new { method = "POST", path = "/api/v1/auth/register", auth = "public", description = "Register, returns token + user" },
        new { method = "POST", path = "/api/v1/auth/login", auth = "public", description = "Login, returns token + user" },
        new { method = "POST", path = "/api/v1/auth/refresh", auth = "bearer", description = "Issue a new token pair" },
        new { method = "POST", path = "/api/v1/auth/logout", auth = "bearer", description = "Revoke the current token" },
        new { method = "GET", path = "/api/v1/auth/me", auth = "bearer", description = "Current user" },
        new { method = "GET", path = "/api/v1/users", auth = "admin", description = "List users" },
        new { method = "POST", path = "/api/v1/users", auth = "admin", description = "Create a user" },
        new { method = "GET", path = "/api/v1/users/me", auth = "bearer", description = "Current user profile" },
        new { method = "PATCH", path = "/api/v1/users/me", auth = "bearer", description = "Update own profile" },
        new { method = "GET", path = "/api/v1/users/{id}", auth = "admin", description = "Get a user" },
        new { method = "PUT", path = "/api/v1/users/{id}", auth = "admin", description = "Replace a user" },
        new { method = "PATCH", path = "/api/v1/users/{id}", auth = "admin", description = "Update a user" },
        new { method = "DELETE", path = "/api/v1/users/{id}", auth = "admin", description = "Delete a user" },
        new { method = "GET", path = "/api/v1/categories", auth = "public", description = "List categories" },
        new { method = "GET", path = "/api/v1/categories/{id}", auth = "public", description = "Get a category" },
        new { method = "POST", path = "/api/v1/categories", auth = "admin", description = "Create a category" },
        new { method = "PUT", path = "/api/v1/categories/{id}", auth = "admin", description = "Replace a category" },
        new { method = "PATCH", path = "/api/v1/categories/{id}", auth = "admin", description = "Update a category" },
        new { method = "DELETE", path = "/api/v1/categories/{id}", auth = "admin", description = "Delete a category" },
        new { method = "GET", path = "/api/v1/products", auth = "public", description = "List products, filter by category_id, tag_id, tag, min_price, max_price" },
        new { method = "GET", path = "/api/v1/products/{id}", auth = "public", description = "Get a product" },
        new { method = "POST", path = "/api/v1/products", auth = "admin", description = "Create a product" },
        new { method = "PUT", path = "/api/v1/products/{id}", auth = "admin", description = "Replace a product" },
        new { method = "PATCH", path = "/api/v1/products/{id}", auth = "admin", description = "Update a product" },
        new { method = "DELETE", path = "/api/v1/products/{id}", auth = "admin", description = "Delete a product" },
        new { method = "GET", path = "/api/v1/tags", auth = "public", description = "List tags" },
        new { method = "GET", path = "/api/v1/tags/{id}", auth = "public", description = "Get a tag" },
        new { method = "POST", path = "/api/v1/tags", auth = "admin", description = "Create a tag" },
        new { method = "PUT", path = "/api/v1/tags/{id}", auth = "admin", description = "Replace a tag" },
        new { method = "PATCH", path = "/api/v1/tags/{id}", auth = "admin", description = "Update a tag" },
        new { method = "DELETE", path = "/api/v1/tags/{id}", auth = "admin", description = "Delete a tag" },
        new { method = "GET", path = "/api/v1/orders", auth = "bearer", description = "List orders, filter by status (and user_id for admins)" },
        new { method = "POST", path = "/api/v1/orders", auth = "bearer", description = "Create an order from items" },
        new { method = "GET", path = "/api/v1/orders/{id}", auth = "bearer", description = "Get an order, owner or admin" },
        new { method = "PATCH", path = "/api/v1/orders/{id}/status", auth = "bearer", description = "Update status, admin or owner cancelling a pending order" },
        new { method = "DELETE", path = "/api/v1/orders/{id}", auth = "admin", description = "Delete an order" },
        new { method = "GET", path = "/api/v1/products/{productId}/comments", auth = "public", description = "List comments for a product" },
        new { method = "POST", path = "/api/v1/products/{productId}/comments", auth = "bearer", description = "Create a comment" },
        new { method = "GET", path = "/api/v1/comments", auth = "public", description = "List comments, filter by product_id" },
        new { method = "PATCH", path = "/api/v1/comments/{id}", auth = "owner or admin", description = "Update a comment" },
        new { method = "DELETE", path = "/api/v1/comments/{id}", auth = "owner or admin", description = "Delete a comment" }
    ];
}
