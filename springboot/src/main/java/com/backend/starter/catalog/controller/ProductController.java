package com.backend.starter.catalog.controller;

import com.backend.starter.catalog.dto.CatalogDtos.ProductRequest;
import com.backend.starter.catalog.dto.CatalogDtos.ProductResponse;
import com.backend.starter.catalog.service.ProductService;
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
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ApiResponse<List<ProductResponse>> index(HttpServletRequest request) {
        ProductService.PageResult result = productService.list(PageQuery.fromRequest(request));
        return ApiResponse.page("Products retrieved", result.rows(), result.meta());
    }

    @GetMapping("/{id}")
    public ApiResponse<ProductResponse> show(@PathVariable String id, HttpServletRequest request) {
        return ApiResponse.ok("Product retrieved", productService.get(PageQuery.requiredPathId("id", id), PageQuery.fromRequest(request)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProductResponse>> store(@RequestBody ProductRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok("Product created successfully", productService.create(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<ProductResponse> replace(@PathVariable String id, @RequestBody ProductRequest request) {
        return ApiResponse.ok("Product updated successfully", productService.replace(PageQuery.requiredPathId("id", id), request));
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProductResponse> update(@PathVariable String id, @RequestBody ProductRequest request) {
        return ApiResponse.ok("Product updated successfully", productService.patch(PageQuery.requiredPathId("id", id), request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        productService.delete(PageQuery.requiredPathId("id", id));
        return ApiResponse.ok("Product deleted successfully", null);
    }
}
