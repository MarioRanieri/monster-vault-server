package com.monstervault.service;

import java.util.Optional;

/**
 * Contratto per l'autenticazione utente.
 *
 * AuthController dipende da questa interfaccia anziché da AdminAuthService (SOLID DIP).
 * Questo rende il controller ignaro di come avviene l'autenticazione:
 * se in futuro si aggiungessero più utenti con credenziali su Firestore,
 * basterebbe creare una nuova implementazione senza modificare AuthController.
 *
 * Il metodo restituisce Optional<String> (il token JWT) invece di lanciare eccezione
 * per autenticazione fallita: il fallimento è un caso atteso, non eccezionale.
 *   - Optional.of(token) → credenziali corrette → restituiamo il JWT
 *   - Optional.empty()   → credenziali errate → nessun token
 */
public interface AuthService {
    Optional<String> authenticate(String username, String password);

    /**
     * Rinnova un JWT valido restituendone uno nuovo con scadenza fresca.
     * Usato dal frontend per il rinnovo silenzioso prima della scadenza (< 30 min rimanenti).
     *
     * @param token JWT corrente (deve essere ancora valido, non scaduto)
     * @return Optional con il nuovo JWT, oppure empty se il token è invalido/scaduto
     */
    Optional<String> refresh(String token);
}
