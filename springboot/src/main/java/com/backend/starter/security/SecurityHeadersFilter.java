package com.backend.starter.security;

import com.backend.starter.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * Writes the hardening headers from {@code _SECURITY_SPEC.md} section 3 on every response and
 * strips framework fingerprints ({@code Server}, {@code X-Powered-By}, {@code X-Application-Context}).
 *
 * <p>The response is wrapped for the rest of the chain so headers added later (by the container or
 * by other filters) cannot re-introduce the fingerprint headers, and repeated {@code Vary} values
 * stay de-duplicated.</p>
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    private static final String PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()";
    /** JSON API default: the app serves no same-origin assets besides the docs page. */
    private static final String STRICT_CSP = "default-src 'none'";
    /**
     * The self-hosted Swagger UI page ({@code /api/v1/docs}) loads webjar assets from the same
     * origin plus one inline bootstrap script, so its policy is relaxed to {@code default-src 'self'}.
     */
    private static final String DOCS_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            + "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; "
            + "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    private static final Set<String> SUPPRESSED_HEADERS =
            Set.of("server", "x-powered-by", "x-application-context");

    private final AppProperties properties;

    public SecurityHeadersFilter(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
        response.setHeader("Content-Security-Policy", servesDocs(request) ? DOCS_CSP : STRICT_CSP);
        addVaryOrigin(response);
        if (properties.isEnableHsts() && isHttps(request)) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
        filterChain.doFilter(request, new FingerprintFreeResponse(response));
    }

    private void addVaryOrigin(HttpServletResponse response) {
        String existing = response.getHeader("Vary");
        if (existing == null || existing.isBlank()) {
            response.setHeader("Vary", "Origin");
        } else if (!containsToken(existing, "Origin")) {
            response.addHeader("Vary", "Origin");
        }
    }

    private boolean isHttps(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        if (!properties.isTrustProxy()) {
            return false;
        }
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return forwardedProto != null && "https".equalsIgnoreCase(forwardedProto.split(",")[0].trim());
    }

    private static boolean servesDocs(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/v1/docs")
                || path.startsWith("/webjars")
                || path.startsWith("/swagger-ui");
    }

    private static boolean containsToken(String headerValue, String token) {
        for (String existing : headerValue.split(",")) {
            if (existing.trim().equalsIgnoreCase(token.trim())) {
                return true;
            }
        }
        return false;
    }

    private static final class FingerprintFreeResponse extends HttpServletResponseWrapper {

        private FingerprintFreeResponse(HttpServletResponse response) {
            super(response);
        }

        @Override
        public void setHeader(String name, String value) {
            if (isSuppressed(name)) {
                return;
            }
            if (isVary(name) && value != null) {
                String current = getHeader("Vary");
                if (current != null && !current.isBlank()) {
                    if (containsAllTokens(current, value)) {
                        return;
                    }
                    super.setHeader(name, current + ", " + value);
                    return;
                }
            }
            super.setHeader(name, value);
        }

        @Override
        public void addHeader(String name, String value) {
            if (isSuppressed(name)) {
                return;
            }
            if (isVary(name) && value != null) {
                String current = getHeader("Vary");
                if (current != null && containsAllTokens(current, value)) {
                    return;
                }
            }
            super.addHeader(name, value);
        }

        private static boolean isSuppressed(String name) {
            return name != null && SUPPRESSED_HEADERS.contains(name.toLowerCase(Locale.ROOT));
        }

        private static boolean isVary(String name) {
            return "Vary".equalsIgnoreCase(name);
        }

        /** True when every token of {@code value} already appears in {@code headerValue}. */
        private static boolean containsAllTokens(String headerValue, String value) {
            for (String token : value.split(",")) {
                if (!token.isBlank() && !containsToken(headerValue, token)) {
                    return false;
                }
            }
            return true;
        }
    }
}
