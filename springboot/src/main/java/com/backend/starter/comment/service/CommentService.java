package com.backend.starter.comment.service;

import com.backend.starter.catalog.entity.Product;
import com.backend.starter.catalog.repo.ProductRepository;
import com.backend.starter.catalog.service.ProductService;
import com.backend.starter.comment.dto.CommentDtos.CommentRequest;
import com.backend.starter.comment.dto.CommentDtos.CommentResponse;
import com.backend.starter.comment.entity.Comment;
import com.backend.starter.comment.repo.CommentRepository;
import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.security.AuthPrincipal;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import com.backend.starter.user.service.UserService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class CommentService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "body", "body",
            "product_id", "productId",
            "user_id", "userId",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );
    private static final List<String> INCLUDES = List.of("user", "product");

    private final CommentRepository commentRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    public CommentService(CommentRepository commentRepository, ProductRepository productRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, INCLUDES);
        Filters filters = filters(query);
        Page<Comment> result = commentRepository.findAll(spec(page.search(), filters.productId(), filters.userId()), page.pageable());
        return new PageResult(mapAll(result.getContent(), page.includes("user"), page.includes("product")),
                PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public PageResult listByProduct(long productId, Map<String, String> query) {
        if (!productRepository.existsById(productId)) {
            throw ApiException.notFound("Product with id " + productId + " not found");
        }
        PageQuery page = PageQuery.parse(query, SORTABLE, INCLUDES);
        Filters filters = filters(query);
        Page<Comment> result = commentRepository.findAll(spec(page.search(), productId, filters.userId()), page.pageable());
        return new PageResult(mapAll(result.getContent(), page.includes("user"), page.includes("product")),
                PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional
    public CommentResponse create(long productId, CommentRequest request, AuthPrincipal actor) {
        if (!productRepository.existsById(productId)) {
            throw ApiException.notFound("Product with id " + productId + " not found");
        }
        String body = requiredBody(request);
        Comment comment = new Comment();
        comment.setProductId(productId);
        comment.setUserId(actor.getId());
        comment.setBody(body);
        return toResponse(commentRepository.save(comment), null, null);
    }

    @Transactional
    public CommentResponse update(long id, CommentRequest request, AuthPrincipal actor) {
        Comment comment = find(id);
        assertOwner(comment, actor);
        comment.setBody(requiredBody(request));
        return toResponse(commentRepository.save(comment), null, null);
    }

    @Transactional
    public void delete(long id, AuthPrincipal actor) {
        Comment comment = find(id);
        assertOwner(comment, actor);
        commentRepository.delete(comment);
    }

    private String requiredBody(CommentRequest request) {
        FieldErrors errors = new FieldErrors();
        String body = Checks.requiredText(errors, "body", request == null ? null : request.getBody(), 1, 2000, "Body");
        errors.throwIfAny();
        return body;
    }

    private void assertOwner(Comment comment, AuthPrincipal actor) {
        if (actor.isAdmin()) {
            return;
        }
        if (!comment.getUserId().equals(actor.getId())) {
            throw ApiException.forbidden("This action is unauthorized");
        }
    }

    private Comment find(long id) {
        return commentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Comment not found"));
    }

    private Filters filters(Map<String, String> query) {
        FieldErrors errors = new FieldErrors();
        Long productId = PageQuery.optionalPositiveLong(errors, "product_id", query.get("product_id"));
        Long userId = PageQuery.optionalPositiveLong(errors, "user_id", query.get("user_id"));
        errors.throwIfAny();
        return new Filters(productId, userId);
    }

    private Specification<Comment> spec(String search, Long productId, Long userId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null) {
                predicates.add(cb.like(cb.lower(root.get("body")), "%" + search.toLowerCase(Locale.ROOT) + "%"));
            }
            if (productId != null) {
                predicates.add(cb.equal(root.get("productId"), productId));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private List<CommentResponse> mapAll(List<Comment> comments, boolean includeUser, boolean includeProduct) {
        Map<Long, User> users = new HashMap<>();
        Map<Long, Product> products = new HashMap<>();
        if (includeUser && !comments.isEmpty()) {
            for (User user : userRepository.findAllById(comments.stream().map(Comment::getUserId).distinct().toList())) {
                users.put(user.getId(), user);
            }
        }
        if (includeProduct && !comments.isEmpty()) {
            for (Product product : productRepository.findAllById(comments.stream().map(Comment::getProductId).distinct().toList())) {
                products.put(product.getId(), product);
            }
        }
        return comments.stream().map(comment -> toResponse(
                comment,
                includeUser ? users.get(comment.getUserId()) : null,
                includeProduct ? products.get(comment.getProductId()) : null
        )).toList();
    }

    private static CommentResponse toResponse(Comment comment, User user, Product product) {
        return new CommentResponse(
                comment.getId(),
                comment.getProductId(),
                comment.getUserId(),
                comment.getBody(),
                comment.getCreatedAt(),
                comment.getUpdatedAt(),
                user == null ? null : UserService.toResponse(user),
                product == null ? null : ProductService.toResponse(product, null, null)
        );
    }

    private record Filters(Long productId, Long userId) {
    }

    public record PageResult(List<CommentResponse> rows, PageMeta meta) {
    }
}
