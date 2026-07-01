package com.monstervault.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.monstervault.exception.MonsterVaultException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Implementazione di PhotoStorage che usa Cloudinary come storage cloud per le foto.
 *
 * Cloudinary è un servizio di gestione media: accetta upload di immagini, le ottimizza
 * (ridimensionamento, compressione, conversione formato) e le serve da CDN globale.
 *
 * Le credenziali (cloud-name, api-key, api-secret) vengono lette da application.properties
 * e iniettate tramite @Value — mai hardcodate nel codice.
 */
@Slf4j
@Service
public class CloudinaryService implements PhotoStorage {

    /** Prefisso cartella Cloudinary per tutte le risorse dell'app. */
    private static final String FOLDER_PREFIX = "monster-vault/";

    @Value("${cloudinary.cloud-name}")
    private String cloudName;

    @Value("${cloudinary.api-key}")
    private String apiKey;

    @Value("${cloudinary.api-secret}")
    private String apiSecret;

    /**
     * Crea un'istanza Cloudinary con le credenziali correnti.
     * Viene ricreata ad ogni chiamata: Cloudinary non mantiene connessioni persistenti,
     * quindi il costo è trascurabile.
     */
    private Cloudinary cloudinary() {
        return new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret
        ));
    }

    /**
     * Carica i byte del file su Cloudinary nella cartella "monster-vault/".
     * "overwrite: true" sovrascrive se esiste già una risorsa con lo stesso public_id.
     */
    @Override
    public String upload(MultipartFile file, String publicId) throws MonsterVaultException {
        try {
            var result = cloudinary().uploader().upload(file.getBytes(), ObjectUtils.asMap(
                    "public_id", FOLDER_PREFIX + publicId,
                    "overwrite", true
            ));
            return (String) result.get("secure_url");
        } catch (IOException e) {
            throw new MonsterVaultException("Upload foto Cloudinary fallito (" + publicId + ")", e);
        }
    }

    /**
     * Chiede a Cloudinary di scaricare la foto direttamente dall'URL esterno.
     * Il server Cloudinary fa il fetch, salva la risorsa e restituisce la nuova URL.
     */
    @Override
    public String uploadFromUrl(String externalUrl, String publicId) throws MonsterVaultException {
        try {
            var result = cloudinary().uploader().upload(externalUrl, ObjectUtils.asMap(
                    "public_id", FOLDER_PREFIX + publicId,
                    "overwrite", true
            ));
            return (String) result.get("secure_url");
        } catch (IOException e) {
            throw new MonsterVaultException("Upload foto da URL su Cloudinary fallito (" + publicId + ")", e);
        }
    }

    /**
     * Elimina una foto da Cloudinary dato il suo public_id oppure URL HTTPS.
     *
     * Logica di risoluzione del public_id:
     *   1. Se l'input NON inizia con "http" → è già un public_id → usato direttamente
     *   2. Se contiene "cloudinary.com" → è un URL → public_id estratto tramite parsing
     *   3. Altrimenti (URL non-Cloudinary) → ignorato silenziosamente
     *
     * Non lancia eccezioni: fallimenti sono loggati come warning.
     *
     * Esempi:
     *   "monster-vault/abc_1_xyz"                          → destroy("monster-vault/abc_1_xyz")
     *   "https://.../upload/v123/monster-vault/abc.jpg"    → destroy("monster-vault/abc")
     */
    @Override
    public void delete(String urlOrPublicId) {
        if (urlOrPublicId == null || urlOrPublicId.isEmpty()) return;
        try {
            String publicId = resolvePublicId(urlOrPublicId);
            if (publicId == null) return;
            cloudinary().uploader().destroy(publicId, ObjectUtils.emptyMap());
            log.info("Foto eliminata da Cloudinary: {}", publicId);
        } catch (Exception e) {
            log.warn("Impossibile eliminare foto da Cloudinary ({}): {}", urlOrPublicId, e.getMessage());
        }
    }

    /**
     * Elimina tutte le risorse nella cartella "monster-vault/" su Cloudinary.
     *
     * Usa Admin API {@code deleteResourcesByPrefix}: una singola chiamata per batch
     * anziché N chiamate {@code destroy()} individuali.
     * Gestisce automaticamente la paginazione per collezioni con più di 1000 risorse
     * tramite {@code next_cursor}.
     *
     * @throws Exception se l'API non è raggiungibile o restituisce errore
     */
    @Override
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void deleteFolder() throws MonsterVaultException {
        try {
            String nextCursor = null;
            int batches = 0;
            do {
                Map opts = nextCursor != null
                        ? ObjectUtils.asMap("next_cursor", nextCursor)
                        : ObjectUtils.emptyMap();
                Map result = cloudinary().api().deleteResourcesByPrefix(FOLDER_PREFIX, opts);
                nextCursor = (String) result.get("next_cursor");
                batches++;
                log.info("deleteFolder batch {}: {}", batches, result.get("deleted_counts"));
            } while (nextCursor != null);
            log.info("deleteFolder completato: {} batch — monster-vault/ svuotata", batches);
        } catch (Exception e) {
            throw new MonsterVaultException("Pulizia cartella Cloudinary fallita", e);
        }
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    /**
     * Risolve l'input in un public_id Cloudinary.
     * @return public_id, oppure null se l'input non è Cloudinary
     */
    private String resolvePublicId(String urlOrPublicId) {
        if (!urlOrPublicId.startsWith("http")) {
            // Già un public_id (es. "monster-vault/abc_1_xyz")
            return urlOrPublicId;
        }
        if (!urlOrPublicId.contains("cloudinary.com")) {
            // URL non-Cloudinary (es. link esterno mai migrato): niente da cancellare
            log.debug("delete foto: URL non-Cloudinary ignorato — {}", urlOrPublicId);
            return null;
        }
        // URL Cloudinary: estrae public_id
        int uploadIdx = urlOrPublicId.indexOf("/upload/");
        if (uploadIdx == -1) {
            // Formato URL inatteso: il delete diventerebbe un no-op silenzioso — logghiamo
            log.warn("delete foto: URL Cloudinary senza '/upload/' (formato inatteso) — {}", urlOrPublicId);
            return null;
        }
        String path = urlOrPublicId.substring(uploadIdx + 8);
        path = path.replaceFirst("^v\\d+/", "");   // rimuove versione opzionale
        int dot = path.lastIndexOf('.');
        return dot > 0 ? path.substring(0, dot) : path;
    }
}
