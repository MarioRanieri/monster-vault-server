package com.monstervault.service;

import com.monstervault.model.Can;
import com.monstervault.repository.CanRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Layer di business logic per la gestione della collezione lattine.
 *
 * Responsabilità (SRP):
 *   - cache in-memoria thread-safe (evita letture Firestore ripetute, quota free tier)
 *   - orchestrazione foto Cloudinary: delete automatico su slot rimossi/sostituiti
 *   - soft-delete: deleteAt timestamp → lattina nascosta ma recuperabile
 *
 * Ciclo di vita di una lattina eliminata:
 *   1. softDelete(id)        → imposta deletedAt, mantiene in cache, NON tocca Cloudinary
 *   2. Undo (entro 10s)      → restore(id): azzera deletedAt, lattina torna visibile
 *   3. Undo scaduto          → permanentDelete(id): rimuove da Firestore + Cloudinary
 *
 * Dipendenze tramite interfacce (DIP):
 *   - CanRepository  → non sa che sotto c'è Firestore
 *   - PhotoStorage   → non sa che sotto c'è Cloudinary
 *
 * Invariante di sicurezza su Cloudinary (Fix 1 — race condition):
 *   Firestore viene sempre scritto/cancellato PRIMA di intervenire su Cloudinary.
 */
@Slf4j
@Service
public class CanService {

    private final CanRepository repo;
    private final PhotoStorage photoStorage;

    private static final long CACHE_TTL_MS = 12 * 60 * 60 * 1000L;

    private volatile List<Can> cache = null;
    private volatile long cacheLoadedAt = 0;

    public CanService(CanRepository repo, PhotoStorage photoStorage) {
        this.repo = repo;
        this.photoStorage = photoStorage;
    }

    // ── Lettura ──────────────────────────────────────────────────────────────

    /**
     * Restituisce tutte le lattine ATTIVE (deletedAt == null), usando la cache se valida.
     * Implementa Double-Checked Locking per thread safety senza lock frequente.
     */
    public List<Can> getAll() throws Exception {
        // Snapshot locale: persist() può azzerare `cache` da un altro thread in qualsiasi
        // momento — non dereferenziare mai il campo due volte (NPE race).
        List<Can> snap = cache;
        if (snap != null && cacheAge() <= CACHE_TTL_MS) return activeCans(snap);
        synchronized (this) {
            snap = cache;
            if (snap != null && cacheAge() <= CACHE_TTL_MS) return activeCans(snap);
            if (snap != null) log.info("Cache TTL scaduta — ricaricamento da Firestore");
            else              log.info("Cache miss — caricamento da Firestore");
            List<Can> loaded = repo.getAll();
            snap = new CopyOnWriteArrayList<>(loaded);
            cache = snap;
            cacheLoadedAt = System.currentTimeMillis();
            log.info("Cache popolata con {} documenti ({} attivi)", snap.size(), activeCans(snap).size());
        }
        return activeCans(snap);
    }

    /** Cerca per ID incluse le lattine soft-deleted (necessario per restore e detail view). */
    public Can getById(String id) throws Exception {
        List<Can> snap = cache;
        if (snap != null) {
            return snap.stream().filter(c -> id.equals(c.getId())).findFirst().orElse(null);
        }
        return repo.getById(id);
    }

    /**
     * Conteggio "economico" delle lattine attive letto dalla SOLA cache in memoria:
     * nessuna query a Firestore e nessuna eccezione → sicuro da chiamare ad alta frequenza
     * (es. da una metrica Micrometer scrapeata ogni pochi secondi).
     * Ritorna 0 finché la cache non è popolata (prima chiamata a getAll()).
     */
    public int cachedActiveCount() {
        List<Can> snap = cache;
        if (snap == null) return 0;
        int n = 0;
        for (Can c : snap) if (c.getDeletedAt() == null) n++;
        return n;
    }

    /**
     * Calcola l'ETag della collezione: hash XOR di (id + updatedAt) per ogni can.
     * Cambia ad ogni creazione, modifica o cancellazione — stabile se nulla cambia.
     * Vive nel service (è il service a definire cosa rende "cambiata" la collezione, SRP);
     * STATICA perché è una funzione pura: gira anche quando il bean è mockato nei test.
     */
    public static String computeEtag(List<Can> cans) {
        int hash = cans.stream().mapToInt(c ->
                java.util.Objects.hashCode(c.getId()) ^
                Long.hashCode(c.getUpdatedAt() != null ? c.getUpdatedAt() : 0L)
        ).sum();
        return '"' + Integer.toHexString(hash & 0x7fffffff) + '"';
    }

