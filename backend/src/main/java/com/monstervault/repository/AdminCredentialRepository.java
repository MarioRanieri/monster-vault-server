package com.monstervault.repository;

import com.monstervault.model.AdminCredential;

import java.util.Optional;

/**
 * Port di persistenza per le credenziali admin (SOLID DIP): il service dipende
 * da questa interfaccia, non dall'implementazione MongoDB, così i test iniettano
 * un mock senza rete.
 */
public interface AdminCredentialRepository {

    /** La credenziale singleton, se già presente. */
    Optional<AdminCredential> find();

    /** Crea o aggiorna la credenziale (upsert sull'_id singleton). */
    void save(AdminCredential credential);
}
