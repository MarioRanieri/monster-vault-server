package com.monstervault.repository;

import com.monstervault.model.Can;

import java.util.List;

/**
 * Contratto CRUD per la persistenza delle lattine (principio SOLID DIP).
 *
 * CanService dipende da questa interfaccia, non da MongoCanRepository.
 * Vantaggi concreti:
 *   1. Testabilità: nei test si inietta un mock al posto di Firestore
 *      senza bisogno di connessione di rete.
 *   2. Sostituibilità: il passaggio da Firestore a MongoDB è stato fatto scrivendo
 *      una nuova implementazione (MongoCanRepository) — CanService non è cambiato.
 *
 * Tutti i metodi dichiarano throws Exception perché un'operazione di persistenza
 * può fallire (rete, database non raggiungibile).
 */
public interface CanRepository {

    /** Recupera tutte le lattine dalla collection MongoDB. */
    List<Can> getAll() throws Exception;

    /** Recupera una singola lattina per ID. Restituisce null se non esiste. */
    Can getById(String id) throws Exception;

    /** Salva (crea o aggiorna) una lattina. Imposta updatedAt prima di scrivere. */
    void save(Can can) throws Exception;

    /** Salva (crea o aggiorna) più lattine — upsert per _id. */
    void batchSave(List<Can> cans) throws Exception;

    /** Elimina la lattina con l'ID dato. */
    void delete(String id) throws Exception;

    /**
     * Elimina tutte le lattine dalla collection MongoDB.
     * Per un cleanup completo incluse le foto Cloudinary usare {@code CanService.deleteAll()}.
     */
    void deleteAll() throws Exception;
}
