package com.monstervault.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenStoreTest {

    private RefreshTokenStore store;

    @BeforeEach
    void setUp() {
        store = new RefreshTokenStore();
    }

    @Test
    void store_and_isActive() {
        store.store("refresh-token-1", "admin");
        assertThat(store.isActive("refresh-token-1")).isTrue();
    }

    @Test
    void isActive_unknownToken_returnsFalse() {
        assertThat(store.isActive("unknown-token")).isFalse();
    }

    @Test
    void revoke_removesToken() {
        store.store("refresh-token-1", "admin");
        store.revoke("refresh-token-1");
        assertThat(store.isActive("refresh-token-1")).isFalse();
    }

    @Test
    void revokeAllForUser_removesOnlyThatUser() {
        store.store("token-admin-1", "admin");
        store.store("token-admin-2", "admin");
        store.store("token-other", "other");

        store.revokeAllForUser("admin");

        assertThat(store.isActive("token-admin-1")).isFalse();
        assertThat(store.isActive("token-admin-2")).isFalse();
        assertThat(store.isActive("token-other")).isTrue();
    }

    @Test
    void hash_isDeterministic() {
        String h1 = RefreshTokenStore.hash("same-input");
        String h2 = RefreshTokenStore.hash("same-input");
        assertThat(h1).isEqualTo(h2);
    }

    @Test
    void hash_differentInputs_differentHashes() {
        String h1 = RefreshTokenStore.hash("token-a");
        String h2 = RefreshTokenStore.hash("token-b");
        assertThat(h1).isNotEqualTo(h2);
    }
}
