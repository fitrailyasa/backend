package com.backend.starter.user.service;

import com.backend.starter.common.ApiException;
import com.backend.starter.common.Checks;
import com.backend.starter.common.FieldErrors;
import com.backend.starter.security.JwtService;
import com.backend.starter.security.TokenBlacklist;
import com.backend.starter.user.dto.UserDtos.AuthResponse;
import com.backend.starter.user.dto.UserDtos.LoginRequest;
import com.backend.starter.user.dto.UserDtos.RegisterRequest;
import com.backend.starter.user.dto.UserDtos.UserResponse;
import com.backend.starter.user.entity.Role;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final TokenBlacklist tokenBlacklist;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, TokenBlacklist tokenBlacklist) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tokenBlacklist = tokenBlacklist;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        FieldErrors errors = new FieldErrors();
        String name = Checks.requiredText(errors, "name", request.getName(), 2, 100, "Name");
        String email = Checks.requiredEmail(errors, request.getEmail());
        String password = Checks.requiredPassword(errors, request.getPassword());
        Checks.confirmation(errors, password, request.getPasswordConfirmation(), true);
        errors.throwIfAny();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw ApiException.unprocessable(java.util.Map.of("email", java.util.List.of("The email has already been taken.")));
        }
        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(Role.user);
        user = userRepository.save(user);
        return tokens(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        FieldErrors errors = new FieldErrors();
        String email = Checks.requiredEmail(errors, request.getEmail());
        if (request.getPassword() == null || request.getPassword().isEmpty()) {
            errors.add("password", "Password is required.");
        }
        errors.throwIfAny();
        User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (user == null || !passwordMatches(request.getPassword(), user.getPassword())) {
            throw ApiException.unauthorized("These credentials do not match our records");
        }
        return tokens(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse refresh(String token) {
        if (token == null || token.isBlank()) {
            throw ApiException.unauthorized("Refresh token is missing");
        }
        Claims claims = jwtService.parseRefresh(token.trim());
        if (tokenBlacklist.isBlacklisted(claims.getId())) {
            throw ApiException.unauthorized("Token has been revoked");
        }
        long userId;
        try {
            userId = Long.parseLong(claims.getSubject());
        } catch (NumberFormatException exception) {
            throw ApiException.unauthorized("Token is invalid");
        }
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.unauthorized("Token is invalid"));
        return tokens(user);
    }

    public void logout(String jti, long expiresAtEpochSecond) {
        tokenBlacklist.blacklist(jti, expiresAtEpochSecond);
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.unauthorized("Token is invalid"));
        return UserService.toResponse(user);
    }

    private boolean passwordMatches(String raw, String hashed) {
        if (hashed != null && hashed.startsWith("bcrypt$")) {
            hashed = hashed.substring("bcrypt$".length());
        }
        return passwordEncoder.matches(raw, hashed);
    }

    private AuthResponse tokens(User user) {
        return new AuthResponse(
                UserService.toResponse(user),
                jwtService.signAccess(user.getId(), user.getRole().name()),
                jwtService.signRefresh(user.getId(), user.getRole().name()),
                "Bearer",
                jwtService.accessExpiresIn()
        );
    }
}
