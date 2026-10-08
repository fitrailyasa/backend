using Backend.Domain.Enums;

namespace Backend.Domain.Entities;

public abstract class AuditableEntity
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class User : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;

    public List<Order> Orders { get; set; } = new();
    public List<Comment> Comments { get; set; } = new();
}

public sealed class Category : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public List<Product> Products { get; set; } = new();
}

public sealed class Product : AuditableEntity
{
    public long CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int Stock { get; set; }

    public Category? Category { get; set; }
    public List<Tag> Tags { get; set; } = new();
    public List<ProductTag> ProductTags { get; set; } = new();
    public List<OrderItem> OrderItems { get; set; } = new();
    public List<Comment> Comments { get; set; } = new();
}

public sealed class Tag : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    public List<Product> Products { get; set; } = new();
    public List<ProductTag> ProductTags { get; set; } = new();
}

public sealed class ProductTag
{
    public long Id { get; set; }
    public long ProductId { get; set; }
    public long TagId { get; set; }

    public Product? Product { get; set; }
    public Tag? Tag { get; set; }
}

public sealed class Order : AuditableEntity
{
    public long UserId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public decimal Total { get; set; }

    public User? User { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}

public sealed class OrderItem : AuditableEntity
{
    public long OrderId { get; set; }
    public long ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }

    public Order? Order { get; set; }
    public Product? Product { get; set; }
}

public sealed class Comment : AuditableEntity
{
    public long ProductId { get; set; }
    public long UserId { get; set; }
    public string Body { get; set; } = string.Empty;

    public Product? Product { get; set; }
    public User? User { get; set; }
}
