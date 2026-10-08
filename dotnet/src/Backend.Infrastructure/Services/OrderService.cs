using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Domain.Enums;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class OrderService : IOrderService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(Order.Id),
        ["status"] = nameof(Order.Status),
        ["total"] = nameof(Order.Total),
        ["user_id"] = nameof(Order.UserId),
        ["created_at"] = nameof(Order.CreatedAt),
        ["updated_at"] = nameof(Order.UpdatedAt)
    };

    private readonly AppDbContext _db;

    public OrderService(AppDbContext db) => _db = db;

    public async Task<PagedResult<OrderDto>> ListAsync(OrderListQuery query, long userId, string role, CancellationToken cancellationToken)
    {
        if (!IsAdmin(role) && query.UserId is not null)
        {
            throw AppException.Forbidden("The user_id filter is only available to administrators");
        }

        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var includes = QuerySupport.Includes(query.Include);
        var orders = _db.Orders.AsNoTracking().AsQueryable();
        orders = IsAdmin(role)
            ? (query.UserId is long filterUser ? orders.Where(order => order.UserId == filterUser) : orders)
            : orders.Where(order => order.UserId == userId);

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = Mappers.ParseStatus(query.Status);
            orders = orders.Where(order => order.Status == status);
        }

        var total = await orders.CountAsync(cancellationToken);
        var pageQuery = ApplyIncludes(QuerySupport.Sort(orders, query.Sort, query.Order, SortFields), includes);
        var items = await pageQuery.Skip((page - 1) * limit).Take(limit).ToListAsync(cancellationToken);
        return new PagedResult<OrderDto>
        {
            Items = items.Select(order => Map(order, includes)).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    public async Task<OrderDto> GetAsync(long id, string? include, long userId, string role, CancellationToken cancellationToken)
    {
        var includes = QuerySupport.Includes(include);
        var order = await ApplyIncludes(_db.Orders.AsNoTracking().Where(candidate => candidate.Id == id), includes)
            .FirstOrDefaultAsync(cancellationToken) ?? throw AppException.NotFound("Order not found");
        EnsureOwner(order, userId, role);
        return Map(order, includes);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderRequest request, long userId, CancellationToken cancellationToken)
    {
        var lines = Merge(request.Items ?? []);
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var ids = lines.Select(line => line.ProductId).ToList();
        var products = await _db.Products.Where(product => ids.Contains(product.Id)).ToListAsync(cancellationToken);
        var byId = products.ToDictionary(product => product.Id);
        foreach (var id in ids)
        {
            if (!byId.ContainsKey(id))
            {
                throw AppException.NotFound($"Product with id {id} not found");
            }
        }

        foreach (var line in lines)
        {
            var product = byId[line.ProductId];
            if (product.Stock < line.Quantity)
            {
                throw AppException.Conflict($"Insufficient stock for product \"{product.Name}\"");
            }
        }

        var order = new Order { UserId = userId, Status = OrderStatus.Pending, Total = 0 };
        _db.Orders.Add(order);
        await _db.SaveChangesAsync(cancellationToken);

        decimal total = 0;
        foreach (var line in lines)
        {
            var product = byId[line.ProductId];
            total += product.Price * line.Quantity;
            _db.OrderItems.Add(new OrderItem
            {
                OrderId = order.Id,
                ProductId = product.Id,
                Quantity = line.Quantity,
                Price = product.Price
            });
            product.Stock -= line.Quantity;
        }

        order.Total = decimal.Round(total, 2, MidpointRounding.AwayFromZero);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var created = await _db.Orders.AsNoTracking()
            .Include(candidate => candidate.Items).ThenInclude(item => item.Product)
            .FirstAsync(candidate => candidate.Id == order.Id, cancellationToken);
        return Mappers.Order(created, true, true, false);
    }

    public async Task<OrderDto> UpdateStatusAsync(long id, string status, long userId, string role, CancellationToken cancellationToken)
    {
        if (!ApiValues.OrderStatuses.Contains(status))
        {
            throw AppException.Validation("status", $"Status must be one of: {string.Join(", ", ApiValues.OrderStatuses)}.");
        }

        var order = await _db.Orders.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Order not found");
        EnsureOwner(order, userId, role);

        var next = Mappers.ParseStatus(status);
        if (order.Status == next)
        {
            return Mappers.Order(order, false, false, false);
        }

        if (!IsAdmin(role) && !(order.Status == OrderStatus.Pending && next == OrderStatus.Cancelled))
        {
            throw AppException.Forbidden();
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (order.Status != OrderStatus.Cancelled && next == OrderStatus.Cancelled)
        {
            await AdjustStockAsync(order.Id, 1, cancellationToken);
        }
        else if (order.Status == OrderStatus.Cancelled && next != OrderStatus.Cancelled)
        {
            await AdjustStockAsync(order.Id, -1, cancellationToken);
        }

        order.Status = next;
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Mappers.Order(order, false, false, false);
    }

    public async Task DeleteAsync(long id, string role, CancellationToken cancellationToken)
    {
        if (!IsAdmin(role))
        {
            throw AppException.Forbidden();
        }

        var order = await _db.Orders.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Order not found");

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        if (order.Status != OrderStatus.Cancelled)
        {
            await AdjustStockAsync(order.Id, 1, cancellationToken);
        }

        _db.Orders.Remove(order);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task AdjustStockAsync(long orderId, int direction, CancellationToken cancellationToken)
    {
        var items = await _db.OrderItems.Where(item => item.OrderId == orderId).ToListAsync(cancellationToken);
        foreach (var item in items)
        {
            var product = await _db.Products.FirstOrDefaultAsync(candidate => candidate.Id == item.ProductId, cancellationToken);
            if (product is null)
            {
                continue;
            }

            var next = direction > 0 ? product.Stock + item.Quantity : product.Stock - item.Quantity;
            product.Stock = Math.Max(0, next);
        }
    }

    private static List<(long ProductId, int Quantity)> Merge(IReadOnlyList<OrderItemRequest> items)
    {
        var lines = new List<(long ProductId, int Quantity)>();
        var positions = new Dictionary<long, int>();
        foreach (var item in items)
        {
            if (positions.TryGetValue(item.ProductId, out var index))
            {
                var current = lines[index];
                lines[index] = (current.ProductId, current.Quantity + item.Quantity);
            }
            else
            {
                positions[item.ProductId] = lines.Count;
                lines.Add((item.ProductId, item.Quantity));
            }
        }

        return lines;
    }

    private static IQueryable<Order> ApplyIncludes(IQueryable<Order> query, HashSet<string> includes)
    {
        var items = includes.Contains("items") || includes.Contains("items.product");
        var products = includes.Contains("items.product");
        var user = includes.Contains("user");
        if (items && products)
        {
            query = query.Include(order => order.Items).ThenInclude(item => item.Product);
        }
        else if (items)
        {
            query = query.Include(order => order.Items);
        }

        if (user)
        {
            query = query.Include(order => order.User);
        }

        return items || user ? query.AsSplitQuery() : query;
    }

    private static OrderDto Map(Order order, HashSet<string> includes) =>
        Mappers.Order(
            order,
            includes.Contains("items") || includes.Contains("items.product"),
            includes.Contains("items.product"),
            includes.Contains("user"));

    private static void EnsureOwner(Order order, long userId, string role)
    {
        if (!IsAdmin(role) && order.UserId != userId)
        {
            throw AppException.Forbidden();
        }
    }

    private static bool IsAdmin(string role) => string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);
}
