using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using Backend.Application.Common;
using Backend.Application.Dtos;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.Options;

namespace Backend.Api.Http;

public sealed record SuccessBody<T>(bool Success, string Message, T? Data);

public sealed record PagedBody<T>(bool Success, string Message, IReadOnlyList<T> Data, PaginationMeta Meta);

public sealed class ErrorBody
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public IDictionary<string, string[]>? Errors { get; set; }
}

public static class ApiResults
{
    public static OkObjectResult Ok<T>(string message, T? data) =>
        new(new SuccessBody<T>(true, message, data));

    public static ObjectResult Created<T>(string message, T? data) =>
        new(new SuccessBody<T>(true, message, data)) { StatusCode = StatusCodes.Status201Created };

    public static OkObjectResult Paginated<T>(string message, IReadOnlyList<T> data, PaginationMeta meta) =>
        new(new PagedBody<T>(true, message, data, meta));
}

public static class ApiErrors
{
    public static IActionResult FromModelState(ModelStateDictionary modelState, HttpRequest? request = null)
    {
        var entries = modelState.Where(entry => entry.Value?.Errors.Count > 0).ToList();
        var bodyLevel = entries.Any(entry =>
            string.IsNullOrEmpty(entry.Key)
            || entry.Key is "$" or "request"
            || entry.Value!.Errors.Any(error => error.Exception is JsonException)
            || entry.Value!.Errors.Any(error =>
                error.ErrorMessage.Contains("JSON", StringComparison.OrdinalIgnoreCase)
                || error.ErrorMessage.Contains("request body", StringComparison.OrdinalIgnoreCase)));

        if (bodyLevel)
        {
            return new BadRequestObjectResult(new ErrorBody { Success = false, Message = "Invalid JSON payload" });
        }

        var errors = entries.ToDictionary(
            entry => ToField(entry.Key),
            entry => entry.Value!.Errors.Select(error => string.IsNullOrWhiteSpace(error.ErrorMessage) ? "The value is invalid." : error.ErrorMessage).ToArray());

        if (request is not null)
        {
            AddNonNegative(errors, request, "min_price");
            AddNonNegative(errors, request, "max_price");
        }

        return new UnprocessableEntityObjectResult(new ErrorBody
        {
            Success = false,
            Message = "Validation failed",
            Errors = errors
        });
    }

    public static async Task WriteAsync(HttpResponse response, int statusCode, string message, IDictionary<string, string[]>? errors, IServiceProvider services)
    {
        if (response.HasStarted)
        {
            return;
        }

        var json = services.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
        response.StatusCode = statusCode;
        response.ContentType = "application/json";
        var body = new ErrorBody
        {
            Success = false,
            Message = message,
            Errors = statusCode == StatusCodes.Status422UnprocessableEntity ? errors : null
        };
        await response.WriteAsync(JsonSerializer.Serialize(body, json));
    }

    private static string ToField(string key)
    {
        var leaf = key.Split('.', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? key;
        if (leaf.StartsWith("$", StringComparison.Ordinal))
        {
            leaf = leaf.TrimStart('$');
        }

        return JsonNamingPolicy.SnakeCaseLower.ConvertName(leaf);
    }

    private static void AddNonNegative(Dictionary<string, string[]> errors, HttpRequest request, string field)
    {
        if (errors.ContainsKey(field) || !request.Query.TryGetValue(field, out var raw))
        {
            return;
        }

        var text = raw.ToString().Trim();
        if (text.Length == 0)
        {
            return;
        }

        if (!decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number) || number < 0)
        {
            errors[field] = [$"{field} must be a number greater than or equal to 0."];
        }
    }
}

public static class RouteIds
{
    public static long Parse(string raw, string name = "id")
    {
        if (!long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) || id < 1)
        {
            throw AppException.Validation(name, $"{name} must be a positive integer.");
        }

        return id;
    }
}

