package com.monstervault.repository;

import com.monstervault.model.Can;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * MongoDB implementation of the {@link CanRepository} port (SOLID DIP).
 *
 * Replaces the former Firestore adapter: thanks to the {@link CanRepository}
 * interface, CanService and the controllers are unchanged — only this adapter
 * and the wiring differ. Spring Boot auto-configures the {@link MongoTemplate}
 * from {@code spring.data.mongodb.uri} (Atlas connection string in prod).
 */
@Slf4j
@Repository
public class MongoCanRepository implements CanRepository {

    private final MongoTemplate mongo;

    public MongoCanRepository(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public List<Can> getAll() {
        List<Can> all = mongo.findAll(Can.class);
        log.info("Mongo getAll: {} documenti caricati", all.size());
        return all;
    }

    @Override
    public Can getById(String id) {
        return mongo.findById(id, Can.class);
    }

    @Override
    public void save(Can can) {
        stampTimestamps(can);
        mongo.save(can); // upsert per _id
    }

    @Override
    public void batchSave(List<Can> cans) {
        // ponytail: per-doc upsert (stesse semantiche del vecchio Firestore .set), non
        // un'unica transazione multi-doc. Atlas è un replica set e supporta le transazioni:
        // avvolgere in una session se in futuro l'atomicità del batch diventa necessaria.
        for (Can can : cans) {
            stampTimestamps(can);
            mongo.save(can);
        }
    }

    @Override
    public void delete(String id) {
        mongo.remove(Query.query(Criteria.where("id").is(id)), Can.class);
    }

    @Override
    public void deleteAll() {
        mongo.remove(new Query(), Can.class);
    }

    /** Aggiorna updatedAt sempre. createdAt è server-autoritativo e immutabile: si timbra `now`
     *  SOLO se la lattina non esiste ancora su Mongo (creazione vera); per un record esistente si
     *  preserva il valore già salvato — null incluso, così i record migrati da Firestore non
     *  vengono "inventati" a oggi da un edit o da un restore (altrimenti finirebbero in "added
     *  this month"). photoAt si timbra `now` SOLO se le foto sono davvero cambiate rispetto al
     *  documento salvato (non basta che il client rimandi p1..p4 non-null: il frontend manda ""
     *  per gli slot vuoti, quindi qualunque edit — prezzo, note, restore, batch — bumperebbe
     *  photoAt a ogni save se controllassimo solo "presente"). Il record esistente si carica UNA
     *  volta sola (se can.getId() != null) e serve sia per photoAt che per createdAt. */
    private void stampTimestamps(Can can) {
        long now = System.currentTimeMillis();
        can.setUpdatedAt(now);

        Can existing = can.getId() != null ? mongo.findById(can.getId(), Can.class) : null;

        can.setPhotoAt(computePhotoAt(can, existing, now));

        if (can.getCreatedAt() == null) {
            // if/else (non ternario) di proposito: `now` è long e getCreatedAt() è Long null →
            // un ternario misto unboxerebbe e andrebbe in NPE sul ramo legacy.
            if (existing == null) can.setCreatedAt(now);
            else can.setCreatedAt(existing.getCreatedAt());
        }
    }

    /** null se il documento è nuovo e senza foto; `now` se il documento è nuovo con almeno una
     *  foto, o se almeno uno slot p1..p4 è cambiato rispetto al salvato E almeno uno slot è
     *  presente dopo l'edit; altrimenti il photoAt già salvato (mai quello mandato dal client —
     *  rimuovere tutte le foto non resetta photoAt: nessun caso speciale). */
    private Long computePhotoAt(Can can, Can existing, long now) {
        boolean hasPhoto = present(can.getP1()) || present(can.getP2())
                || present(can.getP3()) || present(can.getP4());
        if (existing == null) {
            return hasPhoto ? now : null;
        }
        boolean changed = !normalize(can.getP1()).equals(normalize(existing.getP1()))
                || !normalize(can.getP2()).equals(normalize(existing.getP2()))
                || !normalize(can.getP3()).equals(normalize(existing.getP3()))
                || !normalize(can.getP4()).equals(normalize(existing.getP4()));
        // if/else (non ternario) di proposito: `now` è long e getPhotoAt() è Long null → un
        // ternario misto unboxerebbe comunque il ramo Long scelto e andrebbe in NPE (stesso
        // motivo del ramo createdAt in stampTimestamps).
        if (changed && hasPhoto) return now;
        return existing.getPhotoAt();
    }

    private static String normalize(String url) {
        return present(url) ? url : "";
    }

    private static boolean present(String url) {
        return url != null && !url.isBlank();
    }
}
