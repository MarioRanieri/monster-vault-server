package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.service.CanService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * Controller REST per le operazioni CRUD sulle lattine e per il caricamento delle foto.
 *
 * Responsabilità (SRP): tradurre richieste HTTP in chiamate al service.
 * Non contiene logica di business — delega tutto a CanService.
 * Non sa nulla di MongoDB o Cloudinary (DIP): dipende solo da CanService.
 *
 * Endpoint (prefisso /api/cans):
 *   GET    /                         → lista completa attiva (ETag / 304 supportati)
 *   GET    /{id}                     → singola lattina (incluse soft-deleted)
 *   POST   /                         → crea lattina (JWT)
 *   POST   /batch                    → salva multiplo (JWT)
 *   PUT    /{id}                     → aggiorna + cleanup foto (JWT)
 *   DELETE /{id}                     → soft-delete (JWT) — undo in 10s poi chiama /permanent
 *   DELETE /{id}/permanent           → cancellazione definitiva + foto Cloudinary (JWT)
 *   PUT    /{id}/restore             → ripristino da soft-delete (JWT)
 *   DELETE /                         → elimina tutto (JWT + header)
 *   POST   /{id}/photo/{slot}        → upload foto file (JWT)
 *   POST   /{id}/photo/{slot}/from-url → upload foto URL (JWT)
 */
@Slf4j
@RestController
@RequestMapping("/api/cans")
public class CanController {

    /** Chiave JSON usata nei body delle risposte di errore. */
    private static final String ERROR_KEY = "error";

    /** Constructor injection (DIP): dipendenza esplicita, immutabile e testabile senza Spring. */
    private final CanService canService;

    public CanController(CanService canService) {
        this.canService = canService;
    }

    /**
     * Restituisce tutta la collezione attiva con supporto ETag / 304 Not Modified.
     *
     * ETag calcolato come hash XOR di (id + updatedAt) di tutte le lattine:
     * cambia ad ogni modifica, consente al browser/SW di evitare il download se la
     * collezione non è cambiata dall'ultima richiesta.
     */
    @GetMapping
    public ResponseEntity<List<Can>> getAll(
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch)
            throws Exception {
        List<Can> all = canService.getAll();
        String etag = CanService.computeEtag(all);
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(all);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Can> getById(@PathVariable String id) throws Exception {
        Can can = canService.getById(id);
        return can != null ? ResponseEntity.ok(can) : ResponseEntity.notFound().build();
    }

    @PostMapping
    public ResponseEntity<Can> create(@Valid @RequestBody Can can) throws Exception {
        canService.save(can);
        return ResponseEntity.ok(can);
    }

    @PostMapping("/batch")
    public ResponseEntity<?> batchSave(@RequestBody List<Can> cans) throws Exception {
        if (cans == null || cans.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(ERROR_KEY, "Empty list"));
        }
        // Ogni elemento deve avere un id non vuoto: senza questo check si salverebbero
        // documenti con id null su MongoDB (il @Valid di Spring non cascade sulle liste).
        if (cans.stream().anyMatch(c -> c.getId() == null || c.getId().isBlank())) {
            return ResponseEntity.badRequest().body(Map.of(ERROR_KEY, "Every can must have a non-blank id"));
        }
        canService.batchSave(cans);
        return ResponseEntity.ok(Map.of("saved", cans.size()));
    }

    /**
     * Aggiorna una lattina. Il service confronta vecchi e nuovi URL foto ed elimina
     * da Cloudinary gli slot rimossi o sostituiti (logica di business in CanService — SRP).
     */
    @PutMapping("/{id}")
    public ResponseEntity<Can> update(@PathVariable String id, @RequestBody Can can)
            throws Exception {
        can.setId(id);
        canService.update(can);
        return ResponseEntity.ok(can);
    }

    /**
     * Soft-delete: imposta deletedAt sulla lattina e la nasconde dall'API.
     * Le foto su Cloudinary vengono conservate per permettere il restore.
     * Il frontend esegue la cancellazione definitiva ({@code DELETE /{id}/permanent})
     * allo scadere della finestra di undo (10 secondi).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) throws Exception {
        canService.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Ripristina una lattina soft-deleted: azzera deletedAt, torna visibile nell'API.
     */
    @PutMapping("/{id}/restore")
    public ResponseEntity<Void> restore(@PathVariable String id) throws Exception {
        canService.restore(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Cancellazione definitiva: rimuove la lattina da MongoDB e tutte le sue foto
     * da Cloudinary. Chiamato dal frontend allo scadere del timeout di undo.
     */
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentDelete(@PathVariable String id) throws Exception {
        canService.permanentDelete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Elimina tutta la collezione da MongoDB e le foto da Cloudinary.
     * Richiede l'header X-Confirm-Delete: all come protezione contro chiamate accidentali.
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAll(
            @RequestHeader(value = "X-Confirm-Delete", required = false) String confirm)
            throws Exception {
        if (confirm == null || !confirm.equalsIgnoreCase("all")) {
            log.warn("deleteAll chiamato senza header X-Confirm-Delete");
            return ResponseEntity.badRequest().build();
        }
        canService.deleteAll();
        log.info("Intera collezione eliminata");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/photo/{slot}")
    public ResponseEntity<?> uploadPhoto(@PathVariable String id,
                                         @PathVariable int slot,
                                         @RequestParam("file") MultipartFile file)
            throws Exception {
        String url = canService.uploadPhoto(id, slot, file);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @PostMapping("/{id}/photo/{slot}/from-url")
    public ResponseEntity<?> uploadPhotoFromUrl(@PathVariable String id,
                                                @PathVariable int slot,
                                                @RequestBody Map<String, String> body)
            throws Exception {
        String externalUrl = body != null ? body.get("url") : null;
        if (externalUrl == null || externalUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(ERROR_KEY, "Missing 'url' in request body"));
        }
        String url = canService.uploadPhotoFromUrl(id, slot, externalUrl);
        return ResponseEntity.ok(Map.of("url", url));
    }
}
