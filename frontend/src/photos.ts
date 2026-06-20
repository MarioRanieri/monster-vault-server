// ── Monster Vault — Photos module ──────────────────────────────────────────
// Lightbox, broken image handlers, photo editor, drag reorder, upload, slots.

import type { Can } from './types';
import { state, cloudinaryThumb, esc, toast, apiCall, getToken, API } from './core';

// ── LIGHTBOX ───────────────────────────────────────────

export function openLightbox(id: string): void {
  const can = state.cans.find((c: Can) => c.id === id);
  if (!can) return;
  const photos = ([1, 2, 3, 4] as const).filter((n) => can[('p' + n) as keyof Can]);
  if (!photos.length) {
    (window as any).openDetail(id);
    return;
  }
  state.lbCanId = id;
  state.lbSlot = photos[0];
  document.getElementById('lb-name')!.textContent = can.nome || '—';
  document.getElementById('lb-meta')!.textContent = [can.lingua, can.size, can.sku]
    .filter(Boolean)
    .join(' · ');
  setLbPhoto(can, photos[0]);
  buildLbThumbs(can);
  document.getElementById('lightbox')!.classList.add('open');
}

/** Apply current zoom/pan transform to lightbox image */
export function lbApplyZoom(): void {
  const img = document.getElementById('lb-img') as HTMLImageElement;
  img.style.transform =
    'translate(' +
    state.lbZoom.x +
    'px,' +
    state.lbZoom.y +
    'px) scale(' +
    state.lbZoom.scale +
    ')';
  img.style.cursor = state.lbZoom.scale > 1 ? 'grab' : 'auto';
}

export function lbResetZoom(): void {
  state.lbZoom = { scale: 1, x: 0, y: 0 };
  lbApplyZoom();
}

export function setLbPhoto(can: Can, n: number): void {
  if (!can[('p' + n) as keyof Can]) return;
  state.lbSlot = n;
  lbResetZoom();
  const im = document.getElementById('lb-img') as HTMLImageElement;
  im.style.opacity = '1';
  im.src = cloudinaryThumb((can[('p' + n) as keyof Can] as string) || '', 1600, 1600) || '';
  document.querySelectorAll('.lb-thumb').forEach((t) => {
    t.classList.toggle('active', parseInt((t as HTMLElement).dataset.slot!) === n);
  });
}

function buildLbThumbs(can: Can): void {
  const wrap = document.getElementById('lb-thumbs')!;
  const photos = ([1, 2, 3, 4] as const).filter((n) => can[('p' + n) as keyof Can]);
  if (photos.length <= 1) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = photos
    .map(
      (n, i) =>
        '<img class="lb-thumb' +
        (i === 0 ? ' active' : '') +
        '" src="' +
        cloudinaryThumb(can[('p' + n) as keyof Can] as string, 128, 128) +
        '" data-slot="' +
        n +
        '" data-id="' +
        esc(can.id) +
        '" onclick="lbThumbClick(this)" onerror="this.style.display=\'none\'"/>',
    )
    .join('');
}

export function lbThumbClick(el: HTMLElement): void {
  const can = state.cans.find((c: Can) => c.id === el.dataset.id);
  if (can) setLbPhoto(can, parseInt(el.dataset.slot!));
}

export function closeLightbox(): void {
  document.getElementById('lightbox')!.classList.remove('open');
  state.lbCanId = null;
  lbResetZoom();
}

// ── BROKEN IMAGE HANDLERS ───────────────────────────────

/** Called from onerror on card img: hides the img and reveals the placeholder. */
export function imgErrCard(el: HTMLImageElement): void {
  const parent = el.parentNode as HTMLElement | null;
  const lqip = parent && parent.classList.contains('card-img-lqip') ? parent : null;
  if (lqip) {
    lqip.style.display = 'none';
    const ph = lqip.nextElementSibling as HTMLElement | null;
    if (ph && ph.classList.contains('card-img-placeholder')) ph.style.display = 'flex';
  } else {
    el.style.display = 'none';
    if (parent) {
      parent.style.filter = 'none';
      parent.style.backgroundImage = 'none';
    }
    const ph = el.nextElementSibling as HTMLElement | null;
    if (ph && ph.classList.contains('card-img-placeholder')) ph.style.display = 'flex';
  }
}

