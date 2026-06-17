package com.monstervault.e2e;

import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.monstervault.model.Can;
import com.monstervault.repository.CanRepository;
import com.monstervault.security.JwtUtil;
import com.monstervault.service.AuthService;
import com.monstervault.service.PhotoStorage;
import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Classe base per tutti i test E2E con Selenium.
 *
 * Strategia di isolamento:
 *   - @SpringBootTest avvia il server completo su porta casuale
 *   - @MockBean su Firebase/Firestore/Cloudinary evita connessioni reali
 *   - @MockBean AuthService restituisce JWT valido per qualsiasi credenziale
 *   - JWT viene iniettato via localStorage per la maggior parte dei test
 *   - assumeTrue(chromeAvailable) skippa silenziosamente se Chrome non è installato
 *
 * Ogni test che estende questa classe ottiene:
 *   - un WebDriver fresco con headless Chrome
 *   - dati di test preconfigurati
 *   - helper per navigare come admin o guest
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "app.jwt.secret=test-secret-key-e2e-32-chars-ok!!",
        "app.jwt.expiration=86400000",
        "app.admin.username=testadmin",
        "app.admin.password=$2a$10$notused",
        "cloudinary.cloud-name=test",
        "cloudinary.api-key=test",
        "cloudinary.api-secret=test",
        "firestore.collection=test-cans"
})
abstract class E2EBaseTest {

    // ── Mock beans (evitano connessioni reali a Firebase/Cloudinary) ──────────
    @MockBean FirebaseApp  firebaseApp;
    @MockBean Firestore    firestore;
    @MockBean CanRepository canRepository;
    @MockBean PhotoStorage  photoStorage;
    @MockBean AuthService   authService;

    @LocalServerPort int port;
    @Autowired JwtUtil jwtUtil;

    protected WebDriver driver;
    protected WebDriverWait wait;
    protected String baseUrl;

    /** true se Chrome + ChromeDriver sono stati trovati sul sistema */
    protected static boolean chromeAvailable = false;

    @BeforeAll
    static void detectChrome() {
        try {
            WebDriverManager.chromedriver().setup();
            chromeAvailable = true;
        } catch (Exception e) {
            chromeAvailable = false;
        }
    }

    @BeforeEach
    void setUpE2E() throws Exception {
        assumeTrue(chromeAvailable, "Chrome/ChromeDriver non disponibile — test E2E saltati");

        // Mock CanRepository: restituisce dati di test
        var cans = buildTestCans();
        when(canRepository.getAll()).thenReturn(cans);
        for (var can : cans) {
            when(canRepository.getById(can.getId())).thenReturn(can);
        }

        // Mock AuthService: qualsiasi credenziale → JWT valido
        String token = jwtUtil.generate("testadmin");
        when(authService.authenticate(any(), any())).thenReturn(Optional.of(token));
        when(authService.refresh(any())).thenReturn(Optional.of(token));

        // Mock void methods (save, delete, batchSave)
        when(canRepository.getById(any())).thenReturn(null);
        for (var can : cans) {
            when(canRepository.getById(can.getId())).thenReturn(can);
        }

        // Crea WebDriver con Chrome headless
        ChromeOptions opts = new ChromeOptions();
        opts.addArguments(
                "--headless=new",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,800"
        );
        driver = new ChromeDriver(opts);
        wait   = new WebDriverWait(driver, Duration.ofSeconds(15));
        baseUrl = "http://localhost:" + port;
    }

    @AfterEach
    void tearDownE2E() {
        if (driver != null) {
            driver.quit();
            driver = null;
        }
    }

    // ── Navigation helpers ────────────────────────────────────────────────────

    /** Apre l'app con JWT iniettato in localStorage → modalità admin. */
    protected void openAsAdmin() {
        driver.get(baseUrl);
        waitForPageReady();
        dismissLandingOverlay(); // il landing overlay (z-index:1000) blocca tutti i click
        String token = jwtUtil.generate("testadmin");
        js("localStorage.setItem('mv_jwt_token', arguments[0])", token);
        driver.navigate().refresh(); // sessionStorage.mv_session_started già impostato → overlay non ricompare
        waitForGrid();
        dismissConfotoFilter();
    }

