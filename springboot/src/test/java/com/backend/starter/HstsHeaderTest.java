package com.backend.starter;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HSTS only appears when the request is HTTPS and {@code ENABLE_HSTS} is on
 * ({@code _SECURITY_SPEC.md} section 3.1).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "app.enable-hsts=true")
class HstsHeaderTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void hstsIsWrittenForHttpsRequestsOnly() throws Exception {
        mockMvc.perform(get("/health").secure(true))
                .andExpect(status().isOk())
                .andExpect(header().string("Strict-Transport-Security", "max-age=31536000; includeSubDomains"));

        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist("Strict-Transport-Security"));
    }
}
