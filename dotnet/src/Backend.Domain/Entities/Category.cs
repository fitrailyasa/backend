namespace Backend.Domain.Entities;

public sealed class Category : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public List<Product> Products { get; set; } = new();
}
