using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Api.Tests;

public sealed class SecurityHardeningTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private readonly HttpClient _client;

    public SecurityHardeningTests(ApiFactory factory)
    {
        _client = factory.CreateReadyClient();
    }

    [Fact]
    public async Task Responses_carry_security_headers_without_fingerprints()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertHeader(response, "X-Content-Type-Options", "nosniff");
        AssertHeader(response, "X-Frame-Options", "DENY");
        AssertHeader(response, "Referrer-Policy", "no-referrer");
        AssertHeader(response, "Cross-Origin-Opener-Policy", "same-origin");
        AssertHeader(response, "Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        AssertHeader(response, "Content-Security-Policy", "default-src 'none'");
        Assert.False(response.Headers.Contains("Server"));
        Assert.False(response.Headers.Contains("X-Powered-By"));
        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task Oversize_body_returns_413_with_the_error_envelope()
    {
        var password = new string('a', 200_000);
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            name = "Big Payload",
            email = $"big-{Guid.NewGuid():N}@example.com",
            password,
            password_confirmation = password
        }, Json);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);

        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        var body = document.RootElement;
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("Request body too large", body.GetProperty("message").GetString());
        Assert.False(body.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Cors_never_reflects_an_origin_outside_the_allowlist()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/categories");
        request.Headers.Add("Origin", "https://evil.example");
        var response = await _client.SendAsync(request);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Contains("Origin", SplitVary(response), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cors_allows_a_configured_origin_and_varies_on_origin()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/categories");
        request.Headers.Add("Origin", "http://localhost:5173");
        var response = await _client.SendAsync(request);
        Assert.Equal("http://localhost:5173", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").Single());
        Assert.Contains("Origin", SplitVary(response), StringComparer.OrdinalIgnoreCase);
    }

    private static IEnumerable<string> SplitVary(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Vary", out var values)
            ? values.SelectMany(value => value.Split(',')).Select(value => value.Trim())
            : [];

    private static void AssertHeader(HttpResponseMessage response, string name, string expected)
    {
        Assert.True(response.Headers.TryGetValues(name, out var values), $"{name} header is missing");
        Assert.Equal(expected, values.FirstOrDefault());
    }
}
