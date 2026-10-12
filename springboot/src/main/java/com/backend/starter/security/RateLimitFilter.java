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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory request limiters (see {@code _SECURITY_SPEC.md} section 2):
 *
 * <ul>
 *   <li>a global limit of {@code RATE_LIMIT_MAX} requests per {@code RATE_LIMIT_WINDOW_MS} per
 *       client IP on every route except {@code /health} and the API index, skipped automatically
 *       in the test profile and when {@code RATE_LIMIT_ENABLED=false};</li>
 *   <li>the pre-existing stricter per-IP limiter on the auth routes (register / login / refresh),
 *       keyed per endpoint, tunable with {@code AUTH_RATE_LIMIT_MAX} /
 *       {@code AUTH_RATE_LIMIT_WINDOW_MS}.</li>
 * </ul>
 *
 * <p>{@code X-Forwarded-For} is only trusted when {@code TRUST_PROXY} is on (see {@link ClientIp}).</p>
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> GLOBAL_EXEMPT_PATHS = Set.of("/health", "/api/v1", "/");
    private static final Set<String> AUTH_ROUTES = Set.of(
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh"
    );

    private final AppProperties properties;
    private final ObjectMapper objectMapper;
    private final ClientIp clientIp;
    private final Map<String, Window> globalWindows = new ConcurrentHashMap<>();
    private final Map<String, Window> authWindows = new ConcurrentHashMap<>();

    public RateLimitFilter(AppProperties properties, ObjectMapper objectMapper, ClientIp clientIp) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.clientIp = clientIp;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !globalApplies(request) && !authApplies(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long now = System.currentTimeMillis();
        String path = request.getRequestURI();

        if (globalApplies(request)) {
            AppProperties.RateLimit limit = properties.getRateLimit();
            if (limit.getMax() > 0 && overLimit(globalWindows, clientIp.resolve(request), limit.getMax(),
                    limit.getWindowMs(), now, response)) {
                reject(response);
                return;
            }
        }

        if (authApplies(request)) {
            AppProperties.AuthRateLimit limit = properties.getAuthRateLimit();
            String key = clientIp.resolve(request) + "|" + path;
            if (limit.getMax() > 0 && overLimit(authWindows, key, limit.getMax(),
                    limit.getWindowMs(), now, response)) {
                reject(response);
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean globalApplies(HttpServletRequest request) {
        if (!properties.getRateLimit().isEnabled()) {
            return false;
        }
        String path = normalize(request.getRequestURI());
        return !GLOBAL_EXEMPT_PATHS.contains(path);
    }

    private boolean authApplies(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod())
                && AUTH_ROUTES.contains(request.getRequestURI());
    }

    /** Counts one request in the window; returns true when the caller is over the limit. */
    private static boolean overLimit(Map<String, Window> windows, String key, int max, long windowMs,
                                     long now, HttpServletResponse response) {
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
            return true;
        }
        return false;
    }

    private void reject(HttpServletResponse response) throws IOException {
        SecurityConfig.write(response, objectMapper, 429, "Too many requests, please try again later");
    }

    private static String normalize(String path) {
        if (path == null) {
            return "/";
        }
        if (path.length() > 1 && path.endsWith("/")) {
            return path.substring(0, path.length() - 1);
        }
        return path;
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
