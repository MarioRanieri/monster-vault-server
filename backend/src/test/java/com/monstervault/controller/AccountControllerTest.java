package com.monstervault.controller;

import com.monstervault.security.JwtUtil;
import com.monstervault.service.AccountService;
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

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AccountController.class)
@Import({com.monstervault.config.SecurityConfig.class, JwtUtil.class})
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-32-chars-minimum!!",
        "app.jwt.access-expiration=900000",
        "app.jwt.refresh-expiration=604800000"
})
class AccountControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockBean AccountService accountService;
    @MockBean PasswordEncoder passwordEncoder;

    private String bearer;

    @BeforeEach
    void setUp() {
        bearer = "Bearer " + jwtUtil.generate("testadmin");
    }

    @Test
    void changePassword_noAuth_isRejected() throws Exception {
        mockMvc.perform(put("/api/account/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"a\",\"newPassword\":\"newpassword\"}"))
                .andExpect(status().is4xxClientError()); // 401/403: serve un JWT valido
    }

    @Test
    void changePassword_correct_returns204() throws Exception {
        when(accountService.changePassword("current", "newpassword")).thenReturn(true);

        mockMvc.perform(put("/api/account/password")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"current\",\"newPassword\":\"newpassword\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    void changePassword_wrongCurrent_returns401() throws Exception {
        when(accountService.changePassword(anyString(), anyString())).thenReturn(false);

        mockMvc.perform(put("/api/account/password")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"newpassword\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void changePassword_shortNew_returns400() throws Exception {
        mockMvc.perform(put("/api/account/password")
                        .header("Authorization", bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"current\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void generateRecoveryCode_returnsCode() throws Exception {
        when(accountService.generateRecoveryCode()).thenReturn("MV-AAAA-BBBB-CCCC");

        mockMvc.perform(post("/api/account/recovery-code").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recoveryCode").value("MV-AAAA-BBBB-CCCC"));
    }
}
