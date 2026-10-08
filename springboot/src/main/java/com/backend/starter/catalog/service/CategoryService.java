package com.backend.starter.catalog.service;

import com.backend.starter.catalog.dto.CatalogDtos.CategoryResponse;
import com.backend.starter.catalog.dto.CatalogDtos.NameSlugRequest;
import com.backend.starter.catalog.dto.CatalogDtos.ProductResponse;
import com.backend.starter.catalog.entity.Category;
import com.backend.starter.catalog.repo.CategoryRepository;
import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.common.Slugify;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CategoryService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "name", "name",
            "slug", "slug",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );

    private final CategoryRepository categoryRepository;
    private final ProductService productService;

    public CategoryService(CategoryRepository categoryRepository, ProductService productService) {
        this.categoryRepository = categoryRepository;
        this.productService = productService;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of("products"));
        Page<Category> result = categoryRepository.findAll(search(page.search()), page.pageable());
        Map<Long, List<ProductResponse>> products = page.includes("products")
                ? productService.byCategoryIds(result.getContent().stream().map(Category::getId).toList())
                : Map.of();
        List<CategoryResponse> rows = result.getContent().stream()
                .map(category -> toResponse(category, page.includes("products") ? products.getOrDefault(category.getId(), List.of()) : null))
                .toList();
        return new PageResult(rows, PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public CategoryResponse get(long id, Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of("products"));
        Category category = find(id);
        List<ProductResponse> products = null;
        if (page.includes("products")) {
            products = productService.byCategoryIds(List.of(id)).getOrDefault(id, List.of());
        }
        return toResponse(category, products);
    }

    @Transactional
    public CategoryResponse create(NameSlugRequest request) {
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 120);
        String description = optionalDescription(errors, request.getDescription());
        errors.throwIfAny();
        String slug = requestedSlug == null ? Slugify.of(name, 120) : requestedSlug;
        ensureSlug(slug, null);
        Category category = new Category();
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(description);
        return toResponse(categoryRepository.save(category), null);
    }

    @Transactional
    public CategoryResponse replace(long id, NameSlugRequest request) {
        Category category = find(id);
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 120);
        String description = request.getDescription() == null ? null : optionalDescription(errors, request.getDescription());
        errors.throwIfAny();
        String slug = requestedSlug == null ? Slugify.of(name, 120) : requestedSlug;
        ensureSlug(slug, category.getId());
        category.setName(name);
        category.setSlug(slug);
        category.setDescription(blankToNull(description));
        return toResponse(categoryRepository.save(category), null);
    }

    @Transactional
    public CategoryResponse patch(long id, NameSlugRequest request) {
        Category category = find(id);
        FieldErrors errors = new FieldErrors();
        if (request.has("name")) {
            String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
            errors.throwIfAny();
            category.setName(name);
        }
        if (request.has("slug") && request.getSlug() != null && !request.getSlug().isBlank()) {
            String slug = Checks.optionalSlug(errors, request.getSlug(), 120);
            errors.throwIfAny();
            ensureSlug(slug, category.getId());
            category.setSlug(slug);
        }
        if (request.has("description")) {
            String description = optionalDescription(errors, request.getDescription());
            errors.throwIfAny();
            category.setDescription(description);
        }
        errors.throwIfAny();
        return toResponse(categoryRepository.save(category), null);
    }

    @Transactional
    public void delete(long id) {
        categoryRepository.delete(find(id));
    }

    public Category find(long id) {
        return categoryRepository.findById(id).orElseThrow(() -> ApiException.notFound("Category not found"));
    }

    private void ensureSlug(String slug, Long exceptId) {
        boolean taken = exceptId == null ? categoryRepository.existsBySlug(slug) : categoryRepository.existsBySlugAndIdNot(slug, exceptId);
        if (taken) {
            throw ApiException.conflict("Slug \"" + slug + "\" has already been taken");
        }
    }

    private Specification<Category> search(String search) {
        return (root, query, cb) -> {
            if (search == null) {
                return cb.conjunction();
            }
            String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
            Predicate name = cb.like(cb.lower(root.get("name")), like);
            Predicate description = cb.like(cb.lower(cb.coalesce(root.get("description"), "")), like);
            return cb.or(name, description);
        };
    }

    private static String optionalDescription(FieldErrors errors, String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (!(value instanceof String)) {
            errors.add("description", "Description must be a string.");
            return null;
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public static CategoryResponse toResponse(Category category, List<ProductResponse> products) {
        List<ProductResponse> sorted = products == null ? null : products.stream()
                .sorted(Comparator.comparing(ProductResponse::id))
                .toList();
        return new CategoryResponse(category.getId(), category.getName(), category.getSlug(), category.getDescription(),
                category.getCreatedAt(), category.getUpdatedAt(), sorted);
    }

    public record PageResult(List<CategoryResponse> rows, PageMeta meta) {
    }
}
