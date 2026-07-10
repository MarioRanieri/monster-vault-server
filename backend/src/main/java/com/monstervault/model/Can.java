package com.monstervault.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Modello dati che rappresenta una lattina nella collezione Monster Vault.
 *
 * @Data (Lombok) genera automaticamente in fase di compilazione:
 *   getter e setter per ogni campo, equals(), hashCode() e toString().
 *   Senza Lombok bisognerebbe scrivere decine di metodi a mano.
 *
 * @NoArgsConstructor (Lombok) genera il costruttore senza argomenti.
 *   È obbligatorio per Spring Data MongoDB: quando mappa un documento BSON
 *   in un oggetto Java usa la reflection e chiama prima il costruttore vuoto,
 *   poi imposta i campi tramite i setter.
 *
 * Tutti i campi sono String (tranne updatedAt) per semplicità.
 */
@Data
@NoArgsConstructor
@Document(collection = "cans")
public class Can {

    /** Identificatore univoco della lattina. @NotBlank fa sì che Spring rifiuti
     *  con 400 Bad Request qualsiasi richiesta in cui questo campo è assente o vuoto.
     *  @Id mappa questo campo sull'_id di MongoDB. */
    @Id
    @NotBlank(message = "id obbligatorio")
    private String id;

    private String nome;
    private String sku;
    private String produttore;
    private String size;
    private String lingua;
    private String top;       // tipo di tappo
    private String note;
    private String stato;     // es. "Aperta", "Chiusa", "Vuota"
    private String promo;
    private String valore;
    private String descrizione;

    private String p1;        // URL foto 1 (Cloudinary HTTPS — per display)
    private String p2;        // URL foto 2
    private String p3;        // URL foto 3
    private String p4;        // URL foto 4

    private String p1Id;      // Cloudinary public_id foto 1 (es. "monster-vault/abc_1_xyz") — per delete diretto
    private String p2Id;      // Cloudinary public_id foto 2
    private String p3Id;      // Cloudinary public_id foto 3
    private String p4Id;      // Cloudinary public_id foto 4

    /** Timestamp Unix in millisecondi dell'ultimo salvataggio. Impostato lato server
     *  da MongoCanRepository.save() per garantire ordine cronologico coerente. */
    private Long updatedAt;

    /** Timestamp Unix in millisecondi della PRIMA creazione. Impostato una sola volta dal
     *  repository quando la lattina non esiste ancora su MongoDB, poi mai più modificato
     *  (a differenza di updatedAt, che cambia a ogni edit). Alimenta il badge "added this
     *  month" della landing. I record migrati da Firestore, precedenti a questo campo,
     *  restano null: si contano solo le lattine davvero nuove da qui in avanti. */
    private Long createdAt;

    /**
     * Soft-delete: quando non null la lattina è "nel cestino" e non appare in GET /api/cans.
     * Impostato da CanService.softDelete(); azzerato da CanService.restore().
     * La cancellazione fisica (MongoDB + Cloudinary) avviene solo con permanentDelete().
     */
    private Long deletedAt;

    /** Timestamp Unix in millisecondi dell'ultima volta che p1 è stato impostato/aggiornato.
     *  Impostato dal repository solo quando p1 != null → permette il sort "RECENTLY PHOTOGRAPHED"
     *  indipendente dagli altri aggiornamenti (modifica note, stato, ecc.). */
    private Long photoAt;

    /** Flag "Monitora su eBay": se true, il companion tool eBay Monitor usa le foto
     *  di questa lattina come riferimento per cercarla sui mercati eBay.
     *  Impostato dall'admin dal frontend (toggle per-lattina). Default null = non sorvegliata. */
    private Boolean watch;
}
