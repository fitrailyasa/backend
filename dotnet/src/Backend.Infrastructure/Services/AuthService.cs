using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Domain.Enums;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class AuthService : IAuthService
{
    // Compared when the email does not exist so timing cannot reveal account existence.
    private static readonly string DummyPasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"), workFactor: 10);

    private readonly AppDbContext _db;
    private readonly IPasswordHasher _passwords;
    private readonly IJwtTokenService _jwt;
    private readonly ITokenBlacklist _blacklist;

    public AuthService(AppDbContext db, IPasswordHasher passwords, IJwtTokenService jwt, ITokenBlacklist blacklist)
    {
        _db = db;
        _passwords = passwords;
        _jwt = jwt;
        _blacklist = blacklist;
    }

    public async Task<AuthResultDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email!.Trim();
        if (await EmailTakenAsync(email, null, cancellationToken))
        {
            throw AppException.Validation("email", "The email has already been taken.");
        }

        var user = new User
        {
            Name = request.Name!.Trim(),
            Email = email,
            Password = _passwords.Hash(request.Password!),
            Role = UserRole.User
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);
        return Issue(user);
    }

    public async Task<AuthResultDto> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email!.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(candidate => candidate.Email.ToLower() == email.ToLower(), cancellationToken);
        if (user is null)
        {
            // Burn the same bcrypt work as a real match, then fail with the same generic message.
            _passwords.Verify(request.Password ?? string.Empty, DummyPasswordHash);
            throw AppException.Unauthorized("These credentials do not match our records");
        }

        if (!_passwords.Verify(request.Password ?? string.Empty, user.Password))
        {
            throw AppException.Unauthorized("These credentials do not match our records");
        }

        return Issue(user);
    }

    public async Task<AuthResultDto> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var principal = _jwt.ValidateRefreshToken(refreshToken);
        var user = await _db.Users.FirstOrDefaultAsync(candidate => candidate.Id == principal.UserId, cancellationToken);
        if (user is null)
        {
            throw AppException.Unauthorized("Token is invalid");
        }

        return Issue(user);
    }

    public Task LogoutAsync(string? jti, DateTimeOffset? expiresAt, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(jti))
        {
            _blacklist.Revoke(jti, expiresAt ?? DateTimeOffset.UtcNow.AddHours(1));
        }

        return Task.CompletedTask;
    }

    public async Task<UserDto> MeAsync(long userId, CancellationToken cancellationToken)
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
        if (user is null)
        {
            throw AppException.Unauthorized("Token is invalid");
        }

        return Mappers.User(user);
    }

    private AuthResultDto Issue(User user)
    {
        var pair = _jwt.IssuePair(user.Id, Mappers.RoleName(user.Role));
        return new AuthResultDto
        {
            User = Mappers.User(user),
            Token = pair.Token,
            RefreshToken = pair.RefreshToken,
            TokenType = "Bearer",
            ExpiresIn = pair.ExpiresIn
        };
    }

    private Task<bool> EmailTakenAsync(string email, long? exceptId, CancellationToken cancellationToken) =>
        _db.Users.AnyAsync(user => user.Email.ToLower() == email.ToLower() && (exceptId == null || user.Id != exceptId), cancellationToken);
}
