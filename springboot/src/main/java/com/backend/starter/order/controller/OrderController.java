package com.backend.starter.order.controller;

import com.backend.starter.common.ApiResponse;
import com.backend.starter.common.PageQuery;
import com.backend.starter.order.dto.OrderDtos.CreateOrderRequest;
import com.backend.starter.order.dto.OrderDtos.OrderResponse;
import com.backend.starter.order.dto.OrderDtos.StatusRequest;
import com.backend.starter.order.service.OrderService;
import com.backend.starter.security.AuthPrincipal;
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
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ApiResponse<List<OrderResponse>> index(HttpServletRequest request) {
        OrderService.PageResult result = orderService.list(PageQuery.fromRequest(request), CurrentUser.require());
        return ApiResponse.page("Orders retrieved", result.rows(), result.meta());
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> store(@RequestBody CreateOrderRequest request) {
        AuthPrincipal actor = CurrentUser.require();
        return ResponseEntity.status(201).body(ApiResponse.ok("Order created successfully", orderService.create(actor.getId(), request)));
    }

    @GetMapping("/{id}")
    public ApiResponse<OrderResponse> show(@PathVariable String id, HttpServletRequest request) {
        return ApiResponse.ok("Order retrieved", orderService.get(PageQuery.requiredPathId("id", id), PageQuery.fromRequest(request), CurrentUser.require()));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<OrderResponse> updateStatus(@PathVariable String id, @RequestBody StatusRequest request) {
        return ApiResponse.ok("Order status updated successfully",
                orderService.updateStatus(PageQuery.requiredPathId("id", id), request.getStatus(), CurrentUser.require()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> destroy(@PathVariable String id) {
        orderService.delete(PageQuery.requiredPathId("id", id));
        return ApiResponse.ok("Order deleted successfully", null);
    }
}