/** Called from onerror on detail main img: replaces with placeholder, hides "tap to zoom". */
export function imgErrMain(el: HTMLImageElement): void {
  el.style.display = 'none';
  const tap = el.nextElementSibling as HTMLElement | null;
  if (tap && tap.classList.contains('detail-tap-zoom')) tap.style.display = 'none';
  const ph = document.createElement('div');
  ph.className = 'detail-main-img-ph';
  ph.innerHTML =
    '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/>' +
    '<polyline points="21 15 16 10 5 21"/></svg>' +
    '<p style="font-size:11px;color:var(--text3);margin-top:8px">Photo not available</p>';
  el.parentNode!.insertBefore(ph, el);
}

// ── SCAN & FIX BROKEN PHOTOS (admin) ───────────────────

export async function cleanBrokenPhotos(): Promise<void> {
  const btn = document.getElementById('btn-clean') as HTMLButtonElement;
  const lbl = btn.querySelector('.btn-label') as HTMLElement;
  const cansWithPhotos = state.cans.filter((c: Can) => c.p1 || c.p2 || c.p3 || c.p4);
  if (!cansWithPhotos.length) {
    toast('No cans with photos to scan');
    return;
  }
  btn.disabled = true;
  lbl.textContent = 'Scanning…';

  function probe(url: string): Promise<boolean> {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        res(true);
      };
      img.onerror = () => {
        res(false);
      };
      img.src = cloudinaryThumb(url, 10, 10) || '';
      setTimeout(() => {
        res(false);
      }, 8000);
    });
  }

  const results = await Promise.all(
    cansWithPhotos.map(async (c: Can) => {
      const broken: number[] = [];
      for (let n = 1; n <= 4; n++) {
        if (c[('p' + n) as keyof Can] && !(await probe(c[('p' + n) as keyof Can] as string)))
          broken.push(n);
      }
      return { can: c, broken };
    }),
  );

  const toFix = results.filter((r) => r.broken.length);
  const totalBroken = toFix.reduce((s, r) => s + r.broken.length, 0);

  if (!toFix.length) {
    toast('✓ All ' + cansWithPhotos.length + ' photo URLs are valid');
    btn.disabled = false;
    lbl.textContent = 'Scan Photos';
    return;
  }
  if (
    !confirm(
      totalBroken +
        ' broken photo' +
        (totalBroken > 1 ? 's' : '') +
        ' found in ' +
        toFix.length +
        ' can' +
        (toFix.length > 1 ? 's' : '') +
        '.\nRemove broken URLs from the database?',
    )
  ) {
    btn.disabled = false;
    lbl.textContent = 'Scan Photos';
    return;
  }

  lbl.textContent = 'Fixing…';
  let fixed = 0;
  for (const r of toFix) {
    const updated: any = Object.assign({}, r.can);
    r.broken.forEach((n) => {
      updated['p' + n] = '';
      updated['p' + n + 'Id'] = '';
    });
    try {
      await apiCall('PUT', '/api/cans/' + r.can.id, updated);
      r.broken.forEach((n) => {
        (r.can as any)['p' + n] = '';
        (r.can as any)['p' + n + 'Id'] = '';
      });
      fixed++;
    } catch (e) {
      console.warn('cleanBrokenPhotos: failed for', r.can.id, e);
    }
  }
  toast(
    '✓ Removed ' +
      totalBroken +
      ' broken URL' +
      (totalBroken > 1 ? 's' : '') +
      ' from ' +
      fixed +
      ' can' +
      (fixed > 1 ? 's' : ''),
  );
  btn.disabled = false;
  lbl.textContent = 'Scan Photos';
  (window as any).applyFilters();
}

// ── PHOTO SLOTS ────────────────────────────────────────

export function triggerPhoto(n: number): void {
  document.getElementById('photo-in-' + n)!.click();
}

export function loadPhoto(e: Event, n: number): void {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) return;
  if (f.size > 10485760) {
    toast('File troppo grande (max 10 MB)', true);
    input.value = '';
    return;
  }
  readPhotoFile(f, n);
}

export function readPhotoFile(file: File, n: number): void {
  state.pendingFiles[n] = file;
  const reader = new FileReader();
  reader.onload = (ev: any) => {
    state.pendingURLs[n] = ev.target.result;
    setSlot(n, ev.target.result);
  };
  reader.readAsDataURL(file);
}

