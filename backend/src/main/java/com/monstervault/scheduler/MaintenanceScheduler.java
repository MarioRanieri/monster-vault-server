package com.monstervault.scheduler;

import com.monstervault.service.CanService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Task di manutenzione periodici (abilitati da @EnableScheduling su MonsterVaultApplication).
 *
 * Pulizia soft-delete: un soft-delete imposta solo deletedAt; il record resta su MongoDB
 * finché il frontend non chiama permanentDelete allo scadere dell'undo. Se quella chiamata
 * non avviene (utente chiude la pagina, errore di rete) il documento resta orfano e il
 * database cresce. Questo job lo rimuove definitivamente dopo la finestra di retention.
 */
@Slf4j
@Component
public class MaintenanceScheduler {

    /** Giorni di conservazione di una lattina soft-deleted prima della cancellazione fisica. */
    private static final long RETENTION_DAYS = 30;

    private final CanService canService;

    public MaintenanceScheduler(CanService canService) {
        this.canService = canService;
    }

    /**
     * Ogni notte alle 03:00 cancella fisicamente le lattine soft-deleted da oltre RETENTION_DAYS.
     * Un'eccezione qui non deve abortire silenziosamente lo scheduler: la loggo e basta.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void purgeOldSoftDeleted() {
        try {
            canService.purgeSoftDeletedOlderThan(RETENTION_DAYS);
        } catch (Exception e) {
            log.error("Purge soft-delete fallito: {}", e.getMessage(), e);
        }
    }
}
