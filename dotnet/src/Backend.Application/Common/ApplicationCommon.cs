using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Application.Common;

public sealed class AppException : Exception
{
    public int StatusCode { get; }
    public IDictionary<string, string[]>? Errors { get; }

    public AppException(int statusCode, string message, IDictionary<string, string[]>? errors = null)
        : base(message)
    {
        StatusCode = statusCode;
        Errors = errors;
    }

    public static AppException Validation(IDictionary<string, string[]> errors) =>
        new(422, "Validation failed", errors);

    public static AppException Validation(string field, string message) =>
        Validation(new Dictionary<string, string[]> { [field] = [message] });

    public static AppException BadRequest(string message = "Bad request") => new(400, message);
    public static AppException Unauthorized(string message = "Unauthenticated") => new(401, message);
    public static AppException Forbidden(string message = "This action is unauthorized") => new(403, message);
    public static AppException NotFound(string message = "Resource not found") => new(404, message);
    public static AppException Conflict(string message = "Resource already exists") => new(409, message);
    public static AppException TooManyRequests(string message = "Too many requests, please try again later") => new(429, message);
}

public sealed class Provided<T>
{
    public Provided(T? value, bool isNull)
    {
        Value = value;
        IsNull = isNull;
    }

    public T? Value { get; }
    public bool IsNull { get; }
}

public sealed record PaginationMeta(int Page, int Limit, int Total, int TotalPages);

public sealed class PagedResult<T>
{
    public required IReadOnlyList<T> Items { get; init; }
    public required PaginationMeta Meta { get; init; }
}

public static class ApiValues
{
    public static readonly string[] Roles = ["user", "admin"];
    public static readonly string[] OrderStatuses = ["pending", "paid", "shipped", "completed", "cancelled"];
}

public static class Slugify
{
    public static string From(string? value, int maxLength = 120)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var decomposed = value.Normalize(NormalizationForm.FormD);
        var buffer = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            buffer.Append(character);
        }

        var lower = buffer.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant().Trim();
        lower = Regex.Replace(lower, "['\"`]", string.Empty);
        lower = Regex.Replace(lower, "[^a-z0-9]+", "-");
        lower = Regex.Replace(lower, "^-+|-+$", string.Empty);
        lower = Regex.Replace(lower, "-{2,}", "-");
        if (maxLength > 0 && lower.Length > maxLength)
        {
            lower = lower[..maxLength].Trim('-');
        }

        return lower;
    }
}

public static class PageLimits
{
    public const int DefaultPage = 1;
    public const int DefaultLimit = 10;
    public const int MaxLimit = 100;

    public static (int Page, int Limit) Normalize(int? page, int? limit)
    {
        var resolvedPage = page is null or < 1 ? DefaultPage : page.Value;
        var resolvedLimit = limit ?? DefaultLimit;
        if (resolvedLimit < 1)
        {
            resolvedLimit = DefaultLimit;
        }

        if (resolvedLimit > MaxLimit)
        {
            resolvedLimit = MaxLimit;
        }

        return (resolvedPage, resolvedLimit);
    }

    public static PaginationMeta Meta(int total, int page, int limit)
    {
        var pages = limit > 0 ? (int)Math.Ceiling(total / (double)limit) : 0;
        return new PaginationMeta(page, limit, total, pages);
    }
}
