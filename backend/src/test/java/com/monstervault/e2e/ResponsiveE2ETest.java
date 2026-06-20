package com.monstervault.e2e;

import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test E2E responsività — verifica il layout su diversi viewport.
 *
 * Dispositivi testati:
 *   - Mobile  375×812  (iPhone 14 / iOS Safari)
 *   - Tablet  768×1024 (iPad)
 *   - Desktop 1280×800 (default)
 *
 * Si concentra su: grid columns, visibilità dei controlli, dimensioni dei panel.
 */
class ResponsiveE2ETest extends E2EBaseTest {

    // ── Mobile 375×812 ────────────────────────────────────────────────────────

    @Test
    void mobile_gridIs2Columns() {
        resizeTo(375, 812);
        openAsAdmin();
        String cols = jsStr("return getComputedStyle(document.getElementById('grid')).gridTemplateColumns");
        // 2 colonne → "XXXpx XXXpx"
        long colCount = java.util.Arrays.stream(cols.split(" ")).filter(s -> s.endsWith("px")).count();
        assertThat(colCount).isEqualTo(2);
    }

    @Test
    void mobile_cardWidthFitsScreen() {
        resizeTo(375, 812);
        openAsAdmin();
        WebElement card = driver.findElement(By.cssSelector(".card"));
        double cardW = card.getSize().getWidth();
        // 375px viewport → ~175px; Chrome/Windows clampra a ~480px → ~223px.
        // In entrambi i casi la card è in layout mobile (2 colonne, < 260px).
        assertThat(cardW).isBetween(130.0, 260.0);
    }

    @Test
    void mobile_btnLabelsHidden() {
        resizeTo(375, 812);
        openAsAdmin();
        WebElement label = driver.findElement(By.cssSelector("#btn-add .btn-label"));
        String display = jsStr("return getComputedStyle(arguments[0]).display", label);
        assertThat(display).isEqualTo("none");
    }

    @Test
    void mobile_exportImportButtonsHidden() {
        resizeTo(375, 812);
        openAsAdmin();
        String expDisplay = jsStr("return getComputedStyle(document.getElementById('btn-export')).display");
        String impDisplay = jsStr("return getComputedStyle(document.getElementById('btn-import')).display");
        assertThat(expDisplay).isEqualTo("none");
        assertThat(impDisplay).isEqualTo("none");
    }

    @Test
    void mobile_detailPanelIsFullWidth() {
        resizeTo(375, 812);
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        double panelW = driver.findElement(By.id("detail-panel")).getSize().getWidth();
        assertThat(panelW).isGreaterThanOrEqualTo(370); // full width ≈ 375px
    }

    @Test
    void mobile_editModalIsFullWidth() {
        resizeTo(375, 812);
        openAsAdmin();
        driver.findElement(By.cssSelector(".card")).click();
        waitForElement(By.cssSelector(".detail-panel.open"));
        driver.findElement(By.id("detail-edit-btn")).click();
        waitForElement(By.cssSelector("#edit-modal.open"));
        double modalW = driver.findElement(By.id("edit-modal")).getSize().getWidth();
        assertThat(modalW).isGreaterThanOrEqualTo(370);
    }

    @Test
    void mobile_authOverlayScrollable() {
        resizeTo(375, 812);
        driver.get(baseUrl);
        waitForPageReady();
        js("localStorage.clear()"); // assicura che non ci sia JWT residuo che nasconderebbe l'overlay
        driver.navigate().refresh();
        waitForPageReady();
        // Chrome/Windows clampra il viewport a ~480px; la media query è max-width:480px.
        // Se la query non è attiva (viewport clamped appena sopra la soglia), il test viene saltato.
        assumeTrue((Boolean) js("return window.matchMedia('(max-width:480px)').matches"),
                   "Viewport clamped >480px da Chrome/Windows — media query non attiva, test saltato");
        String overflow = jsStr("return getComputedStyle(document.getElementById('auth-overlay')).overflowY");
        assertThat(overflow).isEqualTo("auto");
    }

    @Test
    void mobile_authOverlayAlignTop() {
        // Il form deve partire in cima per non essere coperto dalla tastiera
        resizeTo(375, 812);
        driver.get(baseUrl);
        waitForPageReady();
        js("localStorage.clear()"); // assicura che non ci sia JWT residuo che nasconderebbe l'overlay
        driver.navigate().refresh();
        waitForPageReady();
        // Chrome/Windows clampra il viewport a ~480px; la media query è max-width:480px.
        // Se la query non è attiva (viewport clamped appena sopra la soglia), il test viene saltato.
        assumeTrue((Boolean) js("return window.matchMedia('(max-width:480px)').matches"),
                   "Viewport clamped >480px da Chrome/Windows — media query non attiva, test saltato");
        String align = jsStr("return getComputedStyle(document.getElementById('auth-overlay')).alignItems");
        assertThat(align).isEqualTo("flex-start");
    }