public static class CurrentUser
{
    public static long Id(ClaimsPrincipal user)
    {
        var sub = user.FindFirst("sub")?.Value;
        if (!long.TryParse(sub, out var id))
        {
            throw AppException.Unauthorized("Token is invalid");
        }

        return id;
    }

    public static string Role(ClaimsPrincipal user) => user.FindFirst("role")?.Value ?? "user";

    public static string? Jti(ClaimsPrincipal user) => user.FindFirst("jti")?.Value;

    public static DateTimeOffset? Expires(ClaimsPrincipal user)
    {
        var exp = user.FindFirst("exp")?.Value;
        return long.TryParse(exp, out var seconds) ? DateTimeOffset.FromUnixTimeSeconds(seconds) : null;
    }
}

public sealed class ValidationFilter : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null || argument is CancellationToken || argument is JsonElement)
            {
                continue;
            }

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator)
            {
                continue;
            }

            var validationContextType = typeof(ValidationContext<>).MakeGenericType(argument.GetType());
            var validationContext = (IValidationContext)Activator.CreateInstance(validationContextType, argument)!;
            var result = await validator.ValidateAsync(validationContext);
            if (result.IsValid)
            {
                continue;
            }

            var errors = result.Errors
                .GroupBy(error => string.IsNullOrWhiteSpace(error.PropertyName) ? "_" : error.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).Distinct().ToArray());

            context.Result = new ObjectResult(new ErrorBody
            {
                Success = false,
                Message = "Validation failed",
                Errors = errors
            })
            {
                StatusCode = StatusCodes.Status422UnprocessableEntity
            };
            return;
        }

        await next();
    }
}

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AppException exception)
        {
            await ApiErrors.WriteAsync(context.Response, exception.StatusCode, exception.Message, exception.Errors, context.RequestServices);
        }
        catch (BadHttpRequestException)
        {
            await ApiErrors.WriteAsync(context.Response, StatusCodes.Status400BadRequest, "Invalid JSON payload", null, context.RequestServices);
        }
        catch (JsonException)
        {
            await ApiErrors.WriteAsync(context.Response, StatusCodes.Status400BadRequest, "Invalid JSON payload", null, context.RequestServices);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException exception)
        {
            await WriteDatabaseErrorAsync(context, exception);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await ApiErrors.WriteAsync(context.Response, StatusCodes.Status500InternalServerError, "Internal server error", null, context.RequestServices);
        }
    }

    private async Task WriteDatabaseErrorAsync(HttpContext context, Exception exception)
    {
        var text = exception.ToString();
        if (text.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase) && text.Contains("email", StringComparison.OrdinalIgnoreCase))
        {
            await ApiErrors.WriteAsync(
                context.Response,
                StatusCodes.Status422UnprocessableEntity,
                "Validation failed",
                new Dictionary<string, string[]> { ["email"] = ["The email has already been taken."] },
                context.RequestServices);
            return;
        }

        if (text.Contains("slug", StringComparison.OrdinalIgnoreCase))
        {
            await ApiErrors.WriteAsync(context.Response, StatusCodes.Status409Conflict, "The slug has already been taken", null, context.RequestServices);
            return;
        }

        if (text.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase) || text.Contains("constraint", StringComparison.OrdinalIgnoreCase))
        {
            await ApiErrors.WriteAsync(context.Response, StatusCodes.Status409Conflict, "Resource is still referenced by other records", null, context.RequestServices);
            return;
        }

        _logger.LogError(exception, "Database update failed");
        await ApiErrors.WriteAsync(context.Response, StatusCodes.Status500InternalServerError, "Internal server error", null, context.RequestServices);
    }
}

public sealed class RateLimitMiddleware
{
    private static readonly object Gate = new();
    private static readonly Dictionary<string, (int Count, long Started)> Hits = new();
    private readonly RequestDelegate _next;
    private readonly int _limit;
    private readonly TimeSpan _window;

