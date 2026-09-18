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

    // --- GET /api/cans: ETag / 304 ---

    private Can canAt(String id, long updatedAt) {
        Can c = new Can();
        c.setId(id);
        c.setUpdatedAt(updatedAt);
        return c;
    }

    @Test
    void getAll_matchingIfNoneMatch_returns304WithoutBody() throws Exception {
        when(canService.getAll()).thenReturn(List.of(canAt("1", 123L)));
        String etag = mockMvc.perform(get("/api/cans"))
                .andReturn().getResponse().getHeader("ETag");

        mockMvc.perform(get("/api/cans").header("If-None-Match", etag))
                .andExpect(status().isNotModified())
                .andExpect(header().string("ETag", etag))
                .andExpect(content().string(""));
    }

    @Test
    void getAll_staleIfNoneMatch_returnsFullBodyWithFreshEtag() throws Exception {
        when(canService.getAll()).thenReturn(List.of(canAt("1", 123L)));

        mockMvc.perform(get("/api/cans").header("If-None-Match", "\"stale\""))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$[0].id").value("1"));
    }

    @Test
    void getAll_adminWithMatchingIfNoneMatch_returns304() throws Exception {
        when(canService.getAll()).thenReturn(List.of(canAt("1", 123L)));
        String etag = mockMvc.perform(get("/api/cans").header("Authorization", bearerToken))
                .andReturn().getResponse().getHeader("ETag");

        mockMvc.perform(get("/api/cans").header("Authorization", bearerToken).header("If-None-Match", etag))
                .andExpect(status().isNotModified());
    }

    // --- errori del service → 500 generico (GlobalExceptionHandler) ---

    @Test
    void getAll_serviceFailure_returns500WithGenericMessage() throws Exception {
        when(canService.getAll()).thenThrow(new com.monstervault.exception.MonsterVaultException("mongo down"));

        mockMvc.perform(get("/api/cans"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Internal server error"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("mongo"))));
    }

    // --- POST /api/cans/batch ---

    @Test
    void batchSave_validList_returnsSavedCountAndDelegates() throws Exception {
        mockMvc.perform(post("/api/cans/batch")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"id\":\"a\"},{\"id\":\"b\"}]"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saved").value(2));

        verify(canService).batchSave(argThat(l -> l.size() == 2 && "a".equals(l.get(0).getId())));
    }

    @Test
    void batchSave_emptyList_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/batch")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Empty list"));

        verify(canService, never()).batchSave(any());
    }

    @Test
    void batchSave_canWithoutId_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/batch")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"id\":\"a\"},{\"nome\":\"senza id\"}]"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Every can must have a non-blank id"));

        verify(canService, never()).batchSave(any());
    }

    @Test
    void batchSave_canWithBlankId_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/batch")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"id\":\"   \"}]"))
                .andExpect(status().isBadRequest());

        verify(canService, never()).batchSave(any());
    }

    @Test
    void batchSave_withoutAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/cans/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"id\":\"a\"}]"))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).batchSave(any());
    }

    // --- DELETE /api/cans: header di conferma ---

    @Test
    void deleteAll_confirmHeaderIsCaseInsensitive() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken)
                        .header("X-Confirm-Delete", "ALL"))
                .andExpect(status().isNoContent());

        verify(canService).deleteAll();
    }

    @Test
    void deleteAll_wrongConfirmValue_returns400() throws Exception {
        mockMvc.perform(delete("/api/cans")
                        .header("Authorization", bearerToken)
                        .header("X-Confirm-Delete", "yes"))
                .andExpect(status().isBadRequest());

        verify(canService, never()).deleteAll();
    }

    // --- POST /api/cans/{id}/photo/{slot} (multipart) ---

    @Test
    void uploadPhoto_withValidJwt_returnsUrlAndDelegatesWithSlot() throws Exception {
        org.springframework.mock.web.MockMultipartFile file =
                new org.springframework.mock.web.MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1, 2});
        when(canService.uploadPhoto(eq("abc"), eq(3), any())).thenReturn("https://res.cloudinary.com/abc_3.jpg");

        mockMvc.perform(multipart("/api/cans/abc/photo/3").file(file).header("Authorization", bearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://res.cloudinary.com/abc_3.jpg"));

        verify(canService).uploadPhoto(eq("abc"), eq(3), argThat(f -> "p.jpg".equals(f.getOriginalFilename())));
    }

    @Test
    void uploadPhoto_withoutAuth_returns401() throws Exception {
        org.springframework.mock.web.MockMultipartFile file =
                new org.springframework.mock.web.MockMultipartFile("file", "p.jpg", "image/jpeg", new byte[]{1});

        mockMvc.perform(multipart("/api/cans/abc/photo/1").file(file))
                .andExpect(status().isUnauthorized());

        verify(canService, never()).uploadPhoto(any(), anyInt(), any());
    }

    // --- POST /api/cans/{id}/photo/{slot}/from-url: body mancante/vuoto ---

    @Test
    void uploadPhotoFromUrl_missingUrlField_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Missing 'url' in request body"));

        verify(canService, never()).uploadPhotoFromUrl(any(), anyInt(), any());
    }

    @Test
    void uploadPhotoFromUrl_blankUrl_returns400() throws Exception {
        mockMvc.perform(post("/api/cans/abc/photo/1/from-url")
                        .header("Authorization", bearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"url\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Missing 'url' in request body"));

        verify(canService, never()).uploadPhotoFromUrl(any(), anyInt(), any());
    }
}
