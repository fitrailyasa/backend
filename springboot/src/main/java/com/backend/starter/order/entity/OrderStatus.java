package com.backend.starter.order.entity;

public enum OrderStatus {
    pending,
    paid,
    shipped,
    completed,
    cancelled;

    public static final String ALLOWED = "pending, paid, shipped, completed, cancelled";
}
