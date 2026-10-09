namespace Backend.Domain.Entities;

public sealed class Tag : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    public List<Product> Products { get; set; } = new();
    public List<ProductTag> ProductTags { get; set; } = new();
}
