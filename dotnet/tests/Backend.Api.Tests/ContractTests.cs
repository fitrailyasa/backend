using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Application.Abstractions;
using Backend.Domain.Entities;
using Backend.Domain.Enums;
using Backend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");
    private bool _ready;

    public ApiFactory()
    {
        _connection.Open();
        using var command = _connection.CreateCommand();
        command.CommandText = "PRAGMA foreign_keys = ON;";
        command.ExecuteNonQuery();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services => services.AddSingleton(_connection));
    }

    public HttpClient CreateReadyClient()
    {
        var client = CreateClient();
        if (!_ready)
        {
            using var scope = Services.CreateScope();
            var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            database.Database.EnsureCreated();
            _ready = true;
        }

        return client;
    }
}

public sealed class ContractTests : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private readonly ApiFactory _factory;
    private readonly HttpClient _client;

    public ContractTests(ApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateReadyClient();
    }

    [Fact]
    public async Task Health_returns_status_without_envelope()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.Equal("ok", body.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Number, body.GetProperty("uptime").ValueKind);
        Assert.Equal(JsonValueKind.String, body.GetProperty("timestamp").ValueKind);
        Assert.False(body.TryGetProperty("success", out _));
    }

    [Fact]
    public async Task Register_returns_token_and_hides_password()
    {
        var response = await RegisterAsync($"reg-{Guid.NewGuid():N}@example.com");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.True(body.GetProperty("success").GetBoolean());
        var data = body.GetProperty("data");
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("token").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(data.GetProperty("refresh_token").GetString()));
        Assert.Equal("Bearer", data.GetProperty("token_type").GetString());
        Assert.Equal(3600, data.GetProperty("expires_in").GetInt32());
        Assert.Equal(JsonValueKind.Object, data.GetProperty("user").ValueKind);
        AssertNoPassword(body);
    }

    [Fact]
    public async Task Duplicate_email_returns_422()
    {
        var email = $"dup-{Guid.NewGuid():N}@example.com";
        var first = await RegisterAsync(email);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await RegisterAsync(email);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, second.StatusCode);
        var body = await ReadAsync(second);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal("Validation failed", body.GetProperty("message").GetString());
        Assert.Equal("The email has already been taken.", body.GetProperty("errors").GetProperty("email")[0].GetString());
    }

    [Fact]
    public async Task Login_and_me_return_the_authenticated_user()
    {
        var email = $"me-{Guid.NewGuid():N}@example.com";
        Assert.Equal(HttpStatusCode.Created, (await RegisterAsync(email)).StatusCode);

        var login = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "password123" }, Json);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var loginBody = await ReadAsync(login);
        var token = loginBody.GetProperty("data").GetProperty("token").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        AssertNoPassword(loginBody);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var me = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var meBody = await ReadAsync(me);
        Assert.Equal(email, meBody.GetProperty("data").GetProperty("email").GetString());
        AssertNoPassword(meBody);

        var profileRequest = new HttpRequestMessage(HttpMethod.Get, "/api/v1/users/me");
        profileRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var profile = await _client.SendAsync(profileRequest);
        Assert.Equal(HttpStatusCode.OK, profile.StatusCode);
        Assert.Equal(email, (await ReadAsync(profile)).GetProperty("data").GetProperty("email").GetString());
    }

    [Fact]
    public async Task Non_admin_cannot_create_a_category()
    {
        var email = $"cat-{Guid.NewGuid():N}@example.com";
        var registered = await ReadAsync(await RegisterAsync(email));
        var token = registered.GetProperty("data").GetProperty("token").GetString();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/categories")
        {
            Content = JsonContent.Create(new { name = "Electronics" }, options: Json)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await ReadAsync(response);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.False(body.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Create_order_computes_total_drops_stock_and_owner_cannot_mark_paid()
    {
        var adminEmail = $"admin-{Guid.NewGuid():N}@example.com";
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            database.Users.Add(new User
            {
                Name = "Order Admin",
                Email = adminEmail,
                Password = hasher.Hash("password123"),
                Role = UserRole.Admin
            });
            await database.SaveChangesAsync();
        }

        var adminToken = await LoginAsync(adminEmail);
        var category = await SendAsync(HttpMethod.Post, "/api/v1/categories", adminToken, new { name = $"Cat {Guid.NewGuid():N}" });
        Assert.Equal(HttpStatusCode.Created, category.StatusCode);
        var categoryId = (await ReadAsync(category)).GetProperty("data").GetProperty("id").GetInt64();

        var product = await SendAsync(HttpMethod.Post, "/api/v1/products", adminToken, new
        {
            category_id = categoryId,
            name = $"Widget {Guid.NewGuid():N}",
            price = 2500.50m,
            stock = 10
        });
        Assert.Equal(HttpStatusCode.Created, product.StatusCode);
        var productId = (await ReadAsync(product)).GetProperty("data").GetProperty("id").GetInt64();

        var buyerEmail = $"buyer-{Guid.NewGuid():N}@example.com";
        Assert.Equal(HttpStatusCode.Created, (await RegisterAsync(buyerEmail)).StatusCode);
        var buyerToken = await LoginAsync(buyerEmail);

        var order = await SendAsync(HttpMethod.Post, "/api/v1/orders", buyerToken, new
        {
            items = new[] { new { product_id = productId, quantity = 2 } }
        });
        Assert.Equal(HttpStatusCode.Created, order.StatusCode);
        var orderBody = await ReadAsync(order);
        Assert.Equal(5001.00m, orderBody.GetProperty("data").GetProperty("total").GetDecimal());
        var orderId = orderBody.GetProperty("data").GetProperty("id").GetInt64();

        var loaded = await _client.GetAsync($"/api/v1/products/{productId}");
        Assert.Equal(HttpStatusCode.OK, loaded.StatusCode);
        Assert.Equal(8, (await ReadAsync(loaded)).GetProperty("data").GetProperty("stock").GetInt32());

        var paid = await SendAsync(HttpMethod.Patch, $"/api/v1/orders/{orderId}/status", buyerToken, new { status = "paid" });
        Assert.Equal(HttpStatusCode.Forbidden, paid.StatusCode);
        var paidBody = await ReadAsync(paid);
        Assert.False(paidBody.GetProperty("success").GetBoolean());
        Assert.False(paidBody.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Register_list_query_and_category_writes_are_validated()
    {
        var invalid = await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            name = "A",
            email = "bad",
            password = "short",
            password_confirmation = "nope"
        }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, invalid.StatusCode);
        var invalidBody = await ReadAsync(invalid);
        foreach (var field in new[] { "name", "email", "password", "password_confirmation" })
        {
            Assert.Equal(JsonValueKind.Array, invalidBody.GetProperty("errors").GetProperty(field).ValueKind);
        }

        var listed = await _client.GetAsync("/api/v1/categories?page=0&limit=0&sort=nope&order=sideways&include=nope");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, listed.StatusCode);
        var listedErrors = (await ReadAsync(listed)).GetProperty("errors");
        foreach (var field in new[] { "page", "limit", "sort", "order", "include" })
        {
            Assert.Equal(JsonValueKind.Array, listedErrors.GetProperty(field).ValueKind);
        }

        var anonymous = await _client.PostAsJsonAsync("/api/v1/categories", new { name = "Valid Name" }, Json);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        var adminEmail = $"admin-{Guid.NewGuid():N}@example.com";
        using (var scope = _factory.Services.CreateScope())
        {
            var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            database.Users.Add(new User
            {
                Name = "Query Admin",
                Email = adminEmail,
                Password = hasher.Hash("password123"),
                Role = UserRole.Admin
            });
            await database.SaveChangesAsync();
        }

        var token = await LoginAsync(adminEmail);
        var rejected = await SendAsync(HttpMethod.Post, "/api/v1/categories", token, new { name = "X", slug = "Bad Slug" });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, rejected.StatusCode);
        var rejectedErrors = (await ReadAsync(rejected)).GetProperty("errors");
        Assert.Equal(JsonValueKind.Array, rejectedErrors.GetProperty("name").ValueKind);
        Assert.Equal(JsonValueKind.Array, rejectedErrors.GetProperty("slug").ValueKind);

        var created = await SendAsync(HttpMethod.Post, "/api/v1/categories", token, new { name = "Valid Category Name" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal("valid-category-name", (await ReadAsync(created)).GetProperty("data").GetProperty("slug").GetString());
    }

    private async Task<HttpResponseMessage> RegisterAsync(string email) =>
        await _client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            name = "Test User",
            email,
            password = "password123",
            password_confirmation = "password123"
        }, Json);

    private async Task<string> LoginAsync(string email)
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "password123" }, Json);
        response.EnsureSuccessStatusCode();
        return (await ReadAsync(response)).GetProperty("data").GetProperty("token").GetString()!;
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, string token, object payload)
    {
        var request = new HttpRequestMessage(method, url)
        {
            Content = JsonContent.Create(payload, options: Json)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await _client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response)
    {
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var document = await JsonDocument.ParseAsync(stream);
        return document.RootElement.Clone();
    }

    private static void AssertNoPassword(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    Assert.NotEqual("password", property.Name);
                    AssertNoPassword(property.Value);
                }
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    AssertNoPassword(item);
                }
                break;
        }
    }
}
