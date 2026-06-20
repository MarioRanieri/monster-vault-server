package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.security.JwtUtil;
import com.monstervault.service.CanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CanController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000"
})
class CanControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockBean CanService canService;
    // SecurityConfig espone PasswordEncoder — serve il @MockBean se non è disponibile nel contesto ridotto
    @MockBean PasswordEncoder passwordEncoder;

    private String bearerToken;

    @BeforeEach
    void setUp() {
        bearerToken = "Bearer " + jwtUtil.generate("testadmin");
    }

    // --- GET /api/cans ---

    @Test
    void getAll_noAuth_returns200WithEmptyList() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getAll_noAuth_returns200WithCans() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setNome("Birra Alpha");
        when(canService.getAll()).thenReturn(List.of(c));

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("1"))
                .andExpect(jsonPath("$[0].nome").value("Birra Alpha"));
    }

    // --- GET /api/cans/{id} ---

    @Test
    void getById_existing_returns200WithJson() throws Exception {
        Can c = new Can();
        c.setId("abc");
        c.setNome("Birra Beta");
        c.setSku("SKU-001");
        when(canService.getById("abc")).thenReturn(c);

        mockMvc.perform(get("/api/cans/abc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc"))
                .andExpect(jsonPath("$.nome").value("Birra Beta"))
                .andExpect(jsonPath("$.sku").value("SKU-001"));
    }

    @Test
    void getById_notFound_returns404() throws Exception {
        when(canService.getById("missing")).thenReturn(null);

        mockMvc.perform(get("/api/cans/missing"))
                .andExpect(status().isNotFound());
    }

    // --- POST /api/cans ---

    @Test
    void create_withValidJwt_returns200AndDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"new1\",\"nome\":\"Nuova Latta\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("new1"))
                .andExpect(jsonPath("$.nome").value("Nuova Latta"));

        verify(canService).save(argThat(c -> "new1".equals(c.getId())));
    }

    // --- DELETE /api/cans/{id} ---

    @Test
    void delete_withValidJwt_returns204AndSoftDeletes() throws Exception {
        mockMvc.perform(delete("/api/cans/abc")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).softDelete("abc");
    }

    @Test
    void permanentDelete_withValidJwt_returns204() throws Exception {
        mockMvc.perform(delete("/api/cans/abc/permanent")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).permanentDelete("abc");
    }

    @Test
    void restore_withValidJwt_returns204() throws Exception {
        mockMvc.perform(put("/api/cans/abc/restore")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).restore("abc");
    }

    @Test
    void create_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"x\",\"nome\":\"Latta\"}"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).save(any());
    }

    @Test
    void delete_withoutAuth_returns401() throws Exception {
        mockMvc.perform(delete("/api/cans/abc"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).softDelete(any());
    }

    // --- PUT /api/cans/{id} ---

    @Test
    void update_withValidJwt_returns200AndDelegatesToService() throws Exception {
        mockMvc.perform(put("/api/cans/abc")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Latta Aggiornata\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc"))
                .andExpect(jsonPath("$.nome").value("Latta Aggiornata"));

        verify(canService).update(argThat(c -> "abc".equals(c.getId())));
    }

    @Test
    void update_withoutAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/cans/abc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Latta Aggiornata\"}"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).save(any());
    }

    // --- DELETE /api/cans (deleteAll) ---

        @Test
    void deleteAll_withoutAuth_returns401() throws Exception {
        mockMvc.perform(delete("/api/cans"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).deleteAll();
    }

        @Test
    void deleteAll_withJwtAndConfirmHeader_returns204() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken)
                        .header("X-Confirm-Delete", "all"))
                .andExpect(status().isNoContent());

        verify(canService).deleteAll();
    }

        @Test
    void deleteAll_withJwtWithoutConfirmHeader_returns400() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken))
                .andExpect(status().isBadRequest());

        verify(canService, never()).deleteAll();
    }

    @Test
    void create_withoutId_returns400() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Latta senza ID\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.id").value("id obbligatorio"));

        verify(canService, never()).save(any());
    }
}
