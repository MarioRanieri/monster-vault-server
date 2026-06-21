package com.monstervault.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {

    /** A missing static resource (e.g. browsers auto-requesting /favicon.ico) must be a
     *  404, not a 500 — regression guard for the dedicated NoResourceFoundException handler. */
    @Test
    void missingStaticResource_is404_notServerError() {
        var response = new GlobalExceptionHandler()
                .handleNoResource(new NoResourceFoundException(HttpMethod.GET, "/favicon.ico"));
        assertEquals(404, response.getStatusCode().value());
    }
}
