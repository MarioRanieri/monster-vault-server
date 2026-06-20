package com.monstervault.service;

import com.monstervault.security.RefreshTokenStore;
import com.monstervault.security.TokenGenerator;
import com.monstervault.security.TokenValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AdminAuthService implements AuthService {

    @Value("${app.admin.username}")
    private String adminUsername;

    @Value("${app.admin.password}")
    private String adminPasswordHash;

    private final PasswordEncoder passwordEncoder;
    private final TokenGenerator tokenGenerator;
    private final TokenValidator tokenValidator;
    private final RefreshTokenStore refreshTokenStore;

    public AdminAuthService(PasswordEncoder passwordEncoder,
                            TokenGenerator tokenGenerator,
                            TokenValidator tokenValidator,
                            RefreshTokenStore refreshTokenStore) {
        this.passwordEncoder = passwordEncoder;
        this.tokenGenerator = tokenGenerator;
        this.tokenValidator = tokenValidator;
        this.refreshTokenStore = refreshTokenStore;
    }

    @Override
    public Optional<AuthResponse> authenticate(String username, String password) {
        if (adminUsername.equals(username) && passwordEncoder.matches(password, adminPasswordHash)) {
            String accessToken = tokenGenerator.generateAccess(username);
            String refreshToken = tokenGenerator.generateRefresh(username);
            refreshTokenStore.store(refreshToken, username);
            return Optional.of(new AuthResponse(accessToken, refreshToken));
        }
        return Optional.empty();
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
        String newAccess = tokenGenerator.generateAccess(username);
        String newRefresh = tokenGenerator.generateRefresh(username);
        refreshTokenStore.store(newRefresh, username);
        return Optional.of(new AuthResponse(newAccess, newRefresh));
    }

    @Override
    public void logout(String refreshToken) {
        if (refreshToken != null && tokenValidator.isRefreshToken(refreshToken)) {
            String username = tokenValidator.getUsername(refreshToken);
            refreshTokenStore.revokeAllForUser(username);
        }
    }
}
