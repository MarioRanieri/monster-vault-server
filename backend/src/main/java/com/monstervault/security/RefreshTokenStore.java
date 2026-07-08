package com.monstervault.security;

import com.monstervault.model.RefreshToken;
import com.monstervault.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;

/**
 * Registro dei refresh token attivi (rotation + revoca).
 *
 * Delega la persistenza a {@link RefreshTokenRepository} (MongoDB in produzione):
 * prima teneva i token in una {@code ConcurrentHashMap} in memoria, che si azzerava
 * a ogni riavvio del backend costringendo l'utente a rifare login a ogni ricarica.
 * Nel DB si salva solo l'HASH SHA-256 del token, mai il valore in chiaro.
 */
@Component
public class RefreshTokenStore {

    private final RefreshTokenRepository repo;
    private final long refreshExpirationMs;

    public RefreshTokenStore(
            RefreshTokenRepository repo,
            @Value("${app.jwt.refresh-expiration:604800000}") long refreshExpirationMs) {
        this.repo = repo;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    public void store(String token, String username) {
        Date expiresAt = new Date(System.currentTimeMillis() + refreshExpirationMs);
        repo.save(new RefreshToken(hash(token), username, expiresAt));
    }

    public boolean isActive(String token) {
        return repo.existsById(hash(token));
    }

    public void revoke(String token) {
        repo.deleteById(hash(token));
    }

    public void revokeAllForUser(String username) {
        repo.deleteByUsername(username);
    }

    static String hash(String token) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }
}
