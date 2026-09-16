package com.monstervault.config;

import com.monstervault.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifica che i font statici (serviti da /fonts/**, es. bebas-neue-400.woff2)
 * siano leggibili anche senza login, come gli altri asset pubblici (/assets/**,
 * /*.html). Prima del fix mancavano dal permitAll e cadevano su
 * anyRequest().authenticated() → 401, quindi il sito non caricava mai i font
 * scelti e ripiegava su quelli di sistema.
 *
 * @SpringBootTest completo (come ApiDocsAuthTest): il resource handler dei file
 * statici non è registrato nella web slice di @WebMvcTest.
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
class StaticResourcesAuthTest {

    @Autowired MockMvc mockMvc;

    @MockBean RefreshTokenRepository refreshTokenRepository;

    @Test
    void fontFile_withoutAuth_isNotUnauthorized() throws Exception {
        // Non richiediamo 200: il file può mancare nel classpath di test (copiato
        // da frontend/dist solo in build). Basta che la security non lo blocchi.
        mockMvc.perform(get("/fonts/bebas-neue-400.woff2"))
                .andExpect(result -> assertThat(result.getResponse().getStatus()).isNotEqualTo(401));
    }

    @Test
    void writeRoute_withoutAuth_staysUnauthorized() throws Exception {
        mockMvc.perform(post("/api/cans"))
                .andExpect(status().isUnauthorized());
    }
}
