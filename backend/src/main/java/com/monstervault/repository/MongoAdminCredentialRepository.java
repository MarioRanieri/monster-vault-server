package com.monstervault.repository;

import com.monstervault.model.AdminCredential;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Implementazione MongoDB di {@link AdminCredentialRepository} (come
 * {@link MongoCanRepository}). Usa il {@link MongoTemplate} auto-configurato da Spring.
 */
@Repository
public class MongoAdminCredentialRepository implements AdminCredentialRepository {

    private final MongoTemplate mongo;

    public MongoAdminCredentialRepository(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Optional<AdminCredential> find() {
        return Optional.ofNullable(
                mongo.findById(AdminCredential.SINGLETON_ID, AdminCredential.class));
    }

    @Override
    public void save(AdminCredential credential) {
        credential.setId(AdminCredential.SINGLETON_ID);
        mongo.save(credential);
    }
}