    @Test
    void mobile_loginFormHasFaceIdSupport() {
        resizeTo(375, 812);
        driver.get(baseUrl);
        waitForPageReady();
        assertThat(driver.findElement(By.id("auth-form")).getAttribute("autocomplete")).isEqualTo("on");
        assertThat(driver.findElement(By.id("auth-submit-btn")).getAttribute("type")).isEqualTo("submit");
    }

    // ── Tablet 768×1024 ───────────────────────────────────────────────────────

    @Test
    void tablet_gridHasMoreThan2Columns() {
        resizeTo(768, 1024);
        openAsAdmin();
        String cols = jsStr("return getComputedStyle(document.getElementById('grid')).gridTemplateColumns");
        long colCount = java.util.Arrays.stream(cols.split(" ")).filter(s -> s.endsWith("px")).count();
        assertThat(colCount).isGreaterThan(2); // 3+ colonne
    }

    @Test
    void tablet_exportButtonVisible() {
        resizeTo(768, 1024);
        openAsAdmin();
        String display = jsStr("return getComputedStyle(document.getElementById('btn-export')).display");
        assertThat(display).isNotEqualTo("none");
    }

    @Test
    void tablet_btnLabelsVisible() {
        resizeTo(768, 1024);
        openAsAdmin();
        String display = jsStr("return getComputedStyle(document.querySelector('#btn-add .btn-label')).display");
        assertThat(display).isNotEqualTo("none");
    }

    // ── Desktop 1280×800 ──────────────────────────────────────────────────────

    @Test
    void desktop_gridHasMultipleColumns() {
        resizeTo(1280, 800);
        openAsAdmin();
        String cols = jsStr("return getComputedStyle(document.getElementById('grid')).gridTemplateColumns");
        long colCount = java.util.Arrays.stream(cols.split(" ")).filter(s -> s.endsWith("px")).count();
        assertThat(colCount).isGreaterThanOrEqualTo(3);
    }

    @Test
    void desktop_allAdminButtonsVisible() {
        resizeTo(1280, 800);
        openAsAdmin();
        assertThat(driver.findElement(By.id("btn-add")).isDisplayed()).isTrue();
        assertThat(driver.findElement(By.id("btn-export")).isDisplayed()).isTrue();
        assertThat(driver.findElement(By.id("btn-import")).isDisplayed()).isTrue();
        assertThat(driver.findElement(By.id("btn-clean")).isDisplayed()).isTrue();
    }

    @Test
    void desktop_contentVisibilityAutoApplied() {
        resizeTo(1280, 800);
        openAsAdmin();
        String cv = jsStr("var c = document.querySelector('.card'); " +
                          "return c ? getComputedStyle(c).contentVisibility : 'no card'");
        assertThat(cv).isEqualTo("auto");
    }

    // ── LQIP ─────────────────────────────────────────────────────────────────

    @Test
    void lqip_functionReturnsBlurredThumbnailUrl() {
        resizeTo(1280, 800);
        openAsAdmin();
        String lqip = jsStr(
            "return cloudinaryLqip('https://res.cloudinary.com/x/image/upload/v1/monster-vault/t.jpg')");
        assertThat(lqip).contains("w_20");
        assertThat(lqip).contains("e_blur:200");
        assertThat(lqip).contains("f_auto");
    }

    @Test
    void lqip_nonCloudinaryUrl_returnsEmpty() {
        resizeTo(1280, 800);
        openAsAdmin();
        String lqip = jsStr("return cloudinaryLqip('https://example.com/photo.jpg')");
        assertThat(lqip).isEmpty();
    }

    @Test
    void lqip_cardWithPhoto_hasLqipDiv() {
        resizeTo(1280, 800);
        // Inietta una foto su un can di test
        openAsAdmin();
        js("cans[0].p1='https://res.cloudinary.com/demo/image/upload/v1/monster-vault/test.jpg'; applyFilters()");
        waitForElementPresent(By.cssSelector(".card-img-lqip")); // presence: il div esiste ma può avere height:0
        assertThat(driver.findElement(By.cssSelector(".card-img-lqip"))).isNotNull();
        String bg = jsStr("return document.querySelector('.card-img-lqip').style.backgroundImage");
        assertThat(bg).contains("cloudinary.com");
    }

    @Test
    void lqip_cardWithPhoto_imgHasOnerror() {
        resizeTo(1280, 800);
        openAsAdmin();
        js("cans[0].p1='https://res.cloudinary.com/demo/image/upload/v1/monster-vault/test.jpg'; applyFilters()");
        waitForElementPresent(By.cssSelector(".card-img-lqip img")); // presence: può avere height:0
        WebElement img = driver.findElement(By.cssSelector(".card-img-lqip img"));
        assertThat(img.getAttribute("onerror")).contains("imgErrCard");
    }
}
