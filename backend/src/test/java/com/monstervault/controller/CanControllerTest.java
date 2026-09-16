package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.security.JwtUtil;
import com.monstervault.service.CanService;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = CanController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000"
})
class CanControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockBean CanService canService;
    // SecurityConfig espone PasswordEncoder — serve il @MockBean se non è disponibile nel contesto ridotto
    @MockBean PasswordEncoder passwordEncoder;

    private String bearerToken;

    @BeforeEach
    void setUp() {
        bearerToken = "Bearer " + jwtUtil.generate("testadmin");
    }

    // --- GET /api/cans ---

    @Test
    void getAll_noAuth_returns200WithEmptyList() throws Exception {
        when(canService.getAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getAll_noAuth_returns200WithCans() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setNome("Birra Alpha");
        when(canService.getAll()).thenReturn(List.of(c));

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("1"))
                .andExpect(jsonPath("$[0].nome").value("Birra Alpha"));
    }

    // --- GET /api/cans/{id} ---

    @Test
    void getById_existing_returns200WithJson() throws Exception {
        Can c = new Can();
        c.setId("abc");
        c.setNome("Birra Beta");
        c.setSku("SKU-001");
        when(canService.getById("abc")).thenReturn(c);

        mockMvc.perform(get("/api/cans/abc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc"))
                .andExpect(jsonPath("$.nome").value("Birra Beta"))
                .andExpect(jsonPath("$.sku").value("SKU-001"));
    }

    @Test
    void getById_notFound_returns404() throws Exception {
        when(canService.getById("missing")).thenReturn(null);

        mockMvc.perform(get("/api/cans/missing"))
                .andExpect(status().isNotFound());
    }

    // --- Guest non deve vedere il prezzo (valore) né dedurlo via cache HTTP ---

    @Test
    void getAll_noAuth_hidesValore() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setNome("Birra Alpha");
        c.setValore("50");
        when(canService.getAll()).thenReturn(List.of(c));

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Birra Alpha"))
                .andExpect(jsonPath("$[0].valore").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void getAll_withValidJwt_showsValore() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setValore("50");
        when(canService.getAll()).thenReturn(List.of(c));

        mockMvc.perform(get("/api/cans").header("Authorization", bearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].valore").value("50"));
    }

    @Test
    void getById_noAuth_hidesValore() throws Exception {
        Can c = new Can();
        c.setId("abc");
        c.setValore("99");
        when(canService.getById("abc")).thenReturn(c);

        mockMvc.perform(get("/api/cans/abc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valore").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void getById_withValidJwt_showsValore() throws Exception {
        Can c = new Can();
        c.setId("abc");
        c.setValore("99");
        when(canService.getById("abc")).thenReturn(c);

        mockMvc.perform(get("/api/cans/abc").header("Authorization", bearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valore").value("99"));
    }

    // La cache in CanService condivide le stesse istanze Can tra tutte le richieste
    // (vedi CopyOnWriteArrayList in CanService): oscurare il prezzo NON deve mutare
    // l'oggetto originale, altrimenti una successiva richiesta admin (o un update che
    // rilegge lo stesso oggetto) vedrebbe/persisterebbe il prezzo perso per sempre.
    @Test
    void getAll_noAuth_doesNotMutateOriginalCanObject() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setValore("50");
        when(canService.getAll()).thenReturn(List.of(c));

        mockMvc.perform(get("/api/cans")).andExpect(status().isOk());

        Assertions.assertEquals("50", c.getValore());
    }

    // L'ETag è calcolato da id+updatedAt, uguale per admin e guest: se non lo si
    // differenzia per ruolo, un browser che ha in cache la risposta admin (con
    // prezzi) risponderebbe 304 anche a una richiesta guest con lo stesso
    // If-None-Match, servendo dalla cache locale il body con i prezzi.
    @Test
    void getAll_etagDiffersBetweenGuestAndAdmin() throws Exception {
        Can c = new Can();
        c.setId("1");
        c.setUpdatedAt(123L);
        c.setValore("50");
        when(canService.getAll()).thenReturn(List.of(c));

        String guestEtag = mockMvc.perform(get("/api/cans"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("ETag");
        String adminEtag = mockMvc.perform(get("/api/cans").header("Authorization", bearerToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getHeader("ETag");

        Assertions.assertNotEquals(guestEtag, adminEtag);

        // Il guest-etag non deve far scattare 304 su una richiesta admin: altrimenti
        // il browser servirebbe dalla propria cache locale il body guest (senza prezzo)
        // — non è un leak, ma dimostra che gli scope sono davvero separati.
        mockMvc.perform(get("/api/cans").header("Authorization", bearerToken)
                        .header("If-None-Match", guestEtag))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].valore").value("50"));
    }

    // --- POST /api/cans ---

    @Test
    void create_withValidJwt_returns200AndDelegatesToService() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"new1\",\"nome\":\"Nuova Latta\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("new1"))
                .andExpect(jsonPath("$.nome").value("Nuova Latta"));

        verify(canService).save(argThat(c -> "new1".equals(c.getId())));
    }

    // --- DELETE /api/cans/{id} ---

    @Test
    void delete_withValidJwt_returns204AndSoftDeletes() throws Exception {
        mockMvc.perform(delete("/api/cans/abc")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).softDelete("abc");
    }

    @Test
    void permanentDelete_withValidJwt_returns204() throws Exception {
        mockMvc.perform(delete("/api/cans/abc/permanent")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).permanentDelete("abc");
    }

    @Test
    void restore_withValidJwt_returns204() throws Exception {
        mockMvc.perform(put("/api/cans/abc/restore")
                        .header("Authorization", bearerToken))
                .andExpect(status().isNoContent());

        verify(canService).restore("abc");
    }

    @Test
    void create_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"x\",\"nome\":\"Latta\"}"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).save(any());
    }

    @Test
    void delete_withoutAuth_returns401() throws Exception {
        mockMvc.perform(delete("/api/cans/abc"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).softDelete(any());
    }

    // --- PUT /api/cans/{id} ---

    @Test
    void update_withValidJwt_returns200AndDelegatesToService() throws Exception {
        mockMvc.perform(put("/api/cans/abc")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"abc\",\"nome\":\"Latta Aggiornata\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("abc"))
                .andExpect(jsonPath("$.nome").value("Latta Aggiornata"));

        verify(canService).update(argThat(c -> "abc".equals(c.getId())));
    }

    @Test
    void update_withoutAuth_returns401() throws Exception {
        mockMvc.perform(put("/api/cans/abc")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"abc\",\"nome\":\"Latta Aggiornata\"}"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).save(any());
    }

    @Test
    void update_withoutId_returns400() throws Exception {
        mockMvc.perform(put("/api/cans/abc")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Latta senza ID\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.id").value("id obbligatorio"));

        verify(canService, never()).update(any());
    }

    // --- DELETE /api/cans (deleteAll) ---

        @Test
    void deleteAll_withoutAuth_returns401() throws Exception {
        mockMvc.perform(delete("/api/cans"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).deleteAll();
    }

        @Test
    void deleteAll_withJwtAndConfirmHeader_returns204() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken)
                        .header("X-Confirm-Delete", "all"))
                .andExpect(status().isNoContent());

        verify(canService).deleteAll();
    }

        @Test
    void deleteAll_withJwtWithoutConfirmHeader_returns400() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken))
                .andExpect(status().isBadRequest());

        verify(canService, never()).deleteAll();
    }

    @Test
    void create_withoutId_returns400() throws Exception {
        mockMvc.perform(post("/api/cans")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Latta senza ID\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.id").value("id obbligatorio"));

        verify(canService, never()).save(any());
    }

    // --- POST /api/cans/{id}/photo/{slot}/from-url ---

    @Test
    void uploadPhotoFromUrl_withHttpsUrl_returns200() throws Exception {
        when(canService.uploadPhotoFromUrl("abc", 1, "https://example.com/photo.jpg"))
                .thenReturn("https://res.cloudinary.com/abc_1.jpg");

        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://example.com/photo.jpg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://res.cloudinary.com/abc_1.jpg"));
    }

    @Test
    void uploadPhotoFromUrl_withHttpUrl_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"http://example.com/photo.jpg\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("'url' must use https://"));

        verify(canService, never()).uploadPhotoFromUrl(any(), anyInt(), any());
    }

    @Test
    void uploadPhotoFromUrl_withNonHttpScheme_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"javascript:alert(1)\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("'url' must use https://"));

        verify(canService, never()).uploadPhotoFromUrl(any(), anyInt(), any());
    }

    @Test
    void uploadPhotoFromUrl_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"https://example.com/photo.jpg\"}"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).uploadPhotoFromUrl(any(), anyInt(), any());
    }
}
