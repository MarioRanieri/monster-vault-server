package com.monstervault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto di ingresso dell'applicazione Spring Boot.
 *
 * @SpringBootApplication abilita tre cose insieme:
 *   - @Configuration: questa classe può definire bean
 *   - @EnableAutoConfiguration: Spring configura automaticamente tutto ciò che trova nel classpath
 *     (es. trova spring-boot-starter-web → avvia Tomcat embedded)
 *   - @ComponentScan: scansiona tutti i package sotto com.monstervault alla ricerca di
 *     @Component, @Service, @Repository, @Controller e li registra come bean nel contesto
 */
@SpringBootApplication
public class MonsterVaultApplication {

    /**
     * Avvia l'intero contesto Spring: carica la configurazione, inizializza tutti i bean,
     * avvia il server embedded su porta 8080 (o quella definita in application.properties).
     */
    public static void main(String[] args) {
        SpringApplication.run(MonsterVaultApplication.class, args);
    }
}
