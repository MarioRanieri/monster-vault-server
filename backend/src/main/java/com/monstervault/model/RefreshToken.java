package com.monstervault.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/**
 * Refresh token attivo, persistito su MongoDB.
 *
 * Prima i token vivevano in una {@code ConcurrentHashMap} in memoria: a ogni
 * riavvio del backend (su Render free tier l'istanza si addormenta di continuo)
 * la mappa si azzerava e ogni refresh falliva → l'utente doveva rifare login a
 * ogni ricarica. Persistendoli su Mongo la sessione sopravvive ai riavvii.
 *
 * L'{@code _id} è l'HASH SHA-256 del token, mai il token in chiaro. {@code expiresAt}
 * alimenta un TTL index (cleanup automatico) — comunque i JWT scaduti sono già
 * rifiutati dal validator, quindi il TTL è solo igiene della collezione.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "refresh_tokens")
public class RefreshToken {

    @Id
    private String id;
    private String username;
    private Date expiresAt;
}
