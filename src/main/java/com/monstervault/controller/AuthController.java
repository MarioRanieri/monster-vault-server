package com.monstervault.controller;

import com.monstervault.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * Controller REST per l'autenticazione.
 *
 * Endpoint:
 *   POST /api/auth/login   → verifica credenziali, restituisce JWT
 *   POST /api/auth/refresh → rinnova un JWT ancora valido (silent refresh)
 *
 * Dipende dall'interfaccia AuthService (SOLID DIP): non sa nulla di BCrypt o JWT.
 */
@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /** Constructor injection (DIP): dipendenza esplicita, immutabile e testabile senza Spring. */
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Autentica l'utente e restituisce un JWT se le credenziali sono corrette.
     * Risposta 200: { "token": "<JWT>" }
     * Risposta 401: credenziali errate (non si specifica quale campo è sbagliato)
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        Optional<String> token = authService.authenticate(req.username(), req.password());
        if (token.isPresent()) {
            log.info("Login riuscito per '{}'", req.username());
            return ResponseEntity.ok(Map.of("token", token.get()));
        }
        log.warn("Login fallito per '{}'", req.username());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
    }

    /**
     * Rinnova silenziosamente un JWT ancora valido restituendone uno con scadenza fresca.
     * Chiamato dal frontend quando mancano < 30 minuti alla scadenza del token corrente.
     *
     * Richiede l'header {@code Authorization: Bearer <token>} con un token valido.
     * Risposta 200: { "token": "<nuovo JWT>" }
     * Risposta 401: token assente, invalido o scaduto
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        if (auth == null || !auth.startsWith("Bearer "))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Optional<String> newToken = authService.refresh(auth.substring(7));
        if (newToken.isPresent()) {
            log.info("Token rinnovato");
            return ResponseEntity.ok(Map.of("token", newToken.get()));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    record LoginRequest(String username, String password) {}
}
