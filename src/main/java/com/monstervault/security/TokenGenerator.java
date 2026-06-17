package com.monstervault.security;

/**
 * Contratto per la generazione dei token JWT.
 *
 * Separato da TokenValidator per rispettare il principio di singola responsabilità (SRP):
 * chi valida i token in ingresso (JwtFilter) non ha bisogno di sapere come generarli,
 * e chi li genera (AdminAuthService) non ha bisogno di validarli.
 * JwtUtil implementa entrambe le interfacce perché la logica HMAC è condivisa.
 */
public interface TokenGenerator {

    /** Genera un token JWT firmato per l'username dato.
     *  La durata di validità è definita da app.jwt.expiration in application.properties. */
    String generate(String username);
}
