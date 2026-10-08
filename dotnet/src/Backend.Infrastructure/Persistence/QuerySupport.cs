using System.Linq.Expressions;

namespace Backend.Infrastructure.Persistence;

internal static class QuerySupport
{
    public static HashSet<string> Includes(string? include)
    {
        if (string.IsNullOrWhiteSpace(include))
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        return include
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public static IQueryable<T> Sort<T>(IQueryable<T> query, string? sort, string? order, IReadOnlyDictionary<string, string> fields)
    {
        var requested = string.IsNullOrWhiteSpace(sort) ? "id" : sort.Trim();
        if (!fields.TryGetValue(requested, out var propertyName))
        {
            propertyName = fields.TryGetValue("id", out var idProperty) ? idProperty : fields.Values.First();
        }

        var descending = !string.Equals(order?.Trim(), "asc", StringComparison.OrdinalIgnoreCase);
        var parameter = Expression.Parameter(typeof(T), "entity");
        var member = Expression.Property(parameter, propertyName);
        var lambda = Expression.Lambda(member, parameter);
        var method = descending ? nameof(Queryable.OrderByDescending) : nameof(Queryable.OrderBy);
        var call = Expression.Call(
            typeof(Queryable),
            method,
            [typeof(T), member.Type],
            query.Expression,
            Expression.Quote(lambda));
        return query.Provider.CreateQuery<T>(call);
    }
}
