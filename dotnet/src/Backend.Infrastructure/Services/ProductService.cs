using Backend.Application.Abstractions;
using Backend.Application.Common;
using Backend.Application.Dtos;
using Backend.Domain.Entities;
using Backend.Infrastructure.Mapping;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Services;

public sealed class ProductService : IProductService
{
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = nameof(Product.Id),
        ["name"] = nameof(Product.Name),
        ["slug"] = nameof(Product.Slug),
        ["price"] = nameof(Product.Price),
        ["stock"] = nameof(Product.Stock),
        ["category_id"] = nameof(Product.CategoryId),
        ["created_at"] = nameof(Product.CreatedAt),
        ["updated_at"] = nameof(Product.UpdatedAt)
    };

    private readonly AppDbContext _db;

    public ProductService(AppDbContext db) => _db = db;

    public async Task<PagedResult<ProductDto>> ListAsync(ProductListQuery query, CancellationToken cancellationToken)
    {
        var (page, limit) = PageLimits.Normalize(query.Page, query.Limit);
        var includes = QuerySupport.Includes(query.Include);
        var products = Filter(query);
        var total = await products.CountAsync(cancellationToken);
        var pageQuery = ApplyIncludes(QuerySupport.Sort(products, query.Sort, query.Order, SortFields), includes);
        var items = await pageQuery.Skip((page - 1) * limit).Take(limit).ToListAsync(cancellationToken);
        return new PagedResult<ProductDto>
        {
            Items = items.Select(product => Mappers.Product(product, includes.Contains("category"), includes.Contains("tags"))).ToList(),
            Meta = PageLimits.Meta(total, page, limit)
        };
    }

    public async Task<ProductDto> GetAsync(long id, string? include, CancellationToken cancellationToken)
    {
        var includes = QuerySupport.Includes(include);
        var product = await ApplyIncludes(_db.Products.AsNoTracking().Where(candidate => candidate.Id == id), includes)
            .FirstOrDefaultAsync(cancellationToken) ?? throw AppException.NotFound("Product not found");
        return Mappers.Product(product, includes.Contains("category"), includes.Contains("tags"));
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken)
    {
        if (!await _db.Categories.AnyAsync(category => category.Id == request.CategoryId, cancellationToken))
        {
            throw AppException.Validation("category_id", "The selected category id is invalid.");
        }

        var slug = await UniqueSlugAsync(string.IsNullOrWhiteSpace(request.Slug) ? Slugify.From(request.Name, 180) : Slugify.From(request.Slug, 180), null, cancellationToken);
        var product = new Product
        {
            CategoryId = request.CategoryId,
            Name = request.Name!.Trim(),
            Slug = slug,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Price = request.Price ?? 0,
            Stock = request.Stock ?? 0
        };

        if (request.Tags is { Count: > 0 })
        {
            product.Tags = await ResolveTagsAsync(request.Tags, cancellationToken);
        }

        _db.Products.Add(product);
        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Product(product, false, false);
    }

    public async Task<ProductDto> UpdateAsync(long id, ProductWriteRequest request, CancellationToken cancellationToken)
    {
        var product = await _db.Products.Include(candidate => candidate.Tags).FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Product not found");

        if (request.CategoryId is { IsNull: false, Value: var categoryId })
        {
            if (!await _db.Categories.AnyAsync(category => category.Id == categoryId, cancellationToken))
            {
                throw AppException.Validation("category_id", "The selected category id is invalid.");
            }

            product.CategoryId = categoryId;
        }

        if (request.Name is { IsNull: false, Value: { } name })
        {
            product.Name = name.Trim();
        }

        if (request.Slug is { IsNull: false, Value: { } slug })
        {
            product.Slug = await UniqueSlugAsync(Slugify.From(slug, 180), product.Id, cancellationToken);
        }

        if (request.Description is not null)
        {
            product.Description = request.Description.IsNull || string.IsNullOrWhiteSpace(request.Description.Value)
                ? null
                : request.Description.Value.Trim();
        }

        if (request.Price is { IsNull: false, Value: var price })
        {
            product.Price = price;
        }

        if (request.Stock is { IsNull: false, Value: var stock })
        {
            product.Stock = stock;
        }

        if (request.Tags is not null)
        {
            var ids = request.Tags.IsNull || request.Tags.Value is null ? [] : request.Tags.Value;
            var tags = await ResolveTagsAsync(ids, cancellationToken);
            product.Tags.Clear();
            foreach (var tag in tags)
            {
                product.Tags.Add(tag);
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Mappers.Product(product, false, false);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken)
            ?? throw AppException.NotFound("Product not found");
        _db.Products.Remove(product);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private IQueryable<Product> Filter(ProductListQuery query)
    {
        var products = _db.Products.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim()}%";
            products = products.Where(product => EF.Functions.Like(product.Name, pattern) || (product.Description != null && EF.Functions.Like(product.Description, pattern)));
        }

        if (query.CategoryId is long categoryId)
        {
            products = products.Where(product => product.CategoryId == categoryId);
        }

        if (query.TagId is long tagId)
        {
            products = products.Where(product => product.Tags.Any(tag => tag.Id == tagId));
        }

        if (!string.IsNullOrWhiteSpace(query.Tag))
        {
            var slug = Slugify.From(query.Tag, 80);
            products = products.Where(product => product.Tags.Any(tag => tag.Slug == slug));
        }

        if (query.MinPrice is decimal minPrice)
        {
            products = products.Where(product => product.Price >= minPrice);
        }

        if (query.MaxPrice is decimal maxPrice)
        {
            products = products.Where(product => product.Price <= maxPrice);
        }

        return products;
    }

    private static IQueryable<Product> ApplyIncludes(IQueryable<Product> query, HashSet<string> includes)
    {
        var includeCategory = includes.Contains("category");
        var includeTags = includes.Contains("tags");
        if (includeCategory)
        {
            query = query.Include(product => product.Category);
        }

        if (includeTags)
        {
            query = query.Include(product => product.Tags);
        }

        return includeCategory || includeTags ? query.AsSplitQuery() : query;
    }

    private async Task<List<Tag>> ResolveTagsAsync(IReadOnlyCollection<long> ids, CancellationToken cancellationToken)
    {
        var distinct = ids.Distinct().ToList();
        if (distinct.Count == 0)
        {
            return [];
        }

        var tags = await _db.Tags.Where(tag => distinct.Contains(tag.Id)).ToListAsync(cancellationToken);
        if (tags.Count != distinct.Count)
        {
            throw AppException.Validation("tags", "One or more selected tags are invalid.");
        }

        return tags;
    }

    private async Task<string> UniqueSlugAsync(string slug, long? exceptId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            throw AppException.Validation("slug", "Slug is required.");
        }

        var taken = await _db.Products.AnyAsync(product => product.Slug == slug && (exceptId == null || product.Id != exceptId), cancellationToken);
        if (taken)
        {
            throw AppException.Conflict($"Slug \"{slug}\" has already been taken");
        }

        return slug;
    }
}
