package com.monstervault.config;

import com.monstervault.service.CanService;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.binder.MeterBinder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metriche di BUSINESS custom, in aggiunta a quelle automatiche di Actuator/Micrometer
 * (HTTP, JVM, ecc.).
 *
 * Espone un gauge Prometheus {@code monstervault_cans_active} = numero di lattine attive
 * in collezione, letto dalla cache in memoria di {@link CanService#cachedActiveCount()}
 * (conteggio economico, nessuna query a Firestore). Compare su /actuator/prometheus e si
 * può graficare in Grafana accanto alle metriche di sistema.
 *
 * Un "gauge" è una misura che può salire E scendere (come un termometro), a differenza di
 * un "counter" che può solo crescere.
 */
@Configuration
public class MetricsConfig {

    @Bean
    public MeterBinder monsterVaultBusinessMetrics(CanService canService) {
        return registry -> Gauge
                .builder("monstervault.cans.active", canService, CanService::cachedActiveCount)
                .description("Lattine attive attualmente in collezione (dalla cache in memoria)")
                .baseUnit("cans")
                .register(registry);
    }
}
