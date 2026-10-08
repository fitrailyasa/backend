package com.backend.starter.user.controller;

import com.backend.starter.common.ApiResponse;
import com.backend.starter.security.CurrentUser;
import com.backend.starter.user.dto.UserDtos.AuthResponse;
import com.backend.starter.user.dto.UserDtos.LoginRequest;
import com.backend.starter.user.dto.UserDtos.RefreshRequest;
import com.backend.starter.user.dto.UserDtos.RegisterRequest;
import com.backend.starter.user.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.status(201).body(ApiResponse.ok("User registered successfully", authService.register(request)));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@RequestBody LoginRequest request) {
        return ApiResponse.ok("Login successful", authService.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(HttpServletRequest request, @RequestBody(required = false) RefreshRequest body) {
        String token = null;
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            token = body.getRefreshToken();
        } else if (body != null && body.getToken() != null && !body.getToken().isBlank()) {
            token = body.getToken();
        } else {
            token = bearer(request);
        }
        return ApiResponse.ok("Token refreshed successfully", authService.refresh(token));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        var principal = CurrentUser.require();
        authService.logout(principal.getJti(), principal.getExpiresAtEpochSecond());
        return ApiResponse.ok("Logged out successfully", null);
    }

    @GetMapping("/me")
    public ApiResponse<com.backend.starter.user.dto.UserDtos.UserResponse> me() {
        return ApiResponse.ok("Authenticated user retrieved", authService.me(CurrentUser.require().getId()));
    }

    private static String bearer(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return header.substring(7).trim();
        }
        return null;
    }
}