export function setSlot(n: number, url: string | null): void {
  const img = document.getElementById('prev-' + n) as HTMLImageElement;
  const ph = document.getElementById('ph-' + n) as HTMLElement;
  if (url) {
    img.src = url;
    img.style.display = 'block';
    ph.style.display = 'none';
  } else {
    img.style.display = 'none';
    img.src = '';
    ph.style.display = 'flex';
  }
}

export function clearPhoto(n: number): void {
  state.pendingFiles[n] = null;
  state.pendingURLs[n] = null;
  setSlot(n, null);
  (document.getElementById('photo-in-' + n) as HTMLInputElement).value = '';
}

// ── PHOTO EDITOR ───────────────────────────────────────
// Rotate/crop a slot's photo without re-taking it. Output becomes a File in
// pendingFiles[slot], uploaded by the normal Save flow.

interface PeState {
  slot: number;
  img: HTMLImageElement;
  rot: number;
  crop: { x: number; y: number; w: number; h: number } | null;
  sel: { x: number; y: number; w: number; h: number } | null;
  scale: number;
}

let peState: PeState | null = null;

export function editPhoto(n: number): void {
  const pending = state.pendingFiles[n] as any;
  const src =
    pending && !pending._externalUrl
      ? URL.createObjectURL(pending)
      : (pending && pending._externalUrl) || state.pendingURLs[n];
  if (!src) {
    toast('No photo in this slot', true);
    return;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    peState = { slot: n, img, rot: 0, crop: null, sel: null, scale: 1 };
    peDraw();
    document.getElementById('photoedit-modal')!.classList.add('open');
  };
  img.onerror = () => {
    toast('Cannot load this photo for editing', true);
  };
  img.src = src;
}

function peDims(): { w: number; h: number } {
  const i = peState!.img;
  return peState!.rot % 2
    ? { w: i.naturalHeight, h: i.naturalWidth }
    : { w: i.naturalWidth, h: i.naturalHeight };
}

export function peDraw(): void {
  const c = document.getElementById('pe-canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d')!;
  const d = peDims();
  const maxW = Math.min(660, window.innerWidth - 70);
  const maxH = Math.floor(window.innerHeight * 0.55);
  const s = Math.min(maxW / d.w, maxH / d.h, 1);
  peState!.scale = s;
  c.width = Math.max(1, Math.round(d.w * s));
  c.height = Math.max(1, Math.round(d.h * s));
  ctx.save();
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((peState!.rot * Math.PI) / 2);
  const dw = peState!.rot % 2 ? c.height : c.width;
  const dh = peState!.rot % 2 ? c.width : c.height;
  ctx.drawImage(peState!.img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  const sel = peState!.sel || peState!.crop;
  if (sel) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, c.width, sel.y * s);
    ctx.fillRect(0, (sel.y + sel.h) * s, c.width, c.height - (sel.y + sel.h) * s);
    ctx.fillRect(0, sel.y * s, sel.x * s, sel.h * s);
    ctx.fillRect((sel.x + sel.w) * s, sel.y * s, c.width - (sel.x + sel.w) * s, sel.h * s);
    ctx.strokeStyle = '#a8ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(sel.x * s, sel.y * s, sel.w * s, sel.h * s);
  }
}

export function peRotate(d: number): void {
  if (!peState) return;
  peState.rot = (peState.rot + d + 4) % 4;
  peState.crop = null;
  peState.sel = null;
  peDraw();
}

export function peReset(): void {
  if (!peState) return;
  peState.rot = 0;
  peState.crop = null;
  peState.sel = null;
  peDraw();
}

export function peCancel(): void {
  (window as any).closeModal('photoedit-modal');
  peState = null;
}