    /** Apre l'app come guest tramite URL pubblico. */
    protected void openAsGuest() {
        driver.get(baseUrl + "?public=1&name=TestGuest");
        waitForGrid();
        dismissLandingOverlay(); // il landing overlay (z-index:1000) blocca i click sulle card
        dismissConfotoFilter();
        // Attende che almeno una card sia visibile (non solo nel DOM)
        try {
            wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".card")));
        } catch (Exception ignored) {}
    }

    /**
     * Imposta le dimensioni del viewport.
     * In headless Chrome non c'è overhead del browser (nessuna barra indirizzi/titolo),
     * quindi setSize() corrisponde direttamente al viewport — nessuna compensazione necessaria.
     */
    protected void resizeTo(int width, int height) {
        driver.manage().window().setSize(new Dimension(width, height));
        js("if(typeof applyFilters==='function') applyFilters()");
    }

    // ── Wait helpers ─────────────────────────────────────────────────────────

    protected void waitForPageReady() {
        wait.until(d -> "complete".equals(js("return document.readyState")));
    }

    protected void waitForGrid() {
        wait.until(ExpectedConditions.presenceOfElementLocated(By.id("grid")));
        waitForPageReady();
    }

    protected void waitForElement(By locator) {
        wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }

    /** Attende che l'elemento sia nel DOM (anche se non visibile — es. height:0). */
    protected void waitForElementPresent(By locator) {
        wait.until(ExpectedConditions.presenceOfElementLocated(locator));
    }

    protected void waitForElementGone(By locator) {
        wait.until(ExpectedConditions.invisibilityOfElementLocated(locator));
    }

    // ── JavaScript helper ─────────────────────────────────────────────────────

    protected Object js(String script, Object... args) {
        return ((JavascriptExecutor) driver).executeScript(script, args);
    }

    protected String jsStr(String script, Object... args) {
        Object r = js(script, args); return r != null ? r.toString() : "";
    }

    // ── Misc ─────────────────────────────────────────────────────────────────

    /**
     * Chiude il landing overlay chiamando closeLanding(false) via JavaScript.
     * Il landing overlay (z-index:1000) copre l'intera pagina: senza questa chiamata
     * ogni click su card, bottoni, form viene intercettato dall'overlay.
     */
    protected void dismissLandingOverlay() {
        try {
            js("if(typeof closeLanding==='function') closeLanding(false)");
            wait.until(ExpectedConditions.invisibilityOfElementLocated(By.id("landing-overlay")));
        } catch (Exception ignored) {}
    }

    /**
     * Disattiva il filtro "With Photo" e aspetta che le card siano visibili.
     * I mock can non hanno foto: senza questo il grid resta vuoto.
     */
    protected void dismissConfotoFilter() {
        js("if(typeof activeChips!=='undefined'){" +
           "  activeChips.confoto=false;" +
           "  activeChips.nofoto=false;" +
           "  if(typeof applyFilters==='function') applyFilters();" +
           "}");
        // Attende che almeno una card sia nel DOM
        try {
            wait.until(d -> !d.findElements(By.cssSelector(".card")).isEmpty());
        } catch (Exception ignored) { /* alcuni test non richiedono card */ }
    }

    /** Dati di test: 5 lattine con attributi diversi. */
    protected static List<Can> buildTestCans() {
        return List.of(
            can("E001", "Monster Original",       "MO-500", "OK",          "500ML", "USA"),
            can("E002", "Monster Ultra White",     "MU-500", "OK",          "500ML", "USA"),
            can("E003", "Monster Mango Loco",      "ML-500", "Minor Dents", "500ML", "MEX"),
            can("E004", "Monster Pipeline Punch",  "MP-500", "OK",          "355ML", "AUS"),
            can("E005", "Monster Lewis Hamilton",  "LH-500", "Damaged",     "500ML", "GBR")
        );
    }

    private static Can can(String id, String nome, String sku, String stato, String size, String lingua) {
        Can c = new Can();
        c.setId(id); c.setNome(nome); c.setSku(sku);
        c.setStato(stato); c.setSize(size); c.setLingua(lingua);
        c.setUpdatedAt(System.currentTimeMillis());
        return c;
    }
}
