namespace Backend.Domain.Entities;

public sealed class Comment : AuditableEntity
{
    public long ProductId { get; set; }
    public long UserId { get; set; }
    public string Body { get; set; } = string.Empty;

    public Product? Product { get; set; }
    public User? User { get; set; }
}
