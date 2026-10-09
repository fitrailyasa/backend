namespace Backend.Domain.Entities;

public sealed class ProductTag
{
    public long Id { get; set; }
    public long ProductId { get; set; }
    public long TagId { get; set; }

    public Product? Product { get; set; }
    public Tag? Tag { get; set; }
}
