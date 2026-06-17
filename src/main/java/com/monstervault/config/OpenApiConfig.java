package com.monstervault.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configurazione OpenAPI / Swagger UI.
 *
 * Aggiunge il pulsante "Authorize" nella Swagger UI:
 *   1. Ottieni il token via POST /api/auth/login
 *   2. Clicca "Authorize" nella Swagger UI
 *   3. Inserisci il token nel campo "bearerAuth"
 *   4. Tutti gli endpoint protetti useranno il token
 *
 * La Swagger UI è accessibile a /swagger-ui.html senza autenticazione
 * (per poter fare il login e ottenere il token), ma le chiamate
 * agli endpoint protetti richiedono JWT valido come sempre.
 *
 * In produzione: valutare di aggiungere il path swagger-ui
 * in SecurityConfig con .authenticated() se si vuole limitare l'accesso.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openAPI() {
        final String securitySchemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("Monster Vault API")
                        .description("REST API per la gestione della collezione Monster Energy. " +
                                "Endpoint GET pubblici, tutto il resto richiede JWT. " +
                                "Usa POST /api/auth/login per ottenere il token, poi clicca Authorize.")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}
