namespace Backend.Domain.Entities;

public abstract class AuditableEntity
{
    public long Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
