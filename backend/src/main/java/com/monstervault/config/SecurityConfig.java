package com.monstervault.config;

import com.monstervault.security.JwtFilter;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
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

    private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);

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
                        // Asset statici pubblici. /assets/** copre i bundle Vite (JS/CSS hashati
                        // in sottocartella); i glob /*.ext coprono i file in root (map.html, sw.js,
                        // manifest.json, immagini, robots.txt...). Senza /assets/** i bundle Vite
                        // finirebbero in anyRequest() → 401 e il sito non caricherebbe.
                        .requestMatchers("/", "/assets/**", "/*.html", "/*.js", "/*.css",
                                "/manifest.json", "/*.jpg", "/*.png", "/*.ico", "/*.svg",
                                "/*.webmanifest", "/*.txt", "/*.xml", "/share/**").permitAll()
                        // Observability: /health (lo usa anche il health check di Render) e /info
                        // restano pubblici. /prometheus espone metriche dettagliate → protetto con
                        // HTTP Basic (vedi metricsUser): Prometheus fa lo scrape con basic_auth.
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/prometheus").hasRole("METRICS")
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs/**", "/v3/api-docs").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                res.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                )
                // HTTP Basic solo per lo scrape di /actuator/prometheus. Le API REST usano JWT
                // (Bearer): il JwtFilter ignora il Basic, quindi i due meccanismi convivono.
                .httpBasic(Customizer.withDefaults())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Utente (in memoria) che Prometheus usa per autenticarsi sullo scrape di /actuator/prometheus.
     * Credenziali da env: METRICS_USER (default "metrics") e METRICS_PASSWORD.
     * Se METRICS_PASSWORD non è impostata, si genera una password casuale: l'app parte comunque
     * ma lo scrape è impossibile finché non la imposti (endpoint di fatto bloccato, mai aperto).
     */
    @Bean
    public UserDetailsService metricsUser(
            @Value("${metrics.user:metrics}") String user,
            @Value("${metrics.password:}") String password) {
        if (password.isBlank()) {
            password = UUID.randomUUID().toString();
            log.warn("METRICS_PASSWORD non impostata: /actuator/prometheus protetto con password "
                    + "casuale. Imposta METRICS_PASSWORD per consentire lo scrape di Prometheus.");
        }
        // Encoder costruito qui, non iniettato: nei @WebMvcTest il PasswordEncoder è un @MockBean
        // (encode() → null), che farebbe fallire il caricamento del context. BCrypt è BCrypt:
        // il DaoAuthenticationProvider in produzione verifica con lo stesso algoritmo.
        UserDetails metrics = User.withUsername(user)
                .password(new BCryptPasswordEncoder().encode(password))
                .roles("METRICS")
                .build();
        return new InMemoryUserDetailsManager(metrics);
    }
}
