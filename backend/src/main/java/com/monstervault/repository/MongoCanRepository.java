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

    /** Come il vecchio repository: aggiorna updatedAt, e photoAt se almeno uno slot foto è presente. */
    private void stampTimestamps(Can can) {
        long now = System.currentTimeMillis();
        can.setUpdatedAt(now);
        if (can.getP1() != null || can.getP2() != null || can.getP3() != null || can.getP4() != null) {
            can.setPhotoAt(now);
        }
    }
}
