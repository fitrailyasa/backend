package com.backend.starter.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApi(ApiException exception) {
        if (exception.getStatus() == 422) {
            return ResponseEntity.status(422).body(ApiResponse.fail(exception.getMessage(), exception.getErrors()));
        }
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(exception.getStatus());
        if (exception.getRetryAfterSeconds() != null) {
            builder.header(HttpHeaders.RETRY_AFTER, String.valueOf(exception.getRetryAfterSeconds()));
        }
        return builder.body(ApiResponse.fail(exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error -> {
            String field = snake(error.getField());
            errors.computeIfAbsent(field, key -> new ArrayList<>()).add(error.getDefaultMessage());
        });
        return ResponseEntity.status(422).body(ApiResponse.fail("Validation failed", errors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadable(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(ApiResponse.fail("Invalid JSON payload"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleTooLarge(MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiResponse.fail("Request payload is too large"));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleIntegrity(DataIntegrityViolationException exception) {
        String text = exception.getMostSpecificCause().getMessage();
        String lower = text == null ? "" : text.toLowerCase(Locale.ROOT);
        if (lower.contains("email")) {
            return ResponseEntity.status(422).body(ApiResponse.fail(
                    "Validation failed",
                    Map.of("email", List.of("The email has already been taken."))
            ));
        }
        if (lower.contains("slug")) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.fail("The slug has already been taken"));
        }
        if (lower.contains("foreign") || lower.contains("referential") || lower.contains("parent row") || lower.contains("constraint")) {
            if (lower.contains("unique") || lower.contains("duplicate")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.fail("Resource already exists"));
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.fail("Resource is still referenced by other records"));
        }
        log.error("Data integrity violation", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.fail("Internal server error"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(NoResourceFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.fail("Resource not found"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethod(HttpRequestMethodNotSupportedException exception) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(ApiResponse.fail("Method not allowed"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("{} {} failed", request.getMethod(), request.getRequestURI(), exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.fail("Internal server error"));
    }

    private static String snake(String field) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < field.length(); i++) {
            char character = field.charAt(i);
            if (Character.isUpperCase(character)) {
                builder.append('_').append(Character.toLowerCase(character));
            } else {
                builder.append(character);
            }
        }
        return builder.toString();
    }
}
