// ── Monster Vault — Share module ───────────────────────────────────────────
// Share links, QR code, filtered-view sharing, landing overlay.

import type { Can } from './types';
import { OWNER_NAME, state, toast } from './core';

// ── HELP MODAL ─────────────────────────────────────────

export function openHelpModal(): void {
  const admin = state.isAdmin && !state.isPublicMode;
  document.getElementById('help-modal-title')!.textContent = admin ? 'Admin Guide' : 'How to use';
  document.getElementById('help-admin-content')!.style.display = admin ? 'flex' : 'none';
  document.getElementById('help-guest-content')!.style.display = admin ? 'none' : 'flex';
  document.getElementById('help-modal')!.classList.add('open');
}

// ── SHARE MODAL ────────────────────────────────────────

export function openShareModal(): void {
  (document.getElementById('share-name-input') as HTMLInputElement).value =
    localStorage.getItem('mv_share_name') || '';
  updateShareUrl();
  document.getElementById('share-modal')!.classList.add('open');
}

export function updateShareUrl(): void {
  const name = (document.getElementById('share-name-input') as HTMLInputElement).value.trim();
  localStorage.setItem('mv_share_name', name);
  const base = window.location.href.split('?')[0];
  const url = name ? base + '?public=1&name=' + encodeURIComponent(name) : '';
  (document.getElementById('share-url-display') as HTMLInputElement).value =
    url || '— enter your name above —';
  renderShareQR(url);
}

/** Generate a QR code SVG for the public link (client-side, CSP-safe). */
function renderShareQR(url: string): void {
  const box = document.getElementById('share-qr');
  if (!box) return;
  if (!url || typeof (window as any).qrcode === 'undefined') {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  try {
    const qr = (window as any).qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    const svg = box.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.cssText =
        'width:164px;height:164px;background:#fff;padding:10px;border-radius:10px';
    }
    box.style.display = 'block';
  } catch (_e) {
    box.style.display = 'none';
    box.innerHTML = '';
  }
}

export function copyShareUrl(): void {
  const url = (document.getElementById('share-url-display') as HTMLInputElement).value;
  if (!url || url.startsWith('—')) return;
  navigator.clipboard
    .writeText(url)
    .then(() => {
      toast('Link copied ✓');
      (window as any).closeModal('share-modal');
    })
    .catch(() => {
      (document.getElementById('share-url-display') as HTMLInputElement).select();
    });
}

export function copyToClipboard(text: string, cb?: () => void): void {
  function fallback(): void {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    if (cb) cb();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        if (cb) cb();
      })
      .catch(fallback);
  } else {
    fallback();
  }
}

// ── SHARE SHEET (detail view) ──────────────────────────

export function toggleShareSheet(): void {
  if (state.isPublicMode) return;
  const sheet = document.getElementById('share-sheet');
  if (!sheet) return;
  const opening = !sheet.classList.contains('open');
  sheet.classList.toggle('open', opening);
  if (opening) {
    function closeOnOutside(e: Event): void {
      const wrap = document.getElementById('detail-share-wrap');
      if (!wrap || !wrap.contains(e.target as Node)) {
        sheet!.classList.remove('open');
        document.removeEventListener('click', closeOnOutside, true);
      }
    }
    setTimeout(() => {
      document.addEventListener('click', closeOnOutside, true);
    }, 10);
  }
}

export function shareCanLink(mode: string): void {
  if (state.isPublicMode) return;
  const sheet = document.getElementById('share-sheet');
  if (sheet) sheet.classList.remove('open');
  const id = state.detailCurrentId;
  if (!id) return;
  const can = state.cans.find((c: Can) => c.id === id);
  if (!can) return;
  const base = window.location.href.split('?')[0];
  const name = OWNER_NAME;
  const url = base + '?public=1&can=' + encodeURIComponent(id);

  if (mode === 'link') {
    copyToClipboard(url, () => {
      toast('🔗 Link copied ✓');
    });
    return;
  }

  const isFull = can.note && can.note.toUpperCase().includes('FULL');
  const parts: string[] = [];
  if (can.nome) parts.push(can.nome);
  if (can.lingua) parts.push(can.lingua);
  if (can.size) parts.push(can.size);
  if (can.sku) parts.push('SKU: ' + can.sku);
  if (isFull) parts.push('FULL');

  if (mode === 'text') {
    parts.push(url);
    copyToClipboard(parts.join(' · '), () => {
      toast('📋 Text copied ✓');
    });
    return;
  }

  if (mode === 'wa') {
    const waParts: string[] = [];
    if (can.nome) waParts.push('*' + can.nome + '*');
    if (can.lingua) waParts.push(can.lingua);
    if (can.size) waParts.push(can.size);
    if (can.sku) waParts.push('SKU: ' + can.sku);
    if (isFull) waParts.push('✅ FULL');
    waParts.push(url);
    window.open('https://wa.me/?text=' + encodeURIComponent(waParts.join(' · ')), '_blank');
    return;
  }

  if (mode === 'tg') {
    const tgTitle = (can.nome || 'Monster Vault') + ' — ' + name + "'s collection";
    window.open(
      'https://t.me/share/url?url=' +
        encodeURIComponent(url) +
        '&text=' +
        encodeURIComponent(tgTitle),
      '_blank',
    );
    return;
  }
}

