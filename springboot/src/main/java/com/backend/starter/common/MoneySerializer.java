package com.backend.starter.common;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;

public class MoneySerializer extends JsonSerializer<BigDecimal> {

    @Override
    public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        if (value == null) {
            gen.writeNull();
            return;
        }
        BigDecimal scaled = value.setScale(2, RoundingMode.HALF_UP);
        if (scaled.remainder(BigDecimal.ONE).compareTo(BigDecimal.ZERO) == 0) {
            gen.writeNumber(scaled.longValue());
            return;
        }
        gen.writeNumber(scaled.stripTrailingZeros());
    }
}
