using Backend.Application.Common;

namespace Backend.Application.Dtos;

public abstract class PageQuery
{
    public int? Page { get; set; }
    public int? Limit { get; set; }
    public string? Search { get; set; }
    public string? Sort { get; set; }
    public string? Order { get; set; }
    public string? Include { get; set; }
}

public sealed class UserDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "user";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class AuthResultDto
{
    public UserDto User { get; set; } = new();
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string TokenType { get; set; } = "Bearer";
    public int ExpiresIn { get; set; }
}

public sealed class RegisterRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? PasswordConfirmation { get; set; }
}

public sealed class LoginRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
}

public sealed class RefreshRequest
{
    public string? RefreshToken { get; set; }
    public string? Token { get; set; }
}

public sealed class CreateUserRequest
{
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Role { get; set; }
}

public sealed class UserListQuery : PageQuery
{
    public string? Role { get; set; }
}

public sealed class UserWriteRequest
{
    public Provided<string>? Name { get; init; }
    public Provided<string>? Email { get; init; }
    public Provided<string>? Password { get; init; }
    public Provided<string>? PasswordConfirmation { get; init; }
    public Provided<string>? Role { get; init; }
    public bool IsProfile { get; init; }
    public bool RequireCore { get; init; }
}

public sealed class CategoryDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public List<ProductDto>? Products { get; set; }
}

public sealed class CreateCategoryRequest
{
    public string? Name { get; set; }
    public string? Slug { get; set; }
    public string? Description { get; set; }
}

public sealed class CategoryListQuery : PageQuery
{
}

public sealed class CategoryWriteRequest
{
    public Provided<string>? Name { get; init; }
    public Provided<string>? Slug { get; init; }
    public Provided<string>? Description { get; init; }
    public bool RequireName { get; init; }
}

public sealed class TagDto
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public List<ProductDto>? Products { get; set; }
}

public sealed class CreateTagRequest
{
    public string? Name { get; set; }
    public string? Slug { get; set; }
}

public sealed class TagListQuery : PageQuery
{
}

public sealed class TagWriteRequest
{
    public Provided<string>? Name { get; init; }
    public Provided<string>? Slug { get; init; }
    public bool RequireName { get; init; }
}

public sealed class ProductDto
{
    public long Id { get; set; }
    public long CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public CategoryDto? Category { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public List<TagDto>? Tags { get; set; }
}

public sealed class CreateProductRequest
{
    public long CategoryId { get; set; }
    public string? Name { get; set; }
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? Stock { get; set; }
    public List<long>? Tags { get; set; }
}

public sealed class ProductListQuery : PageQuery
{
    public long? CategoryId { get; set; }
    public long? category_id { get => CategoryId; set => CategoryId = value; }
    public long? TagId { get; set; }
    public long? tag_id { get => TagId; set => TagId = value; }
    public string? Tag { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? min_price { get => MinPrice; set => MinPrice = value; }
    public decimal? MaxPrice { get; set; }
    public decimal? max_price { get => MaxPrice; set => MaxPrice = value; }
}

public sealed class ProductWriteRequest
{
    public Provided<long>? CategoryId { get; init; }
    public Provided<string>? Name { get; init; }
    public Provided<string>? Slug { get; init; }
    public Provided<string>? Description { get; init; }
    public Provided<decimal>? Price { get; init; }
    public Provided<int>? Stock { get; init; }
    public Provided<List<long>>? Tags { get; init; }
    public bool RequireCore { get; init; }
}

public sealed class OrderItemDto
{
    public long Id { get; set; }
    public long OrderId { get; set; }
    public long ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public ProductDto? Product { get; set; }
}

public sealed class OrderDto
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string Status { get; set; } = "pending";
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public List<OrderItemDto>? Items { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public UserDto? User { get; set; }
}

public sealed class OrderItemRequest
{
    public long ProductId { get; set; }
    public int Quantity { get; set; }
}

public sealed class CreateOrderRequest
{
    public List<OrderItemRequest>? Items { get; set; }
}

public sealed class UpdateOrderStatusRequest
{
    public string? Status { get; set; }
}

public sealed class OrderListQuery : PageQuery
{
    public string? Status { get; set; }
    public long? UserId { get; set; }
    public long? user_id { get => UserId; set => UserId = value; }
}

public sealed class CommentDto
{
    public long Id { get; set; }
    public long ProductId { get; set; }
    public long UserId { get; set; }
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public UserDto? User { get; set; }

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public ProductDto? Product { get; set; }
}

public sealed class CommentBodyRequest
{
    public string? Body { get; set; }
}

public sealed class CommentListQuery : PageQuery
{
    public long? ProductId { get; set; }
    public long? product_id { get => ProductId; set => ProductId = value; }
    public long? UserId { get; set; }
    public long? user_id { get => UserId; set => UserId = value; }
}

public sealed record SeedSummary(int Users, int Categories, int Products, int Tags, int Orders, int Comments, bool Skipped);

public sealed record AccessPrincipal(long UserId, string Role, string Jti, DateTimeOffset ExpiresAt);
