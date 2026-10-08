package com.backend.starter.health;

import com.backend.starter.common.ApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ApiIndexController {

    @Value("${server.port:8080}")
    private int port;

    @GetMapping("/api/v1")
    public ApiResponse<IndexBody> index() {
        return ApiResponse.ok("API index retrieved", new IndexBody(
                "backend-starter-spring",
                "1.0.0",
                "/api/v1",
                "/api/v1/docs",
                List.of(
                        endpoint("GET", "/health", "public", "Liveness probe"),
                        endpoint("GET", "/api/v1", "public", "API index"),
                        endpoint("POST", "/api/v1/auth/register", "public", "Register, returns token + user"),
                        endpoint("POST", "/api/v1/auth/login", "public", "Login, returns token + user"),
                        endpoint("POST", "/api/v1/auth/refresh", "bearer", "Issue a new token pair"),
                        endpoint("POST", "/api/v1/auth/logout", "bearer", "Revoke the current token"),
                        endpoint("GET", "/api/v1/auth/me", "bearer", "Current user"),
                        endpoint("GET", "/api/v1/users", "admin", "List users"),
                        endpoint("POST", "/api/v1/users", "admin", "Create a user"),
                        endpoint("GET", "/api/v1/users/me", "bearer", "Current user profile"),
                        endpoint("PATCH", "/api/v1/users/me", "bearer", "Update own profile"),
                        endpoint("GET", "/api/v1/users/{id}", "admin", "Get a user"),
                        endpoint("PUT", "/api/v1/users/{id}", "admin", "Replace a user"),
                        endpoint("PATCH", "/api/v1/users/{id}", "admin", "Update a user"),
                        endpoint("DELETE", "/api/v1/users/{id}", "admin", "Delete a user"),
                        endpoint("GET", "/api/v1/categories", "public", "List categories"),
                        endpoint("GET", "/api/v1/categories/{id}", "public", "Get a category"),
                        endpoint("POST", "/api/v1/categories", "admin", "Create a category"),
                        endpoint("PUT", "/api/v1/categories/{id}", "admin", "Replace a category"),
                        endpoint("PATCH", "/api/v1/categories/{id}", "admin", "Update a category"),
                        endpoint("DELETE", "/api/v1/categories/{id}", "admin", "Delete a category"),
                        endpoint("GET", "/api/v1/products", "public", "List products, filter by category_id, tag_id, tag, min_price, max_price"),
                        endpoint("GET", "/api/v1/products/{id}", "public", "Get a product"),
                        endpoint("POST", "/api/v1/products", "admin", "Create a product"),
                        endpoint("PUT", "/api/v1/products/{id}", "admin", "Replace a product"),
                        endpoint("PATCH", "/api/v1/products/{id}", "admin", "Update a product"),
                        endpoint("DELETE", "/api/v1/products/{id}", "admin", "Delete a product"),
                        endpoint("GET", "/api/v1/tags", "public", "List tags"),
                        endpoint("GET", "/api/v1/tags/{id}", "public", "Get a tag"),
                        endpoint("POST", "/api/v1/tags", "admin", "Create a tag"),
                        endpoint("PUT", "/api/v1/tags/{id}", "admin", "Replace a tag"),
                        endpoint("PATCH", "/api/v1/tags/{id}", "admin", "Update a tag"),
                        endpoint("DELETE", "/api/v1/tags/{id}", "admin", "Delete a tag"),
                        endpoint("GET", "/api/v1/orders", "bearer", "List orders, filter by status (and user_id for admins)"),
                        endpoint("POST", "/api/v1/orders", "bearer", "Create an order from items"),
                        endpoint("GET", "/api/v1/orders/{id}", "bearer", "Get an order, owner or admin"),
                        endpoint("PATCH", "/api/v1/orders/{id}/status", "bearer", "Update status, admin or owner cancelling a pending order"),
                        endpoint("DELETE", "/api/v1/orders/{id}", "admin", "Delete an order"),
                        endpoint("GET", "/api/v1/products/{productId}/comments", "public", "List comments for a product"),
                        endpoint("POST", "/api/v1/products/{productId}/comments", "bearer", "Create a comment"),
                        endpoint("GET", "/api/v1/comments", "public", "List comments, filter by product_id"),
                        endpoint("PATCH", "/api/v1/comments/{id}", "owner or admin", "Update a comment"),
                        endpoint("DELETE", "/api/v1/comments/{id}", "owner or admin", "Delete a comment")
                ),
                "http://localhost:" + port
        ));
    }

    private static Endpoint endpoint(String method, String path, String auth, String description) {
        return new Endpoint(method, path, auth, description);
    }

    public record IndexBody(String name, String version, String prefix, String documentation, List<Endpoint> endpoints, String baseUrl) {
    }

    public record Endpoint(String method, String path, String auth, String description) {
    }
}
