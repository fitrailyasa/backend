using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Api.Http;
using Backend.Application;
using Backend.Application.Abstractions;
using Backend.Infrastructure;
using Backend.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
JwtSecurityTokenHandler.DefaultOutboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);
DotEnv.Load(builder.Configuration, builder.Environment.ContentRootPath);
if (!builder.Environment.IsEnvironment("Testing"))
{
    builder.WebHost.UseUrls(builder.Configuration["Urls"] ?? "http://localhost:5080");
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers(options => options.Filters.Add(typeof(ValidationFilter)))
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new MoneyConverter());
    });

builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context => ApiErrors.FromModelState(context.ModelState, context.HttpContext.Request);
});

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = string.IsNullOrWhiteSpace(jwt.Issuer) ? "backend-starter-dotnet" : jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = string.IsNullOrWhiteSpace(jwt.Audience) ? "backend-starter-clients" : jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(string.IsNullOrWhiteSpace(jwt.AccessKey) ? "change-me-to-a-long-random-string-at-least-32-chars" : jwt.AccessKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "sub",
            RoleClaimType = "role"
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var type = context.Principal?.FindFirst("typ")?.Value;
                if (type != "access")
                {
                    context.Fail(new SecurityTokenException("Token is invalid"));
                    return Task.CompletedTask;
                }

                var jti = context.Principal?.FindFirst("jti")?.Value;
                var blacklist = context.HttpContext.RequestServices.GetRequiredService<ITokenBlacklist>();
                if (!string.IsNullOrWhiteSpace(jti) && blacklist.IsRevoked(jti))
                {
                    context.Fail(new SecurityTokenException("Token has been revoked"));
                }

                return Task.CompletedTask;
            },
            OnChallenge = async context =>
            {
                context.HandleResponse();
                if (context.Response.HasStarted)
                {
                    return;
                }

                var message = "Authentication token is missing";
                if (context.AuthenticateFailure is SecurityTokenExpiredException)
                {
                    message = "Token has expired";
                }
                else if (context.AuthenticateFailure is not null)
                {
                    message = context.AuthenticateFailure.Message.Contains("revoked", StringComparison.OrdinalIgnoreCase)
                        ? "Token has been revoked"
                        : "Token is invalid";
                }

                await ApiErrors.WriteAsync(context.Response, StatusCodes.Status401Unauthorized, message, null, context.HttpContext.RequestServices);
            },
            OnForbidden = async context =>
            {
                await ApiErrors.WriteAsync(context.Response, StatusCodes.Status403Forbidden, "This action is unauthorized", null, context.HttpContext.RequestServices);
            }
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (string.Equals(app.Configuration["Database:Provider"], "Sqlite", StringComparison.OrdinalIgnoreCase))
{
    using var schemaScope = app.Services.CreateScope();
    var db = schemaScope.ServiceProvider.GetRequiredService<Backend.Infrastructure.Persistence.AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}

if (args.Any(arg => arg.Equals("seed", StringComparison.OrdinalIgnoreCase) || arg.Equals("--seed", StringComparison.OrdinalIgnoreCase)))
{
    using var scope = app.Services.CreateScope();
    var summary = await scope.ServiceProvider.GetRequiredService<IDemoSeeder>().SeedAsync();
    Console.WriteLine(summary.Skipped
        ? "[seed] admin already exists, skipped"
        : $"[seed] demo data created: users={summary.Users}, categories={summary.Categories}, products={summary.Products}, tags={summary.Tags}, orders={summary.Orders}, comments={summary.Comments}");
    Console.WriteLine("[seed] admin login -> admin@example.com / password");
    return;
}

if (app.Configuration.GetValue<bool>("Seed:Enabled"))
{
    using var scope = app.Services.CreateScope();
    var summary = await scope.ServiceProvider.GetRequiredService<IDemoSeeder>().SeedAsync();
    Console.WriteLine(summary.Skipped ? "[seed] admin already exists, skipped" : "[seed] demo data created");
}

if (!app.Environment.IsEnvironment("Testing"))
{
    app.MapGet("/api/v1/docs.json", () => Results.File(
        Path.Combine(app.Environment.ContentRootPath, "openapi.json"),
        "application/json"));
    app.UseSwaggerUI(options =>
    {
        options.RoutePrefix = "api/v1/docs";
        options.DocumentTitle = "Backend Starter Kit API - .NET";
        options.SwaggerEndpoint("/api/v1/docs.json", "Backend Starter Kit API - .NET");
        options.EnablePersistAuthorization();
        options.EnableDeepLinking();
        options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
    });
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<RateLimitMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallback(async context =>
{
    await ApiErrors.WriteAsync(
        context.Response,
        StatusCodes.Status404NotFound,
        $"Route {context.Request.Method} {context.Request.Path} not found",
        null,
        context.RequestServices);
});

app.Run();

public partial class Program
{
}
