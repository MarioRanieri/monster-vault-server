// ── Monster Vault — UI: filters, views, detail, compare, edit/add, watch, boot ──
import type { Can } from './types';
import {
  state,
  API,
  esc,
  jsq,
  cloudinaryThumb,
  cloudinaryLqip,
  colorizeTop,
  topBg,
  linguaToFlags,
  toast,
  toastUndo,
  closeModal,
  updateTopPreview,
  saveCache,
  loadFromCache,
  saveFilters,
  restoreFilters,
  MV_FILTERS_KEY,
  updateCacheBar,
  applyAuthUI,
  continueAsGuest,
  _tryRefresh,
  STATO_COLORS,
  MOCK_CANS,
  REFRESH_BTN_HTML,
  migrateStato,
  saveCanFS,
  deleteCanFS,
  permanentDeleteCanFS,
  restoreCanFS,
  batchSaveFS,
  JWT_KEY,
  extractYearFromCan,
} from './core';

// ── FILTERS ───────────────────────────────────────────
const filterKeys = ['fl-lingua', 'fl-size', 'fl-produttore', 'fl-top'];
const filterFields = ['lingua', 'size', 'produttore', 'top'];

export function readSelectVals(): Record<string, string> {
  const v: Record<string, string> = {};
  filterKeys.forEach(function (id, i) {
    v[filterFields[i]] = (document.getElementById(id) as HTMLSelectElement).value;
  });
  return v;
}

export function canMatchesFilters(
  c: Can,
  q: string,
  selectVals: Record<string, string>,
  skipIdx: number,
): boolean {
  if (
    q &&
    !(
      (c.nome || '').toLowerCase().includes(q) ||
      String(c.sku).toLowerCase().includes(q) ||
      (c.descrizione || '').toLowerCase().includes(q) ||
      (c.note || '').toLowerCase().includes(q)
    )
  )
    return false;
  if (state.activeChips.promo && !c.promo) return false;
  if (state.activeChips.full && !(c.note && c.note.toUpperCase().indexOf('FULL') !== -1))
    return false;
  if (state.activeChips.confoto && !c.p1) return false;
  if (state.activeChips.nofoto && c.p1) return false;
  for (let i = 0; i < filterFields.length; i++) {
    if (i === skipIdx) continue;
    if (selectVals[filterFields[i]] && (c as any)[filterFields[i]] !== selectVals[filterFields[i]])
      return false;
  }
  return true;
}

export { extractYearFromCan } from './core';

export function populateFilters(): void {
  const q = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
  const selectVals = readSelectVals();
  filterKeys.forEach(function (id, ki) {
    const el = document.getElementById(id) as HTMLSelectElement;
    const key = filterFields[ki];
    let cur = el.value;
    const filtered = state.cans.filter(function (c) {
      return canMatchesFilters(c, q, selectVals, ki);
    });
    const vals = Array.from(
      new Set(
        filtered
          .map(function (c: any) {
            return c[key];
          })
          .filter(Boolean),
      ),
    ).sort(function (a: any, b: any) {
      if (key === 'size') {
        const na = parseFloat(a),
          nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
      }
      return a.localeCompare(b);
    });
    // apply value from data-restore (first populate after reload)
    const restore = (el as any).dataset.restore;
    if (restore && !cur) {
      delete (el as any).dataset.restore;
      cur = restore;
    }
    if (cur && vals.indexOf(cur) === -1) cur = '';
    el.innerHTML =
      el.options[0].outerHTML +
      vals
        .map(function (v: any) {
          return (
            '<option value="' +
            esc(v) +
            '"' +
            (v === cur ? ' selected' : '') +
            '>' +
            esc(v) +
            '</option>'
          );
        })
        .join('');
    if (cur !== el.value) el.value = cur;
  });
}

export function filterCans(): Can[] {
  const q = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
  const sort = (document.getElementById('sort-select') as HTMLSelectElement).value;
  const vminEl = document.getElementById('fl-vmin') as HTMLInputElement | null;
  const vmaxEl = document.getElementById('fl-vmax') as HTMLInputElement | null;
  const vmin = vminEl && vminEl.value !== '' ? parseFloat(vminEl.value) : null;
  const vmax = vmaxEl && vmaxEl.value !== '' ? parseFloat(vmaxEl.value) : null;
  const yminEl = document.getElementById('fl-ymin') as HTMLInputElement | null;
  const ymaxEl = document.getElementById('fl-ymax') as HTMLInputElement | null;
  const ymin = yminEl && yminEl.value !== '' ? parseInt(yminEl.value, 10) : null;
  const ymax = ymaxEl && ymaxEl.value !== '' ? parseInt(ymaxEl.value, 10) : null;
  const selectVals = readSelectVals();
  const list = state.cans.filter(function (c) {
    if (!canMatchesFilters(c, q, selectVals, -1)) return false;
    if (vmin !== null && (parseFloat(c.valore || '') || 0) < vmin) return false;
    if (vmax !== null && (parseFloat(c.valore || '') || 0) > vmax) return false;
    if (ymin !== null || ymax !== null) {
      const y = extractYearFromCan(c);
      if (y === null) return false;
      if (ymin !== null && y < ymin) return false;
      if (ymax !== null && y > ymax) return false;
    }
    return true;
  });
  list.sort(function (a, b) {
    if (sort === 'added-desc') {
      const aP = a.photoAt || 0,
        bP = b.photoAt || 0;
      if (bP !== aP) return bP - aP;
      return ((b.updatedAt as any) || 0) - ((a.updatedAt as any) || 0);
    }
    if (sort === 'id-desc') return (Number(b.id) || 0) - (Number(a.id) || 0);
    if (sort === 'id-asc') return (Number(a.id) || 0) - (Number(b.id) || 0);
    if (sort === 'nome-asc') return (a.nome || '').localeCompare(b.nome || '');
    if (sort === 'lingua-asc') return (a.lingua || '').localeCompare(b.lingua || '');
    if (sort === 'valore-desc')
      return (parseFloat(b.valore || '') || 0) - (parseFloat(a.valore || '') || 0);
    if (sort === 'valore-asc')
      return (parseFloat(a.valore || '') || 0) - (parseFloat(b.valore || '') || 0);
    return 0;
  });
  return list;
}

export function applyFilters(keepPage?: boolean): void {
  const list = filterCans();
  state.filteredList = list;
  if (!keepPage) state.pageShown = state.PAGE_SIZE;
  const hasF =
    filterKeys.some(function (id) {
      return (document.getElementById(id) as HTMLSelectElement).value;
    }) ||
    (document.getElementById('search-input') as HTMLInputElement).value ||
    state.activeChips.promo ||
    state.activeChips.full ||
    state.activeChips.confoto ||
    state.activeChips.nofoto ||
    ((document.getElementById('fl-vmin') as HTMLInputElement | null)?.value !== '' &&
      (document.getElementById('fl-vmin') as HTMLInputElement | null)?.value != null) ||
    ((document.getElementById('fl-vmax') as HTMLInputElement | null)?.value !== '' &&
      (document.getElementById('fl-vmax') as HTMLInputElement | null)?.value != null) ||
    ((document.getElementById('fl-ymin') as HTMLInputElement | null)?.value !== '' &&
      (document.getElementById('fl-ymin') as HTMLInputElement | null)?.value != null) ||
    ((document.getElementById('fl-ymax') as HTMLInputElement | null)?.value !== '' &&
      (document.getElementById('fl-ymax') as HTMLInputElement | null)?.value != null);
  document.getElementById('grid-info')!.textContent =
    list.length === state.cans.length
      ? state.cans.length + ' cans'
      : list.length + ' of ' + state.cans.length + ' cans';
  (document.getElementById('reset-filters-btn') as HTMLElement).style.display = hasF
    ? 'inline'
    : 'none';
  const svBtn = document.getElementById('share-view-btn');
  if (svBtn) svBtn.style.display = hasF && !state.isPublicMode ? 'inline-block' : 'none';
  renderActiveView();
  populateFilters();
  saveFilters();
}

