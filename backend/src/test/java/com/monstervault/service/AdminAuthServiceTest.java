package com.monstervault.service;

import com.monstervault.model.AdminCredential;
import com.monstervault.repository.AdminCredentialRepository;
import com.monstervault.security.RefreshTokenStore;
import com.monstervault.security.TokenGenerator;
import com.monstervault.security.TokenValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
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
    private AdminCredentialRepository credentialRepository;
    private AdminAuthService authService;

    @BeforeEach
    void setUp() {
        passwordEncoder = mock(PasswordEncoder.class);
        tokenGenerator = mock(TokenGenerator.class);
        tokenValidator = mock(TokenValidator.class);
        refreshTokenStore = mock(RefreshTokenStore.class);
        credentialRepository = mock(AdminCredentialRepository.class);
        authService = new AdminAuthService(passwordEncoder, tokenGenerator, tokenValidator,
                refreshTokenStore, credentialRepository);
        when(credentialRepository.find())
                .thenReturn(Optional.of(new AdminCredential("admin", "admin", "$2a$10$fakehash", null)));
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

    // ── account: change password ──────────────────────────────────────────────

    @Test
    void changePassword_correctCurrent_updatesHashAndRevokesSessions() {
        when(passwordEncoder.matches("secret", "$2a$10$fakehash")).thenReturn(true);
        when(passwordEncoder.encode("newpass123")).thenReturn("$2a$10$newhash");

        boolean ok = authService.changePassword("secret", "newpass123");

        assertThat(ok).isTrue();
        ArgumentCaptor<AdminCredential> saved = ArgumentCaptor.forClass(AdminCredential.class);
        verify(credentialRepository).save(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$10$newhash");
        verify(refreshTokenStore).revokeAllForUser("admin");
    }

    @Test
    void changePassword_wrongCurrent_returnsFalseAndDoesNotSave() {
        when(passwordEncoder.matches("wrong", "$2a$10$fakehash")).thenReturn(false);
        assertThat(authService.changePassword("wrong", "newpass123")).isFalse();
        verify(credentialRepository, never()).save(any());
    }

    // ── account: recovery code ────────────────────────────────────────────────

    @Test
    void generateRecoveryCode_returnsReadableCodeAndStoresOnlyHash() {
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$codehash");

        String code = authService.generateRecoveryCode();

        assertThat(code).matches("MV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}");
        ArgumentCaptor<AdminCredential> saved = ArgumentCaptor.forClass(AdminCredential.class);
        verify(credentialRepository).save(saved.capture());
        assertThat(saved.getValue().getRecoveryCodeHash()).isEqualTo("$2a$10$codehash");
    }

    @Test
    void recover_validCode_resetsPasswordAndClearsCode() {
        when(credentialRepository.find()).thenReturn(
                Optional.of(new AdminCredential("admin", "admin", "$2a$10$old", "$2a$10$codehash")));
        when(passwordEncoder.matches("MV-CODE", "$2a$10$codehash")).thenReturn(true);
        when(passwordEncoder.encode("newpass123")).thenReturn("$2a$10$newhash");

        boolean ok = authService.recover("admin", "MV-CODE", "newpass123");

        assertThat(ok).isTrue();
        ArgumentCaptor<AdminCredential> saved = ArgumentCaptor.forClass(AdminCredential.class);
        verify(credentialRepository).save(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$10$newhash");
        assertThat(saved.getValue().getRecoveryCodeHash()).isNull(); // monouso
        verify(refreshTokenStore).revokeAllForUser("admin");
    }

    @Test
    void recover_wrongCode_returnsFalse() {
        when(credentialRepository.find()).thenReturn(
                Optional.of(new AdminCredential("admin", "admin", "$2a$10$old", "$2a$10$codehash")));
        when(passwordEncoder.matches("MV-BAD", "$2a$10$codehash")).thenReturn(false);
        assertThat(authService.recover("admin", "MV-BAD", "newpass123")).isFalse();
        verify(credentialRepository, never()).save(any());
    }

    @Test
    void recover_wrongUsername_returnsFalse() {
        when(credentialRepository.find()).thenReturn(
                Optional.of(new AdminCredential("admin", "admin", "$2a$10$old", "$2a$10$codehash")));
        assertThat(authService.recover("hacker", "MV-CODE", "newpass123")).isFalse();
    }

    @Test
    void recover_noCodeGenerated_returnsFalse() {
        // credenziale di default (recoveryCodeHash null) → nessun recupero possibile
        assertThat(authService.recover("admin", "MV-CODE", "newpass123")).isFalse();
    }

    // ── seeding ───────────────────────────────────────────────────────────────

    @Test
    void authenticate_whenNoCredentialDoc_seedsFromConfig() {
        when(credentialRepository.find()).thenReturn(Optional.empty());
        ReflectionTestUtils.setField(authService, "adminUsername", "RedMghost");
        ReflectionTestUtils.setField(authService, "adminPasswordHash", "$2a$10$seed");
        when(passwordEncoder.matches("pw", "$2a$10$seed")).thenReturn(true);
        when(tokenGenerator.generateAccess("RedMghost")).thenReturn("a");
        when(tokenGenerator.generateRefresh("RedMghost")).thenReturn("r");

        assertThat(authService.authenticate("RedMghost", "pw")).isPresent();
        verify(credentialRepository).save(any(AdminCredential.class)); // ha seedato
    }
}
