package com.monstervault.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Implementazione concreta di TokenValidator e TokenGenerator basata su JWT (JSON Web Token).
 *
 * Un JWT è composto da tre parti separate da punti: Header.Payload.Signature
 *   - Header: algoritmo usato (es. HS256)
 *   - Payload (Claims): dati pubblici — username (subject), emissione, scadenza
 *   - Signature: HMAC-SHA256 di Header+Payload con la chiave segreta
 *
 * Il server non salva nessun token: basta ricalcolare la firma con la stessa chiave
 * e confrontarla con quella nel token per verificarne l'autenticità.
 * Questo rende il sistema completamente stateless.
 *
 * @Component registra questa classe come bean Spring, iniettabile ovunque.
 */
@Component
public class JwtUtil implements TokenValidator, TokenGenerator {

    /** Stringa segreta letta da application.properties (minimo 32 caratteri per HMAC-256). */
    @Value("${app.jwt.secret}")
    private String secret;

    /** Durata del token in millisecondi (es. 86400000 = 24 ore). */
    @Value("${app.jwt.expiration}")
    private long expiration;

    /**
     * Converte la stringa segreta in una chiave crittografica HMAC-SHA256.
     * Chiamato ogni volta che serve firmare o verificare: non viene cachata
     * perché il costo di creazione è trascurabile rispetto alle operazioni I/O.
     */
    private SecretKey getKey() {
        // UTF-8 esplicito: la derivazione della chiave HMAC non deve dipendere dal
        // charset di default della piattaforma (diverso tra Windows e Linux), altrimenti
        // un secret con caratteri non-ASCII produrrebbe chiavi diverse e token non
        // verificabili tra ambienti. Per secret ASCII i byte sono identici a prima.
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Costruisce e firma un nuovo JWT per l'username dato.
     * Il token contiene:
     *   - subject: l'username (chi è autenticato)
     *   - issuedAt: timestamp di emissione
     *   - expiration: timestamp di scadenza = adesso + expiration ms
     * compact() serializza tutto in Base64URL e aggiunge la firma.
     */
    @Override
    public String generate(String username) {
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getKey())
                .compact();
    }

    /**
     * Estrae il subject (username) dal payload del token.
     * Delega a getClaims() che verifica anche la firma e la scadenza.
     */
    @Override
    public String getUsername(String token) {
        return getClaims(token).getSubject();
    }

    /**
     * Restituisce true se il token è valido (firma corretta e non scaduto).
     * Il try-catch cattura qualsiasi anomalia: firma sbagliata, token malformato,
     * scaduto — tutte le eccezioni della libreria jjwt — e le converte in false.
     */
    @Override
    public boolean isValid(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Effettua il parsing del token: verifica la firma con la chiave segreta,
     * controlla la scadenza, e restituisce il Claims (il payload decodificato).
     * Lancia eccezione se la firma non corrisponde o il token è scaduto.
     */
    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
