package com.backend.starter.catalog.dto;

import com.backend.starter.common.MoneySerializer;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryResponse(
            Long id,
            String name,
            String slug,
            String description,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<ProductResponse> products
    ) {
    }

    public record TagResponse(
            Long id,
            String name,
            String slug,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record ProductResponse(
            Long id,
            Long categoryId,
            String name,
            String slug,
            String description,
            @JsonSerialize(using = MoneySerializer.class) BigDecimal price,
            Integer stock,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) CategoryResponse category,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<TagResponse> tags
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class NameSlugRequest {
        private String name;
        private String slug;
        private String description;
        private final Set<String> present = new HashSet<>();

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
            present.add("name");
        }

        public String getSlug() {
            return slug;
        }

        public void setSlug(String slug) {
            this.slug = slug;
            present.add("slug");
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
            present.add("description");
        }

        public boolean has(String field) {
            return present.contains(field);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProductRequest {
        private Long categoryId;
        private String name;
        private String slug;
        private String description;
        private BigDecimal price;
        private Integer stock;
        private List<Long> tags;
        private final Set<String> present = new HashSet<>();

        public Long getCategoryId() {
            return categoryId;
        }

        public void setCategoryId(Long categoryId) {
            this.categoryId = categoryId;
            present.add("category_id");
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
            present.add("name");
        }

        public String getSlug() {
            return slug;
        }

        public void setSlug(String slug) {
            this.slug = slug;
            present.add("slug");
        }

        public String getDescription() {
            return description;
        }

        public void setDescription(String description) {
            this.description = description;
            present.add("description");
        }

        public BigDecimal getPrice() {
            return price;
        }

        public void setPrice(BigDecimal price) {
            this.price = price;
            present.add("price");
        }

        public Integer getStock() {
            return stock;
        }

        public void setStock(Integer stock) {
            this.stock = stock;
            present.add("stock");
        }

        public List<Long> getTags() {
            return tags;
        }

        public void setTags(List<Long> tags) {
            this.tags = tags;
            present.add("tags");
        }

        public boolean has(String field) {
            return present.contains(field);
        }
    }
}
