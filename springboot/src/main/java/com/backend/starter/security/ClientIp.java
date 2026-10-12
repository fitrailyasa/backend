package com.backend.starter.security;

import com.backend.starter.config.AppProperties;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Resolves the client IP used by the rate limiters.
 *
 * <p>{@code X-Forwarded-For} is only honoured when {@code TRUST_PROXY} is on: trusting it by
 * default would let any caller spoof the IP that the limits are keyed on.</p>
 */
@Component
public class ClientIp {

    private final AppProperties properties;

    public ClientIp(AppProperties properties) {
        this.properties = properties;
    }

    public String resolve(HttpServletRequest request) {
        if (properties.isTrustProxy()) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String first = forwarded.split(",")[0].trim();
                if (!first.isEmpty()) {
                    return first;
                }
            }
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }
}
