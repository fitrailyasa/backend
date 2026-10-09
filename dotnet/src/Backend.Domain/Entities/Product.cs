namespace Backend.Domain.Entities;

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
