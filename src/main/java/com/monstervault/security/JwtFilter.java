package com.monstervault.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filtro HTTP che intercetta ogni richiesta in entrata e autentica l'utente tramite JWT.
 *
 * Estende OncePerRequestFilter: garantisce che doFilterInternal venga chiamato
 * esattamente una volta per richiesta, anche in presenza di forward interni.
 *
 * Funziona così:
 *   1. Legge l'header "Authorization: Bearer <token>"
 *   2. Valida il token tramite TokenValidator
 *   3. Se valido, imposta l'autenticazione nel SecurityContext di Spring
 *   4. Passa la richiesta al filtro successivo nella catena
 *
 * Se il token è assente o non valido il filtro non fa nulla: la richiesta
 * prosegue non autenticata e sarà Spring Security a bloccarla con 401
 * se la rotta richiede autenticazione (configurato in SecurityConfig).
 */
@Component
public class JwtFilter extends OncePerRequestFilter {

    /** Dipende dall'interfaccia, non dall'implementazione concreta: JwtUtil è iniettato
     *  automaticamente da Spring perché è l'unico @Component che implementa TokenValidator.
     *  Constructor injection: dipendenza esplicita, immutabile e testabile senza Spring. */
    private final TokenValidator tokenValidator;

    public JwtFilter(TokenValidator tokenValidator) {
        this.tokenValidator = tokenValidator;
    }

    /**
     * Logica principale del filtro, eseguita ad ogni richiesta HTTP.
     *
     * @param request  la richiesta HTTP in entrata
     * @param response la risposta HTTP in uscita
     * @param chain    la catena dei filtri successivi — va sempre chiamata per non bloccare la richiesta
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            // Rimuove il prefisso "Bearer " (7 caratteri) per ottenere il token grezzo
            String token = header.substring(7);

            if (tokenValidator.isValid(token)) {
                String username = tokenValidator.getUsername(token);

                // Crea un oggetto di autenticazione Spring con:
                //   - principal: l'username estratto dal token
                //   - credentials: null (non servono, il token è già verificato)
                //   - authorities: ROLE_ADMIN (unico ruolo supportato — app single-admin)
                var auth = new UsernamePasswordAuthenticationToken(
                        username, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

                // Inserisce l'autenticazione nel contesto della richiesta corrente.
                // Spring Security legge questo contesto nei filtri successivi per
                // decidere se la rotta è accessibile all'utente corrente.
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }

        // Passa sempre al filtro successivo, autenticato o no
        chain.doFilter(request, response);
    }
}
