package com.backend.starter.order.dto;

import com.backend.starter.catalog.dto.CatalogDtos.ProductResponse;
import com.backend.starter.common.MoneySerializer;
import com.backend.starter.order.entity.OrderStatus;
import com.backend.starter.user.dto.UserDtos.UserResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record OrderItemResponse(
            Long id,
            Long orderId,
            Long productId,
            Integer quantity,
            @JsonSerialize(using = MoneySerializer.class) BigDecimal price,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) ProductResponse product
    ) {
    }

    public record OrderResponse(
            Long id,
            Long userId,
            OrderStatus status,
            @JsonSerialize(using = MoneySerializer.class) BigDecimal total,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            @JsonInclude(JsonInclude.Include.NON_NULL) List<OrderItemResponse> items,
            @JsonInclude(JsonInclude.Include.NON_NULL) UserResponse user
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CreateOrderRequest {
        private List<Item> items;

        public List<Item> getItems() {
            return items;
        }

        public void setItems(List<Item> items) {
            this.items = items;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private Long productId;
        private Integer quantity;

        public Long getProductId() {
            return productId;
        }

        public void setProductId(Long productId) {
            this.productId = productId;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class StatusRequest {
        private String status;

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }
}
