package com.monstervault.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Interceptor che limita i tentativi di login per indirizzo IP.
 *
 * Usa Bucket4j (token-bucket algorithm):
 *   - Ogni IP ha un bucket con 10 token
 *   - Ogni tentativo di login consuma 1 token
 *   - Il bucket si ricarica completamente ogni 60 secondi
 *   → Max 10 login/minuto per IP
 *
 * Registrato in WebConfig solo su /api/auth/login (non tocca altri endpoint).
 *
 * Nota: getClientIp() controlla X-Forwarded-For per funzionare correttamente
 * dietro il reverse proxy di Render.
 *
 * Hardening memoria (anti memory-exhaustion DoS): la mappa IP→Bucket è limitata a
 * MAX_TRACKED_IPS entry con eviction LRU. Senza questo limite, un attaccante che ruota
 * l'IP sorgente (o forgia l'header X-Forwarded-For) creerebbe una entry per ogni valore
 * distinto facendo crescere la mappa senza limite fino a esaurire l'heap.
 */
@Slf4j
@Component
public class LoginRateLimitInterceptor implements HandlerInterceptor {

    private static final int MAX_ATTEMPTS = 10;
    private static final Duration REFILL_PERIOD = Duration.ofMinutes(1);

    /** Numero massimo di IP tracciati contemporaneamente; oltre questa soglia l'entry
     *  usata meno di recente viene rimossa (LRU). 10k bucket ≈ poche centinaia di KB. */
    private static final int MAX_TRACKED_IPS = 10_000;

    /**
     * Map IP → Bucket con eviction LRU e dimensione massima limitata.
     *
     * Implementazione: LinkedHashMap in access-order (terzo parametro {@code true}) che
     * rimuove la entry più vecchia quando supera MAX_TRACKED_IPS (removeEldestEntry),
     * avvolta in {@code synchronizedMap} per la thread-safety. L'endpoint /login è a
     * bassissima frequenza (max 10 richieste/min per IP), quindi il lock grossolano del
     * synchronizedMap è del tutto trascurabile in termini di performance.
     */
    private final Map<String, Bucket> buckets = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                    return size() > MAX_TRACKED_IPS;
                }
            });

    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.simple(MAX_ATTEMPTS, REFILL_PERIOD))
                .build();
    }

    @Override
    public boolean preHandle(HttpServletRequest request,
                             HttpServletResponse response,
                             Object handler) throws Exception {
        String ip = getClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> newBucket());

        if (bucket.tryConsume(1)) {
            return true;
        }

        log.warn("Rate limit superato per IP: {}", ip);
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"error\":\"Too many login attempts — try again in a minute\"}");
        return false;
    }

    /**
     * Estrae l'IP reale del client, controllando prima X-Forwarded-For
     * (impostato dal reverse proxy di Render).
     */
    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
