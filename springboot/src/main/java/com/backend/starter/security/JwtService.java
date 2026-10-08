package com.backend.starter.security;

import com.backend.starter.common.ApiException;
import com.backend.starter.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

public class JwtService {

    public static final String ACCESS = "access";
    public static final String REFRESH = "refresh";

    private final AppProperties.Jwt properties;
    private final SecretKey accessKey;
    private final SecretKey refreshKey;

    public JwtService(AppProperties properties) {
        this.properties = properties.getJwt();
        this.accessKey = hmac(this.properties.accessKey());
        this.refreshKey = hmac(this.properties.refreshKey());
    }

    public String signAccess(Long userId, String role) {
        return sign(userId, role, ACCESS, accessKey, properties.getExpiresIn());
    }

    public String signRefresh(Long userId, String role) {
        return sign(userId, role, REFRESH, refreshKey, properties.getRefreshExpiresIn());
    }

    public long accessExpiresIn() {
        return properties.getExpiresIn();
    }

    public Claims parseAccess(String token) {
        Claims claims = parse(token, accessKey);
        if (!ACCESS.equals(claims.get("typ", String.class))) {
            throw ApiException.unauthorized("Token is invalid");
        }
        return claims;
    }

    public Claims parseRefresh(String token) {
        Claims claims = parse(token, refreshKey);
        if (!REFRESH.equals(claims.get("typ", String.class))) {
            throw ApiException.unauthorized("Token is invalid");
        }
        return claims;
    }

    private String sign(Long userId, String role, String typ, SecretKey key, long ttlSeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("role", role)
                .claim("typ", typ)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(ttlSeconds)))
                .issuer(properties.getIssuer())
                .audience().add(properties.getAudience()).and()
                .signWith(key)
                .compact();
    }

    private Claims parse(String token, SecretKey key) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!properties.getIssuer().equals(claims.getIssuer())
                    || claims.getAudience() == null
                    || !claims.getAudience().contains(properties.getAudience())) {
                throw ApiException.unauthorized("Token is invalid");
            }
            if (claims.getSubject() == null || claims.getId() == null) {
                throw ApiException.unauthorized("Token is invalid");
            }
            return claims;
        } catch (ExpiredJwtException exception) {
            throw ApiException.unauthorized("Token has expired");
        } catch (ApiException exception) {
            throw exception;
        } catch (JwtException | IllegalArgumentException exception) {
            throw ApiException.unauthorized("Token is invalid");
        }
    }

    private static SecretKey hmac(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            try {
                bytes = MessageDigest.getInstance("SHA-256").digest(bytes);
            } catch (NoSuchAlgorithmException exception) {
                throw new IllegalStateException(exception);
            }
        }
        return Keys.hmacShaKeyFor(bytes);
    }
}
