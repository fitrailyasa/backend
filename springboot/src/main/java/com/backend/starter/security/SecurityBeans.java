package com.backend.starter.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityBeans {

    @Bean
    public JwtService jwtService(com.backend.starter.config.AppProperties properties) {
        return new JwtService(properties);
    }

    @Bean
    public TokenBlacklist tokenBlacklist() {
        return new TokenBlacklist();
    }
}
