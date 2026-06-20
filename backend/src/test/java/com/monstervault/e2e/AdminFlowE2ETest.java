package com.monstervault.e2e;

import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test E2E per il flusso admin: login, grid, detail, edit, soft-delete con undo.
 *
 * Tutti i test iniettano JWT via localStorage (bypassa il form login) tranne
 * {@code loginPage_*} che testano il form direttamente.
 */
class AdminFlowE2ETest extends E2EBaseTest {

    // ── Login page ────────────────────────────────────────────────────────────

    @Test
    void loginPage_authOverlayVisible() {
        driver.get(baseUrl);
        waitForPageReady();
        // Il login non è più mostrato al boot (così su iOS Face ID non scatta al
        // caricamento dietro la landing): si apre via "Admin access" / openAuthOverlay().
        js("openAuthOverlay()");
        WebElement overlay = driver.findElement(By.id("auth-overlay"));
        assertThat(overlay.isDisplayed()).isTrue();
    }

    @Test
    void loginPage_formHasAutocompleteOn() {
        driver.get(baseUrl);
        waitForPageReady();
        WebElement form = driver.findElement(By.id("auth-form"));
        assertThat(form.getAttribute("autocomplete")).isEqualTo("on");
    }

    @Test
    void loginPage_submitButtonIsTypeSubmit() {
        driver.get(baseUrl);
        waitForPageReady();
        WebElement btn = driver.findElement(By.id("auth-submit-btn"));
        assertThat(btn.getAttribute("type")).isEqualTo("submit");
    }

    @Test
    void loginFlow_correctCredentials_showsAdminUI() {
        driver.get(baseUrl);
        waitForPageReady();
        // Il login non è più mostrato al boot (evita Face ID al caricamento su iOS):
        // si apre via "Admin access" → qui nascondiamo la landing e apriamo l'overlay.
        js("document.getElementById('landing-overlay').style.display='none'; openAuthOverlay();");
        waitForElement(By.id("auth-username")); // aspetta che il campo sia visibile e interagibile
        driver.findElement(By.id("auth-username")).sendKeys("testadmin");
        driver.findElement(By.id("auth-password")).sendKeys("testpass");
        driver.findElement(By.id("auth-submit-btn")).click();
        // Attende che il bottone "Add" compaia (segnale di login avvenuto)
        waitForElement(By.id("btn-add"));
        assertThat(driver.findElement(By.id("btn-add")).isDisplayed()).isTrue();
    }

    // ── Grid view (admin) ─────────────────────────────────────────────────────

    @Test
    void adminGrid_showsAllTestCans() {
        openAsAdmin();
        List<WebElement> cards = driver.findElements(By.cssSelector(".card"));
        assertThat(cards).hasSize(buildTestCans().size());
    }

    @Test
    void adminGrid_cardHasSkuBadge() {
        openAsAdmin();
        String firstCardText = driver.findElement(By.cssSelector(".card")).getText();
        // Gli SKU dei test can sono MO-500, MU-500, ML-500, MP-500, LH-500
        assertThat(firstCardText).containsAnyOf("MO-500", "MU-500", "ML-500", "MP-500", "LH-500");
    }

    @Test
    void adminGrid_btnAddVisible() {
        openAsAdmin();
        assertThat(driver.findElement(By.id("btn-add")).isDisplayed()).isTrue();
    }

    @Test
    void adminGrid_btnScanPhotosVisible() {
        openAsAdmin();
        assertThat(driver.findElement(By.id("btn-clean")).isDisplayed()).isTrue();
    }

    // ── View switch ───────────────────────────────────────────────────────────

    @Test
    void viewSwitch_listButton_showsTable() {
        openAsAdmin();
        driver.findElement(By.id("vbtn-list")).click();
        waitForElement(By.id("list-view-wrap"));
        // La tabella lista deve avere righe
        List<WebElement> rows = driver.findElements(By.cssSelector("#list-tbody tr"));
        assertThat(rows).isNotEmpty();
    }

    @Test
    void viewSwitch_backToGrid_showsCards() {
        openAsAdmin();
        driver.findElement(By.id("vbtn-list")).click();
        driver.findElement(By.id("vbtn-grid")).click();
        waitForElement(By.cssSelector(".card"));
        assertThat(driver.findElements(By.cssSelector(".card"))).isNotEmpty();
    }

    // ── Detail panel ──────────────────────────────────────────────────────────