    public RateLimitMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _limit = configuration.GetValue("RateLimit:PermitLimit", 100);
        _window = TimeSpan.FromSeconds(configuration.GetValue("RateLimit:WindowSeconds", 900));
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_limit <= 0 || !IsAuthWrite(context.Request))
        {
            await _next(context);
            return;
        }

        var key = $"{context.Connection.RemoteIpAddress}:{context.Request.Path}";
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        int remaining;
        long reset;
        bool allowed;
        lock (Gate)
        {
            if (!Hits.TryGetValue(key, out var entry) || now - entry.Started >= _window.TotalMilliseconds)
            {
                entry = (1, now);
            }
            else
            {
                entry = (entry.Count + 1, entry.Started);
            }

            Hits[key] = entry;
            remaining = Math.Max(0, _limit - entry.Count);
            reset = entry.Started + (long)_window.TotalMilliseconds;
            allowed = entry.Count <= _limit;
            if (Hits.Count > 5000)
            {
                var expired = Hits.Where(pair => now - pair.Value.Started >= _window.TotalMilliseconds).Select(pair => pair.Key).ToList();
                foreach (var expiredKey in expired)
                {
                    Hits.Remove(expiredKey);
                }
            }
        }

        context.Response.Headers["X-RateLimit-Limit"] = _limit.ToString();
        context.Response.Headers["X-RateLimit-Remaining"] = remaining.ToString();
        context.Response.Headers["X-RateLimit-Reset"] = (reset / 1000).ToString();
        if (!allowed)
        {
            var retryAfter = Math.Max(1, (int)Math.Ceiling((reset - now) / 1000d));
            context.Response.Headers["Retry-After"] = retryAfter.ToString();
            throw AppException.TooManyRequests();
        }

        await _next(context);
    }

    private static bool IsAuthWrite(HttpRequest request)
    {
        if (!HttpMethods.IsPost(request.Method))
        {
            return false;
        }

        var path = request.Path.Value ?? string.Empty;
        return path.Equals("/api/v1/auth/register", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/auth/login", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/v1/auth/refresh", StringComparison.OrdinalIgnoreCase);
    }
}

public static class DotEnv
{
    public static void Load(ConfigurationManager configuration, string contentRoot)
    {
        DirectoryInfo? directory = new(contentRoot);
        string? file = null;
        for (var depth = 0; depth < 4 && directory is not null; depth++)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                file = candidate;
                break;
            }

            directory = directory.Parent;
        }

        if (file is null)
        {
            return;
        }

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in File.ReadAllLines(file))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var split = line.IndexOf('=');
            if (split <= 0)
            {
                continue;
            }

            values[line[..split].Trim()] = line[(split + 1)..].Trim().Trim('"');
        }

        if (values.Keys.Any(key => key.StartsWith("DB_", StringComparison.OrdinalIgnoreCase)))
        {
            values.TryGetValue("DB_HOST", out var host);
            values.TryGetValue("DB_PORT", out var port);
            values.TryGetValue("DB_NAME", out var name);
            values.TryGetValue("DB_USER", out var user);
            values.TryGetValue("DB_PASSWORD", out var password);
            configuration["ConnectionStrings:Default"] =
                $"Server={host ?? "127.0.0.1"};Port={port ?? "3306"};Database={name ?? "backend_starter"};User={user ?? "root"};Password={password ?? string.Empty};";
        }

        void Set(string target, string key)
        {
            if (values.TryGetValue(key, out var value) && value.Length > 0)
            {
                configuration[target] = value;
            }
        }

        Set("Jwt:Secret", "JWT_SECRET");
        Set("Jwt:AccessSecret", "JWT_ACCESS_SECRET");
        Set("Jwt:RefreshSecret", "JWT_REFRESH_SECRET");
        Set("Jwt:ExpiresIn", "JWT_EXPIRES_IN");
        Set("Jwt:RefreshExpiresIn", "JWT_REFRESH_EXPIRES_IN");
        Set("Jwt:Issuer", "JWT_ISSUER");
        Set("Jwt:Audience", "JWT_AUDIENCE");
        if (values.TryGetValue("SEED_ENABLED", out var seed))
        {
            configuration["Seed:Enabled"] = seed;
        }
    }
}