    // ── Scrittura ────────────────────────────────────────────────────────────

    /**
     * Crea o sovrascrive una lattina su Firestore e aggiorna la cache.
     * Per aggiornare con cleanup automatico delle foto obsolete usare {@link #update(Can)}.
     */
    public void save(Can can) throws Exception {
        persist(() -> { repo.save(can); return null; });
        List<Can> snap = cache;
        if (snap != null) {
            snap.removeIf(c -> can.getId().equals(c.getId()));
            snap.add(can);
            cacheLoadedAt = System.currentTimeMillis();
        }
    }

    /**
     * Aggiorna una lattina esistente con cleanup automatico delle foto obsolete.
     * Ordine di sicurezza: Firestore prima, Cloudinary dopo.
     */
    public void update(Can can) throws Exception {
        Can old = getById(can.getId());
        save(can);
        if (old != null) deleteOrphanPhotos(old, can);
    }

    public void batchSave(List<Can> cans) throws Exception {
        persist(() -> { repo.batchSave(cans); return null; });
        List<Can> snap = cache;
        if (snap != null) {
            for (Can can : cans) {
                snap.removeIf(c -> can.getId().equals(c.getId()));
                snap.add(can);
            }
            cacheLoadedAt = System.currentTimeMillis();
        }
    }

    // ── Soft delete / Restore ─────────────────────────────────────────────────

    /**
     * Soft-delete: imposta {@code deletedAt} sulla lattina e la nasconde da {@link #getAll()}.
     * NON elimina le foto da Cloudinary — le foto vengono mantenute per permettere il restore.
     * La cancellazione fisica avviene tramite {@link #permanentDelete(String)}.
     */
    public void softDelete(String id) throws Exception {
        Can can = getById(id);
        if (can == null) return;
        can.setDeletedAt(System.currentTimeMillis());
        persist(() -> { repo.save(can); return null; });
        // Il can rimane in cache con deletedAt != null; activeCans() lo escluderà
        cacheLoadedAt = System.currentTimeMillis();
        log.info("Soft-deleted can: {}", id);
    }

    /**
     * Ripristina una lattina soft-deleted: azzera {@code deletedAt} e la rende di nuovo visibile.
     */
    public void restore(String id) throws Exception {
        Can can = getById(id);
        if (can == null || can.getDeletedAt() == null) return;
        can.setDeletedAt(null);
        persist(() -> { repo.save(can); return null; });
        cacheLoadedAt = System.currentTimeMillis();
        log.info("Restored can: {}", id);
    }

    /**
     * Cancellazione fisica: rimuove la lattina da Firestore e tutte le sue foto da Cloudinary.
     * Chiamato dal frontend allo scadere della finestra di undo (10s dopo il soft-delete).
     *
     * Ordine di sicurezza:
     *   1. {@code repo.delete()} — rimuove da Firestore
     *   2. Cache aggiornata
     *   3. Foto eliminate da Cloudinary
     */
    public void permanentDelete(String id) throws Exception {
        Can can = getById(id);
        persist(() -> { repo.delete(id); return null; });
        List<Can> snap = cache;
        if (snap != null) { snap.removeIf(c -> id.equals(c.getId())); cacheLoadedAt = System.currentTimeMillis(); }
        if (can != null) deleteAllPhotos(can);
        log.info("Permanently deleted can: {}", id);
    }

    // ── Upload foto ───────────────────────────────────────────────────────────

    /**
     * Carica una foto da file e aggiorna lo slot, salvando sia URL che public_id.
     * @return URL HTTPS della foto caricata su Cloudinary
     */
    public String uploadPhoto(String id, int slot, MultipartFile file) throws Exception {
        String rawId = id + "_" + slot + "_" + Long.toString(System.currentTimeMillis(), 36);
        String url = photoStorage.upload(file, rawId);
        setPhoto(id, slot, url, "monster-vault/" + rawId);
        return url;
    }

    /**
     * Scarica la foto da un URL esterno e aggiorna lo slot.
     * @return URL HTTPS della foto ora ospitata su Cloudinary
     */
    public String uploadPhotoFromUrl(String id, int slot, String externalUrl) throws Exception {
        String rawId = id + "_" + slot + "_" + Long.toString(System.currentTimeMillis(), 36);
        String url = photoStorage.uploadFromUrl(externalUrl, rawId);
        setPhoto(id, slot, url, "monster-vault/" + rawId);
        return url;
    }

