package com.monstervault.service;

import com.monstervault.model.Can;
import com.monstervault.repository.CanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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

    private void warmCache(Can... cans) {
        ReflectionTestUtils.setField(service, "cache", new CopyOnWriteArrayList<>(List.of(cans)));
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
        List<Can> cache = (List<Can>) ReflectionTestUtils.getField(service, "cache");
        assertThat(cache).extracting(Can::getNome).containsExactlyInAnyOrder("Updated", "Beta");
    }

    @Test
    void save_repoError_invalidatesCache() throws Exception {
        warmCache(can("1", "Alpha"));
        doThrow(new RuntimeException("Firestore down")).when(repo).save(any());
        assertThatThrownBy(() -> service.save(can("1", "Updated")))
                .isInstanceOf(RuntimeException.class);
        assertThat(ReflectionTestUtils.getField(service, "cache")).isNull();
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
    void permanentDelete_firestoreBeforeCloudinary() throws Exception {
        String p1 = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/photo1.jpg";
        String p2 = "https://res.cloudinary.com/demo/image/upload/v1/monster-vault/photo2.jpg";
        Can c = can("1", "Alpha"); c.setP1(p1); c.setP2(p2);
        warmCache(c, can("2", "Beta"));
        service.permanentDelete("1");
        InOrder order = inOrder(repo, photoStorage);
        order.verify(repo).delete("1");
        order.verify(photoStorage).delete(p1);
        order.verify(photoStorage).delete(p2);
        List<Can> cache = (List<Can>) ReflectionTestUtils.getField(service, "cache");
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

    // ── deleteAll ─────────────────────────────────────────────────────────────

    @Test
    void deleteAll_resetsCache() throws Exception {
        warmCache(can("1", "Alpha"), can("2", "Beta"));
        service.deleteAll();
        List<Can> cache = (List<Can>) ReflectionTestUtils.getField(service, "cache");
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
        List<Can> cache = (List<Can>) ReflectionTestUtils.getField(service, "cache");
        assertThat(cache).isEmpty();
    }
}