    @Test
    void detailPanel_opensOnCardClick() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        assertThat(driver.findElement(By.cssSelector(".detail-panel")).getAttribute("class"))
                .contains("open");
    }

    @Test
    void detailPanel_hasPrevNextButtons() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        List<WebElement> navBtns = driver.findElements(By.cssSelector(".detail-nav-btn"));
        assertThat(navBtns).hasSize(2);
    }

    @Test
    void detailPanel_closeButton_closesPanel() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-back")).click(); // il pulsante close usa id="detail-back"
        waitForElementGone(By.cssSelector(".detail-panel.open"));
        assertThat(driver.findElement(By.cssSelector(".detail-panel")).getAttribute("class"))
                .doesNotContain("open");
    }

    // ── Edit modal ────────────────────────────────────────────────────────────

    @Test
    void editModal_opensFromDetailEditButton() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-edit-btn")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        assertThat(driver.findElement(By.id("edit-modal")).getAttribute("class"))
                .contains("open");
    }

    @Test
    void editModal_openingInputsAreRadio() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-edit-btn")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        List<WebElement> radios = driver.findElements(
                By.cssSelector("#e-note-grid input[type='radio']"));
        assertThat(radios).hasSize(7);
        radios.forEach(r ->
                assertThat(r.getAttribute("name")).isEqualTo("e-opening"));
    }

    @Test
    void editModal_openingRadiosMutuallyExclusive() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-edit-btn")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        List<WebElement> radios = driver.findElements(
                By.cssSelector("#e-note-grid input[type='radio']"));
        // Clicca due diversi radio (JS click: i radio possono essere fuori dal viewport nel modal scrollabile)
        js("arguments[0].click()", radios.get(0));
        js("arguments[0].click()", radios.get(1));
        long checked = radios.stream().filter(WebElement::isSelected).count();
        assertThat(checked).isEqualTo(1); // solo uno selezionato
    }

    @Test
    void editModal_minorDentsOptionValueCorrect() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-edit-btn")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        // Verifica che l'option value sia "Minor Dents" (case correct per STATO_NORMALIZE)
        WebElement minorDentsOpt = driver.findElement(
                By.cssSelector("#e-stato option[value='Minor Dents']"));
        assertThat(minorDentsOpt).isNotNull();
        assertThat(minorDentsOpt.getAttribute("value")).isEqualTo("Minor Dents");
    }

    // ── Soft delete + undo ────────────────────────────────────────────────────

    @Test
    void softDelete_showsUndoToast() {
        openAsAdmin();
        // Apri il modal di edit della prima card
        driver.findElement(By.cssSelector(".card-overlay-btn.edit")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        // Clicca Delete
        driver.findElement(By.id("del-btn")).click();
        // Toast undo deve apparire (attende esplicitamente sia il container che il bottone)
        waitForElement(By.cssSelector(".toast-undo"));
        waitForElement(By.cssSelector(".toast-undo-btn")); // il bottone è nel DOM ma potrebbe non essere ancora rendered
        assertThat(driver.findElement(By.cssSelector(".toast-undo")).isDisplayed()).isTrue();
        assertThat(driver.findElement(By.cssSelector(".toast-undo-btn")).isDisplayed()).isTrue();
    }

    @Test
    void softDelete_undoButton_undoesToast() {
        openAsAdmin();
        int cardsBefore = driver.findElements(By.cssSelector(".card")).size();
        // Apri edit, clicca Delete
        driver.findElement(By.cssSelector(".card-overlay-btn.edit")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        driver.findElement(By.id("del-btn")).click();
        // Aspetta toast e bottone (timing: il bottone è nel DOM ma potrebbe non essere ancora interagibile)
        waitForElement(By.cssSelector(".toast-undo"));
        waitForElement(By.cssSelector(".toast-undo-btn"));
        // Clicca Undo
        driver.findElement(By.cssSelector(".toast-undo-btn")).click();
        // Toast sparisce
        waitForElementGone(By.cssSelector(".toast-undo"));
        // La card torna (la cache locale viene ripristinata)
        int cardsAfter = driver.findElements(By.cssSelector(".card")).size();
        assertThat(cardsAfter).isEqualTo(cardsBefore);
    }

    @Test
    void softDelete_undoToast_hasProgressBar() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".card-overlay-btn.edit")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        driver.findElement(By.id("del-btn")).click();
        waitForElement(By.cssSelector(".toast-undo"));
        assertThat(driver.findElement(By.cssSelector(".toast-progress-bar"))).isNotNull();
    }

    // ── Search/filter ─────────────────────────────────────────────────────────

    @Test
    void search_filtersCardsByName() {
        openAsAdmin();
        int allCards = driver.findElements(By.cssSelector(".card")).size();
        WebElement searchInput = driver.findElement(By.id("search-input"));
        searchInput.sendKeys("Ultra");
        wait.until(d -> d.findElements(By.cssSelector(".card")).size() < allCards);
        int filteredCards = driver.findElements(By.cssSelector(".card")).size();
        assertThat(filteredCards).isLessThan(allCards);
    }

    @Test
    void search_clearFilter_restoresAllCards() {
        openAsAdmin();
        int allCards = driver.findElements(By.cssSelector(".card")).size();
        WebElement si = driver.findElement(By.id("search-input"));
        si.sendKeys("Ultra");
        wait.until(d -> d.findElements(By.cssSelector(".card")).size() < allCards);
        // Svuota tramite JS + dispatcha evento input (si.clear() non scatena l'evento input)
        js("var el=arguments[0]; el.value=''; el.dispatchEvent(new Event('input',{bubbles:true}))", si);
        // Aspetta che le card tornino
        wait.until(d -> d.findElements(By.cssSelector(".card")).size() == allCards);
        assertThat(driver.findElements(By.cssSelector(".card"))).hasSize(allCards);
    }

    // ── Stats modal ───────────────────────────────────────────────────────────

    @Test
    void statsModal_opens() {
        openAsAdmin();
        driver.findElement(By.cssSelector(".stats-btn")).click();
        waitForElement(By.cssSelector("#stats-modal.open"));
        assertThat(driver.findElement(By.id("stats-modal")).getAttribute("class"))
                .contains("open");
    }

    // ── JWT refresh ───────────────────────────────────────────────────────────

    @Test
    void jwtRefresh_functionExistsInPage() {
        openAsAdmin();
        Object result = js("return typeof checkAndRefreshToken === 'function'");
        assertThat(result).isEqualTo(true);
    }

    @Test
    void jwtRefresh_noThrowOnValidToken() {
        openAsAdmin();
        Object result = js("try { checkAndRefreshToken(); return 'ok'; } catch(e) { return e.message; }");
        assertThat(result.toString()).isEqualTo("ok");
    }
}