    // ── deleteAll ────────────────────────────────────────────────────────────

    /**
     * Elimina tutta la collezione da Firestore e tutte le foto da Cloudinary.
     * Usa Admin API {@code deleteResourcesByPrefix} — 1-3 chiamate invece di N destroy().
     * Il cleanup Cloudinary è best-effort (warning se fallisce; Firestore già pulito).
     */
    public void deleteAll() throws Exception {
        repo.deleteAll();
        cache = new CopyOnWriteArrayList<>();
        cacheLoadedAt = System.currentTimeMillis();
        try {
            photoStorage.deleteFolder();
            log.info("deleteAll completato: Firestore e Cloudinary svuotati");
        } catch (Exception e) {
            log.warn("deleteAll: Firestore svuotato ma Cloudinary cleanup fallito — {}. " +
                     "Rimuovere manualmente: Cloudinary → Media Library → monster-vault/ → Delete all",
                     e.getMessage());
        }
    }

    // ── Helpers privati ──────────────────────────────────────────────────────

    /** Ritorna solo le lattine attive (deletedAt == null) dallo SNAPSHOT passato.
     *  Lavora su una reference locale: un'invalidazione concorrente (cache=null) non causa NPE. */
    private List<Can> activeCans(List<Can> snap) {
        return snap.stream()
                .filter(c -> c.getDeletedAt() == null)
                .collect(Collectors.toList());
    }

    private void setPhoto(String id, int slot, String url, String publicId) throws Exception {
        Can can = getById(id);
        if (can == null) return;
        String oldUrl = slotUrl(can, slot);
        String oldId  = slotId(can, slot);
        setSlot(can, slot, url, publicId);
        save(can);
        deletePhoto(oldUrl, oldId);
    }

    private void deleteOrphanPhotos(Can old, Can neu) {
        deleteIfReplaced(old.getP1(), old.getP1Id(), neu.getP1());
        deleteIfReplaced(old.getP2(), old.getP2Id(), neu.getP2());
        deleteIfReplaced(old.getP3(), old.getP3Id(), neu.getP3());
        deleteIfReplaced(old.getP4(), old.getP4Id(), neu.getP4());
    }

    private void deleteIfReplaced(String oldUrl, String oldId, String newUrl) {
        if (oldUrl != null && !oldUrl.isEmpty() && !oldUrl.equals(newUrl)) {
            deletePhoto(oldUrl, oldId);
        }
    }

    private void deleteAllPhotos(Can can) {
        deletePhoto(can.getP1(), can.getP1Id());
        deletePhoto(can.getP2(), can.getP2Id());
        deletePhoto(can.getP3(), can.getP3Id());
        deletePhoto(can.getP4(), can.getP4Id());
    }

    private void deletePhoto(String url, String publicId) {
        if (url == null || url.isEmpty()) return;
        String target = (publicId != null && !publicId.isEmpty()) ? publicId : url;
        try {
            photoStorage.delete(target);
        } catch (Exception e) {
            // Best-effort, coerente con l'invariante Firestore-first: il DB è già corretto,
            // ma la foto resta orfana su Cloudinary — va loggata per poterla rintracciare.
            log.warn("Cleanup Cloudinary fallito — foto orfana '{}': {}", target, e.getMessage());
        }
    }

    private String slotUrl(Can can, int slot) {
        return switch (slot) {
            case 1 -> can.getP1(); case 2 -> can.getP2();
            case 3 -> can.getP3(); case 4 -> can.getP4(); default -> null;
        };
    }

    private String slotId(Can can, int slot) {
        return switch (slot) {
            case 1 -> can.getP1Id(); case 2 -> can.getP2Id();
            case 3 -> can.getP3Id(); case 4 -> can.getP4Id(); default -> null;
        };
    }

    private void setSlot(Can can, int slot, String url, String publicId) {
        switch (slot) {
            case 1 -> { can.setP1(url); can.setP1Id(publicId); }
            case 2 -> { can.setP2(url); can.setP2Id(publicId); }
            case 3 -> { can.setP3(url); can.setP3Id(publicId); }
            case 4 -> { can.setP4(url); can.setP4Id(publicId); }
        }
    }

    private long cacheAge() {
        return cacheLoadedAt == 0 ? 0 : System.currentTimeMillis() - cacheLoadedAt;
    }

    private void persist(Callable<Void> action) throws Exception {
        try {
            action.call();
        } catch (Exception e) {
            cache = null;
            throw e;
        }
    }
}
