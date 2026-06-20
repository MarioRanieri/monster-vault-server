package com.monstervault.security;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RefreshTokenStore {

    private final ConcurrentHashMap<String, String> activeTokens = new ConcurrentHashMap<>();

    public void store(String token, String username) {
        activeTokens.put(hash(token), username);
    }

    public boolean isActive(String token) {
        return activeTokens.containsKey(hash(token));
    }

    public void revoke(String token) {
        activeTokens.remove(hash(token));
    }

    public void revokeAllForUser(String username) {
        activeTokens.entrySet().removeIf(e -> e.getValue().equals(username));
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
