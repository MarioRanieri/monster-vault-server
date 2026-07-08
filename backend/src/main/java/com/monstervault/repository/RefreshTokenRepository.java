package com.monstervault.repository;

import com.monstervault.model.RefreshToken;

/**
 * Port di persistenza per i refresh token attivi (SOLID DIP): {@code RefreshTokenStore}
 * dipende da questa interfaccia, non dall'implementazione MongoDB, così i test la
 * sostituiscono con un fake in memoria senza rete.
 */
public interface RefreshTokenRepository {

    /** Crea o aggiorna il token attivo (upsert sull'_id = hash). */
    void save(RefreshToken token);

    /** True se esiste un token attivo con questo id (hash). */
    boolean existsById(String id);

    /** Rimuove un singolo token (rotation / revoca). */
    void deleteById(String id);

    /** Rimuove tutti i token di un utente (logout, cambio password). */
    void deleteByUsername(String username);
}
