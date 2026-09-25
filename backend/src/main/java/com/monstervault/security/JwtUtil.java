package com.monstervault.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

@Component
public class JwtUtil implements TokenValidator, TokenGenerator {

    static final String CLAIM_TYPE = "type";
    static final String TYPE_ACCESS = "access";
    static final String TYPE_REFRESH = "refresh";

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.access-expiration:#{${app.jwt.expiration:900000}}}")
    private long accessExpiration;

    @Value("${app.jwt.refresh-expiration:604800000}")
    private long refreshExpiration;

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public String generate(String username) {
        return generateAccess(username);
    }

    @Override
    public String generateAccess(String username) {
        return buildToken(username, accessExpiration, TYPE_ACCESS);
    }

    @Override
    public String generateRefresh(String username) {
        return buildToken(username, refreshExpiration, TYPE_REFRESH);
    }

    private String buildToken(String username, long expiration, String type) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim(CLAIM_TYPE, type)
                // iat/exp in secondi epoch (il formato del JWT): i setter di jjwt
                // vogliono java.util.Date, così resta tutto su java.time
                .claim(Claims.ISSUED_AT, now.getEpochSecond())
                .claim(Claims.EXPIRATION, now.plusMillis(expiration).getEpochSecond())
                .signWith(getKey())
                .compact();
    }

    @Override
    public String getUsername(String token) {
        return getClaims(token).getSubject();
    }

    @Override
    public boolean isValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean isAccessToken(String token) {
        try {
            Claims claims = getClaims(token);
            return TYPE_ACCESS.equals(claims.get(CLAIM_TYPE, String.class));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public boolean isRefreshToken(String token) {
        try {
            Claims claims = getClaims(token);
            return TYPE_REFRESH.equals(claims.get(CLAIM_TYPE, String.class));
        } catch (Exception e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
