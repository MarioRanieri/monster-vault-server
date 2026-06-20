package com.monstervault.repository;

import com.google.cloud.firestore.*;
import com.monstervault.exception.FirestoreQuotaExceededException;
import com.monstervault.model.Can;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

@Slf4j
@Repository
public class FirestoreCanRepository implements CanRepository {

    /**
     * #6: Dimensione pagina per il caricamento paginato da Firestore.
     * Ogni pagina = 1 chiamata → PAGE_SIZE letture.
     * Valore 500 bilancia richieste di rete e dimensione payload.
     */
    private static final int PAGE_SIZE = 500;

    private final Firestore firestore;

    @Value("${firestore.collection}")
    private String collection;

    public FirestoreCanRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    /**
     * #6: Carica tutti i documenti usando paginazione con startAfter().
     *
     * Invece di leggere tutta la collection in una sola query (che può
     * esaurire i timeout di rete su collection grandi), carica PAGE_SIZE
     * documenti alla volta ordinati per documentId.
     *
     * Il numero totale di letture Firestore rimane invariato (1 per doc),
     * ma ogni singola richiesta è più leggera e il server può iniziare
     * a elaborare prima che l'intera collection sia trasferita.
     */
    @Override
    public List<Can> getAll() throws Exception {
        return fs(() -> {
            List<Can> result = new ArrayList<>();
            Query query = firestore.collection(collection)
                    .orderBy(FieldPath.documentId())
                    .limit(PAGE_SIZE);
            QuerySnapshot snapshot = query.get().get();
            int pages = 0;
            while (!snapshot.isEmpty()) {
                pages++;
                snapshot.getDocuments().forEach(doc -> result.add(doc.toObject(Can.class)));
                if (snapshot.size() < PAGE_SIZE) break;
                DocumentSnapshot last = snapshot.getDocuments().get(snapshot.size() - 1);
                query = firestore.collection(collection)
                        .orderBy(FieldPath.documentId())
                        .startAfter(last)
                        .limit(PAGE_SIZE);
                snapshot = query.get().get();
            }
            log.info("Firestore getAll: {} documenti caricati in {} pagine", result.size(), pages);
            return result;
        });
    }

    @Override
    public Can getById(String id) throws Exception {
        return fs(() -> {
            var doc = firestore.collection(collection).document(id).get().get();
            return doc.exists() ? doc.toObject(Can.class) : null;
        });
    }

    @Override
    public void save(Can can) throws Exception {
        long now = System.currentTimeMillis();
        can.setUpdatedAt(now);
        // photoAt: aggiornato se almeno uno slot foto (p1-p4) è presente
        if (can.getP1() != null || can.getP2() != null || can.getP3() != null || can.getP4() != null)
            can.setPhotoAt(now);
        fs(() -> { firestore.collection(collection).document(can.getId()).set(can).get(); return null; });
    }

    @Override
    public void batchSave(List<Can> cans) throws Exception {
        long now = System.currentTimeMillis();
        WriteBatch batch = firestore.batch();
        for (Can can : cans) {
            can.setUpdatedAt(now);
            if (can.getP1() != null || can.getP2() != null || can.getP3() != null || can.getP4() != null)
                can.setPhotoAt(now);
            batch.set(firestore.collection(collection).document(can.getId()), can);
        }
        fs(() -> { batch.commit().get(); return null; });
    }

    @Override
    public void delete(String id) throws Exception {
        fs(() -> { firestore.collection(collection).document(id).delete().get(); return null; });
    }

    @Override
    public void deleteAll() throws Exception {
        fs(() -> {
            var docs = firestore.collection(collection).get().get().getDocuments();
            for (var doc : docs) doc.getReference().delete().get();
            return null;
        });
    }

    // ── Helpers ──────────────────────────────────────────

    /**
     * Wraps every Firestore call: detects RESOURCE_EXHAUSTED (free-tier quota)
     * and converts it to FirestoreQuotaExceededException so the global handler
     * can return 429 instead of a generic 500.
     */
    private <T> T fs(Callable<T> action) throws Exception {
        try {
            return action.call();
        } catch (Exception e) {
            if (isQuotaExceeded(e)) throw new FirestoreQuotaExceededException();
            throw e;
        }
    }

    private boolean isQuotaExceeded(Throwable t) {
        while (t != null) {
            String msg = t.getMessage();
            if (msg != null && (msg.contains("RESOURCE_EXHAUSTED") || msg.contains("Quota exceeded"))) return true;
            t = t.getCause();
        }
        return false;
    }
}
