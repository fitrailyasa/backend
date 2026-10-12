using Backend.Api.Http;
using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController : ControllerBase
{
    private const string LockoutMessage = "Too many failed login attempts. Please try again later.";

    private readonly IAuthService _auth;
    private readonly IJwtTokenService _jwt;
    private readonly ILoginAttemptService _loginAttempts;

    public AuthController(IAuthService auth, IJwtTokenService jwt, ILoginAttemptService loginAttempts)
    {
        _auth = auth;
        _jwt = jwt;
        _loginAttempts = loginAttempts;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _auth.RegisterAsync(request, cancellationToken);
        return ApiResults.Created("User registered successfully", result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var email = (request.Email ?? string.Empty).Trim().ToLowerInvariant();
        var clientIp = ClientIp();

        // Check the lockout before touching the password hash.
        var retryAfter = _loginAttempts.RetryAfter(email, clientIp);
        if (retryAfter > 0)
        {
            Response.Headers["Retry-After"] = retryAfter.ToString();
            throw AppException.TooManyRequests(LockoutMessage);
        }

        try
        {
            var result = await _auth.LoginAsync(request, cancellationToken);
            _loginAttempts.Reset(email);
            return ApiResults.Ok("Login successful", result);
        }
        catch (AppException exception) when (exception.StatusCode == StatusCodes.Status401Unauthorized)
        {
            // Only failed credential checks count (unknown email and wrong password alike).
            _loginAttempts.RecordFailure(email, clientIp);
            throw;
        }
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
    {
        string? token = null;
        var header = Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var bearer = header["Bearer ".Length..].Trim();
            if (_jwt.ReadTokenType(bearer) == "refresh")
            {
                token = bearer;
            }
        }

        token ??= request?.RefreshToken;
        token ??= request?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw AppException.Unauthorized("Refresh token is missing");
        }

        var result = await _auth.RefreshAsync(token, cancellationToken);
        return ApiResults.Ok("Token refreshed successfully", result);
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await _auth.LogoutAsync(CurrentUser.Jti(User), CurrentUser.Expires(User), cancellationToken);
        return ApiResults.Ok<string?>("Logged out successfully", null);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var user = await _auth.MeAsync(CurrentUser.Id(User), cancellationToken);
        return ApiResults.Ok("Authenticated user retrieved", user);
    }

    private string ClientIp() => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
