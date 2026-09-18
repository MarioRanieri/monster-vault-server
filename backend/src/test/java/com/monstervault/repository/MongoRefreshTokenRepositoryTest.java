package com.monstervault.repository;

import com.monstervault.model.RefreshToken;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MongoTemplate è mockato: si verificano le query costruite e le chiamate al template. */
class MongoRefreshTokenRepositoryTest {

    private MongoTemplate mongo;
    private IndexOperations indexOps;
    private MongoRefreshTokenRepository repo;

    @BeforeEach
    void setUp() {
        mongo = mock(MongoTemplate.class);
        indexOps = mock(IndexOperations.class);
        when(mongo.indexOps(RefreshToken.class)).thenReturn(indexOps);
        repo = new MongoRefreshTokenRepository(mongo);
    }

    private Query capturedRemoveQuery() {
        ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
        verify(mongo).remove(q.capture(), org.mockito.ArgumentMatchers.eq(RefreshToken.class));
        return q.getValue();
    }

    @Test
    void constructor_createsTtlIndexOnExpiresAtExpiringImmediately() {
        ArgumentCaptor<IndexDefinition> idx = ArgumentCaptor.forClass(IndexDefinition.class);
        verify(indexOps).ensureIndex(idx.capture());

        assertThat(idx.getValue().getIndexKeys()).isEqualTo(new Document("expiresAt", 1));
        // expireAfterSeconds=0 → il documento sparisce non appena expiresAt <= now
        assertThat(idx.getValue().getIndexOptions().get("expireAfterSeconds")).isEqualTo(0L);
    }

    @Test
    void save_delegatesTokenToTemplate() {
        RefreshToken token = new RefreshToken("hash", "admin", Instant.now());
        repo.save(token);
        verify(mongo).save(token);
    }

    @Test
    void existsById_queriesByIdAndReturnsTemplateAnswer() {
        when(mongo.exists(any(Query.class), org.mockito.ArgumentMatchers.eq(RefreshToken.class))).thenReturn(true);

        assertThat(repo.existsById("hash")).isTrue();

        ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
        verify(mongo).exists(q.capture(), org.mockito.ArgumentMatchers.eq(RefreshToken.class));
        assertThat(q.getValue().getQueryObject()).isEqualTo(new Document("_id", "hash"));
    }

    @Test
    void existsById_unknownToken_returnsFalse() {
        assertThat(repo.existsById("nope")).isFalse();
    }

    @Test
    void deleteById_removesOnlyThatId() {
        repo.deleteById("hash");
        assertThat(capturedRemoveQuery().getQueryObject()).isEqualTo(new Document("_id", "hash"));
    }

    @Test
    void deleteByUsername_removesAllTokensOfThatUser() {
        repo.deleteByUsername("admin");
        assertThat(capturedRemoveQuery().getQueryObject()).isEqualTo(new Document("username", "admin"));
    }
}
