package com.monstervault.service;

/**
 * Operazioni di gestione dell'account admin: cambio password (da loggato) e
 * recupero tramite codice (se chiuso fuori). Nessun invio email: il codice di
 * recupero lo genera e lo salva l'utente stesso; il server ne tiene solo l'hash.
 */
public interface AccountService {

    /** Cambia la password conoscendo quella attuale. false se la corrente è sbagliata. */
    boolean changePassword(String currentPassword, String newPassword);

    /**
     * Genera un nuovo codice di recupero: ritorna il codice in chiaro UNA sola
     * volta (da mostrare all'utente) e salva solo il suo hash.
     */
    String generateRecoveryCode();

    /** Reimposta la password verificando username + codice di recupero. false se non combaciano. */
    boolean recover(String username, String recoveryCode, String newPassword);
}
