package com.backend.starter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hardening coverage from {@code _SECURITY_SPEC.md} section 3: security headers, fingerprint
 * removal, CORS allowlist and the 100kb body cap.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityHardeningTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void securityHeadersAreSetOnEveryResponse() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Cross-Origin-Opener-Policy", "same-origin"))
                .andExpect(header().string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'"))
                .andExpect(header().doesNotExist("Strict-Transport-Security"));

        mockMvc.perform(get("/api/v1"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'"));
    }

    @Test
    void frameworkFingerprintIsRemoved() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Server"))
                .andExpect(header().doesNotExist("X-Powered-By"))
                .andExpect(header().doesNotExist("X-Application-Context"));
    }

    @Test
    void varyOriginIsAlwaysPresent() throws Exception {
        MvcResult result = mockMvc.perform(get("/health")).andReturn();
        assertThat(varyTokens(result)).contains("origin");
    }

    @Test
    void swaggerUiPageGetsRelaxedButScopedCsp() throws Exception {
        mockMvc.perform(get("/api/v1/docs"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Security-Policy",
                        org.hamcrest.Matchers.containsString("default-src 'self'")))
                .andExpect(header().string("X-Frame-Options", "DENY"));
    }

    @Test
    void corsPreflightAllowedOnlyForListedOrigins() throws Exception {
        mockMvc.perform(options("/api/v1/categories")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Max-Age", "600"))
                .andExpect(header().string("Access-Control-Allow-Methods",
                        org.hamcrest.Matchers.containsString("GET")));

        mockMvc.perform(get("/api/v1/categories")
                        .header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));

        MvcResult rejectedPreflight = mockMvc.perform(options("/api/v1/categories")
                .header("Origin", "http://evil.test")
                .header("Access-Control-Request-Method", "GET")).andReturn();
        assertThat(rejectedPreflight.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();

        MvcResult rejectedActual = mockMvc.perform(get("/api/v1/categories")
                .header("Origin", "http://evil.test")).andReturn();
        assertThat(rejectedActual.getResponse().getHeader("Access-Control-Allow-Origin")).isNull();
    }

    @Test
    void corsNeverAllowsWildcardOrigin() throws Exception {
        // The app property falls back to "*", but the filter maps it to the default allowlist.
        MvcResult preflight = mockMvc.perform(options("/api/v1/categories")
                .header("Origin", "http://localhost:4200")
                .header("Access-Control-Request-Method", "GET")).andReturn();
        assertThat(preflight.getResponse().getHeader("Access-Control-Allow-Origin"))
                .isEqualTo("http://localhost:4200");
    }

    @Test
    void preflightResponseAlsoCarriesSecurityHeaders() throws Exception {
        mockMvc.perform(options("/api/v1/categories")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'"));
    }

    @Test
    void oversizedBodiesAreRejectedWithTheStandardEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("x".repeat(110_000)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Request payload is too large"))
                .andExpect(jsonPath("$.errors").doesNotExist());

        // A normal sized body still goes through.
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Small Body\",\"email\":\"small.body@example.com\","
                                + "\"password\":\"password\",\"password_confirmation\":\"password\"}"))
                .andExpect(status().isCreated());
    }

    private static java.util.List<String> varyTokens(MvcResult result) {
        String vary = result.getResponse().getHeader("Vary");
        if (vary == null) {
            return java.util.List.of();
        }
        return Arrays.stream(vary.split(",")).map(String::trim).map(String::toLowerCase).toList();
    }
}
