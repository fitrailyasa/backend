package com.backend.starter.config;

import com.backend.starter.common.UtcDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer utcTimestamps() {
        return builder -> builder.serializerByType(LocalDateTime.class, new UtcDateTimeSerializer());
    }
}
