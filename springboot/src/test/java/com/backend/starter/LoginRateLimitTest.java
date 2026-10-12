package com.backend.starter;

import com.backend.starter.security.LoginAttemptService;
import com.backend.starter.user.entity.Role;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Login attempt limiter coverage from {@code _SECURITY_SPEC.md} section 1.4.
 *
 * <p>The in-memory counters survive transactions, so they are cleared before and after every
 * test through {@link LoginAttemptService#resetLoginRateLimits()}.</p>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class LoginRateLimitTest {

    private static final String LOCK_MESSAGE = "Too many failed login attempts. Please try again later.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private LoginAttemptService loginAttemptService;

    @BeforeEach
    void resetCounters() {
        loginAttemptService.resetLoginRateLimits();
        if (userRepository.findByEmailIgnoreCase("admin@example.com").isEmpty()) {
            User admin = new User();
            admin.setName("Site Administrator");
            admin.setEmail("admin@example.com");
            admin.setPassword(passwordEncoder.encode("password"));
            admin.setRole(Role.admin);
            userRepository.saveAndFlush(admin);
        }
    }

    @AfterEach
    void resetCountersAfterTest() {
        loginAttemptService.resetLoginRateLimits();
    }

    @Test
    void threeFailuresThenFourthAttemptIsLocked() throws Exception {
        register("lock.a@example.com");

        for (int attempt = 1; attempt <= 3; attempt++) {
            login("lock.a@example.com", "wrong-password-" + attempt)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.message").value("These credentials do not match our records"))
                    .andExpect(jsonPath("$.errors").doesNotExist());
        }

        MvcResult locked = login("lock.a@example.com", "wrong-password-4")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE))
                .andExpect(jsonPath("$.errors").doesNotExist())
                .andReturn();
        assertThat(Long.parseLong(locked.getResponse().getHeader("Retry-After"))).isGreaterThanOrEqualTo(1L);
    }

    @Test
    void correctPasswordAlsoRejectedWhileLocked() throws Exception {
        register("lock.b@example.com");

        for (int attempt = 1; attempt <= 3; attempt++) {
            login("lock.b@example.com", "wrong-password").andExpect(status().isUnauthorized());
        }

        MvcResult locked = login("lock.b@example.com", "password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE))
                .andExpect(jsonPath("$.errors").doesNotExist())
                .andReturn();
        assertThat(Long.parseLong(locked.getResponse().getHeader("Retry-After"))).isGreaterThanOrEqualTo(1L);
    }

    @Test
    void unknownEmailFailuresCountTowardTheSameCounter() throws Exception {
        for (int attempt = 1; attempt <= 3; attempt++) {
            login("ghost.lock@example.com", "wrong-password")
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("These credentials do not match our records"));
        }

        login("ghost.lock@example.com", "password")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE))
                .andExpect(jsonPath("$.errors").doesNotExist());
    }

    @Test
    void successfulLoginResetsTheEmailCounter() throws Exception {
        register("reset.me@example.com");

        login("reset.me@example.com", "wrong-password").andExpect(status().isUnauthorized());
        login("reset.me@example.com", "wrong-password").andExpect(status().isUnauthorized());
        login("reset.me@example.com", "password").andExpect(status().isOk());

        // Without the reset the second failure here would already be locked out.
        login("reset.me@example.com", "wrong-password").andExpect(status().isUnauthorized());
        login("reset.me@example.com", "wrong-password").andExpect(status().isUnauthorized());
        login("reset.me@example.com", "wrong-password").andExpect(status().isUnauthorized());

        // Three fresh failures still lead to the lock, so the limiter kept working.
        login("reset.me@example.com", "wrong-password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE));
    }

    @Test
    void lockoutIsPerEmail() throws Exception {
        register("lock.one@example.com");
        register("lock.two@example.com");

        for (int attempt = 1; attempt <= 3; attempt++) {
            login("lock.one@example.com", "wrong-password").andExpect(status().isUnauthorized());
        }

        login("lock.one@example.com", "password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE));

        // The second account is unaffected by the first one's lockout.
        login("lock.two@example.com", "password").andExpect(status().isOk());
    }

    @Test
    void ipCounterLocksAfterTenFailuresAcrossEmails() throws Exception {
        for (int attempt = 1; attempt <= 10; attempt++) {
            login("ip.ghost." + attempt + "@example.com", "wrong-password")
                    .andExpect(status().isUnauthorized());
        }

        MvcResult locked = login("ip.fresh@example.com", "password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value(LOCK_MESSAGE))
                .andExpect(jsonPath("$.errors").doesNotExist())
                .andReturn();
        assertThat(Long.parseLong(locked.getResponse().getHeader("Retry-After"))).isGreaterThanOrEqualTo(1L);
    }

    private void register(String email) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Locker\",\"email\":\"" + email
                                + "\",\"password\":\"password\",\"password_confirmation\":\"password\"}"))
                .andExpect(status().isCreated());
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }
}
