import { useRef, useState } from 'react';
import type { Can } from './types';
import { PhotoCrop } from './PhotoCrop';
import { cloudinaryThumb } from './cloudinary';
import { colorizeTab } from './colorizeTab';

// Le scelte di "Opening" (gruppo di pill mutuamente esclusive, come il vecchio).
const OPENING = [
  'TOP OPENED',
  'BOTTOM OPENED',
  'FULL',
  'PLASTIC FULL',
  'PLASTIC EMPTY',
  'GLASS FULL',
  'GLASS EMPTY',
];

// Uno slot foto: file nuovo (staged), URL nuovo, foto esistente da tenere, o vuoto.
// Anteprima di uno slot foto: URL Cloudinary (esistente), URL esterno, o file staged.
function slotSrc(s: Slot): string | null {
  if (!s) return null;
  if (s.kind === 'keep') return cloudinaryThumb(s.url, 400, 400);
  if (s.kind === 'url') return s.url;
  return s.preview;
}

// Sorgente per il CROP: versione grande per le foto già su Cloudinary (kind:'keep').
function cropSource(s: Exclude<Slot, null>): string {
  if (s.kind === 'file') return s.preview;
  if (s.kind === 'url') return s.url;
  return cloudinaryThumb(s.url, 1600, 1600);
}

type Slot =
  | { kind: 'file'; file: File; preview: string }
  | { kind: 'url'; url: string }
  | { kind: 'keep'; url: string }
  | null;

export interface Upload {
  slot: number;
  file?: File;
  url?: string;
}

export interface Suggestions {
  manufacturers?: string[];
  sizes?: string[];
  countries?: string[];
  tops?: string[];
  conditions?: string[];
}

