package com.monstervault.config;

import com.monstervault.repository.RefreshTokenRepository;
import com.monstervault.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica che la documentazione OpenAPI (/v3/api-docs, /swagger-ui/**) non sia
 * leggibile senza autenticazione: espone l'intera mappa degli endpoint (incluse le
 * rotte di scrittura come /api/account/password) a chiunque, quindi va trattata
 * come il resto dell'API — solo utenti autenticati.
 *
 * @SpringBootTest completo (springdoc registra i suoi endpoint solo con l'app intera,
 * non nella web slice di @WebMvcTest). Nessun Mongo reale: le repository Mongo si
 * connettono in modo lazy tranne {@link RefreshTokenRepository}, che crea un indice TTL
 * nel costruttore — l'unica da mockare per evitare un tentativo di connessione reale.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000",
        "app.admin.username=testadmin",
        "app.admin.password=$2a$10$notused",
        "cloudinary.cloud-name=test",
        "cloudinary.api-key=test",
        "cloudinary.api-secret=test"
})
class ApiDocsAuthTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockBean RefreshTokenRepository refreshTokenRepository;

    @Test
    void apiDocs_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void apiDocs_withValidJwt_returns200() throws Exception {
        String token = jwtUtil.generateAccess("admin");

        mockMvc.perform(get("/v3/api-docs").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void swaggerUiHtml_withoutAuth_returns401() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isUnauthorized());
    }
}
