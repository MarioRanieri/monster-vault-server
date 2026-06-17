package com.monstervault.exception;

public class FirestoreQuotaExceededException extends RuntimeException {
    public FirestoreQuotaExceededException() {
        super("Firebase Free tier: daily quota exceeded — try again tomorrow :)");
    }
}