/** Attach crop-selection listeners (mouse + touch) to the photo editor canvas. */
export function initPhotoEditorListeners(): void {
  let dragging = false;
  let sx = 0;
  let sy = 0;

  function pos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const c = document.getElementById('pe-canvas') as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    const te = (e as TouchEvent).touches;
    const cx = te ? te[0].clientX : (e as MouseEvent).clientX;
    const cy = te ? te[0].clientY : (e as MouseEvent).clientY;
    const d = peDims();
    return {
      x: Math.max(0, Math.min(d.w, (cx - r.left) / peState!.scale)),
      y: Math.max(0, Math.min(d.h, (cy - r.top) / peState!.scale)),
    };
  }

  function down(e: MouseEvent | TouchEvent): void {
    if (!peState) return;
    dragging = true;
    const p = pos(e);
    sx = p.x;
    sy = p.y;
    peState.sel = { x: sx, y: sy, w: 0, h: 0 };
    e.preventDefault();
  }

  function move(e: MouseEvent | TouchEvent): void {
    if (!dragging || !peState) return;
    const p = pos(e);
    peState.sel = {
      x: Math.min(sx, p.x),
      y: Math.min(sy, p.y),
      w: Math.abs(p.x - sx),
      h: Math.abs(p.y - sy),
    };
    peDraw();
    e.preventDefault();
  }

  function up(): void {
    if (!dragging || !peState) return;
    dragging = false;
    if (peState.sel && peState.sel.w > 15 && peState.sel.h > 15) {
      peState.crop = peState.sel;
    }
    peState.sel = null;
    peDraw();
  }

  const cv = document.getElementById('pe-canvas');
  if (cv) {
    cv.addEventListener('mousedown', down as EventListener);
    document.addEventListener('mousemove', move as EventListener);
    document.addEventListener('mouseup', up);
    cv.addEventListener('touchstart', down as EventListener, { passive: false });
    cv.addEventListener('touchmove', move as EventListener, { passive: false });
    cv.addEventListener('touchend', up);
  }
}

export function peApply(): void {
  if (!peState) return;
  const d = peDims();
  const crop = peState.crop || { x: 0, y: 0, w: d.w, h: d.h };
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(crop.w));
  out.height = Math.max(1, Math.round(crop.h));
  const ctx = out.getContext('2d')!;
  ctx.translate(-crop.x, -crop.y);
  ctx.translate(d.w / 2, d.h / 2);
  ctx.rotate((peState.rot * Math.PI) / 2);
  const dw = peState.rot % 2 ? d.h : d.w;
  const dh = peState.rot % 2 ? d.w : d.h;
  ctx.drawImage(peState.img, -dw / 2, -dh / 2, dw, dh);
  try {
    out.toBlob(
      (blob) => {
        if (!blob) {
          toast('Cannot edit this photo (external image without CORS)', true);
          return;
        }
        const n = peState!.slot;
        state.pendingFiles[n] = new File([blob], 'edited_' + Date.now() + '.jpg', {
          type: 'image/jpeg',
        });
        state.pendingURLs[n] = null;
        setSlot(n, URL.createObjectURL(blob));
        (window as any).closeModal('photoedit-modal');
        peState = null;
        toast('Photo edited &#10003; — press Save to upload');
      },
      'image/jpeg',
      0.92,
    );
  } catch (_err) {
    toast('Cannot edit this photo (CORS)', true);
  }
}

export function pasteUrl(n: number): void {
  let url = prompt('Paste the image URL (from Cloudinary or any site):');
  if (!url || !url.trim()) return;
  url = url.trim();
  if (!url.startsWith('http')) {
    toast('Invalid URL', true);
    return;
  }
  const isCloudinary = url.indexOf('cloudinary.com') !== -1;
  state.pendingFiles[n] = isCloudinary ? null : ({ _externalUrl: url } as any);
  state.pendingURLs[n] = url;
  setSlot(n, url);
  toast(
    'Photo ' +
      (isCloudinary ? 'linked from Cloudinary ✓' : 'will be uploaded to Cloudinary on save ✓'),
  );
}

// ── PHOTO DRAG REORDER ─────────────────────────────────

export function slotDragStart(e: DragEvent, n: number): void {
  if (!state.pendingURLs[n]) {
    e.preventDefault();
    return;
  }
  state.dragSrcSlot = n;
  document.getElementById('slot-' + n)!.classList.add('dragging-slot');
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', String(n));
}

export function slotDragEnd(_e: DragEvent): void {
  [1, 2, 3, 4].forEach((n) => {
    const el = document.getElementById('slot-' + n);
    if (el) el.classList.remove('dragging-slot', 'drag-over-slot');
  });
  state.dragSrcSlot = null;
}

export function slotDragOver(e: DragEvent, n: number): void {
  if (state.dragSrcSlot === null) {
    e.preventDefault();
    return;
  }
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  if (n !== state.dragSrcSlot) {
    document.getElementById('slot-' + n)!.classList.add('drag-over-slot');
  }
}

export function slotDragLeave(_e: DragEvent, n: number): void {
  document.getElementById('slot-' + n)!.classList.remove('drag-over-slot');
}

