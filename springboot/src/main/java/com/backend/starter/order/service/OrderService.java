package com.backend.starter.order.service;

import com.backend.starter.catalog.entity.Product;
import com.backend.starter.catalog.repo.ProductRepository;
import com.backend.starter.catalog.service.ProductService;
import com.backend.starter.common.ApiException;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.order.dto.OrderDtos.CreateOrderRequest;
import com.backend.starter.order.dto.OrderDtos.Item;
import com.backend.starter.order.dto.OrderDtos.OrderItemResponse;
import com.backend.starter.order.dto.OrderDtos.OrderResponse;
import com.backend.starter.order.entity.CustomerOrder;
import com.backend.starter.order.entity.OrderItem;
import com.backend.starter.order.entity.OrderStatus;
import com.backend.starter.order.repo.OrderItemRepository;
import com.backend.starter.order.repo.OrderRepository;
import com.backend.starter.security.AuthPrincipal;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import com.backend.starter.user.service.UserService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrderService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "status", "status",
            "total", "total",
            "user_id", "userId",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );
    private static final List<String> INCLUDES = List.of("items", "items.product", "user");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public OrderService(OrderRepository orderRepository, OrderItemRepository orderItemRepository, ProductRepository productRepository, UserRepository userRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query, AuthPrincipal actor) {
        if (query.get("user_id") != null && !query.get("user_id").isBlank() && !actor.isAdmin()) {
            throw ApiException.forbidden("The user_id filter is only available to administrators");
        }
        PageQuery page = PageQuery.parse(query, SORTABLE, INCLUDES);
        FieldErrors errors = new FieldErrors();
        Long userId = PageQuery.optionalPositiveLong(errors, "user_id", query.get("user_id"));
        String statusRaw = PageQuery.blankToNull(query.get("status"));
        OrderStatus status = null;
        if (statusRaw != null) {
            status = parseStatus(statusRaw, errors, "status");
        }
        errors.throwIfAny();
        Long ownerFilter = actor.isAdmin() ? userId : actor.getId();
        Page<CustomerOrder> result = orderRepository.findAll(spec(ownerFilter, status), page.pageable());
        return new PageResult(
                mapAll(result.getContent(), page.includes("items") || page.includes("items.product"), page.includes("items.product"), page.includes("user")),
                PageMeta.of(page.page(), page.limit(), result.getTotalElements())
        );
    }

    @Transactional(readOnly = true)
    public OrderResponse get(long id, Map<String, String> query, AuthPrincipal actor) {
        PageQuery page = PageQuery.parse(query, SORTABLE, INCLUDES);
        CustomerOrder order = find(id);
        assertCanView(order, actor);
        return mapAll(List.of(order), page.includes("items") || page.includes("items.product"), page.includes("items.product"), page.includes("user")).get(0);
    }

    @Transactional
    public OrderResponse create(long userId, CreateOrderRequest request) {
        List<Line> lines = merge(request);
        List<Long> ids = lines.stream().map(Line::productId).toList();
        Map<Long, Product> products = new LinkedHashMap<>();
        for (Product product : productRepository.findAllByIdForUpdate(ids)) {
            products.put(product.getId(), product);
        }
        for (Line line : lines) {
            if (!products.containsKey(line.productId())) {
                throw ApiException.notFound("Product with id " + line.productId() + " not found");
            }
        }
        for (Line line : lines) {
            Product product = products.get(line.productId());
            if (product.getStock() < line.quantity()) {
                throw ApiException.conflict("Insufficient stock for product \"" + product.getName() + "\"");
            }
        }

        CustomerOrder order = new CustomerOrder();
        order.setUserId(userId);
        order.setStatus(OrderStatus.pending);
        order.setTotal(ProductService.money(BigDecimal.ZERO));
        order = orderRepository.save(order);

        BigDecimal total = BigDecimal.ZERO;
        for (Line line : lines) {
            Product product = products.get(line.productId());
            OrderItem item = new OrderItem();
            item.setOrderId(order.getId());
            item.setProductId(product.getId());
            item.setQuantity(line.quantity());
            item.setPrice(ProductService.money(product.getPrice()));
            orderItemRepository.save(item);
            product.setStock(product.getStock() - line.quantity());
            productRepository.save(product);
            total = total.add(item.getPrice().multiply(BigDecimal.valueOf(line.quantity())));
        }
        order.setTotal(ProductService.money(total));
        orderRepository.save(order);
        return mapAll(List.of(order), true, true, false).get(0);
    }

    @Transactional
    public OrderResponse updateStatus(long id, String statusRaw, AuthPrincipal actor) {
        CustomerOrder order = find(id);
        assertCanView(order, actor);
        FieldErrors errors = new FieldErrors();
        if (statusRaw == null || statusRaw.isBlank()) {
            errors.add("status", "Status is required.");
            errors.throwIfAny();
        }
        OrderStatus next = parseStatus(statusRaw, errors, "status");
        errors.throwIfAny();
        if (order.getStatus() == next) {
            return mapAll(List.of(order), false, false, false).get(0);
        }
        if (!actor.isAdmin() && !(order.getStatus() == OrderStatus.pending && next == OrderStatus.cancelled)) {
            throw ApiException.forbidden("This action is unauthorized");
        }
        if (order.getStatus() != OrderStatus.cancelled && next == OrderStatus.cancelled) {
            adjustStock(order.getId(), 1);
        } else if (order.getStatus() == OrderStatus.cancelled && next != OrderStatus.cancelled) {
            adjustStock(order.getId(), -1);
        }
        order.setStatus(next);
        orderRepository.save(order);
        return mapAll(List.of(order), false, false, false).get(0);
    }

    @Transactional
    public void delete(long id) {
        CustomerOrder order = find(id);
        if (order.getStatus() != OrderStatus.cancelled) {
            adjustStock(order.getId(), 1);
        }
        orderItemRepository.deleteByOrderId(order.getId());
        orderRepository.delete(order);
    }

    private void adjustStock(Long orderId, int direction) {
        for (OrderItem item : orderItemRepository.findByOrderId(orderId)) {
            Product product = productRepository.findByIdForUpdate(item.getProductId()).orElse(null);
            if (product == null) {
                continue;
            }
            int next = direction > 0
                    ? product.getStock() + item.getQuantity()
                    : product.getStock() - item.getQuantity();
            product.setStock(Math.max(0, next));
            productRepository.save(product);
        }
    }

    private List<Line> merge(CreateOrderRequest request) {
        FieldErrors errors = new FieldErrors();
        if (request == null || request.getItems() == null) {
            errors.add("items", "Items is required.");
            errors.throwIfAny();
        }
        List<Item> items = request.getItems();
        if (items.isEmpty() || items.size() > 100) {
            errors.add("items", "Items must be a non-empty array.");
            errors.throwIfAny();
        }
        for (int index = 0; index < items.size(); index++) {
            Item item = items.get(index);
            if (item == null) {
                errors.add("items." + index, "items." + index + " must be an object.");
                continue;
            }
            if (item.getProductId() == null || item.getProductId() < 1) {
                errors.add("items." + index + ".product_id", "items." + index + ".product_id must be a positive integer.");
            }
            if (item.getQuantity() == null || item.getQuantity() < 1) {
                errors.add("items." + index + ".quantity", "items." + index + ".quantity must be an integer greater than or equal to 1.");
            }
        }
        errors.throwIfAny();
        Map<Long, Integer> merged = new LinkedHashMap<>();
        for (Item item : items) {
            merged.merge(item.getProductId(), item.getQuantity(), Integer::sum);
        }
        return merged.entrySet().stream().map(entry -> new Line(entry.getKey(), entry.getValue())).toList();
    }

    private void assertCanView(CustomerOrder order, AuthPrincipal actor) {
        if (actor.isAdmin()) {
            return;
        }
        if (!order.getUserId().equals(actor.getId())) {
            throw ApiException.forbidden("This action is unauthorized");
        }
    }

    private CustomerOrder find(long id) {
        return orderRepository.findById(id).orElseThrow(() -> ApiException.notFound("Order not found"));
    }

    private OrderStatus parseStatus(String raw, FieldErrors errors, String field) {
        if (raw == null) {
            return null;
        }
        for (OrderStatus status : OrderStatus.values()) {
            if (status.name().equals(raw.trim())) {
                return status;
            }
        }
        errors.add(field, "Status must be one of: " + OrderStatus.ALLOWED + ".");
        return null;
    }

    private Specification<CustomerOrder> spec(Long userId, OrderStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private List<OrderResponse> mapAll(List<CustomerOrder> orders, boolean includeItems, boolean includeProduct, boolean includeUser) {
        Map<Long, List<OrderItem>> itemsByOrder = Map.of();
        Map<Long, Product> products = Map.of();
        if (includeItems && !orders.isEmpty()) {
            List<Long> orderIds = orders.stream().map(CustomerOrder::getId).toList();
            itemsByOrder = new LinkedHashMap<>();
            List<OrderItem> items = orderItemRepository.findByOrderIdIn(orderIds);
            for (OrderItem item : items) {
                itemsByOrder.computeIfAbsent(item.getOrderId(), key -> new ArrayList<>()).add(item);
            }
            if (includeProduct && !items.isEmpty()) {
                products = new LinkedHashMap<>();
                for (Product product : productRepository.findAllById(items.stream().map(OrderItem::getProductId).distinct().toList())) {
                    products.put(product.getId(), product);
                }
            }
        }
        Map<Long, User> users = Map.of();
        if (includeUser && !orders.isEmpty()) {
            users = new LinkedHashMap<>();
            for (User user : userRepository.findAllById(orders.stream().map(CustomerOrder::getUserId).distinct().toList())) {
                users.put(user.getId(), user);
            }
        }
        List<OrderResponse> rows = new ArrayList<>();
        for (CustomerOrder order : orders) {
            List<OrderItemResponse> itemResponses = null;
            if (includeItems) {
                itemResponses = new ArrayList<>();
                for (OrderItem item : itemsByOrder.getOrDefault(order.getId(), List.of())) {
                    Product product = includeProduct ? products.get(item.getProductId()) : null;
                    itemResponses.add(new OrderItemResponse(
                            item.getId(),
                            item.getOrderId(),
                            item.getProductId(),
                            item.getQuantity(),
                            ProductService.money(item.getPrice()),
                            item.getCreatedAt(),
                            item.getUpdatedAt(),
                            product == null ? null : ProductService.toResponse(product, null, null)
                    ));
                }
            }
            rows.add(new OrderResponse(
                    order.getId(),
                    order.getUserId(),
                    order.getStatus(),
                    ProductService.money(order.getTotal()),
                    order.getCreatedAt(),
                    order.getUpdatedAt(),
                    itemResponses,
                    includeUser && users.get(order.getUserId()) != null ? UserService.toResponse(users.get(order.getUserId())) : null
            ));
        }
        return rows;
    }

    private record Line(Long productId, int quantity) {
    }

    public record PageResult(List<OrderResponse> rows, PageMeta meta) {
    }
}
