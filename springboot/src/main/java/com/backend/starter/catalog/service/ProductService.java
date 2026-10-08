package com.backend.starter.catalog.service;

import com.backend.starter.catalog.dto.CatalogDtos.CategoryResponse;
import com.backend.starter.catalog.dto.CatalogDtos.ProductRequest;
import com.backend.starter.catalog.dto.CatalogDtos.ProductResponse;
import com.backend.starter.catalog.dto.CatalogDtos.TagResponse;
import com.backend.starter.catalog.entity.Category;
import com.backend.starter.catalog.entity.Product;
import com.backend.starter.catalog.entity.ProductTag;
import com.backend.starter.catalog.entity.Tag;
import com.backend.starter.catalog.repo.CategoryRepository;
import com.backend.starter.catalog.repo.ProductRepository;
import com.backend.starter.catalog.repo.ProductTagRepository;
import com.backend.starter.catalog.repo.TagRepository;
import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.common.Slugify;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class ProductService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "name", "name",
            "slug", "slug",
            "price", "price",
            "stock", "stock",
            "category_id", "categoryId",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final ProductTagRepository productTagRepository;

    public ProductService(ProductRepository productRepository, CategoryRepository categoryRepository, TagRepository tagRepository, ProductTagRepository productTagRepository) {
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.tagRepository = tagRepository;
        this.productTagRepository = productTagRepository;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of("category", "tags"));
        FieldErrors errors = new FieldErrors();
        Long categoryId = PageQuery.optionalPositiveLong(errors, "category_id", query.get("category_id"));
        Long tagId = PageQuery.optionalPositiveLong(errors, "tag_id", query.get("tag_id"));
        BigDecimal minPrice = PageQuery.optionalNonNegativeDecimal(errors, "min_price", query.get("min_price"));
        BigDecimal maxPrice = PageQuery.optionalNonNegativeDecimal(errors, "max_price", query.get("max_price"));
        errors.throwIfAny();
        String tagSlug = blank(query.get("tag"));
        if (tagSlug != null) {
            tagSlug = Slugify.of(tagSlug, 80);
        }
        Page<Product> result = productRepository.findAll(spec(page.search(), categoryId, tagId, tagSlug, minPrice, maxPrice), page.pageable());
        return new PageResult(mapAll(result.getContent(), page.includes("category"), page.includes("tags")),
                PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public ProductResponse get(long id, Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of("category", "tags"));
        Product product = find(id);
        return mapAll(List.of(product), page.includes("category"), page.includes("tags")).get(0);
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        FieldErrors errors = new FieldErrors();
        Long categoryId = Checks.requiredCategoryId(errors, request.getCategoryId());
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 150, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 180);
        BigDecimal price = Checks.requiredPrice(errors, request.getPrice());
        Integer stock = request.has("stock") ? Checks.optionalStock(errors, request.getStock()) : 0;
        List<Long> tags = request.has("tags") ? Checks.optionalTagIds(errors, request.getTags()) : null;
        errors.throwIfAny();
        assertCategory(categoryId);
        String slug = requestedSlug == null ? Slugify.of(name, 180) : requestedSlug;
        ensureSlug(slug, null);
        Product product = new Product();
        product.setCategoryId(categoryId);
        product.setName(name);
        product.setSlug(slug);
        product.setDescription(blank(request.getDescription()));
        product.setPrice(money(price));
        product.setStock(stock == null ? 0 : stock);
        product = productRepository.save(product);
        if (tags != null) {
            replaceTags(product.getId(), tags);
        }
        return mapAll(List.of(product), false, false).get(0);
    }

    @Transactional
    public ProductResponse replace(long id, ProductRequest request) {
        Product product = find(id);
        FieldErrors errors = new FieldErrors();
        Long categoryId = Checks.requiredCategoryId(errors, request.getCategoryId());
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 150, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 180);
        BigDecimal price = Checks.requiredPrice(errors, request.getPrice());
        Integer stock = Checks.optionalStock(errors, request.has("stock") ? request.getStock() : 0);
        List<Long> tags = Checks.optionalTagIds(errors, request.has("tags") ? request.getTags() : List.of());
        errors.throwIfAny();
        assertCategory(categoryId);
        String slug = requestedSlug == null ? Slugify.of(name, 180) : requestedSlug;
        ensureSlug(slug, product.getId());
        product.setCategoryId(categoryId);
        product.setName(name);
        product.setSlug(slug);
        product.setDescription(blank(request.getDescription()));
        product.setPrice(money(price));
        product.setStock(stock == null ? 0 : stock);
        productRepository.save(product);
        replaceTags(product.getId(), tags == null ? List.of() : tags);
        return mapAll(List.of(product), false, false).get(0);
    }

    @Transactional
    public ProductResponse patch(long id, ProductRequest request) {
        Product product = find(id);
        FieldErrors errors = new FieldErrors();
        if (request.has("category_id")) {
            Long categoryId = Checks.optionalCategoryId(errors, request.getCategoryId());
            if (categoryId != null) {
                assertCategory(categoryId);
                product.setCategoryId(categoryId);
            } else if (!errors.has("category_id")) {
                errors.add("category_id", "category_id is required.");
            }
        }
        if (request.has("name")) {
            String name = Checks.requiredText(errors, "name", request.getName(), 2, 150, "Name");
            if (name != null) {
                product.setName(name);
            }
        }
        if (request.has("slug") && request.getSlug() != null && !request.getSlug().isBlank()) {
            String slug = Checks.optionalSlug(errors, request.getSlug(), 180);
            if (slug != null) {
                ensureSlug(slug, product.getId());
                product.setSlug(slug);
            }
        }
        if (request.has("description")) {
            product.setDescription(blank(request.getDescription()));
        }
        if (request.has("price")) {
            BigDecimal price = Checks.optionalPrice(errors, request.getPrice());
            if (request.getPrice() == null) {
                errors.add("price", "Price is required.");
            } else if (price != null) {
                product.setPrice(money(price));
            }
        }
        if (request.has("stock")) {
            Integer stock = Checks.optionalStock(errors, request.getStock());
            if (request.getStock() == null) {
                errors.add("stock", "Stock must be an integer greater than or equal to 0.");
            } else if (stock != null) {
                product.setStock(stock);
            }
        }
        List<Long> tags = null;
        if (request.has("tags")) {
            tags = Checks.optionalTagIds(errors, request.getTags() == null ? List.of() : request.getTags());
        }
        errors.throwIfAny();
        productRepository.save(product);
        if (tags != null) {
            replaceTags(product.getId(), tags);
        }
        return mapAll(List.of(product), false, false).get(0);
    }

    @Transactional
    public void delete(long id) {
        Product product = find(id);
        productTagRepository.deleteByProductId(product.getId());
        productRepository.delete(product);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<ProductResponse>> byCategoryIds(Collection<Long> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<ProductResponse>> grouped = new HashMap<>();
        for (Product product : productRepository.findByCategoryIdIn(categoryIds)) {
            grouped.computeIfAbsent(product.getCategoryId(), key -> new ArrayList<>()).add(toResponse(product, null, null));
        }
        return grouped;
    }

    public Product find(long id) {
        return productRepository.findById(id).orElseThrow(() -> ApiException.notFound("Product not found"));
    }

    private void assertCategory(Long categoryId) {
        if (!categoryRepository.existsById(categoryId)) {
            throw ApiException.unprocessable(Map.of("category_id", List.of("The selected category id is invalid.")));
        }
    }

    private void ensureSlug(String slug, Long exceptId) {
        boolean taken = exceptId == null ? productRepository.existsBySlug(slug) : productRepository.existsBySlugAndIdNot(slug, exceptId);
        if (taken) {
            throw ApiException.conflict("Slug \"" + slug + "\" has already been taken");
        }
    }

    private void replaceTags(Long productId, List<Long> tagIds) {
        Set<Long> unique = new LinkedHashSet<>(tagIds);
        List<Tag> found = unique.isEmpty() ? List.of() : tagRepository.findByIdIn(unique);
        if (found.size() != unique.size()) {
            throw ApiException.unprocessable(Map.of("tags", List.of("One or more selected tags are invalid.")));
        }
        productTagRepository.deleteByProductId(productId);
        productTagRepository.flush();
        for (Long tagId : unique) {
            ProductTag link = new ProductTag();
            link.setProductId(productId);
            link.setTagId(tagId);
            productTagRepository.save(link);
        }
    }

    private List<ProductResponse> mapAll(List<Product> products, boolean includeCategory, boolean includeTags) {
        Map<Long, Category> categories = Map.of();
        if (includeCategory && !products.isEmpty()) {
            List<Long> ids = products.stream().map(Product::getCategoryId).distinct().toList();
            categories = new HashMap<>();
            for (Category category : categoryRepository.findAllById(ids)) {
                categories.put(category.getId(), category);
            }
        }
        Map<Long, List<TagResponse>> tags = Map.of();
        if (includeTags && !products.isEmpty()) {
            tags = tagsFor(products.stream().map(Product::getId).toList());
        }
        List<ProductResponse> rows = new ArrayList<>();
        for (Product product : products) {
            CategoryResponse category = null;
            if (includeCategory) {
                Category found = categories.get(product.getCategoryId());
                if (found != null) {
                    category = CategoryService.toResponse(found, null);
                }
            }
            List<TagResponse> productTags = includeTags ? tags.getOrDefault(product.getId(), List.of()) : null;
            rows.add(toResponse(product, category, productTags));
        }
        return rows;
    }

    private Map<Long, List<TagResponse>> tagsFor(Collection<Long> productIds) {
        List<ProductTag> links = productTagRepository.findByProductIdIn(productIds);
        if (links.isEmpty()) {
            return Map.of();
        }
        Map<Long, Tag> tags = new HashMap<>();
        for (Tag tag : tagRepository.findByIdIn(links.stream().map(ProductTag::getTagId).distinct().toList())) {
            tags.put(tag.getId(), tag);
        }
        Map<Long, List<TagResponse>> grouped = new HashMap<>();
        for (ProductTag link : links) {
            Tag tag = tags.get(link.getTagId());
            if (tag == null) {
                continue;
            }
            grouped.computeIfAbsent(link.getProductId(), key -> new ArrayList<>()).add(TagService.toResponse(tag));
        }
        return grouped;
    }

    private Specification<Product> spec(String search, Long categoryId, Long tagId, String tagSlug, BigDecimal min, BigDecimal max) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null) {
                String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like)
                ));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("categoryId"), categoryId));
            }
            if (min != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("price"), min));
            }
            if (max != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("price"), max));
            }
            if (tagId != null || tagSlug != null) {
                Subquery<Long> subquery = query.subquery(Long.class);
                Root<ProductTag> link = subquery.from(ProductTag.class);
                Root<Tag> tag = subquery.from(Tag.class);
                List<Predicate> tagPredicates = new ArrayList<>();
                tagPredicates.add(cb.equal(link.get("productId"), root.get("id")));
                tagPredicates.add(cb.equal(link.get("tagId"), tag.get("id")));
                if (tagId != null) {
                    tagPredicates.add(cb.equal(tag.get("id"), tagId));
                }
                if (tagSlug != null) {
                    tagPredicates.add(cb.equal(tag.get("slug"), tagSlug));
                }
                subquery.select(link.get("id")).where(tagPredicates.toArray(Predicate[]::new));
                predicates.add(cb.exists(subquery));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public static ProductResponse toResponse(Product product, CategoryResponse category, List<TagResponse> tags) {
        return new ProductResponse(
                product.getId(),
                product.getCategoryId(),
                product.getName(),
                product.getSlug(),
                product.getDescription(),
                money(product.getPrice()),
                product.getStock(),
                product.getCreatedAt(),
                product.getUpdatedAt(),
                category,
                tags
        );
    }

    public static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String blank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public record PageResult(List<ProductResponse> rows, PageMeta meta) {
    }
}
