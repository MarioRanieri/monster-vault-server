package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.security.JwtUtil;
import com.monstervault.service.CanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Test degli header HTTP di sicurezza e delle funzionalità di caching (ETag).
 *
 * Non usa browser — verifica le risposte HTTP direttamente tramite MockMvc.
 * Copre:
 *   - Content-Security-Policy
 *   - X-Frame-Options: DENY
 *   - X-Content-Type-Options: nosniff
 *   - Referrer-Policy
 *   - ETag / 304 Not Modified
 */
@WebMvcTest(controllers = CanController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.expiration=86400000"
})
class SecurityHeadersTest {

    @Autowired MockMvc mockMvc;
    @MockBean CanService canService;
    @MockBean PasswordEncoder passwordEncoder;

    private List<Can> twoTestCans() {
        Can c1 = new Can(); c1.setId("A001"); c1.setNome("Alpha"); c1.setUpdatedAt(1000L);
        Can c2 = new Can(); c2.setId("A002"); c2.setNome("Beta");  c2.setUpdatedAt(2000L);
        return List.of(c1, c2);
    }

    // ── ETag ─────────────────────────────────────────────────────────────────

    @Test
    void getAll_returnsETagHeader() throws Exception {
        when(canService.getAll()).thenReturn(twoTestCans());

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(header().string("ETag", matchesPattern("\"[0-9a-f]+\"")));
    }

    @Test
    void getAll_withMatchingETag_returns304() throws Exception {
        when(canService.getAll()).thenReturn(twoTestCans());

        // Prima richiesta: ottieni l'ETag
        String etag = mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getHeader("ETag");

        // Seconda richiesta con lo stesso ETag: deve tornare 304
        mockMvc.perform(get("/api/cans").header("If-None-Match", etag))
                .andExpect(status().isNotModified());
    }

    @Test
    void getAll_withDifferentETag_returns200WithBody() throws Exception {
        when(canService.getAll()).thenReturn(twoTestCans());

        mockMvc.perform(get("/api/cans").header("If-None-Match", "\"stale\""))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"));
    }

    @Test
    void getAll_etagIsDeterministic() throws Exception {
        when(canService.getAll()).thenReturn(twoTestCans());

        // Due richieste identiche → stesso ETag
        String etag1 = mockMvc.perform(get("/api/cans"))
                .andReturn().getResponse().getHeader("ETag");
        String etag2 = mockMvc.perform(get("/api/cans"))
                .andReturn().getResponse().getHeader("ETag");

        org.assertj.core.api.Assertions.assertThat(etag1).isEqualTo(etag2);
    }

    @Test
    void getAll_etagChangesWhenCollectionChanges() throws Exception {
        Can c1 = new Can(); c1.setId("A001"); c1.setNome("Alpha"); c1.setUpdatedAt(1000L);
        Can c2 = new Can(); c2.setId("A001"); c2.setNome("Alpha"); c2.setUpdatedAt(9999L); // updatedAt diverso

        when(canService.getAll()).thenReturn(List.of(c1));
        String etag1 = mockMvc.perform(get("/api/cans"))
                .andReturn().getResponse().getHeader("ETag");

        when(canService.getAll()).thenReturn(List.of(c2));
        String etag2 = mockMvc.perform(get("/api/cans"))
                .andReturn().getResponse().getHeader("ETag");

        org.assertj.core.api.Assertions.assertThat(etag1).isNotEqualTo(etag2);
    }

    // ── Security headers ─────────────────────────────────────────────────────

    @Test
    void anyEndpoint_hasCspHeader() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(header().string("Content-Security-Policy", containsString("default-src 'self'")))
                .andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")));
    }

    @Test
    void anyEndpoint_hasXFrameOptions() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(header().string("X-Frame-Options", "DENY"));
    }

    @Test
    void anyEndpoint_hasXContentTypeOptions() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    void anyEndpoint_hasReferrerPolicy() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"));
    }

    @Test
    void anyEndpoint_hasPermissionsPolicy() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(header().exists("Permissions-Policy"))
                .andExpect(header().string("Permissions-Policy", containsString("camera=()")));
    }
}
