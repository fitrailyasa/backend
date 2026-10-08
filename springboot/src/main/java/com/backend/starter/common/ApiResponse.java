package com.backend.starter.common;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@JsonSerialize(using = ApiResponse.Serializer.class)
public class ApiResponse<T> {

    private final boolean success;
    private final String message;
    private final T data;
    private final boolean includeData;
    private final PageMeta meta;
    private final Map<String, List<String>> errors;

    private ApiResponse(boolean success, String message, T data, boolean includeData, PageMeta meta, Map<String, List<String>> errors) {
        this.success = success;
        this.message = message;
        this.data = data;
        this.includeData = includeData;
        this.meta = meta;
        this.errors = errors;
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, true, null, null);
    }

    public static <T> ApiResponse<T> page(String message, T data, PageMeta meta) {
        return new ApiResponse<>(true, message, data, true, meta, null);
    }

    public static ApiResponse<Void> fail(String message) {
        return new ApiResponse<>(false, message, null, false, null, null);
    }

    public static ApiResponse<Void> fail(String message, Map<String, List<String>> errors) {
        return new ApiResponse<>(false, message, null, false, null, errors);
    }

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public T getData() {
        return data;
    }

    public boolean isIncludeData() {
        return includeData;
    }

    public PageMeta getMeta() {
        return meta;
    }

    public Map<String, List<String>> getErrors() {
        return errors;
    }

    public static final class Serializer extends JsonSerializer<ApiResponse<?>> {
        @Override
        public void serialize(ApiResponse<?> value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
            gen.writeStartObject();
            gen.writeBooleanField("success", value.isSuccess());
            gen.writeStringField("message", value.getMessage());
            if (value.isIncludeData()) {
                gen.writeFieldName("data");
                serializers.defaultSerializeValue(value.getData(), gen);
            }
            if (value.getMeta() != null) {
                gen.writeFieldName("meta");
                serializers.defaultSerializeValue(value.getMeta(), gen);
            }
            if (value.getErrors() != null && !value.getErrors().isEmpty()) {
                gen.writeFieldName("errors");
                serializers.defaultSerializeValue(value.getErrors(), gen);
            }
            gen.writeEndObject();
        }
    }
}
