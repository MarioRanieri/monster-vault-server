package com.monstervault.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/**
 * Configurazione Firebase Admin SDK.
 *
 * @Configuration indica a Spring che questa classe contiene definizioni di bean (@Bean).
 * I bean definiti qui vengono creati all'avvio dell'applicazione e resi disponibili
 * per l'iniezione in qualsiasi altro componente (es. FirestoreCanRepository riceve Firestore).
 *
 * Gestisce due ambienti in modo trasparente:
 *   - Locale: le credenziali vengono lette dal file JSON indicato in application.properties
 *   - Produzione (Render): le credenziali arrivano come variabile d'ambiente Base64
 *     perché su Render non si possono caricare file; il JSON viene encodato in Base64
 *     e inserito come stringa nella variabile FIREBASE_CREDENTIALS_JSON.
 */
@Configuration
public class FirebaseConfig {

    /** Path del file service account JSON — presente solo in locale, mai pushato su git.
     *  :#{null} è Spring Expression Language: se la proprietà non esiste, imposta null
     *  invece di lanciare eccezione (necessario in produzione dove la proprietà non c'è). */
    @Value("${firebase.service-account:#{null}}")
    private String serviceAccountPath;

    /**
     * Inizializza FirebaseApp con le credenziali del service account.
     * Il guard FirebaseApp.getApps().isEmpty() evita la re-inizializzazione in caso di
     * hot-reload o test multipli nello stesso processo JVM, che causerebbe IllegalStateException.
     *
     * @return l'istanza singleton di FirebaseApp usata per tutti i servizi Firebase
     */
    @Bean
    public FirebaseApp initializeFirebase() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        InputStream credentialsStream;
        String base64Json = System.getenv("FIREBASE_CREDENTIALS_JSON");

        if (base64Json != null && !base64Json.isBlank()) {
            // In produzione il JSON è codificato in Base64: lo decodifichiamo e lo
            // avvolgiamo in uno stream in memoria, senza toccare il filesystem
            credentialsStream = new ByteArrayInputStream(Base64.getDecoder().decode(base64Json));
        } else {
            // In locale leggiamo il file JSON dal percorso in application.properties
            credentialsStream = new FileInputStream(serviceAccountPath);
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(credentialsStream))
                .build();
        return FirebaseApp.initializeApp(options);
    }

    /**
     * Espone il client Firestore come bean Spring.
     * Riceve FirebaseApp iniettato (bean definito sopra) e ne estrae il client Firestore.
     * Tutti i repository che hanno bisogno di Firestore lo ricevono via costruttore.
     */
    @Bean
    public Firestore firestore(FirebaseApp app) {
        return FirestoreClient.getFirestore(app);
    }
}
