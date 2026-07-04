package com.monstervault.controller;

import com.monstervault.service.AccountService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Endpoint di gestione account admin. Sta sotto /api/account, che in SecurityConfig
 * ricade in .anyRequest().authenticated() → richiede un access token valido (JWT).
 */
@Slf4j
@RestController
@RequestMapping("/api/account")
public class AccountController {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final AccountService accountService;

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PutMapping("/password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req) {
        if (tooShort(req.newPassword())) {
            return ResponseEntity.badRequest()
                    .body("Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (accountService.changePassword(req.currentPassword(), req.newPassword())) {
            log.info("Password cambiata");
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Current password is wrong");
    }

    @PostMapping("/recovery-code")
    public ResponseEntity<Map<String, String>> generateRecoveryCode() {
        String code = accountService.generateRecoveryCode();
        log.info("Nuovo codice di recupero generato");
        return ResponseEntity.ok(Map.of("recoveryCode", code));
    }

    static boolean tooShort(String password) {
        return password == null || password.length() < MIN_PASSWORD_LENGTH;
    }

    record ChangePasswordRequest(String currentPassword, String newPassword) {}
}
