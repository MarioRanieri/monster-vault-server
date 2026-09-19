# Lovable review fixes — plan

Source: triage of an external (Lovable) review, agreed with the user on 2026-09-19.
No separate spec: this plan is the authority. Task 1 (drop `content-visibility`
on `.card`) is already done in commit `060870a`.

## Global Constraints

- Branch `fix/lovable-review`. Small, focused commits, one logical change each,
  messages in English (conventional commits, e.g. `fix(map): ...`).
- UI text is English. Code comments follow the file's existing style (Italian is fine).
- Guests must never see a readable value/price. Do not add any value or rarity
  information to the guest UI.
- TDD for logic: pure logic goes in `frontend/public/map-data.js` (plain ES5 globals
  + `export`, loaded as-is by `map.html`) and is tested in
  `frontend/src/ui/map-data.test.ts` (Vitest). Declare new functions in the `md`
  type cast at the top of that test file. New logic must be covered by tests.
- `map.html` is a standalone vanilla page (no React, no build step). Keep its ES5 style.
- Windows checkout with CRLF: before running Prettier on a `frontend/src` file,
  normalize it to LF (`sed -i 's/\r$//' <file>`), then `npx prettier --write <file>`.
  `frontend/public/*` is not Prettier-managed; leave its formatting as is.
- Verify with `cd frontend && npx vitest run` (all green) and `npx eslint src`.
- Do NOT touch `backend/src/main/resources/static/` (untracked build output).
- Do not push.

## Task 2: Map cleanup (zoom, demo data, dev-only text)

File: `frontend/public/map.html`.

1. Page zoom: in the viewport meta (line 5) remove `maximum-scale=1, user-scalable=no`,
   keeping `width=device-width, initial-scale=1.0`. Add `touch-action:pan-x pan-y` to
   `#map-box` CSS so the browser does not page-zoom on a two-finger gesture inside the
   map (the custom pinch handler keeps working there); the rest of the page is zoomable.
2. Demo data: delete the `MOCK` array and the `usingMock` flag entirely, plus every
   place that reads them (the `.catch` returning MOCK in the `Promise.all`, the
   "Demo data" notes in `lightMap()` and in the load `.then`). If `/api/cans` fails,
   the existing outer `.catch` must show the error ("Could not load the map…") — the
   page must never display invented cans. Keep the `warm` timer behaviour.
3. Legend overlay (`openInfo()`): remove the red "The can exists but I don't have it
   yet…" legend line, and the `<p>` paragraph addressed to the developer
   ("Review this list and tell me, country by country…"). Reword the remaining
   visitor-facing texts to be neutral: green line → "A can from this country is in
   the collection"; heading "Countries without a can of yours (N)" → "Countries not
   in the collection yet (N)". The grey line: "No can from this country yet".
   Keep the Caribbean note. Do not remove the `SHARED_CAN_ISO` logic in
   `lightMap`/`showTip` (it is data-driven and inert while the list is empty).

Testing: these are deletions/copy changes in an untested inline script — no unit test
needed. Verify by grepping that `MOCK`, `usingMock`, `user-scalable` and
"tell me" no longer occur in `map.html`, and run the vitest suite.

## Task 3: Map keyboard access, anchored zoom, search centering

Files: `frontend/public/map-data.js`, `frontend/src/ui/map-data.test.ts`,
`frontend/public/map.html`.

1. Pure helper in `map-data.js` (TDD, tests first):
   `zoomScroll(scroll, anchor, s0, s1)` → new scroll offset along one axis so the
   content point under `anchor` (px from the scroll container's visible left/top edge)
   stays under it after scale goes from `s0` to `s1`.
   Formula: `(scroll + anchor) * s1 / s0 - anchor`, clamped to `>= 0`.
   Tests: same scale returns same scroll; zooming in 1→2 with anchor 100, scroll 0
   gives 100; zooming out clamps at 0.
   Also `centerScroll(elStart, elSize, viewSize)` → `Math.max(0, elStart + elSize/2 - viewSize/2)`
   (offset that centers an element along one axis), with tests.
2. In `map.html`, introduce one function `setScale(s, ax, ay)` that applies the scale
   to `#svg-host` (as today: `dataset.scale` + `style.width`) and then sets
   `#map-box.scrollLeft/scrollTop` via `zoomScroll`, anchored at (ax, ay). The +/−
   buttons (`zoomMap`) anchor at the centre of `#map-box`'s visible area; reset
   (`dir===0`) goes to scale 1 and scroll 0. The pinch handler anchors at the midpoint
   of the two touches relative to `#map-box`'s bounding rect. Both use `setScale`
   (no duplicated scale code). Note `#map-box` has `padding:12px`; content offsets are
   relative to the scroll container, the small padding error is acceptable.
3. Search centering: in `jumpToCountry`, when the target is found, after `openPanel`
   and `pulse`, scroll `#map-box` so the country's path is centred, using
   `centerScroll` on both axes with the element's `getBoundingClientRect()` converted
   to container scroll coordinates (`rect.left - boxRect.left + box.scrollLeft`).
4. Keyboard access: in `lightMap()`, every element that gets class `lit` also gets
   `tabindex="0"`, `role="button"` and `aria-label="<country name>: <n> can(s)"`;
   `clearMapClasses()` removes those attributes. In `attachEvents()`, add a `keydown`
   listener on `#svg-host`: Enter or Space on a `.lit` element → `preventDefault()` and
   `openPanel(iso)`. Add a visible focus style in the CSS:
   `#svg-host .lit:focus-visible{outline:2px solid #fff;outline-offset:1px}`.

Testing: unit tests for `zoomScroll` and `centerScroll` in `map-data.test.ts`.
DOM wiring in `map.html` has no harness — keep it thin (all maths in the helpers).

## Task 4: Small UI fixes (card name, back button, landing copy)

Files: `frontend/src/styles/main.css`, `frontend/src/landing/LandingPage.tsx`
(+ its test if it asserts the tagline).

1. `.card-name`: allow two lines instead of one. Replace `white-space: nowrap` with
   `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
   line-clamp: 2;` keeping `overflow: hidden`. Remove `text-overflow: ellipsis` only if
   it has no effect with line-clamp (it is harmless; keep it if unsure).
2. `.detail-back`: `width: 44px; height: 44px` (was 36).
3. Landing tagline (`LandingPage.tsx` ~line 57): drop the word "valued" — guests never
   see values. New text: "RedMghost's personal Monster Energy archive — every can
   catalogued and mapped across the world." (keep the `&rsquo;` entity style).
   Update any test asserting the old text.

Testing: run the vitest suite (`contrast.test.ts` reads `main.css`; landing tests
render the tagline). Prettier the touched `src` files (LF first).
