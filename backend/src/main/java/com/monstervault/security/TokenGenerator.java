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

    String generate(String username);

    String generateAccess(String username);

    String generateRefresh(String username);
}
