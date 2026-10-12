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
import java.util.Set;

/**
 * Rejects request bodies larger than {@code BODY_LIMIT} (default 100kb) with 413 and the standard
 * error envelope, before the body is read by the application.
 *
 * <p>The check uses {@code Content-Length}; multipart uploads are capped separately through
 * {@code spring.servlet.multipart}.</p>
 */
@Component
public class BodyLimitFilter extends OncePerRequestFilter {

    private static final Set<String> BODY_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AppProperties properties;
    private final ObjectMapper objectMapper;

    public BodyLimitFilter(AppProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        long limit = properties.getBodyLimit();
        return limit <= 0
                || !BODY_METHODS.contains(request.getMethod().toUpperCase())
                || request.getContentLengthLong() <= limit;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        SecurityConfig.write(response, objectMapper, 413, "Request payload is too large");
    }
}
