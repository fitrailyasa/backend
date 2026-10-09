using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class CategoryService : ICategoryService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(Category.Id),
        ["name"] = nameof(Category.Name),
        ["slug"] = nameof(Category.Slug),
        ["created_at"] = nameof(Category.CreatedAt),
        ["updated_at"] = nameof(Category.UpdatedAt)
    };

    private readonly AppDbContext _db;

    public CategoryService(AppDbContext db) => _db = db;

    public async Task<PagedResult<CategoryDto>> ListAsync(CategoryListQuery query, CancellationToken cancellationToken)
    {
        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var includes = QuerySupport.Includes(query.Include);
        var categories = _db.Categories.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            categories = categories.Where(category => EF.Functions.Like(category.Name, pattern) || (category.Description != null && EF.Functions.Like(category.Description, pattern)));
        }

        var total = await categories.CountAsync(cancellationToken);
        IQueryable<Category> pageQuery = QuerySupport.Sort(categories, query.Sort, query.Order, SortFields);
        if (includes.Contains("products"))
        {
            pageQuery = pageQuery.Include(category => category.Products).AsSplitQuery();
        }

        var items = await pageQuery.Skip((page - 1) * limit).Take(limit).ToListAsync(cancellationToken);
        return new PagedResult<CategoryDto>
        {
            Items = items.Select(category => Mappers.Category(category, includes.Contains("products"))).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    public async Task<CategoryDto> GetAsync(long id, string? include, CancellationToken cancellationToken)
    {
        var includes = QuerySupport.Includes(include);
        IQueryable<Category> query = _db.Categories.AsNoTracking();
        if (includes.Contains("products"))
        {
            query = query.Include(category => category.Products);
        }

        var category = await query.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Category not found");
        return Mappers.Category(category, includes.Contains("products"));
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        var slug = await UniqueSlugAsync(string.IsNullOrWhiteSpace(request.Slug) ? Slugify.From(request.Name, 120) : Slugify.From(request.Slug, 120), null, cancellationToken);
        var category = new Category
        {
            Name = request.Name!.Trim(),
            Slug = slug,
            Description = Clean(request.Description)
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Category(category, false);
    }

    public async Task<CategoryDto> UpdateAsync(long id, CategoryWriteRequest request, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Category not found");

        if (request.Name is { IsNull: false, Value: { } name })
        {
            category.Name = name.Trim();
        }

        if (request.Slug is { IsNull: false, Value: { } slug })
        {
            category.Slug = await UniqueSlugAsync(Slugify.From(slug, 120), category.Id, cancellationToken);
        }

        if (request.Description is not null)
        {
            category.Description = request.Description.IsNull ? null : Clean(request.Description.Value);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Category(category, false);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var category = await _db.Categories.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Category not found");
        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> UniqueSlugAsync(string slug, long? exceptId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            throw AppException.Validation("slug", "Slug is required.");
        }

        var taken = await _db.Categories.AnyAsync(category => category.Slug == slug && (exceptId == null || category.Id != exceptId), cancellationToken);
        if (taken)
        {
            throw AppException.Conflict($"Slug \"{slug}\" has already been taken");
        }

        return slug;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
