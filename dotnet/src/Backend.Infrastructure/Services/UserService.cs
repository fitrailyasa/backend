using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class UserService : IUserService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(User.Id),
        ["name"] = nameof(User.Name),
        ["email"] = nameof(User.Email),
        ["role"] = nameof(User.Role),
        ["created_at"] = nameof(User.CreatedAt),
        ["updated_at"] = nameof(User.UpdatedAt)
    };

    private readonly AppDbContext _db;
    private readonly IPasswordHasher _passwords;

    public UserService(AppDbContext db, IPasswordHasher passwords)
    {
        _db = db;
        _passwords = passwords;
    }

    public async Task<PagedResult<UserDto>> ListAsync(UserListQuery query, CancellationToken cancellationToken)
    {
        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var users = _db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            users = users.Where(user => EF.Functions.Like(user.Name, pattern) || EF.Functions.Like(user.Email, pattern));
        }

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            var role = Mappers.ParseRole(query.Role);
            users = users.Where(user => user.Role == role);
        }

        var total = await users.CountAsync(cancellationToken);
        var items = await QuerySupport.Sort(users, query.Sort, query.Order, SortFields)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new PagedResult<UserDto>
        {
            Items = items.Select(Mappers.User).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    public async Task<UserDto> GetAsync(long id, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        return user is null ? throw AppException.NotFound("User not found") : Mappers.User(user);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email!.Trim();
        if (await _db.Users.AnyAsync(user => user.Email.ToLower() == email.ToLower(), cancellationToken))
        {
            throw AppException.Validation("email", "The email has already been taken.");
        }

        var user = new User
        {
            Name = request.Name!.Trim(),
            Email = email,
            Password = _passwords.Hash(request.Password!),
            Role = Mappers.ParseRole(string.IsNullOrWhiteSpace(request.Role) ? "user" : request.Role)
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.User(user);
    }

    public async Task<UserDto> UpdateAsync(long id, UserWriteRequest request, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("User not found");

        if (request.Name is { IsNull: false, Value: { } name })
        {
            user.Name = name.Trim();
        }

        if (request.Email is { IsNull: false, Value: { } email })
        {
            email = email.Trim();
            if (!string.Equals(email, user.Email, StringComparison.OrdinalIgnoreCase)
                && await _db.Users.AnyAsync(candidate => candidate.Id != user.Id && candidate.Email.ToLower() == email.ToLower(), cancellationToken))
            {
                throw AppException.Validation("email", "The email has already been taken.");
            }

            user.Email = email;
        }

        if (request.Password is { IsNull: false, Value: { Length: > 0 } password })
        {
            user.Password = _passwords.Hash(password);
        }

        if (!request.IsProfile && request.Role is { IsNull: false, Value: { } role })
        {
            user.Role = Mappers.ParseRole(role);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.User(user);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var user = await _db.Users.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("User not found");
        _db.Users.Remove(user);
        await _db.SaveChangesAsync(cancellationToken);
    }
}
