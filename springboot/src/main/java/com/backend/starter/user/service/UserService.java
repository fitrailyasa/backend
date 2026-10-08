package com.backend.starter.user.service;

import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.common.PageMeta;
import com.backend.starter.common.PageQuery;
import com.backend.starter.user.dto.UserDtos.UserResponse;
import com.backend.starter.user.dto.UserDtos.UserWriteRequest;
import com.backend.starter.user.entity.Role;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class UserService {

    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "name", "name",
            "email", "email",
            "role", "role",
            "created_at", "createdAt",
            "updated_at", "updatedAt"
    );

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public PageResult list(Map<String, String> query) {
        PageQuery page = PageQuery.parse(query, SORTABLE, List.of());
        FieldErrors errors = new FieldErrors();
        String role = null;
        if (query.get("role") != null && !query.get("role").isBlank()) {
            role = Checks.role(errors, query.get("role"), true);
        }
        errors.throwIfAny();
        Page<User> result = userRepository.findAll(spec(page.search(), role), page.pageable());
        List<UserResponse> rows = result.getContent().stream().map(UserService::toResponse).toList();
        return new PageResult(rows, PageMeta.of(page.page(), page.limit(), result.getTotalElements()));
    }

    @Transactional(readOnly = true)
    public UserResponse get(long id) {
        return toResponse(find(id));
    }

    @Transactional
    public UserResponse create(UserWriteRequest request) {
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
        String email = Checks.requiredEmail(errors, request.getEmail());
        String password = Checks.requiredPassword(errors, request.getPassword());
        String role = Checks.role(errors, request.getRole(), false);
        errors.throwIfAny();
        ensureEmailAvailable(email, null);
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role == null ? Role.user : Role.valueOf(role));
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse replace(long id, UserWriteRequest request) {
        User user = find(id);
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
        String email = Checks.requiredEmail(errors, request.getEmail());
        String password = Checks.requiredPassword(errors, request.getPassword());
        String role = Checks.role(errors, request.has("role") ? request.getRole() : "user", true);
        errors.throwIfAny();
        ensureEmailAvailable(email, user.getId());
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Role.valueOf(role));
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse patch(long id, UserWriteRequest request) {
        User user = find(id);
        applyPartial(user, request, true);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse patchProfile(long id, UserWriteRequest request) {
        User user = find(id);
        applyPartial(user, request, false);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void delete(long id) {
        userRepository.delete(find(id));
    }

    private void applyPartial(User user, UserWriteRequest request, boolean allowRole) {
        FieldErrors errors = new FieldErrors();
        String name = request.has("name") ? Checks.optionalText(errors, "name", request.getName(), 2, 100, "Name") : null;
        String email = request.has("email") ? Checks.optionalEmail(errors, request.getEmail()) : null;
        String password = request.has("password") ? Checks.optionalPassword(errors, request.getPassword()) : null;
        if (request.has("password") || request.has("password_confirmation")) {
            Checks.confirmation(errors, request.has("password") ? request.getPassword() : null,
                    request.has("password_confirmation") ? request.getPasswordConfirmation() : null,
                    request.has("password"));
        }
        String role = allowRole && request.has("role") ? Checks.role(errors, request.getRole(), true) : null;
        errors.throwIfAny();
        if (request.has("name") && name != null) {
            user.setName(name);
        }
        if (request.has("email") && email != null && !email.equals(user.getEmail())) {
            ensureEmailAvailable(email, user.getId());
            user.setEmail(email);
        }
        if (request.has("password") && password != null) {
            user.setPassword(passwordEncoder.encode(password));
        }
        if (allowRole && request.has("role") && role != null) {
            user.setRole(Role.valueOf(role));
        }
    }

    private void ensureEmailAvailable(String email, Long exceptId) {
        boolean taken = exceptId == null
                ? userRepository.existsByEmailIgnoreCase(email)
                : userRepository.existsByEmailIgnoreCaseAndIdNot(email, exceptId);
        if (taken) {
            throw ApiException.unprocessable(Map.of("email", List.of("The email has already been taken.")));
        }
    }

    private User find(long id) {
        return userRepository.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private Specification<User> spec(String search, String role) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null) {
                String like = "%" + search.toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("email")), like)
                ));
            }
            if (role != null) {
                predicates.add(cb.equal(root.get("role"), Role.valueOf(role)));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    public static UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getCreatedAt(), user.getUpdatedAt());
    }

    public record PageResult(List<UserResponse> rows, PageMeta meta) {
    }
}
