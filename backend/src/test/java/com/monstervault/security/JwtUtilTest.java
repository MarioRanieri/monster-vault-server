package com.monstervault.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtUtilTest {

    private static final String SECRET = "test-secret-key-32-chars-minimum!!";

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", SECRET);
        ReflectionTestUtils.setField(jwtUtil, "accessExpiration", 900000L);
        ReflectionTestUtils.setField(jwtUtil, "refreshExpiration", 604800000L);
    }

    @Test
    void generate_getUsername_roundtrip() {
        String token = jwtUtil.generate("RedMghost");
        assertThat(jwtUtil.getUsername(token)).isEqualTo("RedMghost");
    }

    @Test
    void isValid_freshToken_returnsTrue() {
        String token = jwtUtil.generate("RedMghost");
        assertThat(jwtUtil.isValid(token)).isTrue();
    }

    @Test
    void isValid_expiredToken_returnsFalse() {
        ReflectionTestUtils.setField(jwtUtil, "accessExpiration", -1000L);
        String token = jwtUtil.generate("RedMghost");
        assertThat(jwtUtil.isValid(token)).isFalse();
    }

    @Test
    void isValid_tamperedToken_returnsFalse() {
        String token = jwtUtil.generate("RedMghost");
        String tampered = token.substring(0, token.length() - 6) + "XXXXXX";
        assertThat(jwtUtil.isValid(tampered)).isFalse();
    }

    // ── dual token types ─────────────────────────────────────────────────────

    @Test
    void generateAccess_isAccessToken() {
        String token = jwtUtil.generateAccess("admin");
        assertThat(jwtUtil.isAccessToken(token)).isTrue();
        assertThat(jwtUtil.isRefreshToken(token)).isFalse();
    }

    @Test
    void generateRefresh_isRefreshToken() {
        String token = jwtUtil.generateRefresh("admin");
        assertThat(jwtUtil.isRefreshToken(token)).isTrue();
        assertThat(jwtUtil.isAccessToken(token)).isFalse();
    }

    @Test
    void generate_defaultsToAccessToken() {
        String token = jwtUtil.generate("admin");
        assertThat(jwtUtil.isAccessToken(token)).isTrue();
    }

    @Test
    void generateRefresh_getUsername_roundtrip() {
        String token = jwtUtil.generateRefresh("admin");
        assertThat(jwtUtil.getUsername(token)).isEqualTo("admin");
    }

    @Test
    void expiredRefreshToken_isNotValid() {
        ReflectionTestUtils.setField(jwtUtil, "refreshExpiration", -1000L);
        String token = jwtUtil.generateRefresh("admin");
        assertThat(jwtUtil.isValid(token)).isFalse();
        assertThat(jwtUtil.isRefreshToken(token)).isFalse();
    }

    @Test
    void isAccessToken_invalidToken_returnsFalse() {
        assertThat(jwtUtil.isAccessToken("garbage")).isFalse();
    }

    @Test
    void isRefreshToken_invalidToken_returnsFalse() {
        assertThat(jwtUtil.isRefreshToken("garbage")).isFalse();
    }
}
