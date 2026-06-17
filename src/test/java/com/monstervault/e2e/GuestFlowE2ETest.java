package com.monstervault.e2e;

import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test E2E per la modalità guest (accesso pubblico tramite URL di condivisione).
 *
 * Verifica che:
 *   - L'interfaccia admin è completamente nascosta
 *   - La collezione è accessibile in sola lettura
 *   - Filtri, ricerca e compare funzionano
 *   - Dati sensibili (Est. Value) sono nascosti
 */
class GuestFlowE2ETest extends E2EBaseTest {

    // ── Accesso e UI ─────────────────────────────────────────────────────────

    @Test
    void guestMode_gridLoadsWithoutLogin() {
        openAsGuest();
        List<WebElement> cards = driver.findElements(By.cssSelector(".card"));
        assertThat(cards).isNotEmpty();
    }

    @Test
    void guestMode_noAddButton() {
        openAsGuest();
        WebElement btn = driver.findElement(By.id("btn-add"));
        // display: none — non visibile
        assertThat(btn.isDisplayed()).isFalse();
    }

    @Test
    void guestMode_noImportExportButtons() {
        openAsGuest();
        assertThat(driver.findElement(By.id("btn-export")).isDisplayed()).isFalse();
        assertThat(driver.findElement(By.id("btn-import")).isDisplayed()).isFalse();
    }

    @Test
    void guestMode_noScanPhotosButton() {
        openAsGuest();
        assertThat(driver.findElement(By.id("btn-clean")).isDisplayed()).isFalse();
    }

    @Test
    void guestMode_noDeleteButtonInDetail() {
        openAsGuest();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        // Il bottone Delete non deve essere visibile (no-edit body class)
        WebElement delBtn = driver.findElement(By.id("del-btn"));
        String display = (String) js("return getComputedStyle(arguments[0]).display", delBtn);
        assertThat(display).isEqualTo("none");
    }

    @Test
    void guestMode_loginButtonVisible() {
        openAsGuest();
        // Il bottone Sign in deve essere visibile per permettere di fare login
        assertThat(driver.findElement(By.id("btn-login")).isDisplayed()).isTrue();
    }

    @Test
    void guestMode_guideButtonVisible() {
        openAsGuest();
        assertThat(driver.findElement(By.id("btn-help")).isDisplayed()).isTrue();
    }

    // ── Detail panel in guest mode ────────────────────────────────────────────

    @Test
    void guestDetail_opensOnClick() {
        openAsGuest();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        assertThat(driver.findElement(By.cssSelector(".detail-panel")).getAttribute("class"))
                .contains("open");
    }

    @Test
    void guestDetail_noEditButton() {
        openAsGuest();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        // Il bottone Edit nel detail non deve essere visibile
        WebElement editBtn = driver.findElement(By.id("detail-edit-btn"));
        String display = (String) js("return getComputedStyle(arguments[0]).display", editBtn);
        assertThat(display).isEqualTo("none");
    }

    // ── Ricerca ───────────────────────────────────────────────────────────────

    @Test
    void guestSearch_filtersResults() {
        openAsGuest();
        int total = driver.findElements(By.cssSelector(".card")).size();
        driver.findElement(By.id("search-input")).sendKeys("Ultra");
        wait.until(d -> d.findElements(By.cssSelector(".card")).size() < total);
        assertThat(driver.findElements(By.cssSelector(".card")).size()).isLessThan(total);
    }

    @Test
    void guestSearch_skuSearchWorks() {
        openAsGuest();
        int total = driver.findElements(By.cssSelector(".card")).size();
        driver.findElement(By.id("search-input")).sendKeys("LH-500"); // SKU specifico
        wait.until(d -> d.findElements(By.cssSelector(".card")).size() < total);
        // Deve trovare almeno una card
        assertThat(driver.findElements(By.cssSelector(".card"))).isNotEmpty();
    }

    // ── Compare ───────────────────────────────────────────────────────────────

    @Test
    void guestCompare_selectTwoCans_openComparePanel() {
        openAsGuest();
        List<WebElement> cards = driver.findElements(By.cssSelector(".card"));
        assertThat(cards.size()).isGreaterThanOrEqualTo(2);
        // Seleziona le prime due card per il compare tramite JS
        js("toggleCompare('" + buildTestCans().get(0).getId() + "')");
        js("toggleCompare('" + buildTestCans().get(1).getId() + "')");
        // Apri il compare panel
        waitForElement(By.id("compare-bar"));
        js("openComparePanel()");
        waitForElement(By.cssSelector("#compare-panel.open"));
        assertThat(driver.findElement(By.id("compare-panel")).getAttribute("class"))
                .contains("open");
    }

    @Test
    void guestCompare_noEstimatedValueRow() {
        openAsGuest();
        js("toggleCompare('" + buildTestCans().get(0).getId() + "')");
        js("toggleCompare('" + buildTestCans().get(1).getId() + "')");
        js("openComparePanel()");
        waitForElement(By.cssSelector("#compare-panel.open"));
        // "Est. Value" non deve comparire nelle righe del compare (campo nascosto in guest)
        String bodyText = driver.findElement(By.id("compare-panel-body")).getText();
        assertThat(bodyText).doesNotContain("Est. Value");
    }

    // ── Filtri URL ────────────────────────────────────────────────────────────

    @Test
    void guestUrlWithFilter_appliesFilterOnLoad() {
        // URL con fq=Ultra → la ricerca viene preapplicata
        driver.get(baseUrl + "?public=1&name=Test&fq=Ultra");
        waitForGrid();
        dismissConfotoFilter();
        // Attende che il filtro si applichi
        wait.until(d -> !d.findElement(By.id("search-input")).getAttribute("value").isEmpty());
        String searchVal = driver.findElement(By.id("search-input")).getAttribute("value");
        assertThat(searchVal).isEqualTo("Ultra");
    }
}
