package com.monstervault.security;

/**
 * Contratto per la validazione dei token JWT.
 *
 * Separare questa responsabilità in un'interfaccia (principio SOLID DIP) permette
 * di iniettare un mock nei test senza caricare l'intera implementazione JWT,
 * e di sostituire l'algoritmo (es. passare da HMAC a RSA) senza toccare JwtFilter.
 */
public interface TokenValidator {

    /** Restituisce true se il token è ben formato, non scaduto e la firma è valida. */
    boolean isValid(String token);

    /** Estrae l'username (subject) dal payload del token.
     *  Va chiamato solo dopo aver verificato isValid(), altrimenti può lanciare eccezione. */
    String getUsername(String token);
}
