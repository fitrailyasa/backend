using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Api.Tests;

public sealed class LoginRateLimitTests : IClassFixture<ApiFactory>
{
    private const string LockoutMessage = "Too many failed login attempts. Please try again later.";

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private readonly HttpClient _client;

    public LoginRateLimitTests(ApiFactory factory)
    {
        _client = factory.CreateReadyClient();
        // Counters are shared per host, so start every test from a clean slate.
        using var scope = factory.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<ILoginAttemptService>().Reset();
    }

    [Fact]
    public async Task Three_failures_return_401_and_the_fourth_returns_429()
    {
        var email = $"lock-{Guid.NewGuid():N}@example.com";
        await RegisterAsync(email);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            var failed = await LoginAsync(email, "wrong-password");
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
            var failedBody = await ReadAsync(failed);
            Assert.False(failedBody.GetProperty("success").GetBoolean());
        }

        var locked = await LoginAsync(email, "wrong-password");
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        AssertRetryAfter(locked);
        var body = await ReadAsync(locked);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(LockoutMessage, body.GetProperty("message").GetString());
        Assert.False(body.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Correct_password_also_returns_429_while_locked()
    {
        var email = $"correct-{Guid.NewGuid():N}@example.com";
        await RegisterAsync(email);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "wrong-password")).StatusCode);
        }

        var locked = await LoginAsync(email, "password123");
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        AssertRetryAfter(locked);
        var body = await ReadAsync(locked);
        Assert.Equal(LockoutMessage, body.GetProperty("message").GetString());
        Assert.False(body.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Unknown_email_failures_count_toward_the_counter()
    {
        var email = $"ghost-{Guid.NewGuid():N}@example.com";

        for (var attempt = 0; attempt < 3; attempt++)
        {
            var failed = await LoginAsync(email, "wrong-password");
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        }

        var locked = await LoginAsync(email, "wrong-password");
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        AssertRetryAfter(locked);
        var body = await ReadAsync(locked);
        Assert.Equal(LockoutMessage, body.GetProperty("message").GetString());
        Assert.False(body.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Successful_login_resets_the_counter()
    {
        var email = $"reset-{Guid.NewGuid():N}@example.com";
        await RegisterAsync(email);

        // Two failures leave room for a successful login, which clears the counter.
        for (var attempt = 0; attempt < 2; attempt++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "wrong-password")).StatusCode);
        }

        var success = await LoginAsync(email, "password123");
        Assert.Equal(HttpStatusCode.OK, success.StatusCode);

        // The counter restarted from zero: three failures are still allowed.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var failed = await LoginAsync(email, "wrong-password");
            Assert.Equal(HttpStatusCode.Unauthorized, failed.StatusCode);
        }

        var locked = await LoginAsync(email, "wrong-password");
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        AssertRetryAfter(locked);
    }

    [Fact]
    public async Task Lockout_is_scoped_to_the_email()
    {
        var lockedEmail = $"alpha-{Guid.NewGuid():N}@example.com";
        var otherEmail = $"beta-{Guid.NewGuid():N}@example.com";
        await RegisterAsync(lockedEmail);
        await RegisterAsync(otherEmail);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(lockedEmail, "wrong-password")).StatusCode);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(lockedEmail, "wrong-password")).StatusCode);

        var other = await LoginAsync(otherEmail, "wrong-password");
        Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
        var otherSuccess = await LoginAsync(otherEmail, "password123");
        Assert.Equal(HttpStatusCode.OK, otherSuccess.StatusCode);
    }

    [Fact]
    public async Task Lockout_counter_is_keyed_on_normalized_email()
    {
        var email = $"norm-{Guid.NewGuid():N}@Example.COM";
        await RegisterAsync(email);

        for (var attempt = 0; attempt < 3; attempt++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email.ToUpperInvariant(), "wrong-password")).StatusCode);
        }

        var locked = await LoginAsync(email, "password123");
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        AssertRetryAfter(locked);
    }

    private async Task<HttpResponseMessage> RegisterAsync(string email) =>
        await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            name = "Lockout User",
            email,
            password = "password123",
            password_confirmation = "password123"
        }, Json);

    private Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password }, Json);

    private static void AssertRetryAfter(HttpResponseMessage response)
    {
        Assert.True(response.Headers.TryGetValues("Retry-After", out var values), "Retry-After header is missing");
        var raw = values.FirstOrDefault();
        Assert.True(int.TryParse(raw, out var seconds), $"Retry-After was '{raw}'");
        Assert.True(seconds >= 1, $"Retry-After was {seconds}, expected >= 1");
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        return document.RootElement.Clone();
    }
}
