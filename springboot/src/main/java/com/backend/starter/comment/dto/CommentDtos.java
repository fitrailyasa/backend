package com.backend.starter.comment.dto;

import com.backend.starter.catalog.dto.CatalogDtos.ProductResponse;
import com.backend.starter.user.dto.UserDtos.UserResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDateTime;

public final class CommentDtos {

    private CommentDtos() {
    }

    public record CommentResponse(
            Long id,
            Long productId,
            Long userId,
            String body,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) UserResponse user,
            @JsonInclude(JsonInclude.Include.NON_NULL) ProductResponse product
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CommentRequest {
        private String body;

        public String getBody() {
            return body;
        }

        public void setBody(String body) {
            this.body = body;
        }
    }
}
