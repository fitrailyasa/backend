namespace Backend.Domain.Entities;

public sealed class OrderItem : AuditableEntity
{
    public long OrderId { get; set; }
    public long ProductId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }

    public Order? Order { get; set; }
    public Product? Product { get; set; }
}