// Modale di modifica/creazione (classi .modal/.photo-grid/.field-grid del vecchio).
// Le foto sono "staged": si scelgono qui e vengono caricate dopo il salvataggio
// (così funziona anche creando una can nuova, che ancora non ha un id sul server).
export function CanEditForm({
  can,
  title = 'Edit Can',
  suggestions,
  onSave,
  onCancel,
  onDelete,
}: Readonly<{
  can: Can;
  title?: string;
  suggestions?: Suggestions;
  onSave: (can: Can, uploads: Upload[]) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}>) {
  const [nome, setNome] = useState(can.nome);
  const [sku, setSku] = useState(can.sku ?? '');
  const [produttore, setProduttore] = useState(can.produttore ?? '');
  const [size, setSize] = useState(can.size ?? '');
  const [lingua, setLingua] = useState(can.lingua ?? '');
  const [top, setTop] = useState(can.top ?? '');
  const [promo, setPromo] = useState(can.promo ?? '');
  const [valore, setValore] = useState(can.valore ?? '');
  const [stato, setStato] = useState(can.stato ?? '');
  const [note, setNote] = useState(can.note ?? '');
  const [descrizione, setDescrizione] = useState(can.descrizione ?? '');
  const [pending, setPending] = useState<Slot[]>(() =>
    [can.p1, can.p2, can.p3, can.p4].map<Slot>((u) => (u ? { kind: 'keep', url: u } : null)),
  );
  const [cropTarget, setCropTarget] = useState<{ idx: number; src: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Riordino: sorgente del tap-swap (⇄) e feedback visivo del drag&drop.
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setSlot = (i: number, s: Slot) => setPending((p) => p.map((x, j) => (j === i ? s : x)));
  // Scambio di due slot: solo staging, nessun upload coinvolto.
  const swap = (i: number, j: number) => {
    if (i !== j)
      setPending((p) => {
        const q = [...p];
        [q[i], q[j]] = [q[j], q[i]];
        return q;
      });
    setSwapFrom(null);
  };
  // Click sullo slot: destinazione dello swap se ⇄ è attivo, altrimenti file
  // picker (su slot pieno = sostituzione, come il vecchio; il crop è su ✏️).
  const slotClick = (i: number) => {
    if (swapFrom != null) swap(swapFrom, i);
    else fileRefs.current[i]?.click();
  };

  // Async con stato `saving`: durante il salvataggio (PUT + upload foto, lento su
  // mobile) Save/Cancel sono disabilitati — niente UI congelata né doppio invio.
  const save = async () => {
    if (saving) return;
    if (!nome.trim() || !sku.trim()) {
      setInvalid(true);
      return;
    }
    const canData: Can = {
      ...can,
      nome,
      sku,
      produttore,
      size,
      lingua,
      top,
      promo,
      valore,
      stato,
      note,
      descrizione,
    };
    const uploads: Upload[] = [];
    pending.forEach((s, i) => {
      const key = `p${i + 1}` as 'p1' | 'p2' | 'p3' | 'p4';
      if (!s) canData[key] = '';
      else if (s.kind === 'keep') canData[key] = s.url;
      else {
        canData[key] = '';
        uploads.push(
          s.kind === 'file' ? { slot: i + 1, file: s.file } : { slot: i + 1, url: s.url },
        );
      }
    });
    setSaving(true);
    try {
      await onSave(canData, uploads);
    } finally {
      setSaving(false);
    }
  };

  const datalist = (id: string, values?: string[]) =>
    values && values.length > 0 ? (
      <datalist id={id}>
        {values.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    ) : null;

  return (
    <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="photo-grid">
            {[0, 1, 2, 3].map((i) => {
              const slot = i + 1;
              const s = pending[i];
              const src = slotSrc(s);
              return (
                <div
                  key={slot}
                  id={`slot-${slot}`}
                  className={`photo-slot${dragIdx === i ? ' dragging-slot' : ''}${
                    overIdx === i || swapFrom === i ? ' drag-over-slot' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={src ? `Replace photo ${slot}` : `Upload photo ${slot}`}
                  title={src ? 'Tap to replace · drag to reorder' : 'Tap to upload'}
                  draggable={Boolean(src)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(i));
                    setDragIdx(i);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDragLeave={() => setOverIdx((o) => (o === i ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number.parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (!Number.isNaN(from)) swap(from, i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onClick={() => slotClick(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      slotClick(i);
                    }
                  }}
                >
                  {src ? (
                    <img src={src} alt={`Photo ${slot}`} />
                  ) : (
                    <div className="photo-slot-ph">
                      <span>{slot === 1 ? 'Main photo' : `Photo ${slot}`}</span>
                      <small>Click or paste URL</small>
                    </div>
                  )}
                  <span className="photo-slot-lbl">
                    {slot}
                    {slot === 1 ? ' · Main' : ''}
                  </span>
                  {src && (
                    <button
                      type="button"
                      className="photo-slot-del"
                      aria-label={`Remove photo ${slot}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlot(i, null);
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {src && (
                    <button
                      type="button"
                      className="photo-slot-edit"
                      title="Crop photo"
                      aria-label={`Crop photo ${slot}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const s = pending[i];
                        if (s) setCropTarget({ idx: i, src: cropSource(s) });
                      }}
                    >
                      ✏️
                    </button>
                  )}
                  {src && (
                    <button
                      type="button"
                      className="photo-slot-move"
                      title="Move: tap here, then tap the destination slot"
                      aria-label={`Move photo ${slot}`}
                      aria-pressed={swapFrom === i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSwapFrom((f) => (f === i ? null : i));
                      }}
                    >
                      ⇄
                    </button>
                  )}
                  <button
                    type="button"
                    className="photo-slot-url"
                    title="Paste URL"
                    aria-label="Paste URL"
                    onClick={(e) => {
                      e.stopPropagation();
                      const u = globalThis.prompt('Paste image URL');
                      if (u?.trim()) setSlot(i, { kind: 'url', url: u.trim() });
                    }}
                  >
                    🔗
                  </button>
                  <input
                    ref={(el) => {
                      fileRefs.current[i] = el;
                    }}
                    type="file"
                    accept="image/*"
                    aria-label={`Photo ${slot}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        setSlot(i, { kind: 'file', file, preview: URL.createObjectURL(file) });
                      e.currentTarget.value = '';
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="field-grid">
            <div className="field field-full">
              <label htmlFor="e-nome">Name</label>
              <input
                id="e-nome"
                placeholder="e.g. OG Original 2020"
                className={invalid && !nome.trim() ? 'field-invalid' : undefined}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="e-sku">SKU</label>
              <input
                id="e-sku"
                placeholder="e.g. 1112"
                className={invalid && !sku.trim() ? 'field-invalid' : undefined}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="e-produttore">Manufacturer</label>
              <input
                id="e-produttore"
                list="dl-produttore"
                placeholder="e.g. BALL"
                value={produttore}
                onChange={(e) => setProduttore(e.target.value)}
              />
              {datalist('dl-produttore', suggestions?.manufacturers)}
            </div>
            <div className="field">
              <label htmlFor="e-size">Size</label>
              <input
                id="e-size"
                list="dl-size"
                placeholder="e.g. 500ML"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              />
              {datalist('dl-size', suggestions?.sizes)}
            </div>
            <div className="field">
              <label htmlFor="e-lingua">Language / Country</label>
              <input
                id="e-lingua"
                list="dl-lingua"
                placeholder="e.g. ITALY"
                value={lingua}
                onChange={(e) => setLingua(e.target.value)}
              />
              {datalist('dl-lingua', suggestions?.countries)}
            </div>
            <div className="field">
              <label htmlFor="e-top">Top / Tab</label>
              <input
                id="e-top"
                list="dl-top"
                placeholder="e.g. Gold"
                value={top}
                onChange={(e) => setTop(e.target.value)}
              />
              {datalist('dl-top', suggestions?.tops)}
              {top.trim() !== '' &&
                (() => {
                  const tab = colorizeTab(top);
                  return (
                    <div
                      className="top-preview"
                      style={tab.style ?? { background: 'var(--bg3)', color: 'var(--text)' }}
                    >
                      {tab.parts.map((p, j) => (
                        <span key={`${j}-${p.text}`}>
                          {j > 0 && '/'}
                          <span style={p.color ? { color: p.color } : undefined}>{p.text}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}
            </div>
            <div className="field">
              <label htmlFor="e-promo">Promo</label>
              {/* value derivato: se non lo tocchi, il testo storico (es. "Christmas") resta */}
              <select
                id="e-promo"
                value={promo !== '' ? 'Yes' : 'No'}
                onChange={(e) => setPromo(e.target.value === 'Yes' ? 'Yes' : '')}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="e-valore">Est. Value (€)</label>
              <input
                id="e-valore"
                type="number"
                min="0"
                placeholder="0"
                value={valore}
                onChange={(e) => setValore(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="e-stato">Condition</label>
              <input
                id="e-stato"
                list="dl-stato"
                value={stato}
                onChange={(e) => setStato(e.target.value)}
              />
              {datalist('dl-stato', suggestions?.conditions)}
            </div>
            <div className="field field-full">
              <label>Opening</label>
              <div className="opening-grid">
                {OPENING.map((o) => (
                  <label key={o} className="opening-opt">
                    <input
                      type="radio"
                      name="opening"
                      value={o}
                      checked={note === o}
                      onChange={() => setNote(o)}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field field-full">
              <label htmlFor="e-descrizione">More Info</label>
              <textarea
                id="e-descrizione"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {invalid && (!nome.trim() || !sku.trim()) && (
            <span className="form-error" role="alert">
              Name and SKU are required
            </span>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginRight: 'auto' }}
              onClick={onDelete}
              disabled={saving}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      {cropTarget && (
        <PhotoCrop
          src={cropTarget.src}
          onApply={(f) => {
            setSlot(cropTarget.idx, { kind: 'file', file: f, preview: URL.createObjectURL(f) });
            setCropTarget(null);
          }}
          onCancel={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}
