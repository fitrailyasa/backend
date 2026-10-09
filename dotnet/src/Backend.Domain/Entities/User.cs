using Backend.Domain.Enums;

namespace Backend.Domain.Entities;

public sealed class User : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.User;

    public List<Order> Orders { get; set; } = new();
    public List<Comment> Comments { get; set; } = new();
}
