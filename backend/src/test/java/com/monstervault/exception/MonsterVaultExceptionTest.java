package com.monstervault.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MonsterVaultExceptionTest {

    @Test
    void messageAndCause_areBothKept() {
        Throwable cause = new IllegalStateException("socket closed");

        MonsterVaultException e = new MonsterVaultException("upload failed", cause);

        assertThat(e).hasMessage("upload failed").hasCause(cause);
    }

    @Test
    void messageOnly_hasNoCause() {
        MonsterVaultException e = new MonsterVaultException("upload failed");

        assertThat(e).hasMessage("upload failed");
        assertThat(e.getCause()).isNull();
    }
}
