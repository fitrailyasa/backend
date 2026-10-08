using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = "change-me-to-a-long-random-string-at-least-32-chars";
    public string? AccessSecret { get; set; }
    public string? RefreshSecret { get; set; }
    public int ExpiresIn { get; set; } = 3600;
    public int RefreshExpiresIn { get; set; } = 604800;
    public string Issuer { get; set; } = "backend-starter-dotnet";
    public string Audience { get; set; } = "backend-starter-clients";

    public string AccessKey => string.IsNullOrWhiteSpace(AccessSecret) ? Secret : AccessSecret;
    public string RefreshKey => string.IsNullOrWhiteSpace(RefreshSecret) ? Secret : RefreshSecret;
}

public sealed class BcryptPasswordHasher : IPasswordHasher
{
    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);

    public bool Verify(string password, string passwordHash)
    {
        if (string.IsNullOrEmpty(passwordHash)) return false;
        var stored = passwordHash.StartsWith("bcrypt$", StringComparison.Ordinal) ? passwordHash["bcrypt$".Length..] : passwordHash;
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, stored);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            return false;
        }
    }
}

public sealed class MemoryTokenBlacklist : ITokenBlacklist
{
    private readonly IMemoryCache _cache;

    public MemoryTokenBlacklist(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void Revoke(string jti, DateTimeOffset expiresAt)
    {
        var ttl = expiresAt - DateTimeOffset.UtcNow;
        if (ttl <= TimeSpan.Zero)
        {
            ttl = TimeSpan.FromSeconds(1);
        }

        _cache.Set("revoked:" + jti, true, ttl);
    }

    public bool IsRevoked(string jti) => _cache.TryGetValue("revoked:" + jti, out _);
}

public sealed class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;

    static JwtTokenService()
    {
        JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
        JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();
    }

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public (string Token, string RefreshToken, int ExpiresIn) IssuePair(long userId, string role)
    {
        var access = Sign(userId, role, "access", _options.AccessKey, _options.ExpiresIn);
        var refresh = Sign(userId, role, "refresh", _options.RefreshKey, _options.RefreshExpiresIn);
        return (access, refresh, _options.ExpiresIn);
    }

    public string? ReadTokenType(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        if (!handler.CanReadToken(token))
        {
            return null;
        }

        var jwt = handler.ReadJwtToken(token);
        return jwt.Claims.FirstOrDefault(claim => claim.Type == "typ")?.Value;
    }

    public AccessPrincipal ValidateRefreshToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _options.Issuer,
            ValidateAudience = true,
            ValidAudience = _options.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = Key(_options.RefreshKey),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Sub,
            RoleClaimType = "role"
        };

        try
        {
            var principal = handler.ValidateToken(token, parameters, out var validated);
            var jwt = (JwtSecurityToken)validated;
            var type = principal.FindFirst("typ")?.Value;
            if (type != "refresh")
            {
                throw AppException.Unauthorized("Token is invalid");
            }

            var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? principal.FindFirst("sub")?.Value;
            if (!long.TryParse(sub, out var userId))
            {
                throw AppException.Unauthorized("Token is invalid");
            }

            var role = principal.FindFirst("role")?.Value ?? "user";
            var jti = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value ?? principal.FindFirst("jti")?.Value ?? string.Empty;
            var expires = jwt.ValidTo == DateTime.MinValue ? DateTimeOffset.UtcNow.AddSeconds(_options.RefreshExpiresIn) : new DateTimeOffset(DateTime.SpecifyKind(jwt.ValidTo, DateTimeKind.Utc));
            return new AccessPrincipal(userId, role, jti, expires);
        }
        catch (AppException)
        {
            throw;
        }
        catch (SecurityTokenExpiredException)
        {
            throw AppException.Unauthorized("Token has expired");
        }
        catch (Exception)
        {
            throw AppException.Unauthorized("Token is invalid");
        }
    }

    private string Sign(long userId, string role, string type, string secret, int lifetimeSeconds)
    {
        var now = DateTime.UtcNow;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new("role", role),
            new("typ", type),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64)
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: now.AddSeconds(lifetimeSeconds),
            signingCredentials: new SigningCredentials(Key(secret), SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static SymmetricSecurityKey Key(string secret) => new(Encoding.UTF8.GetBytes(secret));
}
