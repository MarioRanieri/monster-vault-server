package com.monstervault.security;

/**
 * Contratto per la validazione dei token JWT.
 *
 * Separare questa responsabilità in un'interfaccia (principio SOLID DIP) permette
 * di iniettare un mock nei test senza caricare l'intera implementazione JWT,
 * e di sostituire l'algoritmo (es. passare da HMAC a RSA) senza toccare JwtFilter.
 */
public interface TokenValidator {

    boolean isValid(String token);

    String getUsername(String token);

    boolean isAccessToken(String token);

    boolean isRefreshToken(String token);
}
