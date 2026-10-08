package com.backend.starter.security;

import com.backend.starter.common.ApiException;
import com.backend.starter.config.SecurityConfig;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final TokenBlacklist tokenBlacklist;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtService jwtService, TokenBlacklist tokenBlacklist, UserRepository userRepository, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.tokenBlacklist = tokenBlacklist;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        if ("/api/v1/auth/refresh".equals(path)) {
            filterChain.doFilter(request, response);
            return;
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || header.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }
        if (!header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            SecurityConfig.write(response, objectMapper, 401, "Token is invalid");
            return;
        }
        String token = header.substring(7).trim();
        if (token.isEmpty()) {
            SecurityConfig.write(response, objectMapper, 401, "Authentication token is missing");
            return;
        }
        try {
            Claims claims = jwtService.parseAccess(token);
            if (tokenBlacklist.isBlacklisted(claims.getId())) {
                SecurityConfig.write(response, objectMapper, 401, "Token has been revoked");
                return;
            }
            long userId = Long.parseLong(claims.getSubject());
            User user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                SecurityConfig.write(response, objectMapper, 401, "Token is invalid");
                return;
            }
            long exp = claims.getExpiration() == null ? 0L : claims.getExpiration().toInstant().getEpochSecond();
            AuthPrincipal principal = new AuthPrincipal(user.getId(), user.getEmail(), user.getRole(), claims.getId(), exp);
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            filterChain.doFilter(request, response);
        } catch (ApiException exception) {
            SecurityConfig.write(response, objectMapper, exception.getStatus(), exception.getMessage());
        } catch (NumberFormatException exception) {
            SecurityConfig.write(response, objectMapper, 401, "Token is invalid");
        }
    }
}
