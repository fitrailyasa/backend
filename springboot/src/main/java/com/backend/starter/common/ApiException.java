package com.backend.starter.common;

import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

public class ApiException extends RuntimeException {

    private final int status;
    private final Map<String, List<String>> errors;
    private final Long retryAfterSeconds;

    public ApiException(int status, String message, Map<String, List<String>> errors) {
        this(status, message, errors, null);
    }

    public ApiException(int status, String message, Map<String, List<String>> errors, Long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.errors = errors;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, List<String>> getErrors() {
        return errors;
    }

    /** Value for the {@code Retry-After} header, or {@code null} when the exception carries none. */
    public Long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }

    public static ApiException of(HttpStatus status, String message) {
        return new ApiException(status.value(), message, null);
    }

    public static ApiException badRequest(String message) {
        return of(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException unauthorized(String message) {
        return of(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException forbidden(String message) {
        return of(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException notFound(String message) {
        return of(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException conflict(String message) {
        return of(HttpStatus.CONFLICT, message);
    }

    public static ApiException unprocessable(Map<String, List<String>> errors) {
        return new ApiException(422, "Validation failed", errors);
    }

    public static ApiException tooManyRequests(String message) {
        return of(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    public static ApiException tooManyLoginAttempts(long retryAfterSeconds) {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "Too many failed login attempts. Please try again later.",
                null,
                retryAfterSeconds
        );
    }
}
