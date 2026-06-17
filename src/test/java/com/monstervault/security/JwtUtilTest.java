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
        ReflectionTestUtils.setField(jwtUtil, "expiration", 86400000L);
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
        ReflectionTestUtils.setField(jwtUtil, "expiration", -1000L);
        String token = jwtUtil.generate("RedMghost");
        assertThat(jwtUtil.isValid(token)).isFalse();
    }

    @Test
    void isValid_tamperedToken_returnsFalse() {
        String token = jwtUtil.generate("RedMghost");
        String tampered = token.substring(0, token.length() - 6) + "XXXXXX";
        assertThat(jwtUtil.isValid(tampered)).isFalse();
    }
}
