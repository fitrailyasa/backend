package com.backend.starter.catalog.controller;

import com.backend.starter.catalog.dto.CatalogDtos.CategoryResponse;
import com.backend.starter.catalog.dto.CatalogDtos.NameSlugRequest;
import com.backend.starter.catalog.service.CategoryService;
import com.backend.starter.common.ApiResponse;
import com.backend.starter.common.PageQuery;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    public ApiResponse<List<CategoryResponse>> index(HttpServletRequest request) {
        CategoryService.PageResult result = categoryService.list(PageQuery.fromRequest(request));
        return ApiResponse.page("Categories retrieved", result.rows(), result.meta());
    }

    @GetMapping("/{id}")
    public ApiResponse<CategoryResponse> show(@PathVariable String id, HttpServletRequest request) {
        return ApiResponse.ok("Category retrieved", categoryService.get(PageQuery.requiredPathId("id", id), PageQuery.fromRequest(request)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> store(@RequestBody NameSlugRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok("Category created successfully", categoryService.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<CategoryResponse> replace(@PathVariable String id, @RequestBody NameSlugRequest request) {
        return ApiResponse.ok("Category updated successfully", categoryService.replace(PageQuery.requiredPathId("id", id), request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<CategoryResponse> update(@PathVariable String id, @RequestBody NameSlugRequest request) {
        return ApiResponse.ok("Category updated successfully", categoryService.patch(PageQuery.requiredPathId("id", id), request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        categoryService.delete(PageQuery.requiredPathId("id", id));
        return ApiResponse.ok("Category deleted successfully", null);
    }
}
