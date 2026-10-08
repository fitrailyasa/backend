package com.backend.starter.comment.controller;

import com.backend.starter.comment.dto.CommentDtos.CommentRequest;
import com.backend.starter.comment.dto.CommentDtos.CommentResponse;
import com.backend.starter.comment.service.CommentService;
import com.backend.starter.common.ApiResponse;
import com.backend.starter.common.PageQuery;
import com.backend.starter.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @GetMapping("/comments")
    public ApiResponse<List<CommentResponse>> index(HttpServletRequest request) {
        CommentService.PageResult result = commentService.list(PageQuery.fromRequest(request));
        return ApiResponse.page("Comments retrieved", result.rows(), result.meta());
    }

    @GetMapping("/products/{productId}/comments")
    public ApiResponse<List<CommentResponse>> indexByProduct(@PathVariable String productId, HttpServletRequest request) {
        CommentService.PageResult result = commentService.listByProduct(PageQuery.requiredPathId("productId", productId), PageQuery.fromRequest(request));
        return ApiResponse.page("Comments retrieved", result.rows(), result.meta());
    }

    @PostMapping("/products/{productId}/comments")
    public ResponseEntity<ApiResponse<CommentResponse>> store(@PathVariable String productId, @RequestBody CommentRequest request) {
        CommentResponse created = commentService.create(PageQuery.requiredPathId("productId", productId), request, CurrentUser.require());
        return ResponseEntity.status(201).body(ApiResponse.ok("Comment created successfully", created));
    }

    @PatchMapping("/comments/{id}")
    public ApiResponse<CommentResponse> update(@PathVariable String id, @RequestBody CommentRequest request) {
        return ApiResponse.ok("Comment updated successfully", commentService.update(PageQuery.requiredPathId("id", id), request, CurrentUser.require()));
    }

    @DeleteMapping("/comments/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        commentService.delete(PageQuery.requiredPathId("id", id), CurrentUser.require());
        return ApiResponse.ok("Comment deleted successfully", null);
    }
}
