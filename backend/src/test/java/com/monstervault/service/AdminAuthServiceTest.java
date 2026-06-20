package com.monstervault.service;

import com.monstervault.security.RefreshTokenStore;
import com.monstervault.security.TokenGenerator;
import com.monstervault.security.TokenValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AdminAuthServiceTest {

    private PasswordEncoder passwordEncoder;
    private TokenGenerator tokenGenerator;
    private TokenValidator tokenValidator;
    private RefreshTokenStore refreshTokenStore;
    private AdminAuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = mock(PasswordEncoder.class);
        tokenGenerator = mock(TokenGenerator.class);
        tokenValidator = mock(TokenValidator.class);
        refreshTokenStore = mock(RefreshTokenStore.class);
        authService = new AdminAuthService(passwordEncoder, tokenGenerator, tokenValidator, refreshTokenStore);
        ReflectionTestUtils.setField(authService, "adminUsername", "admin");
        ReflectionTestUtils.setField(authService, "adminPasswordHash", "$2a$10$fakehash");
    }

    // ── authenticate ─────────────────────────────────────────────────────────

    @Test
    void authenticate_correctCredentials_returnsTokenPair() {
        when(passwordEncoder.matches("secret", "$2a$10$fakehash")).thenReturn(true);
        when(tokenGenerator.generateAccess("admin")).thenReturn("access-token");
        when(tokenGenerator.generateRefresh("admin")).thenReturn("refresh-token");

        Optional<AuthResponse> result = authService.authenticate("admin", "secret");

        assertThat(result).isPresent();
        assertThat(result.get().accessToken()).isEqualTo("access-token");
        assertThat(result.get().refreshToken()).isEqualTo("refresh-token");
        verify(refreshTokenStore).store("refresh-token", "admin");
    }

    @Test
    void authenticate_wrongPassword_returnsEmpty() {
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        assertThat(authService.authenticate("admin", "wrong")).isEmpty();
    }

    @Test
    void authenticate_wrongUsername_returnsEmpty() {
        assertThat(authService.authenticate("hacker", "secret")).isEmpty();
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void authenticate_failure_neverCallsTokenGenerator() {
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        authService.authenticate("admin", "wrong");
        verifyNoInteractions(tokenGenerator);
    }

    // ── refresh (with rotation) ──────────────────────────────────────────────

    @Test
    void refresh_validActiveToken_returnsNewPairAndRevokesOld() {
        when(tokenValidator.isRefreshToken("old-refresh")).thenReturn(true);
        when(refreshTokenStore.isActive("old-refresh")).thenReturn(true);
        when(tokenValidator.getUsername("old-refresh")).thenReturn("admin");
        when(tokenGenerator.generateAccess("admin")).thenReturn("new-access");
        when(tokenGenerator.generateRefresh("admin")).thenReturn("new-refresh");

        Optional<AuthResponse> result = authService.refresh("old-refresh");

        assertThat(result).isPresent();
        assertThat(result.get().accessToken()).isEqualTo("new-access");
        assertThat(result.get().refreshToken()).isEqualTo("new-refresh");
        verify(refreshTokenStore).revoke("old-refresh");
        verify(refreshTokenStore).store("new-refresh", "admin");
    }

    @Test
    void refresh_invalidToken_returnsEmpty() {
        when(tokenValidator.isRefreshToken("bad")).thenReturn(false);
        assertThat(authService.refresh("bad")).isEmpty();
    }

    @Test
    void refresh_validButRevokedToken_returnsEmpty() {
        when(tokenValidator.isRefreshToken("revoked")).thenReturn(true);
        when(refreshTokenStore.isActive("revoked")).thenReturn(false);
        assertThat(authService.refresh("revoked")).isEmpty();
    }

    @Test
    void refresh_nullToken_returnsEmpty() {
        assertThat(authService.refresh(null)).isEmpty();
        verifyNoInteractions(tokenValidator);
    }

    // ── logout ───────────────────────────────────────────────────────────────

    @Test
    void logout_validToken_revokesAllForUser() {
        when(tokenValidator.isRefreshToken("token")).thenReturn(true);
        when(tokenValidator.getUsername("token")).thenReturn("admin");

        authService.logout("token");

        verify(refreshTokenStore).revokeAllForUser("admin");
    }

    @Test
    void logout_nullToken_doesNothing() {
        authService.logout(null);
        verifyNoInteractions(refreshTokenStore);
    }
}
