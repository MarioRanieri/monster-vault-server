package com.monstervault.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Credenziali dell'unico amministratore, persistite su MongoDB così da poterle
 * cambiare a runtime (prima erano solo in application.properties, immutabili).
 *
 * Al primo avvio il documento viene "seedato" dai valori di config
 * (app.admin.username / app.admin.password), quindi il login esistente non cambia.
 * Si salvano solo HASH BCrypt, mai valori in chiaro (né password né codice di recupero).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "admin_credentials")
public class AdminCredential {

    /** C'è un solo admin: il documento ha sempre questo _id. */
    public static final String SINGLETON_ID = "admin";

    @Id
    private String id;
    private String username;
    private String passwordHash;
    /** Hash del codice di recupero; null finché non ne viene generato uno. */
    private String recoveryCodeHash;
}
