package com.monstervault.repository;

import com.monstervault.model.Can;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.bson.Document;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
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

    // ── photoAt: timbrato SOLO se la foto è davvero cambiata rispetto al salvato ─

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void save_newCanWithAnyPhotoSlot_stampsPhotoAt(int slot) {
        // findById non stubbato → torna null di default: nessun documento esistente, è una vera
        // creazione.
        Can c = can("1");
        switch (slot) {
            case 1 -> c.setP1("https://x/1.jpg");
            case 2 -> c.setP2("https://x/2.jpg");
            case 3 -> c.setP3("https://x/3.jpg");
            default -> c.setP4("https://x/4.jpg");
        }

        repo.save(c);

        assertThat(c.getPhotoAt()).isNotNull().isEqualTo(c.getUpdatedAt());
    }

    @Test
    void save_newCanWithoutPhoto_leavesPhotoAtNull() {
        Can c = can("1");
        repo.save(c);
        assertThat(c.getPhotoAt()).isNull();
    }

    @Test
    void save_editWithIdenticalPhotos_keepsStoredPhotoAt() {
        // Bug regression: prima qualunque save (prezzo, note, restore...) con p1..p4 non-null
        // ribumpava photoAt anche a parità di foto.
        Can existing = can("1");
        existing.setP1("https://x/1.jpg");
        existing.setPhotoAt(1000L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP1("https://x/1.jpg"); // stessa foto, solo un edit di altri campi
        incoming.setNome("Nome aggiornato");

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isEqualTo(1000L);
    }

    @Test
    void save_editWithBlankSlotsAndNoStoredPhotos_keepsStoredNullPhotoAt() {
        // Il frontend manda "" per gli slot vuoti: non deve confondersi con "foto presente".
        Can existing = can("1"); // nessuna foto, photoAt null
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP1("");
        incoming.setP2("");
        incoming.setP3("");
        incoming.setP4("");

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isNull();
    }

    @Test
    void save_editChangedPhoto_stampsPhotoAtNow() {
        Can existing = can("1");
        existing.setP1("https://x/old.jpg");
        existing.setPhotoAt(1000L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP1("https://x/new.jpg");

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isNotNull().isEqualTo(incoming.getUpdatedAt());
    }

    @Test
    void save_editAddedPhotoToCanWithNoStoredPhotos_stampsPhotoAtNow() {
        Can existing = can("1"); // nessuna foto ancora
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP3("https://x/3.jpg");

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isNotNull().isEqualTo(incoming.getUpdatedAt());
    }

    @Test
    void save_editRemovingAllPhotos_keepsStoredPhotoAtWithoutSpecialCase() {
        Can existing = can("1");
        existing.setP1("https://x/1.jpg");
        existing.setPhotoAt(1000L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP1(""); // rimossa dal frontend

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isEqualTo(1000L);
    }

    @Test
    void save_clientSentPhotoAt_isIgnored() {
        Can existing = can("1");
        existing.setP1("https://x/1.jpg");
        existing.setPhotoAt(1000L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can incoming = can("1");
        incoming.setP1("https://x/1.jpg"); // invariata
        incoming.setPhotoAt(999_999_999L); // valore arbitrario mandato dal client, da ignorare

        repo.save(incoming);

        assertThat(incoming.getPhotoAt()).isEqualTo(1000L);
    }

    @Test
    void save_canWithoutId_isTreatedAsNewWithoutLookingItUp() {
        Can c = can(null);

        repo.save(c);

        assertThat(c.getCreatedAt()).isNotNull();
        verify(mongo, never()).findById(any(), eq(Can.class));
    }

    @Test
    void save_persistsTheStampedCanViaUpsert() {
        Can c = can("1");
        repo.save(c);
        verify(mongo).save(c);
    }

    @Test
    void save_canAlreadyHavingCreatedAt_keepsClientValueButStillLooksUpOnceForPhotoAt() {
        // La lookup ora serve anche a photoAt, quindi avviene comunque quando l'id è presente —
        // ma createdAt già valorizzato dal client non viene toccato, e la query è UNA sola
        // (riuso tra la logica photoAt e quella createdAt, non due query separate).
        Can existing = can("1");
        existing.setCreatedAt(1L);
        when(mongo.findById(eq("1"), any())).thenReturn(existing);

        Can c = can("1");
        c.setCreatedAt(5L);

        repo.save(c);

        assertThat(c.getCreatedAt()).isEqualTo(5L);
        verify(mongo, times(1)).findById(eq("1"), eq(Can.class));
    }

    // ── batchSave ──────────────────────────────────────────────────────────────

    @Test
    void batchSave_stampsAndPersistsEveryCan() {
        Can a = can("1");
        Can b = can("2");
        b.setP3("https://x/3.jpg");

        repo.batchSave(List.of(a, b));

        assertThat(a.getUpdatedAt()).isNotNull();
        assertThat(a.getCreatedAt()).isNotNull();
        assertThat(b.getPhotoAt()).isNotNull();
        verify(mongo).save(a);
        verify(mongo).save(b);
    }

    @Test
    void batchSave_emptyList_persistsNothing() {
        repo.batchSave(List.of());
        verify(mongo, never()).save(any());
    }

    // ── letture ────────────────────────────────────────────────────────────────

    @Test
    void getAll_returnsEveryDocumentFromTheTemplate() {
        List<Can> stored = List.of(can("1"), can("2"));
        when(mongo.findAll(Can.class)).thenReturn(stored);

        assertThat(repo.getAll()).isSameAs(stored);
    }

    @Test
    void getById_delegatesToFindById() {
        Can c = can("7");
        when(mongo.findById("7", Can.class)).thenReturn(c);

        assertThat(repo.getById("7")).isSameAs(c);
        assertThat(repo.getById("missing")).isNull();
    }

    // ── cancellazioni ──────────────────────────────────────────────────────────

    @Test
    void delete_removesOnlyTheGivenId() {
        repo.delete("42");

        ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
        verify(mongo).remove(q.capture(), eq(Can.class));
        assertThat(q.getValue().getQueryObject()).isEqualTo(new Document("id", "42"));
    }

    @Test
    void deleteAll_removesWithAnEmptyFilter() {
        repo.deleteAll();

        ArgumentCaptor<Query> q = ArgumentCaptor.forClass(Query.class);
        verify(mongo).remove(q.capture(), eq(Can.class));
        assertThat(q.getValue().getQueryObject()).isEmpty();
    }
}
