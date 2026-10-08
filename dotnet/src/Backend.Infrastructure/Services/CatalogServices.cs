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

public sealed class TagService : ITagService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(Tag.Id),
        ["name"] = nameof(Tag.Name),
        ["slug"] = nameof(Tag.Slug),
        ["created_at"] = nameof(Tag.CreatedAt),
        ["updated_at"] = nameof(Tag.UpdatedAt)
    };

    private readonly AppDbContext _db;

    public TagService(AppDbContext db) => _db = db;

    public async Task<PagedResult<TagDto>> ListAsync(TagListQuery query, CancellationToken cancellationToken)
    {
        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var includes = QuerySupport.Includes(query.Include);
        var tags = _db.Tags.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            tags = tags.Where(tag => EF.Functions.Like(tag.Name, pattern));
        }

        var total = await tags.CountAsync(cancellationToken);
        IQueryable<Tag> pageQuery = QuerySupport.Sort(tags, query.Sort, query.Order, SortFields);
        if (includes.Contains("products"))
        {
            pageQuery = pageQuery.Include(tag => tag.Products).AsSplitQuery();
        }

        var items = await pageQuery.Skip((page - 1) * limit).Take(limit).ToListAsync(cancellationToken);
        return new PagedResult<TagDto>
        {
            Items = items.Select(tag => Mappers.Tag(tag, includes.Contains("products"))).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    public async Task<TagDto> GetAsync(long id, string? include, CancellationToken cancellationToken)
    {
        var includes = QuerySupport.Includes(include);
        IQueryable<Tag> query = _db.Tags.AsNoTracking();
        if (includes.Contains("products"))
        {
            query = query.Include(tag => tag.Products);
        }

        var tag = await query.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Tag not found");
        return Mappers.Tag(tag, includes.Contains("products"));
    }

    public async Task<TagDto> CreateAsync(CreateTagRequest request, CancellationToken cancellationToken)
    {
        var slug = await UniqueSlugAsync(string.IsNullOrWhiteSpace(request.Slug) ? Slugify.From(request.Name, 80) : Slugify.From(request.Slug, 80), null, cancellationToken);
        var tag = new Tag { Name = request.Name!.Trim(), Slug = slug };
        _db.Tags.Add(tag);
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Tag(tag);
    }

    public async Task<TagDto> UpdateAsync(long id, TagWriteRequest request, CancellationToken cancellationToken)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Tag not found");
        if (request.Name is { IsNull: false, Value: { } name })
        {
            tag.Name = name.Trim();
        }

        if (request.Slug is { IsNull: false, Value: { } slug })
        {
            tag.Slug = await UniqueSlugAsync(Slugify.From(slug, 80), tag.Id, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Tag(tag);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Tag not found");
        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> UniqueSlugAsync(string slug, long? exceptId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            throw AppException.Validation("slug", "Slug is required.");
        }

        var taken = await _db.Tags.AnyAsync(tag => tag.Slug == slug && (exceptId == null || tag.Id != exceptId), cancellationToken);
        if (taken)
        {
            throw AppException.Conflict($"Slug \"{slug}\" has already been taken");
        }

        return slug;
    }
}
