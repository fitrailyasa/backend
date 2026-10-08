package com.backend.starter.catalog.service;

import com.backend.starter.catalog.dto.CatalogDtos.NameSlugRequest;
import com.backend.starter.catalog.dto.CatalogDtos.TagResponse;
import com.backend.starter.catalog.entity.Tag;
import com.backend.starter.catalog.repo.ProductTagRepository;
import com.backend.starter.catalog.repo.TagRepository;
import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.common.Slugify;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class TagService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "name", "name",
            "slug", "slug",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );

    private final TagRepository tagRepository;
    private final ProductTagRepository productTagRepository;

    public TagService(TagRepository tagRepository, ProductTagRepository productTagRepository) {
        this.tagRepository = tagRepository;
        this.productTagRepository = productTagRepository;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of());
        Page<Tag> result = tagRepository.findAll(search(page.search()), page.pageable());
        List<TagResponse> rows = result.getContent().stream().map(TagService::toResponse).toList();
        return new PageResult(rows, PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public TagResponse get(long id) {
        return toResponse(find(id));
    }

    @Transactional
    public TagResponse create(NameSlugRequest request) {
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 60, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 80);
        errors.throwIfAny();
        String slug = requestedSlug == null ? Slugify.of(name, 80) : requestedSlug;
        ensureSlug(slug, null);
        Tag tag = new Tag();
        tag.setName(name);
        tag.setSlug(slug);
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public TagResponse replace(long id, NameSlugRequest request) {
        Tag tag = find(id);
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 60, "Name");
        String requestedSlug = Checks.optionalSlug(errors, request.getSlug(), 80);
        errors.throwIfAny();
        String slug = requestedSlug == null ? Slugify.of(name, 80) : requestedSlug;
        ensureSlug(slug, tag.getId());
        tag.setName(name);
        tag.setSlug(slug);
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public TagResponse patch(long id, NameSlugRequest request) {
        Tag tag = find(id);
        FieldErrors errors = new FieldErrors();
        if (request.has("name")) {
            String name = Checks.requiredText(errors, "name", request.getName(), 2, 60, "Name");
            if (name != null) {
                tag.setName(name);
            }
        }
        if (request.has("slug") && request.getSlug() != null && !request.getSlug().isBlank()) {
            String slug = Checks.optionalSlug(errors, request.getSlug(), 80);
            if (slug != null) {
                ensureSlug(slug, tag.getId());
                tag.setSlug(slug);
            }
        }
        errors.throwIfAny();
        return toResponse(tagRepository.save(tag));
    }

    @Transactional
    public void delete(long id) {
        Tag tag = find(id);
        productTagRepository.deleteByTagId(tag.getId());
        tagRepository.delete(tag);
    }

    private Tag find(long id) {
        return tagRepository.findById(id).orElseThrow(() -> ApiException.notFound("Tag not found"));
    }

    private void ensureSlug(String slug, Long exceptId) {
        boolean taken = exceptId == null ? tagRepository.existsBySlug(slug) : tagRepository.existsBySlugAndIdNot(slug, exceptId);
        if (taken) {
            throw ApiException.conflict("Slug \"" + slug + "\" has already been taken");
        }
    }

    private Specification<Tag> search(String search) {
        return (root, query, cb) -> {
            if (search == null) {
                return cb.conjunction();
            }
            return cb.like(cb.lower(root.get("name")), "%" + search.toLowerCase(Locale.ROOT) + "%");
        };
    }

    public static TagResponse toResponse(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName(), tag.getSlug(), tag.getCreatedAt(), tag.getUpdatedAt());
    }

    public record PageResult(List<TagResponse> rows, PageMeta meta) {
    }
}
