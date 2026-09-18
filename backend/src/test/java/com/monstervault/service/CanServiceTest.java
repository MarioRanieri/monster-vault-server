package com.monstervault.service;

import com.monstervault.exception.MonsterVaultException;
import com.monstervault.model.Can;
import com.monstervault.repository.CanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CanServiceTest {

    private CanRepository repo;
    private PhotoStorage photoStorage;
    private CanService service;

    @BeforeEach
    void setUp() {
        repo = mock(CanRepository.class);
        photoStorage = mock(PhotoStorage.class);
        service = new CanService(repo, photoStorage);
    }

    // ── Builders ──────────────────────────────────────────────────────────────

    private Can can(String id, String nome) {
        Can c = new Can(); c.setId(id); c.setNome(nome); return c;
    }

    private Can canWithPhoto(String id, String p1) {
        Can c = can(id, "Birra " + id); c.setP1(p1); return c;
    }

    private Can canWithPhotoAndId(String id, String p1, String p1Id) {
        Can c = canWithPhoto(id, p1); c.setP1Id(p1Id); return c;
    }

    @SuppressWarnings("unchecked")
    private AtomicReference<List<Can>> cacheRef() {
        return (AtomicReference<List<Can>>) ReflectionTestUtils.getField(service, "cache");
    }

    private void warmCache(Can... cans) {
        cacheRef().set(new CopyOnWriteArrayList<>(List.of(cans)));
    }

    private List<Can> cacheContents() {
        return cacheRef().get();
    }

    // ── getAll ────────────────────────────────────────────────────────────────

    @Test
    void getAll_warmCache_returnsFromCacheWithoutRepo() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        assertThat(service.getAll()).hasSize(2);
        verifyNoInteractions(repo);
    }

    @Test
    void getAll_coldCache_loadsFromRepoAndPopulatesCache() throws Exception {
        when(repo.getAll()).thenReturn(List.of(can("1", "Alpha")));
        List<Can> result = service.getAll();
        service.getAll(); // secondo accesso: usa cache
        assertThat(result).hasSize(1);
        verify(repo, times(1)).getAll();
    }

    @Test
    void getAll_excludesSoftDeletedCans() throws Exception {
        Can active  = can("1", "Active");
        Can deleted = can("2", "Deleted");
        deleted.setDeletedAt(System.currentTimeMillis());
        warmCache(active, deleted);
        List<Can> result = service.getAll();
        assertThat(result).containsExactly(active);
        assertThat(result).doesNotContain(deleted);
    }

    @Test
    void getById_returnsSoftDeletedCan() throws Exception {
        Can deleted = can("1", "Deleted");
        deleted.setDeletedAt(System.currentTimeMillis());
        warmCache(deleted);
        assertThat(service.getById("1")).isEqualTo(deleted);
    }

    // ── cachedActiveCount (metrica observability) ─────────────────────────────

    @Test
    void cachedActiveCount_coldCache_returnsZeroWithoutRepo() {
        assertThat(service.cachedActiveCount()).isZero();
        verifyNoInteractions(repo);
    }

    @Test
    void cachedActiveCount_countsOnlyActiveCans() {
        Can deleted = can("3", "Deleted");
        deleted.setDeletedAt(System.currentTimeMillis());
        warmCache(can("1", "Alpha"), can("2", "Beta"), deleted);
        assertThat(service.cachedActiveCount()).isEqualTo(2);
    }

    // ── save ──────────────────────────────────────────────────────────────────

    @Test
    void save_warmCache_replacesExistingEntry() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        service.save(can("1", "Updated"));
        List<Can> cache = cacheContents();
        assertThat(cache).extracting(Can::getNome).containsExactlyInAnyOrder("Updated", "Beta");
    }

    @Test
    void save_repoError_invalidatesCache() throws Exception {
        warmCache(can("1", "Alpha"));
        doThrow(new RuntimeException("DB down")).when(repo).save(any());
        assertThatThrownBy(() -> service.save(can("1", "Updated")))
                .isInstanceOf(RuntimeException.class);
        assertThat(cacheContents()).isNull();
    }

    // ── update ────────────────────────────────────────────────────────────────

    @Test
    void update_replacedPhoto_savesBeforeDelete() throws Exception {
        String oldUrl = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/old.jpg";
        String newUrl = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/new.jpg";
        warmCache(canWithPhoto("1", oldUrl));
        service.update(canWithPhoto("1", newUrl));
        InOrder order = inOrder(repo, photoStorage);
        order.verify(repo).save(any());
        order.verify(photoStorage).delete(oldUrl);
    }

    @Test
    void update_samePhoto_doesNotDeleteFromStorage() throws Exception {
        String url = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/same.jpg";
        warmCache(canWithPhoto("1", url));
        service.update(canWithPhoto("1", url));
        verify(photoStorage, never()).delete(anyString());
    }

    @Test
    void update_replacedPhoto_usesStoredPublicId() throws Exception {
        String oldUrl = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/old.jpg";
        String oldId  = "monster-vault/old_1_abc";
        warmCache(canWithPhotoAndId("1", oldUrl, oldId));
        service.update(can("1", "Updated"));
        verify(photoStorage).delete(oldId);
        verify(photoStorage, never()).delete(oldUrl);
    }

    // ── softDelete ────────────────────────────────────────────────────────────

    @Test
    void softDelete_setsDeletedAtAndKeepsInCache() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        service.softDelete("1");
        Can c = service.getById("1");
        assertThat(c).isNotNull();
        assertThat(c.getDeletedAt()).isNotNull();
    }

    @Test
    void softDelete_doesNotDeleteFromCloudinary() throws Exception {
        Can c = canWithPhoto("1", "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/p.jpg");
        warmCache(c);
        service.softDelete("1");
        verify(photoStorage, never()).delete(anyString());
    }

    @Test
    void softDelete_canNoLongerInGetAll() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        service.softDelete("1");
        assertThat(service.getAll()).extracting(Can::getId).doesNotContain("1");
    }

    // ── restore ───────────────────────────────────────────────────────────────

    @Test
    void restore_clearsDeletedAtAndAppearsInGetAll() throws Exception {
        Can c = can("1", "Alpha");
        c.setDeletedAt(System.currentTimeMillis());
        warmCache(c, can("2", "Beta"));
        service.restore("1");
        assertThat(c.getDeletedAt()).isNull();
        assertThat(service.getAll()).extracting(Can::getId).contains("1");
    }

    // ── permanentDelete ───────────────────────────────────────────────────────

    @Test
    void permanentDelete_dbBeforeCloudinary() throws Exception {
        String p1 = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/photo1.jpg";
        String p2 = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/photo2.jpg";
        Can c = can("1", "Alpha"); c.setP1(p1); c.setP2(p2);
        warmCache(c, can("2", "Beta"));
        service.permanentDelete("1");
        InOrder order = inOrder(repo, photoStorage);
        order.verify(repo).delete("1");
        order.verify(photoStorage).delete(p1);
        order.verify(photoStorage).delete(p2);
        List<Can> cache = cacheContents();
        assertThat(cache).extracting(Can::getId).doesNotContain("1");
    }

    @Test
    void permanentDelete_canWithNoPhotos_doesNotCallStorage() throws Exception {
        warmCache(can("1", "Alpha"));
        service.permanentDelete("1");
        verify(photoStorage, never()).delete(anyString());
    }

    @Test
    void permanentDelete_usesStoredPublicId() throws Exception {
        String p1 = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/photo.jpg";
        String p1Id = "monster-vault/can1_1_abc";
        warmCache(canWithPhotoAndId("1", p1, p1Id));
        service.permanentDelete("1");
        verify(photoStorage).delete(p1Id);
        verify(photoStorage, never()).delete(p1);
    }

    // ── purgeSoftDeletedOlderThan (scheduler) ────────────────────────────────

    @Test
    void purge_removesOnlySoftDeletedOlderThanRetention() throws Exception {
        long now = System.currentTimeMillis();
        long day = 24L * 3600 * 1000;
        Can active     = can("1", "Active");                       // mai cancellata
        Can recent     = can("2", "Recent");  recent.setDeletedAt(now - 5 * day);   // entro i 30gg
        Can old        = can("3", "Old");     old.setDeletedAt(now - 40 * day);     // oltre i 30gg
        when(repo.getAll()).thenReturn(List.of(active, recent, old));

        int removed = service.purgeSoftDeletedOlderThan(30);

        assertThat(removed).isEqualTo(1);
        verify(repo).delete("3");
        verify(repo, never()).delete("1");
        verify(repo, never()).delete("2");
    }

    @Test
    void purge_nothingOld_removesNothing() throws Exception {
        Can active = can("1", "Active");
        when(repo.getAll()).thenReturn(List.of(active));
        assertThat(service.purgeSoftDeletedOlderThan(30)).isZero();
        verify(repo, never()).delete(anyString());
    }

    // ── deleteAll ─────────────────────────────────────────────────────────────

    @Test
    void deleteAll_resetsCache() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        service.deleteAll();
        List<Can> cache = cacheContents();
        assertThat(cache).isEmpty();
    }

    @Test
    void deleteAll_callsDeleteFolder() throws Exception {
        service.deleteAll();
        verify(photoStorage).deleteFolder();
    }

    @Test
    void deleteAll_cloudinaryFailure_cacheStillCleared() throws Exception {
        doThrow(new RuntimeException("Cloudinary API error")).when(photoStorage).deleteFolder();
        warmCache(can("1", "Alpha"));
        service.deleteAll(); // non deve propagare l'eccezione
        List<Can> cache = cacheContents();
        assertThat(cache).isEmpty();
    }

    // ── cache TTL ─────────────────────────────────────────────────────────────

    @Test
    void getAll_expiredCache_reloadsFromRepo() throws Exception {
        warmCache(can("1", "Stale"));
        ReflectionTestUtils.setField(service, "cacheLoadedAt", 1L); // caricata nel 1970
        when(repo.getAll()).thenReturn(List.of(can("2", "Fresh")));

        assertThat(service.getAll()).extracting(Can::getNome).containsExactly("Fresh");
        verify(repo, times(1)).getAll();
    }

    @Test
    void getAll_recentlyLoadedCache_isNotReloaded() throws Exception {
        warmCache(can("1", "Alpha"));
        ReflectionTestUtils.setField(service, "cacheLoadedAt", System.currentTimeMillis());

        assertThat(service.getAll()).hasSize(1);
        verifyNoInteractions(repo);
    }

    // ── getById ───────────────────────────────────────────────────────────────

    @Test
    void getById_coldCache_readsFromRepo() throws Exception {
        Can c = can("1", "Alpha");
        when(repo.getById("1")).thenReturn(c);
        assertThat(service.getById("1")).isSameAs(c);
    }

    @Test
    void getById_warmCacheWithoutThatId_returnsNullWithoutRepo() throws Exception {
        warmCache(can("1", "Alpha"));
        assertThat(service.getById("zzz")).isNull();
        verifyNoInteractions(repo);
    }

    // ── computeEtag ───────────────────────────────────────────────────────────

    private Can canAt(String id, Long updatedAt) {
        Can c = can(id, "n"); c.setUpdatedAt(updatedAt); return c;
    }

    @Test
    void computeEtag_isQuotedHexAndIndependentOfOrder() {
        String etag = CanService.computeEtag(List.of(canAt("1", 100L), canAt("2", 200L)));
        assertThat(etag).matches("\"[0-9a-f]+\"");
        assertThat(CanService.computeEtag(List.of(canAt("2", 200L), canAt("1", 100L)))).isEqualTo(etag);
    }

    @Test
    void computeEtag_changesWhenACanIsEditedAddedOrRemoved() {
        String base = CanService.computeEtag(List.of(canAt("1", 100L), canAt("2", 200L)));
        assertThat(CanService.computeEtag(List.of(canAt("1", 101L), canAt("2", 200L)))).isNotEqualTo(base);
        assertThat(CanService.computeEtag(List.of(canAt("1", 100L)))).isNotEqualTo(base);
        assertThat(CanService.computeEtag(List.of(canAt("1", 100L), canAt("2", 200L), canAt("3", 1L))))
                .isNotEqualTo(base);
    }

    @Test
    void computeEtag_nullUpdatedAtIsTreatedAsZero() {
        assertThat(CanService.computeEtag(List.of(canAt("1", null))))
                .isEqualTo(CanService.computeEtag(List.of(canAt("1", 0L))));
    }

    @Test
    void computeEtag_emptyCollection_isZero() {
        assertThat(CanService.computeEtag(List.of())).isEqualTo("\"0\"");
    }

    // ── save (cache fredda / cache calda con lattina nuova) ───────────────────

    @Test
    void save_coldCache_writesRepoAndLeavesCacheUnpopulated() throws Exception {
        Can c = can("1", "Alpha");
        service.save(c);
        verify(repo).save(c);
        assertThat(cacheContents()).isNull();
    }

    @Test
    void save_warmCache_addsBrandNewCan() throws Exception {
        warmCache(can("1", "Alpha"));
        service.save(can("2", "Beta"));
        assertThat(cacheContents()).extracting(Can::getId).containsExactlyInAnyOrder("1", "2");
    }

    // ── batchSave ─────────────────────────────────────────────────────────────

    @Test
    void batchSave_warmCache_replacesExistingAndAddsNew() throws Exception {
        warmCache(can("1", "Old"), can("2", "Keep"));
        List<Can> batch = List.of(can("1", "New"), can("3", "Added"));

        service.batchSave(batch);

        verify(repo).batchSave(batch);
        assertThat(cacheContents()).extracting(Can::getNome)
                .containsExactlyInAnyOrder("New", "Keep", "Added");
    }

    @Test
    void batchSave_coldCache_writesRepoOnly() throws Exception {
        List<Can> batch = List.of(can("1", "Alpha"));
        service.batchSave(batch);
        verify(repo).batchSave(batch);
        assertThat(cacheContents()).isNull();
    }

    @Test
    void batchSave_repoError_invalidatesCacheAndRethrows() throws Exception {
        warmCache(can("1", "Alpha"));
        doThrow(new RuntimeException("DB down")).when(repo).batchSave(any());

        assertThatThrownBy(() -> service.batchSave(List.of(can("1", "X"))))
                .isInstanceOf(RuntimeException.class).hasMessage("DB down");
        assertThat(cacheContents()).isNull();
    }

    // ── update: pulizia foto orfane ───────────────────────────────────────────

    @Test
    void update_unknownCan_savesWithoutTouchingStorage() throws Exception {
        warmCache(can("2", "Other"));
        service.update(canWithPhoto("1", "https://x/new.jpg"));
        verify(repo).save(any());
        verifyNoInteractions(photoStorage);
    }

    @Test
    void update_photoRemoved_deletesOldOne() throws Exception {
        warmCache(canWithPhoto("1", "https://x/old.jpg"));
        service.update(can("1", "No photo now"));
        verify(photoStorage).delete("https://x/old.jpg");
    }

    @Test
    void update_replacedEverySlot_deletesEveryOldPhoto() throws Exception {
        Can old = can("1", "Old");
        old.setP1("https://x/o1.jpg"); old.setP2("https://x/o2.jpg");
        old.setP3("https://x/o3.jpg"); old.setP4("https://x/o4.jpg");
        warmCache(old);
        Can neu = can("1", "New");
        neu.setP1("https://x/n1.jpg"); neu.setP2("https://x/n2.jpg");
        neu.setP3("https://x/n3.jpg"); neu.setP4("https://x/n4.jpg");

        service.update(neu);

        verify(photoStorage).delete("https://x/o1.jpg");
        verify(photoStorage).delete("https://x/o2.jpg");
        verify(photoStorage).delete("https://x/o3.jpg");
        verify(photoStorage).delete("https://x/o4.jpg");
        verify(photoStorage, times(4)).delete(anyString());
    }

    @Test
    void update_oldSlotEmptyString_isNotDeleted() throws Exception {
        warmCache(canWithPhoto("1", ""));
        service.update(can("1", "Updated"));
        verify(photoStorage, never()).delete(any());
    }

    @Test
    void update_storageFailure_isSwallowedAndOtherSlotsStillCleaned() throws Exception {
        Can old = can("1", "Old");
        old.setP1("https://x/o1.jpg"); old.setP2("https://x/o2.jpg");
        warmCache(old);
        doThrow(new RuntimeException("Cloudinary down")).when(photoStorage).delete("https://x/o1.jpg");

        service.update(can("1", "New")); // non deve propagare: il DB è già scritto

        verify(repo).save(any());
        verify(photoStorage).delete("https://x/o2.jpg");
    }

    @Test
    void update_blankPublicIdFallsBackToUrl() throws Exception {
        warmCache(canWithPhotoAndId("1", "https://x/old.jpg", ""));
        service.update(can("1", "New"));
        verify(photoStorage).delete("https://x/old.jpg");
    }

    // ── softDelete / restore: rami di errore e no-op ──────────────────────────

    @Test
    void softDelete_persistsCanWithDeletedAtSet() throws Exception {
        Can c = can("1", "Alpha");
        warmCache(c);
        long before = System.currentTimeMillis();

        service.softDelete("1");

        ArgumentCaptor<Can> saved = ArgumentCaptor.forClass(Can.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getId()).isEqualTo("1");
        assertThat(saved.getValue().getDeletedAt()).isGreaterThanOrEqualTo(before);
    }

    @Test
    void softDelete_unknownId_isNoOp() throws Exception {
        warmCache(can("1", "Alpha"));
        service.softDelete("zzz");
        verify(repo, never()).save(any());
    }

    @Test
    void softDelete_repoError_invalidatesCache() throws Exception {
        warmCache(can("1", "Alpha"));
        doThrow(new RuntimeException("DB down")).when(repo).save(any());

        assertThatThrownBy(() -> service.softDelete("1")).isInstanceOf(RuntimeException.class);
        assertThat(cacheContents()).isNull();
    }

    @Test
    void restore_persistsCanWithDeletedAtCleared() throws Exception {
        Can c = can("1", "Alpha");
        c.setDeletedAt(123L);
        warmCache(c);

        service.restore("1");

        ArgumentCaptor<Can> saved = ArgumentCaptor.forClass(Can.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getDeletedAt()).isNull();
    }

    @Test
    void restore_unknownId_isNoOp() throws Exception {
        warmCache(can("1", "Alpha"));
        service.restore("zzz");
        verify(repo, never()).save(any());
    }

    @Test
    void restore_canNotDeleted_isNoOp() throws Exception {
        warmCache(can("1", "Alpha"));
        service.restore("1");
        verify(repo, never()).save(any());
    }

    @Test
    void restore_repoError_invalidatesCache() throws Exception {
        Can c = can("1", "Alpha");
        c.setDeletedAt(123L);
        warmCache(c);
        doThrow(new RuntimeException("DB down")).when(repo).save(any());

        assertThatThrownBy(() -> service.restore("1")).isInstanceOf(RuntimeException.class);
        assertThat(cacheContents()).isNull();
    }

    // ── permanentDelete: rami di errore ───────────────────────────────────────

    @Test
    void permanentDelete_repoError_keepsPhotosAndInvalidatesCache() throws Exception {
        warmCache(canWithPhoto("1", "https://x/p.jpg"));
        doThrow(new RuntimeException("DB down")).when(repo).delete("1");

        assertThatThrownBy(() -> service.permanentDelete("1")).isInstanceOf(RuntimeException.class);

        // DB-first: se il DB non ha cancellato, le foto NON vanno toccate.
        verifyNoInteractions(photoStorage);
        assertThat(cacheContents()).isNull();
    }

    @Test
    void permanentDelete_unknownCan_stillDeletesFromRepoWithoutTouchingStorage() throws Exception {
        warmCache(can("2", "Other"));
        service.permanentDelete("1");
        verify(repo).delete("1");
        verifyNoInteractions(photoStorage);
        assertThat(cacheContents()).extracting(Can::getId).containsExactly("2");
    }

    @Test
    void permanentDelete_coldCache_readsCanFromRepoToCleanItsPhotos() throws Exception {
        when(repo.getById("1")).thenReturn(canWithPhoto("1", "https://x/p.jpg"));
        service.permanentDelete("1");
        verify(repo).delete("1");
        verify(photoStorage).delete("https://x/p.jpg");
        assertThat(cacheContents()).isNull();
    }

    @Test
    void permanentDelete_storageFailureOnOnePhoto_doesNotStopTheOthers() throws Exception {
        Can c = can("1", "Alpha");
        c.setP1("https://x/1.jpg"); c.setP2("https://x/2.jpg");
        c.setP3("https://x/3.jpg"); c.setP4("https://x/4.jpg");
        warmCache(c);
        doThrow(new RuntimeException("boom")).when(photoStorage).delete("https://x/2.jpg");

        service.permanentDelete("1"); // best-effort, non propaga

        verify(photoStorage).delete("https://x/1.jpg");
        verify(photoStorage).delete("https://x/3.jpg");
        verify(photoStorage).delete("https://x/4.jpg");
    }

    @Test
    void purge_removesEverySoftDeletedCanOlderThanRetention() throws Exception {
        long old = System.currentTimeMillis() - 40L * 24 * 3600 * 1000;
        Can a = can("1", "A"); a.setDeletedAt(old);
        Can b = canWithPhoto("2", "https://x/b.jpg"); b.setDeletedAt(old);
        when(repo.getAll()).thenReturn(List.of(a, b));
        when(repo.getById("2")).thenReturn(b); // cache fredda: permanentDelete rilegge dal repo

        assertThat(service.purgeSoftDeletedOlderThan(30)).isEqualTo(2);

        verify(repo).delete("1");
        verify(repo).delete("2");
        verify(photoStorage).delete("https://x/b.jpg");
    }

    // ── upload foto ───────────────────────────────────────────────────────────

    private final MockMultipartFile file = new MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3, 4})
    void uploadPhoto_setsUrlAndPublicIdOnTheRightSlot(int slot) throws Exception {
        Can c = can("1", "Alpha");
        warmCache(c);
        when(photoStorage.upload(eq(file), anyString())).thenReturn("https://cdn/new.jpg");

        String url = service.uploadPhoto("1", slot, file);

        assertThat(url).isEqualTo("https://cdn/new.jpg");
        ArgumentCaptor<String> rawId = ArgumentCaptor.forClass(String.class);
        verify(photoStorage).upload(eq(file), rawId.capture());
        assertThat(rawId.getValue()).startsWith("1_" + slot + "_");
        String[] urls = {c.getP1(), c.getP2(), c.getP3(), c.getP4()};
        String[] ids  = {c.getP1Id(), c.getP2Id(), c.getP3Id(), c.getP4Id()};
        for (int i = 0; i < 4; i++) {
            if (i == slot - 1) {
                assertThat(urls[i]).isEqualTo("https://cdn/new.jpg");
                assertThat(ids[i]).isEqualTo("monster-vault/" + rawId.getValue());
            } else {
                assertThat(urls[i]).isNull();
                assertThat(ids[i]).isNull();
            }
        }
        verify(repo).save(c);
    }

    @Test
    void uploadPhoto_replacingExistingSlot_savesThenDeletesOldByPublicId() throws Exception {
        warmCache(canWithPhotoAndId("1", "https://cdn/old.jpg", "monster-vault/old_1_x"));
        when(photoStorage.upload(eq(file), anyString())).thenReturn("https://cdn/new.jpg");

        service.uploadPhoto("1", 1, file);

        InOrder order = inOrder(repo, photoStorage);
        order.verify(repo).save(any());
        order.verify(photoStorage).delete("monster-vault/old_1_x");
    }

    @Test
    void uploadPhoto_outOfRangeSlot_savesCanUnchangedAndDeletesNothing() throws Exception {
        Can c = can("1", "Alpha");
        warmCache(c);
        when(photoStorage.upload(eq(file), anyString())).thenReturn("https://cdn/new.jpg");

        service.uploadPhoto("1", 9, file);

        assertThat(c.getP1()).isNull();
        assertThat(c.getP4()).isNull();
        verify(photoStorage, never()).delete(any());
    }

    @Test
    void uploadPhoto_unknownCan_returnsUrlButPersistsNothing() throws Exception {
        warmCache(can("2", "Other"));
        when(photoStorage.upload(eq(file), anyString())).thenReturn("https://cdn/new.jpg");

        assertThat(service.uploadPhoto("1", 1, file)).isEqualTo("https://cdn/new.jpg");
        verify(repo, never()).save(any());
    }

    @Test
    void uploadPhoto_storageFailure_propagatesAndLeavesCanUntouched() throws Exception {
        Can c = can("1", "Alpha");
        warmCache(c);
        when(photoStorage.upload(eq(file), anyString()))
                .thenThrow(new MonsterVaultException("upload failed"));

        assertThatThrownBy(() -> service.uploadPhoto("1", 1, file))
                .isInstanceOf(MonsterVaultException.class);
        assertThat(c.getP1()).isNull();
        verify(repo, never()).save(any());
    }

    @Test
    void uploadPhotoFromUrl_setsSlotAndReplacesOldPhoto() throws Exception {
        Can c = canWithPhotoAndId("1", "https://cdn/old.jpg", "monster-vault/old_1_x");
        warmCache(c);
        when(photoStorage.uploadFromUrl(eq("https://ext/pic.jpg"), anyString())).thenReturn("https://cdn/new.jpg");

        String url = service.uploadPhotoFromUrl("1", 1, "https://ext/pic.jpg");

        assertThat(url).isEqualTo("https://cdn/new.jpg");
        assertThat(c.getP1()).isEqualTo("https://cdn/new.jpg");
        assertThat(c.getP1Id()).startsWith("monster-vault/1_1_");
        verify(photoStorage).delete("monster-vault/old_1_x");
    }

    @Test
    void permanentDelete_photoSlotsWithEmptyUrl_areNotSentToStorage() throws Exception {
        Can c = can("1", "Alpha");
        c.setP1("");
        c.setP2("https://x/2.jpg");
        warmCache(c);

        service.permanentDelete("1");

        verify(photoStorage).delete("https://x/2.jpg");
        verify(photoStorage, times(1)).delete(any());
    }
}
