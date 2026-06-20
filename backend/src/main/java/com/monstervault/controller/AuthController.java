package com.monstervault.controller;

import com.monstervault.service.AuthResponse;
import com.monstervault.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = "mv_refresh";

    private final AuthService authService;

    @Value("${app.jwt.refresh-cookie-secure:true}")
    private boolean cookieSecure;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req, HttpServletResponse response) {
        Optional<AuthResponse> result = authService.authenticate(req.username(), req.password());
        if (result.isPresent()) {
            log.info("Login riuscito per '{}'", req.username());
            AuthResponse auth = result.get();
            setRefreshCookie(response, auth.refreshToken());
            return ResponseEntity.ok(Map.of("accessToken", auth.accessToken()));
        }
        log.warn("Login fallito per '{}'", req.username());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid credentials");
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<AuthResponse> result = authService.refresh(refreshToken);
        if (result.isPresent()) {
            log.info("Token rinnovato");
            AuthResponse auth = result.get();
            setRefreshCookie(response, auth.refreshToken());
            return ResponseEntity.ok(Map.of("accessToken", auth.accessToken()));
        }
        clearRefreshCookie(response);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = extractRefreshCookie(request);
        if (refreshToken != null) {
            authService.logout(refreshToken);
        }
        clearRefreshCookie(response);
        log.info("Logout effettuato");
        return ResponseEntity.noContent().build();
    }

    private void setRefreshCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> REFRESH_COOKIE.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> !v.isEmpty())
                .findFirst()
                .orElse(null);
    }

    record LoginRequest(String username, String password) {}
}
