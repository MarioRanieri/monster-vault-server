package com.monstervault.controller;

import com.monstervault.exception.FirestoreQuotaExceededException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Gestore centralizzato delle eccezioni per tutti i controller REST (principio SOLID SRP).
 *
 * @RestControllerAdvice: intercepta le eccezioni lanciate da qualsiasi controller
 * prima che arrivino al client. Senza questa classe, Spring restituirebbe la propria
 * pagina di errore HTML — inutile per una API REST.
 *
 * Centralizzare qui la gestione degli errori evita try-catch ripetuti in ogni controller
 * e garantisce un formato di risposta uniforme per tutti gli errori dell'applicazione.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Gestisce i fallimenti di validazione @Valid: quando un campo annotato con
     * @NotBlank, @NotNull, @Size, ecc. non supera la validazione, Spring lancia
     * MethodArgumentNotValidException prima ancora di entrare nel metodo del controller.
     *
     * Costruisce una mappa campo→messaggio e la restituisce come 400 Bad Request.
     * Esempio di risposta: { "errors": { "id": "id obbligatorio" } }
     *
     * (a, b) -> a è il merge function del toMap(): se lo stesso campo ha più errori,
     * teniamo solo il primo.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        FieldError::getDefaultMessage,
                        (a, b) -> a));
        return ResponseEntity.badRequest().body(Map.of("errors", fieldErrors));
    }

    /**
     * Catch-all per qualsiasi altra eccezione non gestita (es. errori Firestore, Cloudinary).
     *
     * Logga l'errore completo con stack trace (visibile sui log di Render) per il debug,
     * ma restituisce al client solo un messaggio generico: non vogliamo esporre dettagli
     * interni (nomi di classi, stack trace, struttura del database) che potrebbero
     * aiutare un attaccante a capire l'architettura del sistema.
     *
     * HttpServletRequest req è iniettato automaticamente da Spring per includere
     * metodo HTTP e URL nel log, rendendo più facile trovare l'endpoint problematico.
     */
    @ExceptionHandler(FirestoreQuotaExceededException.class)
    public ResponseEntity<Map<String, String>> handleQuotaExceeded(FirestoreQuotaExceededException e) {
        log.warn("Firestore quota exceeded: {}", e.getMessage());
        return ResponseEntity.status(429).body(Map.of(
                "error", "quota_exceeded",
                "message", e.getMessage()
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e, HttpServletRequest req) {
        log.error("{} {} — {}", req.getMethod(), req.getRequestURI(), e.getMessage(), e);
        return ResponseEntity.internalServerError().body(Map.of("error", "Internal server error"));
    }
}
