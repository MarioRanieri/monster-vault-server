package com.monstervault.repository;

import com.monstervault.model.RefreshToken;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Duration;

/**
 * Implementazione MongoDB di {@link RefreshTokenRepository} (come
 * {@link MongoCanRepository} / {@link MongoAdminCredentialRepository}).
 *
 * Crea in modo esplicito il TTL index su {@code expiresAt} nel costruttore: non si
 * affida all'auto-index-creation di Spring (disattivato di default su Boot 3), così
 * i documenti scaduti vengono rimossi da MongoDB anche se l'utente non fa logout.
 */
@Repository
public class MongoRefreshTokenRepository implements RefreshTokenRepository {

    private final MongoTemplate mongo;

    public MongoRefreshTokenRepository(MongoTemplate mongo) {
        this.mongo = mongo;
        // TTL: expireAfterSeconds=0 → il documento sparisce quando expiresAt <= now.
        mongo.indexOps(RefreshToken.class)
                .ensureIndex(new Index().on("expiresAt", Sort.Direction.ASC).expire(Duration.ZERO));
    }

    @Override
    public void save(RefreshToken token) {
        mongo.save(token);
    }

    @Override
    public boolean existsById(String id) {
        return mongo.exists(Query.query(Criteria.where("_id").is(id)), RefreshToken.class);
    }

    @Override
    public void deleteById(String id) {
        mongo.remove(Query.query(Criteria.where("_id").is(id)), RefreshToken.class);
    }

    @Override
    public void deleteByUsername(String username) {
        mongo.remove(Query.query(Criteria.where("username").is(username)), RefreshToken.class);
    }
}
