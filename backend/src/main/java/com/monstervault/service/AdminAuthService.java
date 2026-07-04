package com.monstervault.service;

import com.monstervault.model.AdminCredential;
import com.monstervault.repository.AdminCredentialRepository;
import com.monstervault.security.RefreshTokenStore;
import com.monstervault.security.TokenGenerator;
import com.monstervault.security.TokenValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Optional;

@Service
public class AdminAuthService implements AuthService, AccountService {

    /** Valori di seed: usati solo se il documento credenziali non esiste ancora. */
    @Value("${app.admin.username}")
    private String adminUsername;

    @Value("${app.admin.password}")
    private String adminPasswordHash;

    private static final SecureRandom RNG = new SecureRandom();
    // Alfabeto senza caratteri ambigui (0/O, 1/I) per un codice leggibile.
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final PasswordEncoder passwordEncoder;
    private final TokenGenerator tokenGenerator;
    private final TokenValidator tokenValidator;
    private final RefreshTokenStore refreshTokenStore;
    private final AdminCredentialRepository credentialRepository;

    public AdminAuthService(PasswordEncoder passwordEncoder,
                            TokenGenerator tokenGenerator,
                            TokenValidator tokenValidator,
                            RefreshTokenStore refreshTokenStore,
                            AdminCredentialRepository credentialRepository) {
        this.passwordEncoder = passwordEncoder;
        this.tokenGenerator = tokenGenerator;
        this.tokenValidator = tokenValidator;
        this.refreshTokenStore = refreshTokenStore;
        this.credentialRepository = credentialRepository;
    }

    /** Credenziale corrente; al primo accesso la crea dai valori di config (seed). */
    private AdminCredential credential() {
        return credentialRepository.find().orElseGet(() -> {
            AdminCredential seed = new AdminCredential(
                    AdminCredential.SINGLETON_ID, adminUsername, adminPasswordHash, null);
            credentialRepository.save(seed);
            return seed;
        });
    }

    @Override
    public Optional<AuthResponse> authenticate(String username, String password) {
        AdminCredential cred = credential();
        if (cred.getUsername().equals(username)
                && passwordEncoder.matches(password, cred.getPasswordHash())) {
            return Optional.of(issueTokens(cred.getUsername()));
        }
        return Optional.empty();
    }

    private AuthResponse issueTokens(String username) {
        String accessToken = tokenGenerator.generateAccess(username);
        String refreshToken = tokenGenerator.generateRefresh(username);
        refreshTokenStore.store(refreshToken, username);
        return new AuthResponse(accessToken, refreshToken);
    }

    @Override
    public Optional<AuthResponse> refresh(String refreshToken) {
        if (refreshToken == null || !tokenValidator.isRefreshToken(refreshToken)) {
            return Optional.empty();
        }
        if (!refreshTokenStore.isActive(refreshToken)) {
            return Optional.empty();
        }
        String username = tokenValidator.getUsername(refreshToken);
        // rotation: revoke old, issue new pair
        refreshTokenStore.revoke(refreshToken);
        return Optional.of(issueTokens(username));
    }

    @Override
    public void logout(String refreshToken) {
        if (refreshToken != null && tokenValidator.isRefreshToken(refreshToken)) {
            String username = tokenValidator.getUsername(refreshToken);
            refreshTokenStore.revokeAllForUser(username);
        }
    }

    // ── AccountService ────────────────────────────────────────────────────────

    @Override
    public boolean changePassword(String currentPassword, String newPassword) {
        AdminCredential cred = credential();
        if (!passwordEncoder.matches(currentPassword, cred.getPasswordHash())) {
            return false;
        }
        applyNewPassword(cred, newPassword);
        return true;
    }

    @Override
    public String generateRecoveryCode() {
        String code = randomRecoveryCode();
        AdminCredential cred = credential();
        cred.setRecoveryCodeHash(passwordEncoder.encode(code));
        credentialRepository.save(cred);
        return code;
    }

    @Override
    public boolean recover(String username, String recoveryCode, String newPassword) {
        AdminCredential cred = credential();
        if (!cred.getUsername().equals(username)
                || cred.getRecoveryCodeHash() == null
                || recoveryCode == null
                || !passwordEncoder.matches(recoveryCode, cred.getRecoveryCodeHash())) {
            return false;
        }
        cred.setRecoveryCodeHash(null); // codice monouso
        applyNewPassword(cred, newPassword);
        return true;
    }

    /** Salva la nuova password (hashata) e revoca tutte le sessioni attive. */
    private void applyNewPassword(AdminCredential cred, String newPassword) {
        cred.setPasswordHash(passwordEncoder.encode(newPassword));
        credentialRepository.save(cred);
        refreshTokenStore.revokeAllForUser(cred.getUsername());
    }

    /** Codice tipo "MV-XXXX-XXXX-XXXX" (12 caratteri leggibili). */
    private static String randomRecoveryCode() {
        StringBuilder sb = new StringBuilder("MV");
        for (int group = 0; group < 3; group++) {
            sb.append('-');
            for (int i = 0; i < 4; i++) {
                sb.append(CODE_ALPHABET.charAt(RNG.nextInt(CODE_ALPHABET.length())));
            }
        }
        return sb.toString();
    }
}
