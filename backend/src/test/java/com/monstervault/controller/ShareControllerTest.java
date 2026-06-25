package com.monstervault.controller;

import com.monstervault.model.Can;
import com.monstervault.security.JwtUtil;
import com.monstervault.service.CanService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ShareController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000"
})
class ShareControllerTest {

    @Autowired MockMvc mockMvc;

    @MockBean CanService canService;
    // SecurityConfig esige un PasswordEncoder nel contesto ridotto di @WebMvcTest
    @MockBean PasswordEncoder passwordEncoder;

    @Test
    void share_existingCan_returnsOpenGraphHtmlWithPhoto() throws Exception {
        Can can = new Can();
        can.setId("abc");
        can.setNome("Monster Ultra");
        can.setDescrizione("Limited edition");
        can.setP1("https://res.cloudinary.com/demo/image/upload/v1/can.jpg");
        when(canService.getById("abc")).thenReturn(can);

        mockMvc.perform(get("/share/abc"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/html"))
                .andExpect(content().string(containsString("og:title")))
                .andExpect(content().string(containsString("Monster Ultra — Monster Vault")))
                // p1 riscritta nel social crop 1200x630
                .andExpect(content().string(containsString("/image/upload/c_fill,w_1200,h_630,g_auto/")))
                // meta-refresh nella SPA in modalità pubblica, deep-link alla lattina
                .andExpect(content().string(containsString("/?public=1&can=abc")));
    }

    @Test
    void share_missingCan_redirectsToRootWithoutOgTags() throws Exception {
        when(canService.getById("nope")).thenReturn(null);

        mockMvc.perform(get("/share/nope"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("url=/")))
                .andExpect(content().string(not(containsString("og:title"))));
    }

    @Test
    void share_blankPhoto_usesFallbackImage() throws Exception {
        Can can = new Can();
        can.setId("x");
        can.setNome("No Photo Can");
        when(canService.getById("x")).thenReturn(can);

        mockMvc.perform(get("/share/x"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("social-preview.png")));
    }

    @Test
    void share_escapesHtmlInTheCanName() throws Exception {
        Can can = new Can();
        can.setId("y");
        can.setNome("\"><script>alert(1)</script>");
        when(canService.getById("y")).thenReturn(can);

        mockMvc.perform(get("/share/y"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("<script>alert(1)"))))
                .andExpect(content().string(containsString("&lt;script&gt;")));
    }
}