export function slotDrop(e: DragEvent, n: number): void {
  e.preventDefault();
  document.getElementById('slot-' + n)!.classList.remove('drag-over-slot');

  // Internal slot reorder
  if (state.dragSrcSlot !== null) {
    if (state.dragSrcSlot === n) return;
    const srcN = state.dragSrcSlot;
    const tmpFile = state.pendingFiles[srcN];
    const tmpURL = state.pendingURLs[srcN];
    state.pendingFiles[srcN] = state.pendingFiles[n];
    state.pendingURLs[srcN] = state.pendingURLs[n];
    state.pendingFiles[n] = tmpFile;
    state.pendingURLs[n] = tmpURL;
    setSlot(srcN, state.pendingURLs[srcN] || null);
    setSlot(n, state.pendingURLs[n] || null);
    state.dragSrcSlot = null;
    return;
  }

  // Local file drop
  const files = e.dataTransfer!.files;
  if (files && files.length > 0 && files[0].type.startsWith('image/')) {
    readPhotoFile(files[0], n);
    return;
  }

  // External URL drop
  let url = e.dataTransfer!.getData('text/uri-list') || e.dataTransfer!.getData('text/plain');
  if (!url) {
    const html = e.dataTransfer!.getData('text/html');
    if (html) {
      const match = html.match(/src=["']([^"']+)["']/i);
      if (match && match[1] && match[1].startsWith('http')) url = match[1];
    }
  }
  if (url && url.startsWith('http')) {
    const isC = url.indexOf('cloudinary.com') !== -1;
    state.pendingFiles[n] = isC ? null : ({ _externalUrl: url } as any);
    state.pendingURLs[n] = url;
    setSlot(n, url);
    toast('Photo ' + (isC ? 'linked from Cloudinary ✓' : 'will be uploaded to Cloudinary ✓'));
    return;
  }
  toast('Format not supported', true);
}

// ── UPLOAD ─────────────────────────────────────────────

export function uploadNext(
  p: Record<string, string>,
  slots: number[],
  canId: string,
  btn: HTMLElement,
  done: () => void,
): void {
  if (!slots.length) {
    done();
    return;
  }
  const n = slots[0];
  const rest = slots.slice(1);
  if (!state.pendingFiles[n]) {
    p[n] = state.pendingURLs[n] || '';
    uploadNext(p, rest, canId, btn, done);
    return;
  }
  const pending = state.pendingFiles[n] as any;
  if (pending._externalUrl) {
    btn.textContent = 'Uploading photo ' + n + ' to server...';
    uploadCloudFromUrl(pending._externalUrl, canId, n)
      .then((url: string) => {
        p[n] = url;
        uploadNext(p, rest, canId, btn, done);
      })
      .catch(() => {
        toast('Photo ' + n + ': URL upload failed — saved as external link', true);
        p[n] = pending._externalUrl;
        uploadNext(p, rest, canId, btn, done);
      });
    return;
  }
  btn.textContent = 'Compressing photo ' + n + '...';
  compressImage(state.pendingFiles[n] as File).then((compressed: File) => {
    btn.textContent = 'Uploading photo ' + n + '...';
    uploadCloud(compressed, canId, n)
      .then((url: string) => {
        p[n] = url;
        uploadNext(p, rest, canId, btn, done);
      })
      .catch((e: Error) => {
        toast('Photo ' + n + ' upload failed: ' + e.message, true);
        p[n] = '';
        uploadNext(p, rest, canId, btn, done);
      });
  });
}

export function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size < 400000) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1800;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        } else {
          w = Math.round((w * MAX) / h);
          h = MAX;
        }
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      c.toBlob(
        (blob) => {
          resolve(new File([blob!], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export function uploadCloud(file: File, canId: string, slot: number): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const h: Record<string, string> = {};
  const t = getToken();
  if (t) h['Authorization'] = 'Bearer ' + t;
  return fetch(API + '/api/cans/' + canId + '/photo/' + slot, {
    method: 'POST',
    headers: h,
    body: fd,
  })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((d: any) => d.url);
}

export function uploadCloudFromUrl(
  externalUrl: string,
  canId: string,
  slot: number,
): Promise<string> {
  return apiCall('POST', '/api/cans/' + canId + '/photo/' + slot + '/from-url', {
    url: externalUrl,
  }).then((d: any) => d.url);
}
