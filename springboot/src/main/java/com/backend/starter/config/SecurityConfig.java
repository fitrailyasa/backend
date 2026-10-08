package com.backend.starter.config;

import com.backend.starter.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class SecurityConfig {

    private final AppProperties properties;

    public SecurityConfig(AppProperties properties) {
        this.properties = properties;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        int rounds = Math.min(15, Math.max(4, properties.getBcryptRounds()));
        return new BCryptPasswordEncoder(rounds);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            com.backend.starter.security.JwtAuthenticationFilter jwtAuthenticationFilter,
            com.backend.starter.security.RateLimitFilter rateLimitFilter,
            ObjectMapper objectMapper
    ) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .exceptionHandling(handler -> handler
                        .authenticationEntryPoint((request, response, authException) ->
                                write(response, objectMapper, 401, "Authentication token is missing"))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                write(response, objectMapper, 403, "This action is unauthorized"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()
                        .requestMatchers(
                                "/api/v1/docs",
                                "/api/v1/docs/**",
                                "/api/v1/docs.json",
                                "/api/v1/docs.json/**",
                                "/api/v1/swagger-ui/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs",
                                "/v3/api-docs/**",
                                "/webjars/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/categories", "/api/v1/categories/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/tags", "/api/v1/tags/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/products/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/products", "/api/v1/products/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/comments").permitAll()
                        .requestMatchers("/api/v1/users/me").authenticated()
                        .requestMatchers("/api/v1/users", "/api/v1/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/categories").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/categories/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/tags").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/tags/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/tags/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/tags/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/v1/products").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/v1/products/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/products/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/products/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/orders", "/api/v1/orders/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitFilter, com.backend.starter.security.JwtAuthenticationFilter.class);
        return http.build();
    }

    private CorsConfigurationSource corsSource() {
        return request -> {
            CorsConfiguration configuration = new CorsConfiguration();
            String raw = properties.getCorsOrigins() == null ? "*" : properties.getCorsOrigins().trim();
            if (raw.isEmpty() || "*".equals(raw)) {
                configuration.setAllowedOriginPatterns(List.of("*"));
            } else {
                configuration.setAllowedOrigins(Arrays.stream(raw.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
            }
            configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
            configuration.setAllowedHeaders(List.of("*"));
            configuration.setExposedHeaders(List.of("X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"));
            configuration.setAllowCredentials(false);
            return configuration;
        };
    }

    public static void write(HttpServletResponse response, ObjectMapper objectMapper, int status, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), ApiResponse.fail(message));
    }
}
