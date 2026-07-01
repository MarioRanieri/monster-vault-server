package com.monstervault.exception;

/**
 * Eccezione applicativa per il fallimento di un'operazione di persistenza o storage
 * (database o provider foto non raggiungibile, errore di rete o di upload).
 *
 * Sostituisce il generico {@code throws Exception} nei contratti di CanRepository e
 * PhotoStorage (SonarQube S112): un tipo specifico rende esplicito che il fallimento è
 * di natura infrastrutturale. Viene tradotta in HTTP 500 dal GlobalExceptionHandler.
 */
public class MonsterVaultException extends Exception {

    public MonsterVaultException(String message, Throwable cause) {
        super(message, cause);
    }

    public MonsterVaultException(String message) {
        super(message);
    }
}
