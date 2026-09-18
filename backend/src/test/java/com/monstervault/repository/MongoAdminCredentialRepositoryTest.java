package com.monstervault.repository;

import com.monstervault.model.AdminCredential;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** MongoTemplate è mockato: findById() simula il contenuto della collezione admin_credentials. */
class MongoAdminCredentialRepositoryTest {

    private MongoTemplate mongo;
    private MongoAdminCredentialRepository repo;

    @BeforeEach
    void setUp() {
        mongo = mock(MongoTemplate.class);
        repo = new MongoAdminCredentialRepository(mongo);
    }

    @Test
    void find_documentPresent_returnsIt() {
        AdminCredential stored = new AdminCredential("admin", "mario", "hash", null);
        when(mongo.findById(AdminCredential.SINGLETON_ID, AdminCredential.class)).thenReturn(stored);

        assertThat(repo.find()).containsSame(stored);
    }

    @Test
    void find_noDocument_returnsEmpty() {
        assertThat(repo.find()).isEmpty();
    }

    @Test
    void save_forcesSingletonIdBeforePersisting() {
        // Anche se il chiamante passa un id diverso (o nessuno), c'è un solo admin.
        AdminCredential cred = new AdminCredential("qualcosa-altro", "mario", "hash", "rec");

        repo.save(cred);

        assertThat(cred.getId()).isEqualTo(AdminCredential.SINGLETON_ID);
        verify(mongo).save(cred);
    }
}
