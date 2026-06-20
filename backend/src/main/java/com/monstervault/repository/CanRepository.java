package com.monstervault.repository;

import com.monstervault.model.Can;

import java.util.List;

/**
 * Contratto CRUD per la persistenza delle lattine (principio SOLID DIP).
 *
 * CanService dipende da questa interfaccia, non da FirestoreCanRepository.
 * Vantaggi concreti:
 *   1. Testabilità: nei test si inietta un mock al posto di Firestore
 *      senza bisogno di connessione di rete.
 *   2. Sostituibilità: se domani si volesse passare da Firestore a PostgreSQL
 *      basterebbe scrivere una nuova implementazione — CanService non cambia.
 *
 * Tutti i metodi dichiarano throws Exception perché le operazioni Firestore
 * sono asincrone e possono fallire per problemi di rete o quota esaurita.
 */
public interface CanRepository {

    /** Recupera tutte le lattine dalla collection Firestore. */
    List<Can> getAll() throws Exception;

    /** Recupera una singola lattina per ID. Restituisce null se non esiste. */
    Can getById(String id) throws Exception;

    /** Salva (crea o aggiorna) una lattina. Imposta updatedAt prima di scrivere. */
    void save(Can can) throws Exception;

    /**
     * Salva più lattine in modo atomico tramite WriteBatch.
     * Se anche una sola scrittura fallisce, nessuna viene applicata (ACID Atomicity).
     */
    void batchSave(List<Can> cans) throws Exception;

    /** Elimina la lattina con l'ID dato. */
    void delete(String id) throws Exception;

    /**
     * Elimina tutte le lattine dalla collection Firestore.
     * Per un cleanup completo incluse le foto Cloudinary usare {@code CanService.deleteAll()}.
     */
    void deleteAll() throws Exception;
}
