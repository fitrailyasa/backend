using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class CommentService : ICommentService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(Comment.Id),
        ["body"] = nameof(Comment.Body),
        ["product_id"] = nameof(Comment.ProductId),
        ["user_id"] = nameof(Comment.UserId),
        ["created_at"] = nameof(Comment.CreatedAt),
        ["updated_at"] = nameof(Comment.UpdatedAt)
    };

    private readonly AppDbContext _db;

    public CommentService(AppDbContext db) => _db = db;

    public Task<PagedResult<CommentDto>> ListAsync(CommentListQuery query, CancellationToken cancellationToken) =>
        PageAsync(query, null, cancellationToken);

    public async Task<PagedResult<CommentDto>> ListByProductAsync(long productId, CommentListQuery query, CancellationToken cancellationToken)
    {
        if (!await _db.Products.AnyAsync(product => product.Id == productId, cancellationToken))
        {
            throw AppException.NotFound($"Product with id {productId} not found");
        }

        query.ProductId = productId;
        return await PageAsync(query, productId, cancellationToken);
    }

    public async Task<CommentDto> CreateAsync(long productId, string body, long userId, CancellationToken cancellationToken)
    {
        if (!await _db.Products.AnyAsync(product => product.Id == productId, cancellationToken))
        {
            throw AppException.NotFound($"Product with id {productId} not found");
        }

        var comment = new Comment
        {
            ProductId = productId,
            UserId = userId,
            Body = body.Trim()
        };
        _db.Comments.Add(comment);
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Comment(comment, false, false);
    }

    public async Task<CommentDto> UpdateAsync(long id, string body, long userId, string role, CancellationToken cancellationToken)
    {
        var comment = await _db.Comments.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Comment not found");
        EnsureOwner(comment, userId, role);
        comment.Body = body.Trim();
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Comment(comment, false, false);
    }

    public async Task DeleteAsync(long id, long userId, string role, CancellationToken cancellationToken)
    {
        var comment = await _db.Comments.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Comment not found");
        EnsureOwner(comment, userId, role);
        _db.Comments.Remove(comment);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<PagedResult<CommentDto>> PageAsync(CommentListQuery query, long? forcedProductId, CancellationToken cancellationToken)
    {
        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var includes = QuerySupport.Includes(query.Include);
        var comments = _db.Comments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            comments = comments.Where(comment => EF.Functions.Like(comment.Body, pattern));
        }

        var productId = forcedProductId ?? query.ProductId;
        if (productId is long selectedProduct)
        {
            comments = comments.Where(comment => comment.ProductId == selectedProduct);
        }

        if (query.UserId is long selectedUser)
        {
            comments = comments.Where(comment => comment.UserId == selectedUser);
        }

        var total = await comments.CountAsync(cancellationToken);
        IQueryable<Comment> pageQuery = QuerySupport.Sort(comments, query.Sort, query.Order, SortFields);
        if (includes.Contains("user"))
        {
            pageQuery = pageQuery.Include(comment => comment.User);
        }

        if (includes.Contains("product"))
        {
            pageQuery = pageQuery.Include(comment => comment.Product);
        }

        if (includes.Contains("user") || includes.Contains("product"))
        {
            pageQuery = pageQuery.AsSplitQuery();
        }

        var items = await pageQuery.Skip((page - 1) * limit).Take(limit).ToListAsync(cancellationToken);
        return new PagedResult<CommentDto>
        {
            Items = items.Select(comment => Mappers.Comment(comment, includes.Contains("user"), includes.Contains("product"))).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    private static void EnsureOwner(Comment comment, long userId, string role)
    {
        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase) && comment.UserId != userId)
        {
            throw AppException.Forbidden();
        }
    }
}
