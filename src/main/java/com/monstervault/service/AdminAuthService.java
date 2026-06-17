package com.monstervault.service;

import com.monstervault.security.TokenGenerator;
import com.monstervault.security.TokenValidator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Implementazione di AuthService per un sistema single-admin.
 *
 * Le credenziali dell'admin (username e hash BCrypt della password) vivono in
 * application.properties e vengono iniettate con @Value: non ci sono query
 * a database e nessun dato sensibile nel codice sorgente.
 *
 * Dipende dalle interfacce PasswordEncoder, TokenGenerator e TokenValidator
 * — non dalle classi concrete — per essere facilmente testabile con mock (SOLID DIP).
 */
@Service
public class AdminAuthService implements AuthService {

    @Value("${app.admin.username}")
    private String adminUsername;

    @Value("${app.admin.password}")
    private String adminPasswordHash;

    private final PasswordEncoder passwordEncoder;
    private final TokenGenerator tokenGenerator;
    private final TokenValidator tokenValidator;

    public AdminAuthService(PasswordEncoder passwordEncoder,
                            TokenGenerator tokenGenerator,
                            TokenValidator tokenValidator) {
        this.passwordEncoder = passwordEncoder;
        this.tokenGenerator  = tokenGenerator;
        this.tokenValidator  = tokenValidator;
    }

    /**
     * Verifica le credenziali e restituisce il JWT se corrette.
     *
     * L'ordine dei controlli è importante per il "short-circuit":
     *   1. Prima si confronta lo username (stringa, O(1))
     *   2. Solo se corretto si esegue BCrypt (~100ms)
     * Questo evita di sprecare CPU su tentativi con username sbagliato.
     */
    @Override
    public Optional<String> authenticate(String username, String password) {
        if (adminUsername.equals(username) && passwordEncoder.matches(password, adminPasswordHash)) {
            return Optional.of(tokenGenerator.generate(username));
        }
        return Optional.empty();
    }

    /**
     * Rinnova un JWT ancora valido restituendone uno nuovo con scadenza fresca.
     * Chiamato dal frontend quando mancano < 30 minuti alla scadenza.
     */
    @Override
    public Optional<String> refresh(String token) {
        if (token == null || !tokenValidator.isValid(token)) return Optional.empty();
        String username = tokenValidator.getUsername(token);
        return Optional.of(tokenGenerator.generate(username));
    }
}
