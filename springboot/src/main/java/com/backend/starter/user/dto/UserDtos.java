package com.backend.starter.user.dto;

import com.backend.starter.user.entity.Role;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public final class UserDtos {

    private UserDtos() {
    }

    public record UserResponse(
            Long id,
            String name,
            String email,
            Role role,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
    }

    public record AuthResponse(
            UserResponse user,
            String token,
            String refreshToken,
            String tokenType,
            long expiresIn
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RegisterRequest {
        private String name;
        private String email;
        private String password;
        private String passwordConfirmation;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }

        public String getPasswordConfirmation() {
            return passwordConfirmation;
        }

        public void setPasswordConfirmation(String passwordConfirmation) {
            this.passwordConfirmation = passwordConfirmation;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LoginRequest {
        private String email;
        private String password;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RefreshRequest {
        private String refreshToken;
        private String token;

        public String getRefreshToken() {
            return refreshToken;
        }

        public void setRefreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
        }

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UserWriteRequest {
        private String name;
        private String email;
        private String password;
        private String passwordConfirmation;
        private String role;
        private final Set<String> present = new HashSet<>();

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
            present.add("name");
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
            present.add("email");
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
            present.add("password");
        }

        public String getPasswordConfirmation() {
            return passwordConfirmation;
        }

        public void setPasswordConfirmation(String passwordConfirmation) {
            this.passwordConfirmation = passwordConfirmation;
            present.add("password_confirmation");
        }

        public String getRole() {
            return role;
        }

        public void setRole(String role) {
            this.role = role;
            present.add("role");
        }

        public boolean has(String field) {
            return present.contains(field);
        }
    }
}
