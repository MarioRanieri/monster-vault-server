package com.monstervault.config;

import com.monstervault.security.JwtFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;

/**
 * Configurazione di Spring Security.
 *
 * Strategia: autenticazione stateless tramite JWT.
 *   - Nessuna sessione HTTP sul server (STATELESS)
 *   - Nessun CSRF: senza cookie di sessione gli attacchi CSRF non si applicano
 *   - GET pubbliche: chiunque legge la collezione senza login
 *   - Scritture (POST/PUT/DELETE su /api/cans) richiedono JWT valido
 *
 * Security headers aggiunti:
 *   - Content-Security-Policy: limita le origini per script, immagini, connessioni
 *   - X-Frame-Options: DENY — previene il clickjacking via iframe
 *   - X-Content-Type-Options: nosniff — previene MIME-type sniffing
 *   - Referrer-Policy: strict-origin-when-cross-origin — limita le info nel referrer
 *   - Permissions-Policy: disabilita API non usate (camera, geolocation, ecc.)
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    public SecurityConfig(JwtFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    /**
     * Content-Security-Policy usata dall'app:
     *   - default-src 'self': tutto da stesso origin salvo eccezioni
     *   - img-src: Cloudinary (foto lattine), flagcdn.com (bandiere), data: e blob:
     *   - script-src 'unsafe-inline': richiesto da XLSX in-page; cdn.cloudflare per XLSX lib
     *   - style-src 'unsafe-inline': stili inline nell'HTML
     *   - connect-src 'self': XHR/fetch solo verso stesso origin (REST API)
     *   - frame-ancestors 'none': equivalente a X-Frame-Options DENY (più moderno)
     */
    private static final String CSP =
            "default-src 'self'; " +
            "img-src 'self' https://res.cloudinary.com https://flagcdn.com data: blob:; " +
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
            "style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; " +
            "connect-src 'self'; " +
            "frame-ancestors 'none'";

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .frameOptions(fo -> fo.deny())
                        .contentTypeOptions(cto -> {})
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Referrer-Policy", "strict-origin-when-cross-origin"))
                        .addHeaderWriter(new StaticHeadersWriter(
                                "Permissions-Policy",
                                "camera=(), geolocation=(), microphone=(), payment=()"))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(CSP))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/cans", "/api/cans/**").permitAll()
                        // Tutti gli asset statici in root sono pubblici (es. map.html, map-data.js):
                        // senza i glob *.html/*.js le pagine nuove finirebbero in anyRequest() → 401.
                        .requestMatchers("/", "/*.html", "/*.js", "/manifest.json",
                                "/*.jpg", "/*.png", "/*.ico", "/*.svg", "/*.webmanifest",
                                "/*.txt", "/*.xml", "/share/**").permitAll()
                        // Observability: endpoint Actuator pubblici per lo scrape di Prometheus
                        // (solo questi 3; /actuator/env, /beans ecc. NON sono esposti — vedi application.yml)
                        .requestMatchers("/actuator/health", "/actuator/info", "/actuator/prometheus").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs/**", "/v3/api-docs").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