export function resetFilters(): void {
  (document.getElementById('search-input') as HTMLInputElement).value = '';
  filterKeys.forEach(function (id) {
    (document.getElementById(id) as HTMLSelectElement).value = '';
  });
  (['promo', 'full', 'confoto', 'nofoto'] as const).forEach(function (k) {
    (state.activeChips as any)[k] = false;
    document.getElementById('chip-' + k)!.classList.remove('active');
  });
  const vmin = document.getElementById('fl-vmin') as HTMLInputElement | null;
  const vmax = document.getElementById('fl-vmax') as HTMLInputElement | null;
  if (vmin) vmin.value = '';
  if (vmax) vmax.value = '';
  const ymin = document.getElementById('fl-ymin') as HTMLInputElement | null;
  const ymax = document.getElementById('fl-ymax') as HTMLInputElement | null;
  if (ymin) ymin.value = '';
  if (ymax) ymax.value = '';
  try {
    localStorage.removeItem(MV_FILTERS_KEY);
  } catch (_e) {
    /* ignore */
  }
  applyFilters();
}

export function toggleChip(key: string): void {
  (state.activeChips as any)[key] = !(state.activeChips as any)[key];
  document
    .getElementById('chip-' + key)!
    .classList.toggle('active', (state.activeChips as any)[key]);
  if (key === 'confoto' && state.activeChips.confoto) {
    state.activeChips.nofoto = false;
    document.getElementById('chip-nofoto')!.classList.remove('active');
  }
  if (key === 'nofoto' && state.activeChips.nofoto) {
    state.activeChips.confoto = false;
    document.getElementById('chip-confoto')!.classList.remove('active');
  }
  applyFilters();
}

// ── VIEW ──────────────────────────────────────────────
export function setView(v: string): void {
  state.currentView = v;
  document.getElementById('vbtn-grid')!.classList.toggle('active', v === 'grid');
  document.getElementById('vbtn-list')!.classList.toggle('active', v === 'list');
  document.getElementById('vbtn-wall')!.classList.toggle('active', v === 'wall');
  (document.getElementById('grid') as HTMLElement).style.display = v === 'grid' ? '' : 'none';
  (document.getElementById('list-view-wrap') as HTMLElement).style.display =
    v === 'list' ? '' : 'none';
  (document.getElementById('wall-view') as HTMLElement).style.display = v === 'wall' ? '' : 'none';
  renderActiveView();
}

export function renderActiveView(): void {
  if (state.currentView === 'grid') renderGrid();
  else if (state.currentView === 'list') renderList();
  else renderWall();
}

export function renderGrid(): void {
  const grid = document.getElementById('grid')!;
  const lm = document.getElementById('load-more-wrap')!;
  if (!state.cans.length) {
    grid.innerHTML =
      '<div class="empty"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><p>Import your Excel to get started</p></div>';
    (lm as HTMLElement).style.display = 'none';
    return;
  }
  if (!state.filteredList.length) {
    grid.innerHTML =
      '<div class="empty"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>No cans match the filters</p><button class="reset-filters-btn" onclick="resetFilters()" style="margin-top:12px">&#x2715; Reset filters</button></div>';
    (lm as HTMLElement).style.display = 'none';
    return;
  }
  grid.innerHTML = state.filteredList.slice(0, state.pageShown).map(cardHTML).join('');
  (window as any).refreshPrices();
  const rem = state.filteredList.length - state.pageShown;
  if (rem > 0) {
    (lm as HTMLElement).style.display = 'block';
    document.getElementById('load-more-count')!.textContent =
      Math.min(rem, state.PAGE_SIZE) + ' of ' + rem + ' remaining';
  } else (lm as HTMLElement).style.display = 'none';
}

export function loadMore(): void {
  state.pageShown += state.PAGE_SIZE;
  renderActiveView();
}

export function renderWall(): void {
  const wall = document.getElementById('wall-view')!;
  const lm = document.getElementById('load-more-wrap')!;
  const wl = state.filteredList.filter(function (c) {
    return c.p1;
  });
  if (!wl.length) {
    wall.innerHTML = '<div class="empty"><p>No photos to show here</p></div>';
    (lm as HTMLElement).style.display = 'none';
    return;
  }
  wall.innerHTML = wl
    .slice(0, state.pageShown)
    .map(function (c) {
      return (
        '<div class="wall-tile" title="' +
        esc(c.nome || '') +
        '" onclick="openDetail(\'' +
        jsq(c.id) +
        '\')"><img src="' +
        esc(cloudinaryThumb(c.p1, 300, 300)) +
        '" loading="lazy" onerror="this.parentNode.style.display=\'none\'"/></div>'
      );
    })
    .join('');
  const rem = wl.length - state.pageShown;
  if (rem > 0) {
    (lm as HTMLElement).style.display = 'block';
    document.getElementById('load-more-count')!.textContent =
      Math.min(rem, state.PAGE_SIZE) + ' of ' + rem + ' remaining';
  } else (lm as HTMLElement).style.display = 'none';
}

export function cardHTML(c: Can): string {
  const _CARD_PH =
    '<div class="card-img-placeholder" style="display:none"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>—</span></div>';
  const img = c.p1
    ? '<div class="card-img-lqip" style="background-image:url(' +
      cloudinaryLqip(c.p1) +
      ')">' +
      '<img src="' +
      cloudinaryThumb(c.p1, 400, 400) +
      '" alt="' +
      esc(c.nome) +
      '" loading="lazy" width="400" height="400"' +
      ' onload="this.parentNode.classList.add(\'lqip-loaded\')"' +
      ' onerror="imgErrCard(this)"/>' +
      '</div>' +
      _CARD_PH
    : '<div class="card-img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Add photo</span></div>';
  const stCls = STATO_COLORS[c.stato || ''] || 'badge-stato-ok';
  const badges = [
    c.size ? '<span class="badge badge-size">' + esc(c.size) + '</span>' : '',
    c.promo ? '<span class="badge badge-promo">' + esc(c.promo) + '</span>' : '',
    c.stato ? '<span class="badge ' + stCls + '">' + esc(c.stato) + '</span>' : '',
  ].join('');
  const pv = c.valore ? parseFloat(c.valore).toLocaleString('en-US') : '';
  const isComp = state.selectedForCompare.indexOf(c.id) >= 0;
  return (
    '<div class="card' +
    (isComp ? ' comparing' : '') +
    (c.watch ? ' watching' : '') +
    '" data-id="' +
    esc(c.id) +
    '" onclick="openDetail(\'' +
    jsq(c.id) +
    '\')">' +
    '<div class="card-img">' +
    img +
    '<button class="card-watch-btn" title="Monitora su eBay" onclick="event.stopPropagation();toggleWatch(\'' +
    jsq(c.id) +
    '\')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
    '<span class="card-sku">' +
    esc(c.sku) +
    (c.note && c.note.toUpperCase().indexOf('FULL') !== -1
      ? '<br><span class="badge-full">FULL</span>'
      : '') +
    '</span>' +
    '<div class="card-badges">' +
    badges +
    '</div>' +
    '<div class="card-overlay">' +
    '<div class="card-overlay-btn view" onclick="event.stopPropagation();openDetail(\'' +
    jsq(c.id) +
    '\')">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>Details</div>' +
    '<div class="card-overlay-btn edit" onclick="event.stopPropagation();openEdit(\'' +
    jsq(c.id) +
    '\')">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit</div></div></div>' +
    '<div class="card-body">' +
    '<div class="card-name">' +
    esc(c.nome || '—') +
    '</div>' +
    (c.produttore ? '<div class="card-produttore">' + esc(c.produttore) + '</div>' : '') +
    '<div class="card-meta">' +
    (c.lingua ? linguaToFlags(c.lingua) : '') +
    '</div>' +
    '<div class="card-price" data-val="' +
    (c.valore || '') +
    '">' +
    (pv ? '€' + pv : '') +
    '</div>' +
    '</div></div>'
  );
}

