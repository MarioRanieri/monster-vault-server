package com.monstervault.service;

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
    private AdminAuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = mock(PasswordEncoder.class);
        tokenGenerator  = mock(TokenGenerator.class);
        tokenValidator  = mock(TokenValidator.class);
        authService = new AdminAuthService(passwordEncoder, tokenGenerator, tokenValidator);
        ReflectionTestUtils.setField(authService, "adminUsername", "admin");
        ReflectionTestUtils.setField(authService, "adminPasswordHash", "$2a$10$fakehash");
    }

    // ── authenticate ─────────────────────────────────────────────────────────

    @Test
    void authenticate_correctCredentials_returnsToken() {
        when(passwordEncoder.matches("secret", "$2a$10$fakehash")).thenReturn(true);
        when(tokenGenerator.generate("admin")).thenReturn("jwt-token");

        Optional<String> result = authService.authenticate("admin", "secret");

        assertThat(result).isPresent().contains("jwt-token");
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

    // ── refresh ───────────────────────────────────────────────────────────────

    @Test
    void refresh_validToken_returnsNewToken() {
        when(tokenValidator.isValid("old-token")).thenReturn(true);
        when(tokenValidator.getUsername("old-token")).thenReturn("admin");
        when(tokenGenerator.generate("admin")).thenReturn("new-token");

        Optional<String> result = authService.refresh("old-token");

        assertThat(result).isPresent().contains("new-token");
    }

    @Test
    void refresh_invalidToken_returnsEmpty() {
        when(tokenValidator.isValid("bad-token")).thenReturn(false);

        assertThat(authService.refresh("bad-token")).isEmpty();
        verifyNoInteractions(tokenGenerator);
    }

    @Test
    void refresh_nullToken_returnsEmpty() {
        assertThat(authService.refresh(null)).isEmpty();
        verifyNoInteractions(tokenValidator);
    }
}
