using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Domain.Enums;

namespace Backend.Infrastructure.Mapping;

internal static class Mappers
{
    public static string RoleName(UserRole role) => role == UserRole.Admin ? "admin" : "user";

    public static UserRole ParseRole(string? role) => role == "admin" ? UserRole.Admin : UserRole.User;

    public static string StatusName(OrderStatus status) => status switch
    {
        OrderStatus.Paid => "paid",
        OrderStatus.Shipped => "shipped",
        OrderStatus.Completed => "completed",
        OrderStatus.Cancelled => "cancelled",
        _ => "pending"
    };

    public static OrderStatus ParseStatus(string? status) => status switch
    {
        "paid" => OrderStatus.Paid,
        "shipped" => OrderStatus.Shipped,
        "completed" => OrderStatus.Completed,
        "cancelled" => OrderStatus.Cancelled,
        _ => OrderStatus.Pending
    };

    public static UserDto User(User user) => new()
    {
        Id = user.Id,
        Name = user.Name,
        Email = user.Email,
        Role = RoleName(user.Role),
        CreatedAt = user.CreatedAt,
        UpdatedAt = user.UpdatedAt
    };

    public static CategoryDto Category(Category category, bool includeProducts) => new()
    {
        Id = category.Id,
        Name = category.Name,
        Slug = category.Slug,
        Description = category.Description,
        CreatedAt = category.CreatedAt,
        UpdatedAt = category.UpdatedAt,
        Products = includeProducts ? category.Products.Select(product => Product(product, false, false)).ToList() : null
    };

    public static TagDto Tag(Tag tag, bool includeProducts = false) => new()
    {
        Id = tag.Id,
        Name = tag.Name,
        Slug = tag.Slug,
        CreatedAt = tag.CreatedAt,
        UpdatedAt = tag.UpdatedAt,
        Products = includeProducts ? tag.Products.Select(product => Product(product, false, false)).ToList() : null
    };

    public static ProductDto Product(Product product, bool includeCategory, bool includeTags) => new()
    {
        Id = product.Id,
        CategoryId = product.CategoryId,
        Name = product.Name,
        Slug = product.Slug,
        Description = product.Description,
        Price = product.Price,
        Stock = product.Stock,
        CreatedAt = product.CreatedAt,
        UpdatedAt = product.UpdatedAt,
        Category = includeCategory && product.Category is not null ? Category(product.Category, false) : null,
        Tags = includeTags ? product.Tags.OrderBy(tag => tag.Id).Select(tag => Tag(tag)).ToList() : null
    };

    public static OrderDto Order(Order order, bool includeItems, bool includeItemProducts, bool includeUser) => new()
    {
        Id = order.Id,
        UserId = order.UserId,
        Status = StatusName(order.Status),
        Total = order.Total,
        CreatedAt = order.CreatedAt,
        UpdatedAt = order.UpdatedAt,
        Items = includeItems
            ? order.Items.OrderBy(item => item.Id).Select(item => Item(item, includeItemProducts)).ToList()
            : null,
        User = includeUser && order.User is not null ? User(order.User) : null
    };

    public static OrderItemDto Item(OrderItem item, bool includeProduct) => new()
    {
        Id = item.Id,
        OrderId = item.OrderId,
        ProductId = item.ProductId,
        Quantity = item.Quantity,
        Price = item.Price,
        CreatedAt = item.CreatedAt,
        UpdatedAt = item.UpdatedAt,
        Product = includeProduct && item.Product is not null ? Product(item.Product, false, false) : null
    };

    public static CommentDto Comment(Comment comment, bool includeUser, bool includeProduct) => new()
    {
        Id = comment.Id,
        ProductId = comment.ProductId,
        UserId = comment.UserId,
        Body = comment.Body,
        CreatedAt = comment.CreatedAt,
        UpdatedAt = comment.UpdatedAt,
        User = includeUser && comment.User is not null ? User(comment.User) : null,
        Product = includeProduct && comment.Product is not null ? Product(comment.Product, false, false) : null
    };
}
