package com.backend.starter;

import com.backend.starter.user.entity.Role;
import com.backend.starter.user.entity.User;
import com.backend.starter.user.repo.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedAdmin() {
        if (userRepository.findByEmailIgnoreCase("admin@example.com").isPresent()) {
            return;
        }
        User admin = new User();
        admin.setName("Site Administrator");
        admin.setEmail("admin@example.com");
        admin.setPassword(passwordEncoder.encode("password"));
        admin.setRole(Role.admin);
        userRepository.saveAndFlush(admin);
    }

    @Test
    void healthHasNoEnvelope() throws Exception {
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.uptime").isNumber())
                .andExpect(jsonPath("$.timestamp").isString())
                .andExpect(jsonPath("$.success").doesNotExist());
    }

    @Test
    void registerLoginAndMeHidePassword() throws Exception {
        MvcResult registered = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Sari Wulandari","email":"sari@example.com","password":"password","password_confirmation":"password"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token_type").value("Bearer"))
                .andExpect(jsonPath("$.data.expires_in").value(3600))
                .andExpect(jsonPath("$.data.user.email").value("sari@example.com"))
                .andExpect(jsonPath("$.data.user.role").value("user"))
                .andExpect(jsonPath("$.data.user.password").doesNotExist())
                .andReturn();

        JsonNode body = objectMapper.readTree(registered.getResponse().getContentAsString());
        assertThat(body.toString()).doesNotContain("\"password\"");
        String token = body.path("data").path("token").asText();

        mockMvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("sari@example.com"))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        mockMvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Sari Wulandari"))
                .andExpect(jsonPath("$.data.password").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"sari@example.com\",\"password\":\"password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refresh_token").isString())
                .andExpect(jsonPath("$.data.user.password").doesNotExist());
    }

    @Test
    void validationAndBadLogin() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"A\",\"email\":\"not-an-email\",\"password\":\"short\",\"password_confirmation\":\"other\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.email").isArray())
                .andExpect(jsonPath("$.errors.password").isArray())
                .andExpect(jsonPath("$.errors.password_confirmation").isArray());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Sari Wulandari","email":"sari@example.com","password":"password","password_confirmation":"password"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Sari Lagi","email":"sari@example.com","password":"password","password_confirmation":"password"}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.email[0]").value("The email has already been taken."));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"sari@example.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("These credentials do not match our records"))
                .andExpect(jsonPath("$.errors").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid JSON payload"));
    }

    @Test
    void nonAdminCannotListUsers() throws Exception {
        String token = register("budi.buyer@example.com");
        mockMvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("This action is unauthorized"));
    }

    @Test
    void orderTotalStockAndOwnerCannotMarkPaid() throws Exception {
        String adminToken = login("admin@example.com", "password");
        JsonNode category = read(mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Widgets\"}"))
                .andExpect(status().isCreated())
                .andReturn());
        long categoryId = category.path("data").path("id").asLong();

        JsonNode product = read(mockMvc.perform(post("/api/v1/products")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category_id\":" + categoryId + ",\"name\":\"Brass Widget\",\"price\":1500.50,\"stock\":5}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.password").doesNotExist())
                .andReturn());
        long productId = product.path("data").path("id").asLong();
        assertThat(product.path("data").path("price").decimalValue()).isEqualByComparingTo(new BigDecimal("1500.50"));

        String buyer = register("buyer.orders@example.com");
        JsonNode order = read(mockMvc.perform(post("/api/v1/orders")
                        .header("Authorization", "Bearer " + buyer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"product_id\":" + productId + ",\"quantity\":2}],\"total\":1}"))
                .andExpect(status().isCreated())
                .andReturn());
        long orderId = order.path("data").path("id").asLong();
        assertThat(order.path("data").path("total").decimalValue()).isEqualByComparingTo(new BigDecimal("3001.00"));
        assertThat(order.path("data").path("items").get(0).path("price").decimalValue()).isEqualByComparingTo(new BigDecimal("1500.50"));

        JsonNode afterOrder = read(mockMvc.perform(get("/api/v1/products/" + productId))
                .andExpect(status().isOk())
                .andReturn());
        assertThat(afterOrder.path("data").path("stock").asInt()).isEqualTo(3);

        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + buyer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"paid\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("This action is unauthorized"));

        JsonNode still = read(mockMvc.perform(get("/api/v1/products/" + productId)).andReturn());
        assertThat(still.path("data").path("stock").asInt()).isEqualTo(3);

        mockMvc.perform(patch("/api/v1/orders/" + orderId + "/status")
                        .header("Authorization", "Bearer " + buyer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"cancelled\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("cancelled"));

        JsonNode restored = read(mockMvc.perform(get("/api/v1/products/" + productId)).andReturn());
        assertThat(restored.path("data").path("stock").asInt()).isEqualTo(5);
    }

    @Test
    void registerListQueryAndCategoryWritesAreValidated() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"A\",\"email\":\"bad\",\"password\":\"short\",\"password_confirmation\":\"nope\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.name").isArray())
                .andExpect(jsonPath("$.errors.email").isArray())
                .andExpect(jsonPath("$.errors.password").isArray())
                .andExpect(jsonPath("$.errors.password_confirmation").isArray());

        mockMvc.perform(get("/api/v1/categories")
                        .param("page", "0")
                        .param("limit", "0")
                        .param("sort", "nope")
                        .param("order", "sideways")
                        .param("include", "nope"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.page").isArray())
                .andExpect(jsonPath("$.errors.limit").isArray())
                .andExpect(jsonPath("$.errors.sort").isArray())
                .andExpect(jsonPath("$.errors.order").isArray())
                .andExpect(jsonPath("$.errors.include").isArray());

        mockMvc.perform(post("/api/v1/categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Valid Name\"}"))
                .andExpect(status().isUnauthorized());

        String token = login("admin@example.com", "password");
        mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"slug\":\"Bad Slug\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.name").isArray())
                .andExpect(jsonPath("$.errors.slug").isArray());

        mockMvc.perform(post("/api/v1/categories")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Valid Category Name\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.slug").value("valid-category-name"));
    }

    private String register(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Buyer\",\"email\":\"" + email + "\",\"password\":\"password\",\"password_confirmation\":\"password\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("token").asText();
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("token").asText();
    }

    private JsonNode read(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
