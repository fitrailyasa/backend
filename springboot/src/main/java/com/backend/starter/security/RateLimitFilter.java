package com.backend.starter.security;

import com.backend.starter.config.AppProperties;
import com.backend.starter.config.SecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(AppProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !("/api/v1/auth/register".equals(path)
                || "/api/v1/auth/login".equals(path)
                || "/api/v1/auth/refresh".equals(path));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        int max = properties.getRateLimit().getMax();
        long windowMs = properties.getRateLimit().getWindowMs();
        if (max <= 0) {
            filterChain.doFilter(request, response);
            return;
        }
        String key = clientKey(request) + "|" + request.getRequestURI();
        long now = System.currentTimeMillis();
        Window window = windows.compute(key, (id, current) -> {
            if (current == null || current.resetAt <= now) {
                return new Window(1, now + windowMs);
            }
            current.count += 1;
            return current;
        });
        int remaining = Math.max(0, max - window.count);
        response.setHeader("X-RateLimit-Limit", String.valueOf(max));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf((long) Math.ceil(window.resetAt / 1000.0)));
        if (windows.size() > 5000) {
            windows.entrySet().removeIf(entry -> entry.getValue().resetAt <= now);
        }
        if (window.count > max) {
            long retryAfter = Math.max(1, (long) Math.ceil((window.resetAt - now) / 1000.0));
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            SecurityConfig.write(response, objectMapper, 429, "Too many requests, please try again later");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private static final class Window {
        private int count;
        private final long resetAt;

        private Window(int count, long resetAt) {
            this.count = count;
            this.resetAt = resetAt;
        }
    }
}
