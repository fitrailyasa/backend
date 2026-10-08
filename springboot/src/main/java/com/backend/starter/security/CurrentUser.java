package com.backend.starter.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.backend.starter.common.ApiException;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static AuthPrincipal require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw ApiException.unauthorized("Authentication token is missing");
        }
        return principal;
    }
}
