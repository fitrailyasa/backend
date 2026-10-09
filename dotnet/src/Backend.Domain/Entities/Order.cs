using Backend.Domain.Enums;

namespace Backend.Domain.Entities;

public sealed class Order : AuditableEntity
{
    public long UserId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public decimal Total { get; set; }

    public User? User { get; set; }
    public List<OrderItem> Items { get; set; } = new();
}
