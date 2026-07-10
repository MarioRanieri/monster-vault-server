package com.monstervault.repository;

import com.monstervault.model.Can;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifica lo stamping dei timestamp lato repository (server-autoritativo).
 * MongoTemplate è mockato: findById() simula lo stato attuale del documento su MongoDB.
 */
class MongoCanRepositoryTest {

    private MongoTemplate mongo;
    private MongoCanRepository repo;

    @BeforeEach
    void setUp() {
        mongo = mock(MongoTemplate.class);
        repo = new MongoCanRepository(mongo);
    }

    private Can can(String id) {
        Can c = new Can();
        c.setId(id);
        c.setNome("Test " + id);
        return c;
    }

    // ── createdAt ──────────────────────────────────────────────────────────────

    @Test
    void save_newCan_stampsCreatedAt() {
        // findById == null → la lattina non esiste ancora: è davvero nuova.
        when(mongo.findById(eq("1"), any())).thenReturn(null);
        Can fresh = can("1");

        repo.save(fresh);

        assertThat(fresh.getCreatedAt()).isNotNull();
        // Su una nuova lattina createdAt e updatedAt coincidono (stesso now).
        assertThat(fresh.getCreatedAt()).isEqualTo(fresh.getUpdatedAt());
    }

    @Test
    void save_existingCan_preservesCreatedAt() {
        // Edit: il client rimanda createdAt=null, ma il documento su Mongo ha già una data.
        Can existing = can("1");
        existing.setCreatedAt(1000L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1"); // createdAt null (il client non lo invia)
        repo.save(incoming);

        assertThat(incoming.getCreatedAt()).isEqualTo(1000L); // preservato, non ri-timbrato
    }

    @Test
    void save_legacyCanWithNullCreatedAt_staysNull() {
        // Record migrato da Firestore: esiste su Mongo ma senza createdAt.
        // Regression guard: un soft-delete+restore NON deve inventare una data "oggi"
        // (altrimenti la vecchia lattina finirebbe in "added this month").
        Can legacy = can("1"); // createdAt null, ma il record ESISTE
        when(mongo.findById(eq("1"), any())).thenReturn(legacy);

        Can incoming = can("1");
        repo.save(incoming);

        assertThat(incoming.getCreatedAt()).isNull();
    }

    // ── invariante esistente: updatedAt sempre timbrato ─────────────────────────

    @Test
    void save_alwaysStampsUpdatedAt() {
        when(mongo.findById(eq("1"), any())).thenReturn(null);
        Can c = can("1");
        repo.save(c);
        assertThat(c.getUpdatedAt()).isNotNull();
    }
}
