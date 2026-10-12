package com.backend.starter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Global request limit from {@code _SECURITY_SPEC.md} section 2: 300 requests / 60s per IP,
 * {@code /health} and the API index excluded. The test profile keeps the limiter off, so this
 * class switches it on with a tiny limit to prove the behaviour deterministically.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "app.rate-limit.enabled=true",
        "app.rate-limit.max=2",
        "app.rate-limit.window-ms=60000"
})
class GlobalRateLimitTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void exemptPathsAreNeverLimited() throws Exception {
        for (int request = 0; request < 4; request++) {
            mockMvc.perform(get("/health")).andExpect(status().isOk());
            mockMvc.perform(get("/api/v1")).andExpect(status().isOk());
        }
    }

    @Test
    void thirdRequestWithinWindowIsRejectedWith429Envelope() throws Exception {
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-RateLimit-Limit", "2"))
                .andExpect(header().string("X-RateLimit-Remaining", "1"));

        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-RateLimit-Remaining", "0"));

        MvcResult overLimit = mockMvc.perform(get("/api/v1/categories")).andReturn();
        assertThat(overLimit.getResponse().getStatus()).isEqualTo(429);
        String retryAfter = overLimit.getResponse().getHeader("Retry-After");
        assertThat(retryAfter).isNotNull();
        assertThat(Long.parseLong(retryAfter)).isGreaterThanOrEqualTo(1L);

        String body = overLimit.getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(body);
        assertThat(json.path("success").asBoolean()).isFalse();
        assertThat(json.path("message").asText()).isEqualTo("Too many requests, please try again later");
        assertThat(json.has("errors")).isFalse();

        // Exempt paths keep working while the IP is throttled.
        mockMvc.perform(get("/health")).andExpect(status().isOk());
    }
}