export function sortList(key: string): void {
  if (state.listSortKey === key) state.listSortDir *= -1;
  else {
    state.listSortKey = key;
    state.listSortDir = 1;
  }
  document.querySelectorAll('.list-table th').forEach(function (th) {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  const cols = ['', 'nome', 'sku', 'produttore', 'lingua', 'size', 'top', 'stato', 'valore', ''];
  const ci = cols.indexOf(key);
  if (ci >= 0)
    document
      .querySelectorAll('.list-table th')
      [ci].classList.add(state.listSortDir === 1 ? 'sort-asc' : 'sort-desc');
  state.filteredList.sort(function (a: any, b: any) {
    const av = a[key] || '',
      bv = b[key] || '';
    if (key === 'valore')
      return ((parseFloat(av) || 0) - (parseFloat(bv) || 0)) * state.listSortDir;
    return av.localeCompare(bv) * state.listSortDir;
  });
  renderList();
}

export function renderList(): void {
  const tbody = document.getElementById('list-tbody')!;
  const lm = document.getElementById('load-more-wrap')!;
  if (!state.filteredList.length) {
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--text3)">No cans</td></tr>';
    (lm as HTMLElement).style.display = 'none';
    return;
  }
  tbody.innerHTML = state.filteredList
    .slice(0, state.pageShown)
    .map(function (c) {
      const stCls = STATO_COLORS[c.stato || ''] || '';
      const thumb = c.p1
        ? '<img class="lt-thumb" src="' +
          cloudinaryThumb(c.p1, 80, 80) +
          '" loading="lazy" width="80" height="80"/>'
        : '<div class="lt-nophoto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
      const pv = c.valore ? parseFloat(c.valore).toLocaleString('en-US') : '—';
      return (
        '<tr>' +
        '<td class="td-thumb" onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        thumb +
        '</td>' +
        '<td class="td-nome" onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        esc(c.nome || '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        esc(c.sku || '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        esc(c.produttore || '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        (c.lingua ? linguaToFlags(c.lingua) : '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        esc(c.size || '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        (c.top ? colorizeTop(c.top) : '—') +
        '</td>' +
        '<td onclick="openDetail(\'' +
        jsq(c.id) +
        '\')">' +
        (c.stato ? '<span class="badge ' + stCls + '">' + esc(c.stato) + '</span>' : '—') +
        '</td>' +
        '<td class="td-price" onclick="openDetail(\'' +
        jsq(c.id) +
        '\')" style="display:' +
        (state.showPrice ? '' : 'none') +
        '">' +
        (pv !== '—' ? '€' : '') +
        pv +
        '</td>' +
        '<td class="td-actions"><button title="Edit" onclick="openEdit(\'' +
        jsq(c.id) +
        '\')">&#x270F;&#xFE0F;</button></td>' +
        '</tr>'
      );
    })
    .join('');
  const rem = state.filteredList.length - state.pageShown;
  if (rem > 0) {
    (lm as HTMLElement).style.display = 'block';
    document.getElementById('load-more-count')!.textContent =
      Math.min(rem, state.PAGE_SIZE) + ' of ' + rem + ' remaining';
  } else (lm as HTMLElement).style.display = 'none';
}

// ── COMPARE ───────────────────────────────────────────
export function toggleCompare(id: string): void {
  const idx = state.selectedForCompare.indexOf(id);
  if (idx >= 0) {
    state.selectedForCompare.splice(idx, 1);
  } else {
    const max = window.innerWidth <= 640 ? 2 : 4;
    if (state.selectedForCompare.length >= max) {
      toast('Max ' + max + ' cans for comparison', true);
      return;
    }
    state.selectedForCompare.push(id);
  }
  updateCompareUI();
}

export function updateDetailCompareBtn(): void {
  const btn = document.getElementById('detail-compare-btn');
  if (!btn || !state.detailCurrentId) return;
  btn.classList.toggle('active', state.selectedForCompare.indexOf(state.detailCurrentId) >= 0);
}

export function updateCompareUI(): void {
  document.querySelectorAll('.card[data-id]').forEach(function (el) {
    el.classList.toggle(
      'comparing',
      state.selectedForCompare.indexOf((el as HTMLElement).dataset.id!) >= 0,
    );
  });
  const anySelected = state.selectedForCompare.length > 0;
  document.getElementById('compare-bar')!.classList.toggle('open', anySelected);
  document.body.classList.toggle('comparing-active', anySelected);
  if (anySelected) renderCompareBar();
  updateDetailCompareBtn();
}

export function renderCompareBar(): void {
  document.getElementById('compare-slots')!.innerHTML = state.selectedForCompare
    .map(function (id) {
      const can = state.cans.find(function (c) {
        return c.id === id;
      });
      if (!can) return '';
      const thumb = can.p1
        ? '<img src="' + cloudinaryThumb(can.p1, 80, 80) + '" alt=""/>'
        : '<div class="compare-slot-ph"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
      return (
        '<div class="compare-slot">' +
        thumb +
        '<button class="compare-slot-remove" onclick="event.stopPropagation();toggleCompare(\'' +
        jsq(id) +
        '\')">&#x2715;</button></div>'
      );
    })
    .join('');
  const btn = document.getElementById('compare-go-btn') as HTMLButtonElement;
  btn.disabled = state.selectedForCompare.length < 2;
  btn.textContent = 'Compare (' + state.selectedForCompare.length + ')';
}

export function clearCompare(): void {
  state.selectedForCompare = [];
  updateCompareUI();
}

export function openComparePanel(): void {
  if (state.selectedForCompare.length < 2) return;
  renderComparePanel();
  document.getElementById('compare-panel')!.classList.add('open');
}

export function closeComparePanel(): void {
  document.getElementById('compare-panel')!.classList.remove('open');
}

export function compareCellPhotoHTML(can: Can): string {
  const photoSlots = [1, 2, 3, 4].filter(function (s) {
    return (can as any)['p' + s];
  });
  if (!photoSlots.length) {
    return '<div class="compare-cell compare-cell-photo"><div class="compare-cell-photo-ph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div></div>';
  }
  const mainSrc = cloudinaryThumb((can as any)['p' + photoSlots[0]], 800, 800);
  let thumbsHTML = '';
  if (photoSlots.length > 1) {
    thumbsHTML =
      '<div class="compare-photo-nav">' +
      photoSlots
        .map(function (s, i) {
          return (
            '<img class="compare-photo-thumb' +
            (i === 0 ? ' active' : '') +
            '" src="' +
            esc(cloudinaryThumb((can as any)['p' + s], 64, 64)) +
            '" data-can-id="' +
            esc(can.id) +
            '" data-slot="' +
            s +
            '" onclick="switchComparePhoto(this)" />'
          );
        })
        .join('') +
      '</div>';
  }
  return (
    '<div class="compare-cell compare-cell-photo">' +
    '<img class="compare-photo-main" src="' +
    esc(mainSrc) +
    '" data-slot="' +
    photoSlots[0] +
    '" onclick="openLightbox(\'' +
    jsq(can.id) +
    '\')" />' +
    thumbsHTML +
    '</div>'
  );
}

export function renderComparePanel(): void {
  const compareCans = state.selectedForCompare
    .map(function (id) {
      return state.cans.find(function (c) {
        return c.id === id;
      });
    })
    .filter(Boolean) as Can[];
  const n = compareCans.length;
  const lw = window.innerWidth <= 640 ? '80px' : '120px';
  const cols = lw + ' ' + Array(n).fill('1fr').join(' ');
  const GREEN = 'var(--green)';
  const fields = [
    { key: 'sku', lbl: 'SKU', c: GREEN },
    { key: 'produttore', lbl: 'Manufacturer', c: GREEN },
    { key: 'lingua', lbl: 'Country / Language', c: GREEN },
    { key: 'size', lbl: 'Size', c: GREEN },
    { key: 'top', lbl: 'Top / Tab', c: GREEN, colorize: true },
    { key: 'note', lbl: 'Opening', c: GREEN },
    { key: 'stato', lbl: 'Condition', c: GREEN },
    { key: 'valore', lbl: 'Est. Value', c: GREEN },
    { key: 'promo', lbl: 'Promo', c: GREEN },
  ].filter(function (f) {
    return !state.isPublicMode || f.key !== 'valore';
  });

  function mkRow(lbl: string, cells: string, lblColor?: string): string {
    return (
      '<div class="compare-row" style="grid-template-columns:' +
      cols +
      '">' +
      '<div class="compare-cell compare-cell-lbl"' +
      (lblColor ? ' style="color:' + lblColor + '"' : '') +
      '>' +
      lbl +
      '</div>' +
      cells +
      '</div>'
    );
  }
  let html = '<div class="compare-table">';
  html += mkRow('Photo', compareCans.map(compareCellPhotoHTML).join(''));
  html += mkRow(
    '',
    compareCans
      .map(function (can) {
        return (
          '<div class="compare-cell compare-cell-name"><strong style="color:#ff5555">' +
          esc(can.nome || '—') +
          '</strong>' +
          (can.sku ? '<span>' + esc(can.sku) + '</span>' : '') +
          '</div>'
        );
      })
      .join(''),
  );
  fields.forEach(function (f: any) {
    const vals = compareCans.map(function (can: any) {
      return can[f.key] || '';
    });
    html += mkRow(
      f.lbl,
      vals
        .map(function (v: string) {
          return (
            '<div class="compare-cell compare-cell-val">' +
            (f.colorize && v ? colorizeTop(v) : esc(v || '—')) +
            '</div>'
          );
        })
        .join(''),
      f.c,
    );
  });
  html += '</div>';
  document.getElementById('compare-panel-body')!.innerHTML = html;
  document.getElementById('compare-count-text')!.textContent = 'Comparing ' + n + ' cans';
}

export function switchComparePhoto(thumb: HTMLElement): void {
  const canId = (thumb as any).dataset.canId;
  const slot = parseInt((thumb as any).dataset.slot);
  const can = state.cans.find(function (c) {
    return c.id === canId;
  });
  if (!can || !(can as any)['p' + slot]) return;
  const cell = thumb.closest('.compare-cell-photo')!;
  const mainImg = cell.querySelector('.compare-photo-main') as HTMLImageElement | null;
  if (mainImg) {
    mainImg.src = cloudinaryThumb((can as any)['p' + slot], 800, 800)!;
    (mainImg as any).dataset.slot = slot;
  }
  cell.querySelectorAll('.compare-photo-thumb').forEach(function (t) {
    t.classList.toggle('active', parseInt((t as any).dataset.slot) === slot);
  });
}

// ── DETAIL PANEL ──────────────────────────────────────
export function buildDetailPhotosHTML(can: Can, id: string, photos: number[]): string {
  if (!photos.length)
    return '<div class="detail-main-img-ph"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
  let html =
    '<img class="detail-main-img" id="detail-main-img" src="' +
    esc((can as any)['p' + photos[0]]) +
    '" onclick="openLightbox(\'' +
    jsq(id) +
    '\')" onerror="imgErrMain(this)" /><div class="detail-tap-zoom">tap to zoom</div>';
  if (photos.length > 1) {
    html += '<div class="detail-thumbs-row">';
    photos.forEach(function (n, i) {
      html +=
        '<img class="detail-thumb' +
        (i === 0 ? ' active' : '') +
        '" src="' +
        esc((can as any)['p' + n]) +
        '" data-src="' +
        esc((can as any)['p' + n]) +
        '" onclick="detailThumbClick(this)" onerror="this.style.display=\'none\'" />';
    });
    html += '</div>';
  }
  return html;
}

export function buildDetailFieldsHTML(can: Can, stCls: string): string {
  const fields: any[] = [
    { lbl: 'SKU', val: can.sku },
    { lbl: 'Manufacturer', val: can.produttore },
    { lbl: 'Country/Language', val: can.lingua },
    { lbl: 'Size', val: can.size },
    { lbl: 'Top / Tab', val: colorizeTop(can.top), isHtml: true, top: can.top },
    { lbl: 'Promo', val: can.promo },
    {
      lbl: 'Est. Value',
      val: can.valore ? '€' + parseFloat(can.valore).toLocaleString('en-US') : null,
      fieldKey: 'valore',
    },
    { lbl: 'Condition', val: can.stato, cls: stCls, isBadge: true },
  ];
  let html = '<div class="detail-fields">';
  fields.forEach(function (f) {
    if (!f.val) return;
    let attr = f.fieldKey ? ' data-field="' + f.fieldKey + '"' : '';
    let cls = 'detail-field';
    let valHtml: string;
    if (f.top) {
      const bg = topBg(f.top);
      if (bg) {
        attr += ' style="' + bg + '"';
        cls += ' detail-field-top';
        valHtml = esc(f.top);
      } else valHtml = f.val;
    } else {
      valHtml = f.isBadge
        ? '<span class="badge ' + f.cls + '">' + esc(f.val) + '</span>'
        : f.isHtml
          ? f.val
          : esc(f.val);
    }
    html +=
      '<div class="' +
      cls +
      '"' +
      attr +
      '><div class="detail-field-lbl">' +
      esc(f.lbl) +
      '</div><div class="detail-field-val">' +
      valHtml +
      '</div></div>';
  });
  html += '</div>';
  if (can.note) {
    const noteVals = can.note
      .split(',')
      .map(function (v) {
        return v.trim();
      })
      .filter(Boolean);
    if (noteVals.length)
      html +=
        '<div class="detail-note"><div class="detail-field-lbl">Opening</div><div class="opening-badges" style="margin-top:8px">' +
        noteVals
          .map(function (v) {
            return '<span class="badge-opening">' + esc(v) + '</span>';
          })
          .join('') +
        '</div></div>';
  }
  if (can.descrizione)
    html +=
      '<div class="detail-description"><div class="detail-field-lbl">&#128214; More Info</div><div class="detail-field-val">' +
      esc(can.descrizione) +
      '</div></div>';
  return html;
}

export function buildDetailNavHTML(id: string): string {
  const idx = state.filteredList.findIndex(function (c) {
    return c.id === id;
  });
  const prevId = idx > 0 ? state.filteredList[idx - 1].id : null;
  const nextId = idx < state.filteredList.length - 1 ? state.filteredList[idx + 1].id : null;
  return (
    '<div class="detail-nav">' +
    '<button class="detail-nav-btn" ' +
    (prevId ? 'onclick="openDetail(\'' + jsq(prevId) + '\')"' : 'disabled') +
    '><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Previous</button>' +
    '<button class="detail-nav-btn" ' +
    (nextId ? 'onclick="openDetail(\'' + jsq(nextId) + '\')"' : 'disabled') +
    '>Next <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>' +
    '</div>'
  );
}

export function openDetail(id: string): void {
  const can = state.cans.find(function (c) {
    return c.id === id;
  });
  if (!can) return;
  state.detailCurrentId = id;
  document.getElementById('detail-panel-title')!.textContent = can.nome || '—';
  (document.getElementById('detail-edit-btn') as HTMLElement).onclick = function () {
    closeDetail();
    openEdit(id);
  };
  const _wb = document.getElementById('detail-watch-btn');
  if (_wb) {
    _wb.classList.toggle('active', !!can.watch);
    const _wl = _wb.querySelector('.btn-label');
    if (_wl) _wl.textContent = can.watch ? 'Watching' : 'Watch';
  }
  const photos = [1, 2, 3, 4].filter(function (n) {
    return (can as any)['p' + n];
  });
  const stCls = STATO_COLORS[can.stato || ''] || 'badge-stato-ok';
  const badgesHTML = [
    can.size ? '<span class="badge badge-size">' + esc(can.size) + '</span>' : '',
    can.promo ? '<span class="badge badge-promo">' + esc(can.promo) + '</span>' : '',
    can.stato ? '<span class="badge ' + stCls + '">' + esc(can.stato) + '</span>' : '',
    photos.length ? '<span class="badge badge-photo">' + photos.length + ' photo</span>' : '',
  ].join('');
  document.getElementById('detail-body')!.innerHTML =
    '<div class="detail-photos">' +
    buildDetailPhotosHTML(can, id, photos) +
    '</div><div class="detail-info"><div class="detail-name">' +
    esc(can.nome || '—') +
    '</div><div class="detail-sku">SKU ' +
    esc(can.sku || '—') +
    '</div><div class="detail-badges">' +
    badgesHTML +
    '</div>' +
    buildDetailFieldsHTML(can, stCls) +
    buildDetailNavHTML(id) +
    '</div>';
  document.getElementById('detail-panel')!.classList.add('open');
  document.getElementById('detail-panel')!.scrollTop = 0;
  updateDetailCompareBtn();
}

export function detailThumbClick(el: HTMLElement): void {
  (document.getElementById('detail-main-img') as HTMLImageElement).src = (el as any).dataset.src;
  document.querySelectorAll('.detail-thumb').forEach(function (t) {
    t.classList.remove('active');
  });
  el.classList.add('active');
}

export function closeDetail(): void {
  document.getElementById('detail-panel')!.classList.remove('open');
  state.detailCurrentId = null;
}

export function detailNav(dir: number): void {
  const idx = state.filteredList.findIndex(function (c) {
    return c.id === state.detailCurrentId;
  });
  const next = state.filteredList[idx + dir];
  if (next) openDetail(next.id);
}

// ── WATCH ─────────────────────────────────────────────
export function toggleWatch(id: string): void {
  if (!id) return;
  const can = state.cans.find(function (c) {
    return c.id === id;
  });
  if (!can) return;
  const next = !can.watch;
  can.watch = next;
  saveCache();
  updateWatchUI(id);
  saveCanFS(can)
    .then(function () {
      toast(next ? '👁️ Watching on eBay' : 'Removed from eBay watch');
    })
    .catch(function (e: any) {
      can.watch = !next;
      saveCache();
      updateWatchUI(id);
      toast('Error: ' + e.message, true);
    });
}

export function updateWatchUI(id: string): void {
  const can = state.cans.find(function (c) {
    return c.id === id;
  });
  if (!can) return;
  const cardEls = document.querySelectorAll('.card[data-id]');
  for (let i = 0; i < cardEls.length; i++) {
    if ((cardEls[i] as HTMLElement).dataset.id === id) {
      cardEls[i].classList.toggle('watching', !!can.watch);
      break;
    }
  }
  if (state.detailCurrentId === id) {
    const b = document.getElementById('detail-watch-btn');
    if (b) {
      b.classList.toggle('active', !!can.watch);
      const l = b.querySelector('.btn-label');
      if (l) l.textContent = can.watch ? 'Watching' : 'Watch';
    }
  }
}

// ── ADD / EDIT ────────────────────────────────────────
export function openAddModal(): void {
  state.editingId = null;
  state.pendingFiles = { 1: null, 2: null, 3: null, 4: null };
  state.pendingURLs = { 1: null, 2: null, 3: null, 4: null };
  document.getElementById('edit-title')!.textContent = 'Add Can';
  (document.getElementById('del-btn') as HTMLElement).style.display = 'none';
  ['nome', 'sku', 'produttore', 'size', 'lingua', 'top', 'descrizione', 'valore'].forEach(
    function (f) {
      (document.getElementById('e-' + f) as HTMLInputElement).value = '';
    },
  );
  updateTopPreview();
  (document.getElementById('e-promo') as HTMLInputElement).value = '';
  (document.getElementById('e-stato') as HTMLSelectElement).value = 'OK';
  (document.getElementById('e-watch') as HTMLInputElement).checked = false;
  loadNoteCheckboxes('');
  [1, 2, 3, 4].forEach(function (n) {
    (window as any).setSlot(n, null);
  });
  (document.getElementById('save-btn') as HTMLButtonElement).disabled = false;
  document.getElementById('save-btn')!.textContent = 'Save';
  document.getElementById('edit-modal')!.classList.add('open');
}

export function openEdit(id: string): void {
  const can = state.cans.find(function (c) {
    return c.id === id;
  });
  if (!can) return;
  state.editingId = id;
  state.pendingFiles = { 1: null, 2: null, 3: null, 4: null };
  state.pendingURLs = {
    1: can.p1 || null,
    2: can.p2 || null,
    3: can.p3 || null,
    4: can.p4 || null,
  };
  document.getElementById('edit-title')!.textContent = 'Edit Can';
  (document.getElementById('del-btn') as HTMLElement).style.display = 'inline-flex';
  (document.getElementById('e-nome') as HTMLInputElement).value = can.nome || '';
  (document.getElementById('e-sku') as HTMLInputElement).value = can.sku || '';
  (document.getElementById('e-produttore') as HTMLInputElement).value = can.produttore || '';
  (document.getElementById('e-size') as HTMLInputElement).value = can.size || '';
  (document.getElementById('e-lingua') as HTMLInputElement).value = can.lingua || '';
  (document.getElementById('e-top') as HTMLInputElement).value = can.top || '';
  updateTopPreview();
  loadNoteCheckboxes(can.note || '');
  (document.getElementById('e-descrizione') as HTMLTextAreaElement).value = can.descrizione || '';
  (document.getElementById('e-valore') as HTMLInputElement).value = can.valore || '';
  (document.getElementById('e-promo') as HTMLInputElement).value = can.promo || '';
  (document.getElementById('e-stato') as HTMLSelectElement).value = can.stato || 'OK';
  (document.getElementById('e-watch') as HTMLInputElement).checked = !!can.watch;
  [1, 2, 3, 4].forEach(function (n) {
    const url = (can as any)['p' + n] || null;
    (window as any).setSlot(n, url);
    state.pendingURLs[n] = url;
    state.pendingFiles[n] = null;
  });
  (document.getElementById('save-btn') as HTMLButtonElement).disabled = false;
  document.getElementById('save-btn')!.textContent = 'Save';
  document.getElementById('edit-modal')!.classList.add('open');
}

export function readCanForm(): any {
  return {
    nome: (document.getElementById('e-nome') as HTMLInputElement).value.trim(),
    sku: (document.getElementById('e-sku') as HTMLInputElement).value.trim(),
    produttore: (document.getElementById('e-produttore') as HTMLInputElement).value.trim(),
    size: (document.getElementById('e-size') as HTMLInputElement).value.trim(),
    lingua: (document.getElementById('e-lingua') as HTMLInputElement).value.trim(),
    top: (document.getElementById('e-top') as HTMLInputElement).value.trim(),
    note: getNoteFromCheckboxes(),
    descrizione: (document.getElementById('e-descrizione') as HTMLTextAreaElement).value.trim(),
    valore: (document.getElementById('e-valore') as HTMLInputElement).value.trim(),
    promo: (document.getElementById('e-promo') as HTMLInputElement).value.trim(),
    stato: (document.getElementById('e-stato') as HTMLSelectElement).value.trim(),
    watch: (document.getElementById('e-watch') as HTMLInputElement).checked,
  };
}

export function buildCanData(canId: string, form: any, photos: Record<number, string>): Can {
  return {
    id: canId,
    nome: form.nome,
    sku: form.sku,
    produttore: form.produttore,
    size: form.size,
    lingua: form.lingua,
    top: form.top,
    note: form.note,
    descrizione: form.descrizione,
    valore: form.valore,
    promo: form.promo,
    stato: form.stato,
    watch: form.watch,
    p1: photos[1],
    p2: photos[2],
    p3: photos[3],
    p4: photos[4],
  };
}

export function updateCanInCache(canData: Can): void {
  const idx = state.cans.findIndex(function (c) {
    return c.id === canData.id;
  });
  if (idx >= 0) state.cans[idx] = canData;
  else state.cans.push(canData);
  saveCache();
}

export function refreshAfterSave(canData: Can, isNew: boolean): void {
  if (state.cans.length === 1)
    (document.getElementById('filter-bar') as HTMLElement).style.display = 'flex';
  populateFilters();
  applyFilters(true);
  (window as any).updateStats();
  closeModal('edit-modal');
  if (state.detailCurrentId === canData.id) openDetail(canData.id);
  toast(isNew ? 'Can added ✓' : 'Can updated ✓');
}

export function saveCan(): void {
  if (state.saving) return;
  const form = readCanForm();
  if (!form.sku) {
    toast('SKU required', true);
    return;
  }
  const isNew = !state.editingId;
  const canId = state.editingId || 'new_' + Date.now();
  const btn = document.getElementById('save-btn') as HTMLButtonElement;
  btn.disabled = true;
  state.saving = true;
  const photos: Record<number, string> = {
    1: state.pendingURLs[1] || '',
    2: state.pendingURLs[2] || '',
    3: state.pendingURLs[3] || '',
    4: state.pendingURLs[4] || '',
  };
  (window as any).uploadNext(photos, [1, 2, 3, 4], canId, btn, function () {
    const canData = buildCanData(canId, form, photos);
    btn.textContent = 'Saving...';
    saveCanFS(canData)
      .then(function () {
        updateCanInCache(canData);
        refreshAfterSave(canData, isNew);
        state.saving = false;
        btn.disabled = false;
        btn.textContent = 'Save';
      })
      .catch(function (e: any) {
        toast('Error: ' + e.message, true);
        state.saving = false;
        btn.disabled = false;
        btn.textContent = 'Save';
      });
  });
}

export function deleteCan(): void {
  if (!state.editingId) return;
  const id = state.editingId;
  const snapshot = state.cans.find(function (c) {
    return c.id === id;
  });
  deleteCanFS(id)
    .then(function () {
      state.cans = state.cans.filter(function (c) {
        return c.id !== id;
      });
      saveCache();
      closeModal('edit-modal');
      if (state.detailCurrentId === id) closeDetail();
      populateFilters();
      applyFilters(true);
      (window as any).updateStats();
      let undone = false;
      const permTimer = setTimeout(function () {
        if (!undone)
          permanentDeleteCanFS(id).catch(function () {
            /* ignore */
          });
      }, 10000);
      toastUndo(
        'Can deleted',
        function () {
          undone = true;
          clearTimeout(permTimer);
          restoreCanFS(id)
            .then(function () {
              if (snapshot) {
                state.cans.push(snapshot);
                saveCache();
              }
              populateFilters();
              applyFilters(true);
              (window as any).updateStats();
              toast('Restored ✓');
            })
            .catch(function (e: any) {
              toast('Restore failed: ' + e.message, true);
            });
        },
        10000,
      );
    })
    .catch(function (e: any) {
      toast('Error: ' + e.message, true);
    });
}

// ── DESC AUTOCOMPLETE ─────────────────────────────────
export function suggestDescriptions(ta: HTMLTextAreaElement): void {
  const q = (ta.value || '').toLowerCase().trim();
  const list = document.getElementById('desc-ac-list')!;
  if (!q) {
    list.innerHTML = '';
    list.classList.remove('open');
    return;
  }
  const seen: Record<string, boolean> = {};
  const opts: string[] = [];
  state.cans.forEach(function (c) {
    if (c.descrizione && !seen[c.descrizione] && c.descrizione.toLowerCase().indexOf(q) >= 0) {
      seen[c.descrizione] = true;
      opts.push(c.descrizione);
    }
  });
  if (!opts.length) {
    list.innerHTML = '';
    list.classList.remove('open');
    return;
  }
  list.innerHTML = opts
    .slice(0, 6)
    .map(function (d) {
      return (
        '<div class="desc-ac-item" onmousedown="pickDescSuggestion(event,this)">' +
        esc(d) +
        '</div>'
      );
    })
    .join('');
  list.classList.add('open');
}

export function pickDescSuggestion(e: Event, el: HTMLElement): void {
  e.preventDefault();
  (document.getElementById('e-descrizione') as HTMLTextAreaElement).value = el.textContent || '';
  const list = document.getElementById('desc-ac-list')!;
  list.innerHTML = '';
  list.classList.remove('open');
}

export function closeDescSuggestions(): void {
  setTimeout(function () {
    const list = document.getElementById('desc-ac-list');
    if (list) {
      list.innerHTML = '';
      list.classList.remove('open');
    }
  }, 150);
}

// ── OPENING CHECKBOXES ────────────────────────────────
export function loadNoteCheckboxes(note: string): void {
  const val = (note || '').split(',')[0].trim().toUpperCase();
  document.querySelectorAll('#e-note-grid input').forEach(function (cb) {
    (cb as HTMLInputElement).checked =
      val !== '' && (cb as HTMLInputElement).value.toUpperCase() === val;
  });
}

export function getNoteFromCheckboxes(): string {
  const el = document.querySelector('#e-note-grid input:checked') as HTMLInputElement | null;
  return el ? el.value : '';
}

// ── OG META ───────────────────────────────────────────
export function updateOGMeta(can: Can): void {
  function setMeta(attr: string, name: string, val: string): void {
    let el = document.querySelector('meta[' + attr + '="' + name + '"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', val);
  }
  const title = (can.nome || 'Monster Vault') + (can.lingua ? ' — ' + can.lingua : '');
  const desc = can.descrizione
    ? can.descrizione.slice(0, 120) + (can.descrizione.length > 120 ? '…' : '')
    : [can.sku, can.size, can.stato].filter(Boolean).join(' · ');
  document.title = title + ' — Monster Vault';
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', window.location.href);
  if (can.p1) {
    setMeta('property', 'og:image', can.p1);
    setMeta('name', 'twitter:image', can.p1);
  }
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc);
}

// ── SERVER LOAD ───────────────────────────────────────
export function applyLoaded(): void {
  if (state.cans.length > 0) {
    (document.getElementById('filter-bar') as HTMLElement).style.display = 'flex';
    restoreFilters();
    populateFilters();
    if (state.isPublicMode) (window as any).applyPublicFilters();
  }
  applyFilters();
  (window as any).updateStats();
  (window as any).refreshPrices();
  updateCacheBar();
  if (state.deepLinkCanId) {
    const dlCan = state.cans.find(function (c) {
      return c.id === state.deepLinkCanId;
    });
    if (dlCan) {
      updateOGMeta(dlCan);
      openDetail(state.deepLinkCanId!);
    }
    state.deepLinkCanId = null;
  }
  const landEl = document.getElementById('landing-overlay');
  if (landEl && landEl.style.display !== 'none') {
    const withPhoto = state.cans.filter(function (c) {
      return c.p1 || c.p2 || c.p3 || c.p4;
    }).length;
    document.getElementById('land-total')!.textContent = String(state.cans.length);
    document.getElementById('land-photos')!.textContent = String(withPhoto);
  }
  updateCacheBar();
}

export function fetchWithRetry(attempt: number): Promise<Can[]> {
  return fetch(API + '/api/cans').then(function (r) {
    if (r.status === 429) throw new Error('429');
    if (r.status >= 500 && attempt < 3) {
      if (attempt === 1) {
        const grid = document.getElementById('grid');
        if (grid)
          grid.innerHTML =
            '<div class="empty"><div class="spinner"></div><p>Server warming up…<br><small style="color:var(--text2);font-size:11px">Free tier cold start · usually 30–50s</small></p></div>';
      }
      return new Promise<void>(function (res) {
        setTimeout(res, 2000);
      }).then(function () {
        return fetchWithRetry(attempt + 1);
      });
    }
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
}

export function applyServerData(data: Can[], force: boolean, rbtn: HTMLElement | null): void {
  state.cans = data;
  const changed = migrateStato(state.cans);
  saveCache();
  applyLoaded();
  if (rbtn) {
    (rbtn as HTMLButtonElement).disabled = false;
    rbtn.innerHTML = REFRESH_BTN_HTML;
  }
  if (force) toast('Refreshed from server ✓');
  if (changed.length) {
    batchSaveFS(changed)
      .then(function () {
        if (force) toast(changed.length + ' conditions migrated ✓');
      })
      .catch(function (e: any) {
        console.warn('stato migration:', e);
      });
  }
}

export function showDemo(rbtn: HTMLElement | null): void {
  state.cans = MOCK_CANS.slice();
  applyLoaded();
  if (rbtn) {
    (rbtn as HTMLButtonElement).disabled = false;
    rbtn.innerHTML = REFRESH_BTN_HTML;
  }
}

export function loadFromServer(force?: boolean): void {
  if (!force && !state.isPublicMode) {
    const cached = loadFromCache();
    if (cached) {
      state.cans = cached;
      if (migrateStato(state.cans).length) saveCache();
      applyLoaded();
      return;
    }
  }
  const rbtn = document.getElementById('btn-refresh');
  if (rbtn) {
    (rbtn as HTMLButtonElement).disabled = true;
    rbtn.textContent = '⏳ ...';
  }
  document.getElementById('grid')!.innerHTML =
    '<div class="empty"><div class="spinner"></div><p>Loading collection...</p></div>';
  fetchWithRetry(1)
    .then(function (data) {
      applyServerData(data, !!force, rbtn);
    })
    .catch(function (e) {
      if (e.message === '429') {
        if (rbtn) {
          (rbtn as HTMLButtonElement).disabled = false;
          rbtn.innerHTML = REFRESH_BTN_HTML;
        }
        const cached = loadFromCache();
        if (cached) {
          state.cans = cached;
          applyLoaded();
          setTimeout(function () {
            toast(
              'Firebase Free tier: daily quota exceeded — try again tomorrow :)  (showing cached data)',
              true,
            );
          }, 200);
        } else if (MOCK_CANS.length) {
          showDemo(rbtn);
          setTimeout(function () {
            toast(
              'Firebase Free tier: daily quota exceeded — try again tomorrow :)  (preview mode)',
            );
          }, 200);
        } else {
          document.getElementById('grid')!.innerHTML =
            '<div class="empty"><p style="color:#ff4444">Firebase Free tier: daily quota exceeded — try again tomorrow :)</p></div>';
        }
        return;
      }
      if (MOCK_CANS.length) {
        showDemo(rbtn);
        setTimeout(function () {
          toast('Preview mode — mock data');
        }, 200);
        return;
      }
      document.getElementById('grid')!.innerHTML =
        '<div class="empty"><p style="color:#ff4444">Server error: ' +
        esc(e.message) +
        '</p></div>';
      if (rbtn) {
        (rbtn as HTMLButtonElement).disabled = false;
        rbtn.innerHTML = REFRESH_BTN_HTML;
      }
    });
}

// ── BOOT ──────────────────────────────────────────────
export function boot(): void {
  // migrate legacy localStorage token
  const legacyToken = localStorage.getItem(JWT_KEY);
  if (legacyToken) localStorage.removeItem(JWT_KEY);

  // try to recover session from refresh cookie — but never override an explicit
  // "Continue as guest" choice (guestChosen) or a public share link (?public=1).
  const isShareLink = new URLSearchParams(window.location.search).get('public') === '1';
  _tryRefresh().then(function (ok) {
    if (ok && !state.guestChosen && !isShareLink) {
      state.isAdmin = true;
      (window as any).restoreAdminMode();
      applyAuthUI();
      // returning admin: dismiss the landing if still up
      const landEl = document.getElementById('landing-overlay') as HTMLElement | null;
      if (landEl && landEl.style.display !== 'none') landEl.style.display = 'none';
      if (!state.cans.length) loadFromServer();
    }
  });

  // public mode detection
  const params = new URLSearchParams(window.location.search);
  state.isPublicMode = params.get('public') === '1';
  state.deepLinkCanId = params.get('can') || null;

  if (state.lightTheme) document.body.classList.add('light');

  if (state.isPublicMode) {
    document.body.classList.add('public-mode');
    (document.getElementById('public-banner') as HTMLElement).style.display = 'flex';
    const owner = params.get('name') || 'a collector';
    const ownerName = decodeURIComponent(owner);
    document.getElementById('public-owner-name')!.textContent = ownerName;
    document.title = ownerName + "'s Collection — Monster Vault";
    document
      .querySelector('meta[property="og:title"]')!
      .setAttribute('content', ownerName + "'s Collection — Monster Vault");
    document
      .querySelector('meta[property="og:description"]')!
      .setAttribute('content', 'Explore ' + ownerName + "'s Monster Energy can collection.");
    const sortSel = document.getElementById('sort-select') as HTMLSelectElement;
    ['valore-desc', 'valore-asc'].forEach(function (v) {
      const opt = sortSel.querySelector('option[value="' + v + '"]');
      if (opt) opt.remove();
    });
  }

  // Landing -- only on first visit of the tab. On same-tab reload we default to
  // guest UI but pass explicit=false so a valid admin cookie can still recover.
  if (!state.isPublicMode && sessionStorage.getItem('mv_session_started')) {
    (document.getElementById('landing-overlay') as HTMLElement).style.display = 'none';
    continueAsGuest(false);
  } else {
    (document.getElementById('landing-overlay') as HTMLElement).style.display = 'flex';
    if (!state.isPublicMode) sessionStorage.setItem('mv_session_started', '1');
  }

  // price toggle
  const sw = document.getElementById('price-sw')!;
  if (state.showPrice) sw.classList.add('on');
  document.getElementById('price-label')!.addEventListener('click', function () {
    state.showPrice = !state.showPrice;
    localStorage.setItem('mv_showprice', JSON.stringify(state.showPrice));
    sw.classList.toggle('on', state.showPrice);
    (window as any).refreshPrices();
  });

  // lightbox
  document.getElementById('lb-close')!.onclick = (window as any).closeLightbox;
  (document.getElementById('lb-edit-btn') as HTMLElement).onclick = function () {
    (window as any).closeLightbox();
    openEdit(state.lbCanId!);
  };
  (document.getElementById('lb-detail-btn') as HTMLElement).onclick = function () {
    const id = state.lbCanId;
    (window as any).closeLightbox();
    openDetail(id!);
  };
  document.getElementById('lightbox')!.addEventListener('click', function (e) {
    if (e.target === document.getElementById('lightbox')) (window as any).closeLightbox();
  });

  // swipe touch for detail panel navigation
  (function () {
    const dpEl = document.getElementById('detail-panel')!;
    let tx = 0,
      ty = 0;
    dpEl.addEventListener(
      'touchstart',
      function (e) {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
      },
      { passive: true },
    );
    dpEl.addEventListener(
      'touchend',
      function (e) {
        const dx = e.changedTouches[0].clientX - tx;
        const dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
        detailNav(dx < 0 ? 1 : -1);
      },
      { passive: true },
    );
  })();

  // swipe touch for lightbox photo navigation
  (function () {
    const lbEl = document.getElementById('lightbox')!;
    let tx = 0;
    lbEl.addEventListener(
      'touchstart',
      function (e) {
        tx = e.touches[0].clientX;
      },
      { passive: true },
    );
    lbEl.addEventListener(
      'touchend',
      function (e) {
        if (state.lbZoom.scale > 1.05 || e.changedTouches.length > 1) return;
        const dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) < 40) return;
        const can = state.cans.find(function (c) {
          return c.id === state.lbCanId;
        });
        if (!can) return;
        const photos = [1, 2, 3, 4].filter(function (n) {
          return (can as any)['p' + n];
        });
        if (photos.length < 2) return;
        const ci = photos.indexOf(state.lbSlot);
        if (dx < 0) (window as any).setLbPhoto(can, photos[(ci + 1) % photos.length]);
        else (window as any).setLbPhoto(can, photos[(ci - 1 + photos.length) % photos.length]);
      },
      { passive: true },
    );

    // Zoom/pan for lightbox image
    (function () {
      const img = document.getElementById('lb-img')!;
      let startDist = 0,
        startScale = 1,
        panning = false,
        px = 0,
        py = 0,
        sx = 0,
        sy = 0;
      function clamp(v: number, a: number, b: number) {
        return Math.max(a, Math.min(b, v));
      }
      function dist(t: TouchList) {
        return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      }
      img.addEventListener(
        'touchstart',
        function (e) {
          if (e.touches.length === 2) {
            startDist = dist(e.touches);
            startScale = state.lbZoom.scale;
            e.preventDefault();
          } else if (e.touches.length === 1 && state.lbZoom.scale > 1) {
            panning = true;
            px = e.touches[0].clientX;
            py = e.touches[0].clientY;
            sx = state.lbZoom.x;
            sy = state.lbZoom.y;
          }
        },
        { passive: false },
      );
      img.addEventListener(
        'touchmove',
        function (e) {
          if (e.touches.length === 2 && startDist) {
            state.lbZoom.scale = clamp(startScale * (dist(e.touches) / startDist), 1, 4);
            (window as any).lbApplyZoom();
            e.preventDefault();
          } else if (panning && e.touches.length === 1) {
            state.lbZoom.x = sx + (e.touches[0].clientX - px);
            state.lbZoom.y = sy + (e.touches[0].clientY - py);
            (window as any).lbApplyZoom();
            e.preventDefault();
          }
        },
        { passive: false },
      );
      img.addEventListener('touchend', function () {
        panning = false;
        startDist = 0;
        if (state.lbZoom.scale <= 1.05) (window as any).lbResetZoom();
      });
      img.addEventListener('dblclick', function () {
        if (state.lbZoom.scale > 1) (window as any).lbResetZoom();
        else {
          state.lbZoom.scale = 2.5;
          (window as any).lbApplyZoom();
        }
      });
      img.addEventListener(
        'wheel',
        function (e) {
          e.preventDefault();
          state.lbZoom.scale = clamp(state.lbZoom.scale - (e.deltaY > 0 ? 0.3 : -0.3), 1, 4);
          if (state.lbZoom.scale <= 1.05) (window as any).lbResetZoom();
          else (window as any).lbApplyZoom();
        },
        { passive: false },
      );
      let md = false,
        mx = 0,
        my = 0,
        msx = 0,
        msy = 0;
      img.addEventListener('mousedown', function (e) {
        if (state.lbZoom.scale > 1) {
          md = true;
          mx = e.clientX;
          my = e.clientY;
          msx = state.lbZoom.x;
          msy = state.lbZoom.y;
          e.preventDefault();
        }
      });
      window.addEventListener('mousemove', function (e) {
        if (md) {
          state.lbZoom.x = msx + (e.clientX - mx);
          state.lbZoom.y = msy + (e.clientY - my);
          (window as any).lbApplyZoom();
        }
      });
      window.addEventListener('mouseup', function () {
        md = false;
      });
    })();
  })();

  // Global keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t as any).isContentEditable)
      return;
    if (
      document.querySelector(
        '.modal-backdrop.open, #detail-panel.open, #compare-panel.open, #calc-panel.open, #lightbox.open',
      )
    )
      return;
    if (e.key === '/') {
      const s = document.getElementById('search-input');
      if (s && (s as any).offsetParent !== null) {
        e.preventDefault();
        s.focus();
      }
    } else if (e.key === 'g' || e.key === 'G') {
      setView(
        state.currentView === 'grid' ? 'list' : state.currentView === 'list' ? 'wall' : 'grid',
      );
    } else if ((e.key === 'n' || e.key === 'N') && state.isAdmin) {
      openAddModal();
    } else if (e.key === '?') {
      (window as any).openHelpModal();
    }
  });

  // Keyboard overlay priority handling
  document.addEventListener('keydown', function (e) {
    // 1) Lightbox (highest z)
    if (document.getElementById('lightbox')!.classList.contains('open')) {
      if (e.key === 'Escape') {
        (window as any).closeLightbox();
      } else if (e.key === 'd' || e.key === 'D') {
        const id = state.lbCanId;
        (window as any).closeLightbox();
        openDetail(id!);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const can = state.cans.find(function (c) {
          return c.id === state.lbCanId;
        });
        if (can) {
          const photos = [1, 2, 3, 4].filter(function (n) {
            return (can as any)['p' + n];
          });
          const ci = photos.indexOf(state.lbSlot);
          if (e.key === 'ArrowRight')
            (window as any).setLbPhoto(can, photos[(ci + 1) % photos.length]);
          else (window as any).setLbPhoto(can, photos[(ci - 1 + photos.length) % photos.length]);
        }
      }
      return;
    }
    // 2) Modal open
    const mb = document.querySelector('.modal-backdrop.open') as HTMLElement | null;
    if (mb) {
      if (e.key === 'Escape') closeModal(mb.id);
      return;
    }
    // 2.5) Calculator
    if (document.getElementById('calc-panel')!.classList.contains('open')) {
      if (e.key === 'Escape') (window as any).closeCalc();
      return;
    }
    // 3) Compare panel
    if (document.getElementById('compare-panel')!.classList.contains('open')) {
      if (e.key === 'Escape') closeComparePanel();
      return;
    }
    // 4) Detail panel
    if (document.getElementById('detail-panel')!.classList.contains('open')) {
      if (e.key === 'Escape') closeDetail();
      else if (e.key === 'ArrowRight') detailNav(1);
      else if (e.key === 'ArrowLeft') detailNav(-1);
      return;
    }
  });

  document.getElementById('detail-back')!.onclick = closeDetail;
  document.querySelectorAll('.modal-backdrop').forEach(function (b) {
    b.addEventListener('click', function (e) {
      if (e.target === b) (b as HTMLElement).classList.remove('open');
    });
  });

  // Focus-trap + a11y keyboard for overlay modals
  (function () {
    const TRAP =
      '#stats-modal,#share-modal,#help-modal,#export-modal,#import-modal,#edit-modal,#detail-panel,#compare-panel,#lightbox';
    const FOCUSABLE =
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    let trigger: HTMLElement | null = null;
    function topOverlay(): HTMLElement | null {
      const open = [].slice.call(document.querySelectorAll(TRAP)).filter(function (
        el: HTMLElement,
      ) {
        return el.classList.contains('open');
      }) as HTMLElement[];
      return open.length ? open[open.length - 1] : null;
    }
    function focusable(c: HTMLElement): HTMLElement[] {
      return [].slice.call(c.querySelectorAll(FOCUSABLE)).filter(function (el: HTMLElement) {
        return (el as any).offsetParent !== null;
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      const ov = topOverlay();
      if (!ov) return;
      const f = focusable(ov);
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const first = f[0],
        last = f[f.length - 1],
        a = document.activeElement;
      if (e.shiftKey && (a === first || !ov.contains(a as Node))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (a === last || !ov.contains(a as Node))) {
        e.preventDefault();
        first.focus();
      }
    });
    const obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        const el = m.target as HTMLElement;
        if (!el.matches || !el.matches(TRAP)) return;
        const isOpen = el.classList.contains('open');
        if (isOpen && !(el as any)._trap) {
          (el as any)._trap = true;
          trigger = document.activeElement as HTMLElement;
          const f = focusable(el);
          if (f.length)
            setTimeout(function () {
              const t = el.querySelector('.modal-close,.detail-back') as HTMLElement | null;
              (t || f[0]).focus();
            }, 40);
        } else if (!isOpen && (el as any)._trap) {
          (el as any)._trap = false;
          if (trigger && trigger.focus) {
            try {
              trigger.focus();
            } catch (_) {
              /* ignore */
            }
            trigger = null;
          }
        }
      });
    });
    [].slice.call(document.querySelectorAll(TRAP)).forEach(function (el: HTMLElement) {
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  })();

  // Auth on boot
  if (state.isAdmin) {
    (window as any).restoreAdminMode();
    const landEl = document.getElementById('landing-overlay');
    if (landEl && landEl.style.display !== 'none') {
      (landEl as HTMLElement).style.opacity = '0';
      (landEl as HTMLElement).style.transform = 'scale(1.04)';
      setTimeout(function () {
        (landEl as HTMLElement).style.display = 'none';
      }, 380);
    }
    (document.getElementById('auth-overlay') as HTMLElement).style.display = 'none';
  } else if (!state.isPublicMode) {
    (document.getElementById('auth-overlay') as HTMLElement).style.display = 'none';
  }

  applyAuthUI();
  if (!state.cans.length) loadFromServer();
}