export function shareFilteredView(): void {
  if (state.isPublicMode) return;
  const base = window.location.href.split('?')[0];
  const p = new URLSearchParams();
  p.set('public', '1');
  const q = (document.getElementById('search-input') as HTMLInputElement).value;
  const lng = (document.getElementById('fl-lingua') as HTMLSelectElement).value;
  const sz = (document.getElementById('fl-size') as HTMLSelectElement).value;
  const prod = (document.getElementById('fl-produttore') as HTMLSelectElement).value;
  const top = (document.getElementById('fl-top') as HTMLSelectElement).value;
  const vminEl = document.getElementById('fl-vmin') as HTMLInputElement | null;
  const vmaxEl = document.getElementById('fl-vmax') as HTMLInputElement | null;
  const vmin = vminEl ? vminEl.value : '';
  const vmax = vmaxEl ? vmaxEl.value : '';
  if (q) p.set('fq', q);
  if (lng) p.set('fl', lng);
  if (sz) p.set('fs', sz);
  if (prod) p.set('fp', prod);
  if (top) p.set('ft', top);
  const activeChipKeys = Object.keys(state.activeChips).filter(
    (k) => (state.activeChips as any)[k],
  );
  if (activeChipKeys.length) p.set('fc', activeChipKeys.join(','));
  if (vmin) p.set('fvmin', vmin);
  if (vmax) p.set('fvmax', vmax);
  copyToClipboard(base + '?' + p.toString(), () => {
    toast('🔗 View link copied ✓');
  });
}

export function applyPublicFilters(): void {
  const params = new URLSearchParams(window.location.search);
  const fq = params.get('fq');
  const fl = params.get('fl');
  const fs = params.get('fs');
  const fp = params.get('fp');
  const ft = params.get('ft');
  const fc = params.get('fc');
  const fvmin = params.get('fvmin');
  const fvmax = params.get('fvmax');
  const any = fq || fl || fs || fp || ft || fc || fvmin || fvmax;
  if (!any) return;

  function setSelect(id: string, val: string | null): void {
    if (!val) return;
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (!el) return;
    for (let i = 0; i < el.options.length; i++) {
      if (el.options[i].value === val) {
        el.value = val;
        return;
      }
    }
  }

  if (fq) (document.getElementById('search-input') as HTMLInputElement).value = fq;
  setSelect('fl-lingua', fl);
  setSelect('fl-size', fs);
  setSelect('fl-produttore', fp);
  setSelect('fl-top', ft);
  if (fc) {
    fc.split(',').forEach((k) => {
      if (state.activeChips.hasOwnProperty(k)) {
        (state.activeChips as any)[k] = true;
        const ch = document.getElementById('chip-' + k);
        if (ch) ch.classList.add('active');
      }
    });
  }
  const vminEl = document.getElementById('fl-vmin') as HTMLInputElement | null;
  const vmaxEl = document.getElementById('fl-vmax') as HTMLInputElement | null;
  if (fvmin && vminEl) vminEl.value = fvmin;
  if (fvmax && vmaxEl) vmaxEl.value = fvmax;
  (window as any).applyFilters();
}

// ── LANDING ────────────────────────────────────────────

/** Activates the password field and shows the auth overlay. */
export function openAuthOverlay(): void {
  const p = document.getElementById('auth-password') as HTMLInputElement | null;
  if (p) {
    p.type = 'password';
    p.setAttribute('autocomplete', 'current-password');
  }
  document.getElementById('auth-overlay')!.style.display = 'flex';
}

export function closeLanding(photoFilter?: boolean, adminLogin?: boolean): void {
  if (!state.isAdmin) (window as any).continueAsGuest();
  const el = document.getElementById('landing-overlay')!;
  el.style.opacity = '0';
  el.style.transform = 'scale(1.04)';
  setTimeout(() => {
    el.style.display = 'none';
    if (adminLogin) openAuthOverlay();
  }, 380);
  if (photoFilter)
    setTimeout(() => {
      (window as any).toggleChip('confoto');
    }, 420);
}

export function restoreAdminMode(): void {
  state.isPublicMode = false;
  document.body.classList.remove('public-mode');
  const sortSel = document.getElementById('sort-select') as HTMLSelectElement;
  if (!sortSel.querySelector('option[value="valore-desc"]')) {
    const o1 = document.createElement('option');
    o1.value = 'valore-desc';
    o1.textContent = 'VALUE ↓';
    sortSel.appendChild(o1);
    const o2 = document.createElement('option');
    o2.value = 'valore-asc';
    o2.textContent = 'VALUE ↑';
    sortSel.appendChild(o2);
  }
}
