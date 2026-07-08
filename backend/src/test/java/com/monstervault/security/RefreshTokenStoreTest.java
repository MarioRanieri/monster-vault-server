package com.monstervault.security;

import com.monstervault.model.RefreshToken;
import com.monstervault.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshTokenStoreTest {

    private static final long REFRESH_MS = 604_800_000L; // 7 giorni

    /** Fake in memoria del port di persistenza: mantiene la copertura comportamentale
     *  senza rete (l'adapter Mongo reale è un thin wrapper non unit-testato, come gli altri). */
    private static final class FakeRepo implements RefreshTokenRepository {
        final Map<String, RefreshToken> byId = new HashMap<>();

        @Override public void save(RefreshToken t) { byId.put(t.getId(), t); }
        @Override public boolean existsById(String id) { return byId.containsKey(id); }
        @Override public void deleteById(String id) { byId.remove(id); }
        @Override public void deleteByUsername(String username) {
            byId.values().removeIf(t -> t.getUsername().equals(username));
        }
    }

    private FakeRepo repo;
    private RefreshTokenStore store;

    @BeforeEach
    void setUp() {
        repo = new FakeRepo();
        store = new RefreshTokenStore(repo, REFRESH_MS);
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
    void store_persistsHashedIdNotRawToken() {
        store.store("secret-token", "admin");
        // l'id salvato è l'hash, mai il token in chiaro
        assertThat(repo.byId).containsKey(RefreshTokenStore.hash("secret-token"));
        assertThat(repo.byId).doesNotContainKey("secret-token");
    }

    @Test
    void store_setsExpiryAboutRefreshWindowAhead() {
        long before = System.currentTimeMillis();
        store.store("t", "admin");
        long expiresAt = repo.byId.get(RefreshTokenStore.hash("t")).getExpiresAt().getTime();
        assertThat(expiresAt).isBetween(before + REFRESH_MS, System.currentTimeMillis() + REFRESH_MS);
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
