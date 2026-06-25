package com.monstervault.service;

import org.springframework.web.multipart.MultipartFile;

/**
 * Contratto per il salvataggio delle foto su storage cloud.
 *
 * CanController dipende da questa interfaccia (SOLID DIP): non sa che sotto c'è Cloudinary.
 * Se si volesse passare a AWS S3 o altro provider, si scriverebbe una nuova implementazione
 * senza toccare il controller.
 *
 * Entrambi i metodi restituiscono la URL pubblica della foto dopo l'upload,
 * che viene poi salvata come campo p1/p2/p3/p4 nel documento MongoDB della lattina.
 */
public interface PhotoStorage {

    /**
     * Carica un file binario su Cloudinary.
     *
     * @param file     il file multipart arrivato dalla richiesta HTTP (es. una foto JPG)
     * @param publicId identificatore univoco per la risorsa su Cloudinary (es. "ABC123_1_x7f2k")
     * @return URL HTTPS pubblica della foto su Cloudinary
     */
    String upload(MultipartFile file, String publicId) throws Exception;

    /**
     * Chiede a Cloudinary di scaricare la foto da un URL esterno e re-uploadarla.
     * Utile quando l'utente vuole importare una foto già online senza scaricarla prima.
     *
     * @param url      URL pubblico della foto originale (es. da un sito web)
     * @param publicId identificatore univoco per la risorsa su Cloudinary
     * @return URL HTTPS pubblica della foto ora ospitata su Cloudinary
     */
    String uploadFromUrl(String url, String publicId) throws Exception;

    /**
     * Elimina una singola foto dato il suo public_id Cloudinary oppure il suo URL HTTPS.
     * <ul>
     *   <li>public_id diretto (es. {@code "monster-vault/abc_1_xyz"}) → usato senza parsing</li>
     *   <li>URL Cloudinary (es. {@code "https://res.cloudinary.com/.../upload/v1/monster-vault/abc_1_xyz.jpg"})
     *       → il public_id viene estratto automaticamente</li>
     *   <li>URL non-Cloudinary → ignorati silenziosamente</li>
     * </ul>
     * Non lancia eccezioni: fallimenti vengono loggati come warning e non bloccano l'operazione.
     *
     * <p>Implementazione di default: no-op (OCP).
     *
     * @param urlOrPublicId public_id o URL Cloudinary HTTPS
     */
    default void delete(String urlOrPublicId) {}

    /**
     * Elimina tutte le risorse nella cartella {@code monster-vault/} su Cloudinary.
     * Usa Admin API {@code deleteResourcesByPrefix} — una sola chiamata per batch
     * anziché N chiamate {@code destroy()} individuali. Gestisce automaticamente
     * la paginazione per collezioni con più di 1000 risorse.
     *
     * <p>Usato da {@code CanService.deleteAll()} per un cleanup completo e atomico.
     *
     * <p>Implementazione di default: no-op (OCP).
     *
     * @throws Exception se l'Admin API Cloudinary non è raggiungibile o restituisce errore
     */
    default void deleteFolder() throws Exception {}
}
