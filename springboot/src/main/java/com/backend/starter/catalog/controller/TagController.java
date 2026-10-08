package com.backend.starter.catalog.controller;

import com.backend.starter.catalog.dto.CatalogDtos.NameSlugRequest;
import com.backend.starter.catalog.dto.CatalogDtos.TagResponse;
import com.backend.starter.catalog.service.TagService;
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
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public ApiResponse<List<TagResponse>> index(HttpServletRequest request) {
        TagService.PageResult result = tagService.list(PageQuery.fromRequest(request));
        return ApiResponse.page("Tags retrieved", result.rows(), result.meta());
    }

    @GetMapping("/{id}")
    public ApiResponse<TagResponse> show(@PathVariable String id) {
        return ApiResponse.ok("Tag retrieved", tagService.get(PageQuery.requiredPathId("id", id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TagResponse>> store(@RequestBody NameSlugRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok("Tag created successfully", tagService.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<TagResponse> replace(@PathVariable String id, @RequestBody NameSlugRequest request) {
        return ApiResponse.ok("Tag updated successfully", tagService.replace(PageQuery.requiredPathId("id", id), request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<TagResponse> update(@PathVariable String id, @RequestBody NameSlugRequest request) {
        return ApiResponse.ok("Tag updated successfully", tagService.patch(PageQuery.requiredPathId("id", id), request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        tagService.delete(PageQuery.requiredPathId("id", id));
        return ApiResponse.ok("Tag deleted successfully", null);
    }
}
