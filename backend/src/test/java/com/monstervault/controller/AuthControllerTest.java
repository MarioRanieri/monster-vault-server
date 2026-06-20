package com.monstervault.controller;

import com.monstervault.security.JwtUtil;
import com.monstervault.service.AuthResponse;
import com.monstervault.service.AuthService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AuthController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000",
        "app.jwt.refresh-cookie-secure=false"
})
class AuthControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean AuthService authService;
    @MockBean PasswordEncoder passwordEncoder;

    // ── login ────────────────────────────────────────────────────────────────

    @Test
    void login_validCredentials_returnsAccessTokenAndSetsCookie() throws Exception {
        when(authService.authenticate("testadmin", "testpass"))
                .thenReturn(Optional.of(new AuthResponse("access-jwt", "refresh-jwt")));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testadmin\",\"password\":\"testpass\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-jwt"))
                .andExpect(jsonPath("$.token").doesNotExist())
                .andExpect(cookie().exists(AuthController.REFRESH_COOKIE))
                .andExpect(cookie().value(AuthController.REFRESH_COOKIE, "refresh-jwt"))
                .andExpect(cookie().httpOnly(AuthController.REFRESH_COOKIE, true))
                .andExpect(cookie().path(AuthController.REFRESH_COOKIE, "/api/auth"));
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        when(authService.authenticate(anyString(), anyString())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"testadmin\",\"password\":\"wrongpass\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_wrongUsername_returns401() throws Exception {
        when(authService.authenticate(anyString(), anyString())).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"hacker\",\"password\":\"testpass\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── refresh ──────────────────────────────────────────────────────────────

    @Test
    void refresh_withValidCookie_returnsNewAccessTokenAndRotatesCookie() throws Exception {
        when(authService.refresh("old-refresh"))
                .thenReturn(Optional.of(new AuthResponse("new-access", "new-refresh")));

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(AuthController.REFRESH_COOKIE, "old-refresh")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("new-access"))
                .andExpect(cookie().value(AuthController.REFRESH_COOKIE, "new-refresh"));
    }

    @Test
    void refresh_noCookie_returns401() throws Exception {
        mockMvc.perform(post("/api/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refresh_invalidCookie_returns401AndClearsCookie() throws Exception {
        when(authService.refresh("expired")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/refresh")
                        .cookie(new Cookie(AuthController.REFRESH_COOKIE, "expired")))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().maxAge(AuthController.REFRESH_COOKIE, 0));
    }

    // ── logout ───────────────────────────────────────────────────────────────

    @Test
    void logout_clearsCookieAndReturns204() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                        .cookie(new Cookie(AuthController.REFRESH_COOKIE, "some-refresh")))
                .andExpect(status().isNoContent())
                .andExpect(cookie().maxAge(AuthController.REFRESH_COOKIE, 0));

        verify(authService).logout("some-refresh");
    }

    @Test
    void logout_noCookie_returns204() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());
    }
}
