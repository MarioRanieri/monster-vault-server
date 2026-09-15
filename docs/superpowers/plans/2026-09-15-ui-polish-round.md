# UI Polish Round (A/C/E/F/G) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five independent visual/UX fixes to the React frontend: filters collapse behind a panel on desktop too, the can detail page loses its identical grey boxes and unused whitespace, photo-less grid cards get a real placeholder instead of a dash, section headers get texture + a decisive title font, and the header stops repeating the same number twice.

**Architecture:** Pure frontend changes inside `frontend/src`. No backend, no API, no new dependencies — CSS restructuring plus small, focused component edits. Each task touches its own component(s) but **all five touch `frontend/src/styles/main.css`**, so tasks must be done sequentially in one session, never as isolated parallel branches (a shared-file conflict risk flagged during scope review).

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, existing CSS (no CSS-in-JS, no new libs). Fonts already self-hosted (`Bebas Neue`, `DM Sans`, `Space Mono` — see `main.css:4-30`).

**Spec:** User-provided spec, sections A/C/E/F/G (given in chat 2026-09-15), reviewed against the actual codebase before planning — see task notes for what each section's premise turned out to be once checked against real code.

## Global Constraints

- TDD: write the test first for any task that adds new behavior/logic. Pure-CSS tasks (A's collapse, F's texture/font/motion) have no new logic to unit-test — verified via lint/typecheck/build + visual check instead, not a fake test.
- New-code coverage target for this round: **≥90%** (user-specified for this batch, stricter than the repo's usual >85% floor — applies only to the lines this plan adds/changes).
- Verify per task: `npm run lint`, `npx tsc -b`, `npm test`, `npm run build`, visual check at 1280px and 390px.
- **No commit, no push** for this round (explicit user instruction) — every task ends with a verification step, never a `git commit` step. Work stays uncommitted in the working tree for the user to review.
- English UI copy, Italian code comments matching existing file style (see `commit-style`/`language-preference` conventions already in this codebase's comments).
- `prefers-reduced-motion: reduce` must be respected for anything animated (existing block at `main.css:3422`) — default to **no animation** on new visual elements rather than adding motion and then suppressing it.

---

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `frontend/src/Hero.tsx` | G | Header: single compact stats line instead of big-number + duplicate row |
| `frontend/src/Hero.test.tsx` | G | Assert no duplicate "Total" stat, single-line structure |
| `frontend/src/FilterBar.tsx` | A | No JS change — `showFilters` state already exists and already drives `.open` |
| `frontend/src/FilterBar.test.tsx` | A | New: covers the collapse toggle (currently untested at any breakpoint) |
| `frontend/src/CanGrid.tsx` | E | Photo-less card: inline SVG can silhouette + flag + name instead of `—` |
| `frontend/src/CanGrid.test.tsx` | E | Assert placeholder renders name + flag when `p1` is missing |
| `frontend/src/CanDetail.tsx` | C | Vertical thumb column + arrow nav + counter; grey boxes → clean field list; new "Other cans from this country" section |
| `frontend/src/CanDetail.test.tsx` | C | Arrow nav, counter, related-cans section |
| `frontend/src/App.tsx` | C | Pass `allCans` + `onSelect` through to `CanDetail` for the related-cans section |
| `frontend/src/styles/main.css` | A/C/E/F/G | All five tasks touch this file — see per-task diffs below |

---

### Task 1 (Section G): Header — one compact stats line

**Files:**
- Modify: `frontend/src/Hero.tsx`
- Modify: `frontend/src/Hero.test.tsx`
- Modify: `frontend/src/styles/main.css:1-63` region (hero/stats-row rules — exact selectors below)

**Interfaces:**
- Consumes: `Stats` from `./computeStats` (unchanged: `{ total, withPhoto, promo, countries, full }`)
- Produces: no prop/signature change to `Hero` — same `{ stats, isAdmin, onStats, onValue }` props, so `App.tsx` needs no edit for this task.

**Current bug (confirmed in code):** `hero-count` renders `{stats.total} cans` as a big number, then `.stats-row` repeats it as a `stat-item` labelled "Total" — the exact same number twice, plus Countries/With Photo/Full/Stats/Value crammed into a second row. `Hero.test.tsx` currently documents this as intentional (`// hero-count + Total`).

- [ ] **Step 1: Write the failing test**

Replace the first test in `frontend/src/Hero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Hero } from './Hero';

test('mostra il conteggio grande una sola volta, senza ripetere "Total"', () => {
  render(<Hero stats={{ total: 1866, withPhoto: 355, promo: 315, countries: 99, full: 281 }} />);
  expect(screen.getByText(/cans/i)).toBeTruthy();
  expect(screen.getAllByText('1866').length).toBe(1); // un solo posto, non più hero-count + Total
  expect(screen.queryByText('Total')).toBeNull(); // stat-item "Total" rimosso: ridondante col numero grande
  expect(screen.getByText('99')).toBeTruthy(); // Countries
  expect(screen.getByText('355')).toBeTruthy(); // With Photo
  expect(screen.getByText('281')).toBeTruthy(); // Full
});

test('colora il numero With Photo come il chip (viola)', () => {
  render(<Hero stats={{ total: 1866, withPhoto: 355, promo: 315, countries: 99, full: 281 }} />);
  const val = screen.getByText('355'); // With Photo
  expect(val.style.color.replace(/\s/g, '')).toMatch(/168,85,247|a855f7/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run Hero.test.tsx`
Expected: FAIL on `getAllByText('1866').length` (currently 2) and `queryByText('Total')` (currently found).

- [ ] **Step 3: Rewrite `Hero.tsx`**

```tsx
import type { Stats } from './computeStats';

// Hero della collection: titolo + UNA riga compatta (numero grande + resto delle
// stat in linea). Prima il conteggio grande (hero-count) ripeteva se stesso come
// stat-item "Total" nella riga sotto — stesso numero due volte, due righe invece
// di una. Ora "Total" è solo il numero grande, la riga sotto porta il resto.
export function Hero({
  stats,
  isAdmin,
  onStats,
  onValue,
}: Readonly<{
  stats: Stats;
  isAdmin?: boolean;
  onStats?: () => void;
  onValue?: () => void;
}>) {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-label">{isAdmin ? 'Your Collection' : "RedMghost's Collection"}</div>
      <div className="hero-stats-line">
        <div className="hero-count">
          <span>{stats.total}</span> cans
        </div>
        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">{stats.countries}</span>
            <span className="stat-lbl">Countries</span>
          </div>
          <div className="stat-item">
            <span className="stat-val" style={{ color: '#a855f7' }}>
              {stats.withPhoto}
            </span>
            <span className="stat-lbl">With Photo</span>
          </div>
          <div className="stat-item">
            <span className="stat-val" style={{ color: 'var(--full)' }}>
              {stats.full}
            </span>
            <span className="stat-lbl">Full</span>
          </div>
          {onStats && (
            <div className="stat-item">
              <button type="button" className="stats-btn" onClick={onStats}>
                📊 Stats
              </button>
            </div>
          )}
          {onValue && (
            <div className="stat-item">
              <button type="button" className="stats-btn" onClick={onValue}>
                💰 Value
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
```

Note: `.hero-sub` ("Monster Energy archive") is dropped — it was the line separating the big number from the repeated stats-row; with both merged into one line there's nothing left to separate. If the user wants the tagline kept, it can go into `.hero-label` instead — flag this when reporting back rather than silently deciding.

- [ ] **Step 4: Update `main.css`**

Find `.hero-count` and `.stats-row` (search `hero-count\|stats-row` in `main.css`) and replace the block that lays them out as two stacked elements with one flex line:

```css
.hero-stats-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 14px 24px;
}
```

Keep the existing `.hero-count`, `.stat-item`, `.stat-val`, `.stat-lbl`, `.stats-btn` rules as-is (only their container changes) — do not touch `.hero-bg`/`.hero-label`. Remove any rule that only existed to space `.hero-sub` from `.stats-row` if `.hero-sub` is dropped per Step 3.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run Hero.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify (no commit)**

Run in order, all must pass before moving to Task 2:
```
cd frontend
npm run lint
npx tsc -b
npm test
npm run build
```
Then visual check: `npm run dev`, open at 1280px and 390px width, confirm one compact row, no duplicate number, mobile row wraps without overflowing.

---

### Task 2 (Section A): Filters collapse behind a panel on desktop too

**Files:**
- Modify: `frontend/src/styles/main.css` (two regions: base rules ~`main.css:1399-1407`, mobile-only override ~`main.css:3565-3608`)
- Modify: `frontend/src/FilterBar.test.tsx` (new coverage — the toggle has no test today at any breakpoint)

**Interfaces:**
- Consumes: `FilterBar`'s existing internal `showFilters` state (`FilterBar.tsx:66`) — already drives `aria-expanded` on the toggle button and the `.open` class on `.filter-advanced`. **No JS/TSX change needed in `FilterBar.tsx` at all.**
- Produces: nothing new for other files — this is a pure CSS re-scope.

**What's actually there (confirmed in code):** the collapse mechanism already exists and already works — it's CSS-gated to `@media (max-width: 640px)`. Outside that width, base rules force `.filter-toggle { display: none }` and `.filter-advanced { display: contents }`, so the "Filters" button never shows and nothing ever collapses on desktop. The fix is moving the collapsed-by-default rules from the mobile media query into the unconditional base rules, and deleting the now-redundant mobile copies.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/FilterBar.test.tsx` (check existing imports at the top of that file and reuse them — it already renders `<FilterBar>` with minimal props elsewhere in the suite):

```tsx
test('il pulsante Filters apre/chiude il pannello filtri avanzati', async () => {
  const user = userEvent.setup();
  render(
    <FilterBar
      query=""
      onQuery={() => {}}
      chips={[]}
    />,
  );
  const toggle = screen.getByRole('button', { name: /filters/i });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
```

(If `userEvent` isn't already imported in this file, add `import userEvent from '@testing-library/user-event';` alongside the existing `render`/`screen` import — check the top of `FilterBar.test.tsx` first, several sibling test files already use this pattern, e.g. `CanDetail.test.tsx`.)

- [ ] **Step 2: Run test to verify it fails or passes for the wrong reason**

Run: `cd frontend && npx vitest run FilterBar.test.tsx`
This test actually already passes today (the `aria-expanded` toggle is JS-only, unaffected by CSS) — that's expected and fine: it's new *coverage* for existing logic we're about to rely on for real, not a red/green pair. Confirm it passes, then proceed — the actual behavior change in this task is CSS-only and gets verified visually in Step 4, not through this unit test.

- [ ] **Step 3: Move the collapse CSS from mobile-only to universal**

In `main.css`, replace the base rules (currently ~line 1399-1407):

```css
/* Before */
.filter-toggle {
  display: none;
}
.filter-advanced {
  display: contents;
}
```

with:

```css
/* Toggle "Filters": i filtri avanzati sono sempre dietro un pannello — stesso
   pattern desktop e mobile (prima era mobile-only: su desktop restava tutto
   aperto su 3 righe prima ancora di vedere una lattina). */
.filter-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  background: var(--bg3);
  border: 1px solid var(--border2);
  color: var(--text2);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.filter-toggle[aria-expanded='true'] {
  border-color: var(--green);
  color: var(--green);
}
.filter-advanced {
  display: none;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.filter-advanced.open {
  display: flex;
}
.filter-advanced .filter-tools {
  margin-left: 0;
  flex: 1 1 100%;
  flex-wrap: wrap;
}
```

Then in the `@media (max-width: 640px)` block (~line 3565-3608), delete the now-duplicate `.filter-toggle`, `.filter-toggle[aria-expanded='true']`, `.filter-advanced`, `.filter-advanced.open`, `.filter-advanced .filter-tools` rules — keep only what's genuinely mobile-specific in that block (`.filter-bar { padding }`, `.search-wrap` sizing, `.filter-select`/`.filter-chip` smaller font/padding).

- [ ] **Step 4: Verify (no commit)**

```
cd frontend
npm run lint
npx tsc -b
npm test
npm run build
```
Visual check at 1280px: filters start collapsed, "Filters" button opens the same panel style now used on mobile, search box always visible. At 390px: unchanged from before (this was already mobile's behavior). Confirm the `view-sort-bar` (view toggle + sort) stays visible outside the collapse at both widths — it already lives outside `.filter-advanced` in the JSX, so this should hold without extra work; just confirm visually.

---

### Task 3 (Section E): Photo-less grid card placeholder

**Files:**
- Modify: `frontend/src/CanGrid.tsx`
- Modify: `frontend/src/CanGrid.test.tsx`
- Modify: `frontend/src/styles/main.css` (`.card-img-placeholder` region, ~`main.css:1899-1909` and ~`main.css:1949-1952`)

**Interfaces:**
- Consumes: `Can.p1` (existing, already checked), `Can.lingua` (existing, already passed to `<Flags>` elsewhere in the same file), `Can.nome` (existing)
- Produces: no prop/signature change to `CanGrid` — internal rendering only.

**What's actually there (confirmed in code):** `.card-img-placeholder` already has a styled `svg` child rule (`opacity: 0.25`) waiting to be used — nothing renders an `<svg>` there today, just `<span>—</span>`. The fix is adding the SVG can silhouette + reusing the existing `<Flags>` component (already imported in this file, used at `CanGrid.tsx:136`) + the name.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/CanGrid.test.tsx` (check the file's existing `Can` fixture builder/imports and reuse it):

```tsx
test('lattina senza foto mostra un segnaposto con bandiera e nome, non un trattino', () => {
  const noPhotoCan: Can = { id: 'x1', nome: 'Test Can', lingua: 'ITALY' };
  render(<CanGrid cans={[noPhotoCan]} />);
  expect(screen.getByLabelText('Test Can').textContent).not.toContain('—');
  expect(screen.getByRole('img', { name: /can placeholder/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run CanGrid.test.tsx`
Expected: FAIL — no element with role `img` named "can placeholder" exists yet, and the card still contains "—".

- [ ] **Step 3: Add the SVG silhouette in `CanGrid.tsx`**

Add a small local component above `CanGrid` (same file — one clear responsibility, reused per photo-less card, no new file needed for a single 12-line SVG):

```tsx
// Sagoma di lattina per le card senza foto: SVG inline riusato (niente immagini
// esterne, costo trascurabile anche su ~1500 render) invece del trattino "—"
// di prima — deve leggersi come una scelta grafica, non un placeholder rotto.
function CanSilhouette() {
  return (
    <svg
      width="48"
      height="64"
      viewBox="0 0 48 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      role="img"
      aria-label="can placeholder"
    >
      <rect x="10" y="6" width="28" height="6" rx="1" />
      <path d="M8 12h32l-3 46a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3L8 12Z" />
      <ellipse cx="24" cy="12" rx="16" ry="3" />
    </svg>
  );
}
```

Then replace the placeholder branch (`CanGrid.tsx:59-63`):

```tsx
/* Before */
<div className="card-img-placeholder">
  <span>—</span>
</div>
```

```tsx
/* After */
<div className="card-img-placeholder">
  <CanSilhouette />
  <span className="card-img-placeholder-flag">
    <Flags lingua={can.lingua} />
  </span>
  <span className="card-img-placeholder-name">{can.nome}</span>
</div>
```

- [ ] **Step 4: Update `main.css`**

Replace the `span` rule at ~line 1949 and extend the placeholder block:

```css
.card-img-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text3);
  background: var(--bg3);
  height: 100%;
  padding: 12px;
  text-align: center;
}
.card-img-placeholder svg {
  opacity: 0.25;
}
.card-img-placeholder-flag {
  font-size: 20px; /* ingrandisce il flag-img/flag-emoji ereditati da .flag-chip */
}
.card-img-placeholder-name {
  font-size: 11px;
  letter-spacing: 0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run CanGrid.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify (no commit)**

```
cd frontend
npm run lint
npx tsc -b
npm test
npm run build
```
Visual check at 1280px and 390px: scroll to a photo-less can (or temporarily filter `NO PHOTO` — the chip already exists in the filter bar), confirm the silhouette + flag + name read as a deliberate placeholder, not a broken image. Confirm nothing regresses on cards that DO have photos.

---

### Task 4 (Section F): Section header texture, decisive titles, reduced motion

**Files:**
- Modify: `frontend/src/styles/main.css` only — no component/TSX changes, no new test (pure visual, no new logic).

**Interfaces:** none — CSS-only.

**What's actually there (confirmed in code):** `Bebas Neue` is already self-hosted and already used for some titles (`main.css:214`, `:544`). A `prefers-reduced-motion: reduce` block already exists (`main.css:3422`, currently scoped to landing-page animations). No section-header texture exists yet. Section title sizing today is ad hoc per-rule, not tokenized.

- [ ] **Step 1: Find every section-header selector to touch**

Run: `cd frontend && grep -n "section-title\|section-header\|hero-label" src/styles/main.css`
Confirm the exact selector names in use (do not guess — read the actual output before writing the rules below) and apply the texture/title rules to each one found, not just `.hero-label`.

- [ ] **Step 2: Add texture + title tokens (no animation)**

Near the `:root` token block at the top of `main.css` (find it with `grep -n ":root" src/styles/main.css`), add two tokens:

```css
--section-title-size: 13px;
--section-title-tracking: 1.5px;
```

Add a reusable texture as a static (non-animated) background — a subtle diagonal hairline grid via `repeating-linear-gradient`, cheap (one CSS rule, no image request, no JS):

```css
/* Texture discreta per intestazioni di sezione: griglia sottile, opacity
   bassissima — leggibile solo se ci fai caso, dà "archivio" più che "tabella".
   Statica (nessuna animazione): niente da spegnere per prefers-reduced-motion. */
.section-header-textured {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.025) 0px,
    rgba(255, 255, 255, 0.025) 1px,
    transparent 1px,
    transparent 8px
  );
}
```

Apply `section-header-textured` as an added class on every selector found in Step 1 that represents a section header (do this by editing the relevant `.tsx` files' `className` — list them explicitly once Step 1's grep output is known; this plan cannot name them without guessing, so the executor must fill this from the actual grep output, not skip it).

For each section-title selector found, set:

```css
font-family: 'Bebas Neue', sans-serif;
font-size: var(--section-title-size);
letter-spacing: var(--section-title-tracking);
```

only where it isn't already set to `Bebas Neue` (some already are — don't duplicate/override those, just confirm they use the new tokens instead of a hardcoded size for consistency).

- [ ] **Step 3: Verify (no commit)**

```
cd frontend
npm run lint
npx tsc -b
npm test
npm run build
```
Visual check at 1280px and 390px: texture is visible but subtle (not noisy), titles read as decisive without being oversized on mobile. Toggle OS-level "reduce motion" and confirm nothing on the page still animates around the touched sections (should already hold — no animation was added).

---

### Task 5 (Section C): Can detail — vertical thumbs, clean field list, related cans

This is the largest task — three sub-changes to the same component. Each sub-step is independently testable; do them in order.

**Files:**
- Modify: `frontend/src/CanDetail.tsx`
- Modify: `frontend/src/CanDetail.test.tsx`
- Modify: `frontend/src/App.tsx` (pass `allCans` + `onSelect` into `CanDetail`)
- Modify: `frontend/src/styles/main.css` (`.detail-*` region)

**Interfaces:**
- Consumes: `filterCans`'s pattern isn't reused here — related cans is a simple same-`lingua` filter, written inline (no need for the full filter engine for an 8-item cap).
- Produces: `CanDetail` gains two new optional props: `allCans?: Can[]` and `onSelect?: (can: Can) => void`. Both optional so `CanDetail.test.tsx`'s existing bare `<CanDetail can={can} onClose={...} />` calls keep working unchanged (the related-cans section simply doesn't render without `allCans`).

#### 5a — Vertical thumbnail column + arrow navigation + counter

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/CanDetail.test.tsx`:

```tsx
test('naviga le foto con le frecce e mostra il contatore', async () => {
  const user = userEvent.setup();
  const multiPhotoCan: Can = {
    id: '1',
    nome: 'Alpha',
    p1: 'https://res.cloudinary.com/x/image/upload/a.jpg',
    p2: 'https://res.cloudinary.com/x/image/upload/b.jpg',
    p3: 'https://res.cloudinary.com/x/image/upload/c.jpg',
  };
  render(<CanDetail can={multiPhotoCan} onClose={() => {}} />);
  expect(screen.getByText('1 / 3')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /next photo/i }));
  expect(screen.getByText('2 / 3')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /previous photo/i }));
  expect(screen.getByText('1 / 3')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: FAIL — no "1 / 3" text, no "next photo"/"previous photo" buttons exist yet.

- [ ] **Step 3: Update `CanDetail.tsx`'s photo section**

Replace the `detail-photos` block (`CanDetail.tsx:76-117`):

```tsx
<div className="detail-photos">
  {main ? (
    <>
      <div className="detail-main-wrap">
        {photos.length > 1 && (
          <button
            type="button"
            className="detail-nav detail-nav-prev"
            aria-label="Previous photo"
            onClick={() => setMainIdx((i) => (i - 1 + photos.length) % photos.length)}
          >
            ‹
          </button>
        )}
        <img
          className="detail-main-img"
          src={cloudinaryThumb(main, 800, 800)}
          alt={can.nome}
          tabIndex={0}
          onClick={() => setLbIdx(mainIdx)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setLbIdx(mainIdx);
            }
          }}
        />
        {photos.length > 1 && (
          <button
            type="button"
            className="detail-nav detail-nav-next"
            aria-label="Next photo"
            onClick={() => setMainIdx((i) => (i + 1) % photos.length)}
          >
            ›
          </button>
        )}
      </div>
      <div className="detail-tap-zoom">tap to zoom</div>
      {photos.length > 1 && (
        <div className="detail-photo-counter">
          {mainIdx + 1} / {photos.length}
        </div>
      )}
      {photos.length > 1 && (
        <div className="detail-thumbs-col">
          {photos.map((url, i) => (
            <img
              key={url}
              className={'detail-thumb' + (i === mainIdx ? ' active' : '')}
              src={cloudinaryThumb(url, 80, 80)}
              alt={can.nome}
              tabIndex={0}
              onClick={() => setMainIdx(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMainIdx(i);
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  ) : (
    <div className="detail-main-img-ph" />
  )}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `main.css` for the layout switch**

Find `.detail-photos`, `.detail-thumbs-row`, `.detail-thumb` (search `detail-thumbs\|detail-photos\|detail-main-img` in `main.css`). Change the container to a row (photo + side column instead of stacked):

```css
.detail-photos {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.detail-main-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}
.detail-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  z-index: 5;
}
.detail-nav-prev {
  left: 8px;
}
.detail-nav-next {
  right: 8px;
}
.detail-photo-counter {
  font-size: 11px;
  color: var(--text3);
  text-align: center;
  margin-top: 4px;
}
.detail-thumbs-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 0 0 64px;
}
.detail-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0.6;
}
.detail-thumb.active {
  opacity: 1;
  outline: 2px solid var(--green);
}
```

Replace the OLD `.detail-thumbs-row` rule (horizontal row) rather than leaving both — it no longer applies to any element after this change, delete it, don't leave dead CSS.

Then, inside the existing `@media (max-width: 640px)` block, add the mobile override the spec asked for (thumbs back to horizontal under the photo, since a 64px side column eats too much width on a narrow screen):

```css
.detail-photos {
  flex-direction: column;
}
.detail-thumbs-col {
  flex-direction: row;
  flex: 0 0 auto;
  overflow-x: auto;
}
```

- [ ] **Step 6: Verify (no commit — checkpoint before continuing to 5b)**

```
cd frontend
npm run lint
npx tsc -b
npm test
```

#### 5b — Replace the 6 grey boxes with a clean field list

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/CanDetail.test.tsx`:

```tsx
test('i campi sono una lista pulita, non box grigi identici', () => {
  const fullCan: Can = {
    id: '1',
    nome: 'Alpha',
    sku: 'SKU-1',
    produttore: 'Monster',
    lingua: 'ITALY',
    size: '500ml',
    top: 'Silver',
    stato: 'OK',
  };
  render(<CanDetail can={fullCan} onClose={() => {}} />);
  const list = screen.getByRole('list', { name: /can details/i });
  expect(list.querySelectorAll('li').length).toBeGreaterThanOrEqual(6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: FAIL — no element with role `list` named "can details" exists (current markup is a `div.detail-fields` of `div.detail-field`, not a semantic list).

- [ ] **Step 3: Update the fields block in `CanDetail.tsx`**

Replace `<div className="detail-fields">...</div>` (`CanDetail.tsx:129-154`) with a semantic list, same data/logic, new tags/classes only:

```tsx
<ul className="detail-fields" aria-label="Can details">
  {shown.map((f) => {
    if (f.isTop) {
      const tab = colorizeTab(f.val);
      return (
        <li key={f.lbl} className="detail-field detail-field-top" style={tab.style}>
          <span className="detail-field-lbl">{f.lbl}</span>
          <span className="detail-field-val">
            {tab.parts.map((p, i) => (
              <span key={i}>
                {i > 0 && '/'}
                <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
              </span>
            ))}
          </span>
        </li>
      );
    }
    return (
      <li key={f.lbl} className="detail-field">
        <span className="detail-field-lbl">{f.lbl}</span>
        <span className="detail-field-val">{f.val}</span>
      </li>
    );
  })}
</ul>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `main.css` for `.detail-field`**

Find `.detail-fields`, `.detail-field` (search `detail-field` in `main.css`). Replace the grid-of-boxes rule with a bordered list (label small in Space Mono, value large, thin `var(--border)` separators, no box/background per spec):

```css
.detail-fields {
  display: flex;
  flex-direction: column;
  list-style: none;
  margin: 0;
  padding: 0;
}
.detail-field {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.detail-field:last-child {
  border-bottom: none;
}
.detail-field-lbl {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.5px;
  color: var(--text3);
  text-transform: uppercase;
  flex: 0 0 auto;
}
.detail-field-val {
  font-size: 15px;
  color: var(--text);
  text-align: right;
}
```

Delete the old grid-column/background/border-radius rules for `.detail-field` if they set a 2-column grid or box background — this new rule replaces them, don't leave both active on the same selector.

- [ ] **Step 6: Verify (no commit)**

```
cd frontend
npm run lint
npx tsc -b
npm test
```

#### 5c — "Other cans from this country" section

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/CanDetail.test.tsx`:

```tsx
test('mostra fino a 8 altre lattine dello stesso paese, non se stessa', () => {
  const target: Can = { id: '1', nome: 'Alpha', lingua: 'ITALY' };
  const allCans: Can[] = [
    target,
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `other-${i}`,
      nome: `Other ${i}`,
      lingua: 'ITALY',
    })),
    { id: 'diff', nome: 'Different country', lingua: 'GERMANY' },
  ];
  render(<CanDetail can={target} onClose={() => {}} allCans={allCans} onSelect={() => {}} />);
  const section = screen.getByRole('region', { name: /other cans from this country/i });
  expect(section.querySelectorAll('.card').length).toBe(8);
  expect(screen.queryByText('Different country')).toBeNull();
});

test('non mostra la sezione "other cans" senza allCans', () => {
  const target: Can = { id: '1', nome: 'Alpha', lingua: 'ITALY' };
  render(<CanDetail can={target} onClose={() => {}} />);
  expect(screen.queryByRole('region', { name: /other cans from this country/i })).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: FAIL — `CanDetail` doesn't accept `allCans`/`onSelect` yet, no such region exists.

- [ ] **Step 3: Add the props and the section to `CanDetail.tsx`**

Update the props type (top of the component):

```tsx
export function CanDetail({
  can,
  onClose,
  isAdmin,
  showPrice,
  onEdit,
  onDelete,
  inCompare,
  onToggleCompare,
  onToast,
  allCans,
  onSelect,
}: Readonly<{
  can: Can;
  onClose: () => void;
  isAdmin?: boolean;
  showPrice?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  inCompare?: boolean;
  onToggleCompare?: () => void;
  onToast?: (msg: string) => void;
  allCans?: Can[];
  onSelect?: (can: Can) => void;
}>) {
```

Add the derived list right after the existing `noteVals` computation:

```tsx
const relatedCans = allCans
  ? allCans.filter((c) => c.id !== can.id && c.lingua && c.lingua === can.lingua).slice(0, 8)
  : [];
```

Add the section right before the closing `</div>` of `detail-info` (after the `admin-actions` block, still inside `detail-info` so it scrolls with the rest of the panel — reuses `CanGrid`'s existing card markup via `CanGrid` itself rather than duplicating card JSX):

```tsx
{relatedCans.length > 0 && (
  <section className="detail-related" aria-label="Other cans from this country">
    <h3 className="detail-related-title">Other cans from this country</h3>
    <CanGrid cans={relatedCans} showPrice={showPrice} onSelect={onSelect} />
  </section>
)}
```

Add the import at the top of `CanDetail.tsx`:

```tsx
import { CanGrid } from './CanGrid';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run CanDetail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it up in `App.tsx`**

At the `<CanDetail ...>` call site (`App.tsx:600-610`), add the two new props (reusing the `cans` variable already in scope and the existing `selectCan` handler already used elsewhere in this file for grid clicks):

```tsx
<CanDetail
  can={selected}
  onClose={() => setSelectedId(null)}
  isAdmin={isAdmin}
  showPrice={isAdmin && showPrice}
  onEdit={() => setEditing(true)}
  onDelete={() => handleDelete(selected)}
  inCompare={compareIds.includes(selected.id)}
  onToggleCompare={() => toggleCompare(selected.id)}
  onToast={showToast}
  allCans={cans}
  onSelect={selectCan}
/>
```

- [ ] **Step 6: Update `main.css`**

Add (no existing rule to replace — this is new):

```css
.detail-related {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.detail-related-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: var(--section-title-size, 13px);
  letter-spacing: var(--section-title-tracking, 1.5px);
  color: var(--text2);
  margin: 0 0 12px;
}
.detail-related .grid {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
```

(`var(--section-title-size, 13px)` with a fallback so this task doesn't hard-depend on Task 4 having run first if the executor does these out of order — but the plan's own ordering runs Task 4 before Task 5, so the token will already exist.)

- [ ] **Step 7: Final verify for Task 5 (no commit)**

```
cd frontend
npm run lint
npx tsc -b
npm test
npm run build
```
Visual check at 1280px and 390px: side thumb column on desktop, thumbs-under-photo on mobile, arrows + counter work, field list has no grey boxes, "Other cans from this country" shows real cards (max 8) and clicking one navigates to that can's detail (via `onSelect`/`selectCan` already wired to `setSelectedId`).

---

## Self-Review

**1. Spec coverage:**
- A (filters behind panel, desktop) → Task 2. ✓
- C (photo layout, clean fields, related cans) → Task 5 (5a/5b/5c). ✓
- E (photo-less placeholder) → Task 3. ✓
- F (texture, titles, reduced motion) → Task 4. ✓
- G (header one line) → Task 1. ✓
- DoD (test-first, lint, typecheck, coverage ≥90%, build, visual @1280/390, no commit/push, final report) → Global Constraints + every task's Verify step + final report format below.

**2. Placeholder scan:** Task 4 Step 2 intentionally defers exact selector names to the executor's own `grep` output (can't be guessed without running it) — this is a controlled exception, not a lazy placeholder: the grep command, the reasoning, and the exact rule to apply once selectors are known are all given in full.

**3. Type consistency:** `CanDetail`'s new `allCans?: Can[]` / `onSelect?: (can: Can) => void` match `CanGrid`'s existing `cans: Can[]` / `onSelect?: (can: Can) => void` signature exactly (`CanGrid.tsx:17-20`) — Task 5c passes them straight through with no adapter needed.

---

## Final Report Format (per the user's Definizione di Fatto)

After all 5 tasks: list completed tasks, any skipped (with why), and the coverage numbers from `npm run test:coverage`. No `git commit`, no `git push` for this round.
