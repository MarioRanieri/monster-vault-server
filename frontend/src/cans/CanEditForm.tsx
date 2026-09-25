import { useMemo, useRef, useState } from 'react';
import type { Can } from '../app/types';
import { PhotoCrop } from '../photos/PhotoCrop';
import { CameraCapture } from '../photos/CameraCapture';
import { PhotoSlotMenu, type PhotoAction } from './PhotoSlotMenu';
import { cloudinaryThumb } from '../photos/cloudinary';
import { colorizeTab } from '../ui/colorizeTab';
import { TabBadge } from '../ui/TabParts';
import { SuggestInput } from '../ui/SuggestInput';
import { suggestMoreInfo } from './moreInfoSuggestions';
import { findSimilarCans } from './similarCans';
import { useEscapeClose } from '../ui/useEscapeClose';

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

// Le scelte di "Condition" (come il vecchio). Vuota = lattina nuova → OK.
const CONDITIONS = ['OK', 'Minor Dents', 'Damaged'];

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
  descriptions?: string[];
}

// Modale di modifica/creazione (classi .modal/.photo-grid/.field-grid del vecchio).
// Le foto sono "staged": si scelgono qui e vengono caricate dopo il salvataggio
// (così funziona anche creando una can nuova, che ancora non ha un id sul server).
export function CanEditForm({
  can,
  title = 'Edit Can',
  suggestions,
  collection = [],
  onSave,
  onCancel,
  onDelete,
}: Readonly<{
  can: Can;
  title?: string;
  suggestions?: Suggestions;
  collection?: Can[]; // tutta la collezione, per suggerire More Info dalle lattine simili
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
  const [stato, setStato] = useState(can.stato || 'OK');
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
  const camRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [cameraFrom, setCameraFrom] = useState<number | null>(null);
  // Lattine già in collezione che somigliano al nome che stai scrivendo: servono
  // a nominare la nuova come le sorelle (i nomi si scrivono a mano).
  const similar = useMemo(
    () => findSimilarCans(collection, { id: can.id, nome, lingua }),
    [collection, can.id, nome, lingua],
  );
  // Calcolato sulla bozza corrente: funziona anche su una lattina non ancora salvata.
  const similarInfo = useMemo(
    () => (descrizione.trim() ? [] : suggestMoreInfo(collection, { id: can.id, nome, lingua })),
    [collection, can.id, nome, lingua, descrizione],
  );

  // Snapshot dei valori all'apertura (congelato al primo render, useRef ignora
  // gli aggiornamenti successivi): confrontato con lo stato corrente per sapere
  // se ci sono modifiche non salvate quando si preme ESC.
  const initial = useRef({
    nome: can.nome,
    sku: can.sku ?? '',
    produttore: can.produttore ?? '',
    size: can.size ?? '',
    lingua: can.lingua ?? '',
    top: can.top ?? '',
    promo: can.promo ?? '',
    valore: can.valore ?? '',
    stato: can.stato || 'OK',
    note: can.note ?? '',
    descrizione: can.descrizione ?? '',
    pending: JSON.stringify(
      [can.p1, can.p2, can.p3, can.p4].map((u) => (u ? { kind: 'keep', url: u } : null)),
    ),
  });
  const dirty =
    nome !== initial.current.nome ||
    sku !== initial.current.sku ||
    produttore !== initial.current.produttore ||
    size !== initial.current.size ||
    lingua !== initial.current.lingua ||
    top !== initial.current.top ||
    promo !== initial.current.promo ||
    valore !== initial.current.valore ||
    stato !== initial.current.stato ||
    note !== initial.current.note ||
    descrizione !== initial.current.descrizione ||
    JSON.stringify(pending) !== initial.current.pending;

  // ESC chiude come gli altri overlay, ma con modifiche non salvate chiede
  // conferma prima di scartarle (a differenza di Cancel/✕, che è un'azione
  // esplicita dell'utente e non la richiede).
  useEscapeClose(() => {
    if (saving) return;
    if (!dirty || globalThis.confirm('Discard changes?')) onCancel();
  });

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
  // Click sullo slot: destinazione dello swap se "Move" è attivo, altrimenti il
  // menu delle azioni (prima erano icone da 24px, intoccabili da telefono).
  const slotClick = (i: number) => {
    if (swapFrom != null) swap(swapFrom, i);
    else setMenuIdx(i);
  };

  // Una foto scelta entra nello slot e basta, da fotocamera o da galleria: il
  // flusso dell'utente è scattare tutte le foto e caricarle, sistemandole dopo
  // con calma da "Crop & straighten".
  const takeFile = (i: number, file: File | undefined) => {
    if (!file) return;
    setSlot(i, { kind: 'file', file, preview: URL.createObjectURL(file) });
  };

  const runAction = (i: number, action: PhotoAction) => {
    setMenuIdx(null);
    if (action === 'camera') setCameraFrom(i);
    else if (action === 'phone-camera') camRefs.current[i]?.click();
    else if (action === 'gallery') fileRefs.current[i]?.click();
    else if (action === 'crop') {
      const sl = pending[i];
      if (sl) setCropTarget({ idx: i, src: cropSource(sl) });
    } else if (action === 'move') setSwapFrom(i);
    else if (action === 'url') {
      const u = globalThis.prompt('Paste image URL');
      if (u?.trim()) setSlot(i, { kind: 'url', url: u.trim() });
    } else if (action === 'remove') setSlot(i, null);
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

  return (
    <dialog className="modal-backdrop open" open aria-modal="true" aria-label={title}>
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
                <div // NOSONAR: slot trascinabile con bottoni di azione dentro, non può essere un <button>
                  key={slot}
                  id={`slot-${slot}`}
                  className={`photo-slot${dragIdx === i ? ' dragging-slot' : ''}${
                    overIdx === i || swapFrom === i ? ' drag-over-slot' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={src ? `Photo ${slot} options` : `Add photo ${slot}`}
                  title={src ? 'Tap for options · drag to reorder' : 'Tap to add a photo'}
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
                    <img src={src} alt={`Slot ${slot}`} />
                  ) : (
                    <div className="photo-slot-ph">
                      <span>{slot === 1 ? 'Main photo' : `Photo ${slot}`}</span>
                      <small>Tap to add</small>
                    </div>
                  )}
                  <span className="photo-slot-lbl">
                    {slot}
                    {slot === 1 ? ' · Main' : ''}
                  </span>
                  <input
                    ref={(el) => {
                      fileRefs.current[i] = el;
                    }}
                    type="file"
                    accept="image/*"
                    aria-label={`Photo ${slot}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      takeFile(i, e.target.files?.[0]);
                      e.currentTarget.value = '';
                    }}
                  />
                  {/* capture: apre direttamente la fotocamera del telefono invece
                      del menu galleria/file. */}
                  <input
                    ref={(el) => {
                      camRefs.current[i] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label={`Take photo ${slot}`}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      takeFile(i, e.target.files?.[0]);
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
              {similar.length > 0 && (
                <div className="similar-cans">
                  <span className="similar-cans-lbl">Similar cans you already have</span>
                  <ul>
                    {similar.map((c) => (
                      <li key={c.id}>
                        <span>{c.nome}</span>
                        <span className="similar-cans-meta">
                          {[c.sku, c.lingua].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
              <SuggestInput
                id="e-produttore"
                placeholder="e.g. BALL"
                value={produttore}
                onChange={setProduttore}
                suggestions={suggestions?.manufacturers}
              />
            </div>
            <div className="field">
              <label htmlFor="e-size">Size</label>
              <SuggestInput
                id="e-size"
                placeholder="e.g. 500ML"
                value={size}
                onChange={setSize}
                suggestions={suggestions?.sizes}
              />
            </div>
            <div className="field">
              <label htmlFor="e-lingua">Language / Country</label>
              <SuggestInput
                id="e-lingua"
                placeholder="e.g. ITALY"
                value={lingua}
                onChange={setLingua}
                suggestions={suggestions?.countries}
              />
            </div>
            <div className="field">
              <label htmlFor="e-top">Top / Tab</label>
              <SuggestInput
                id="e-top"
                placeholder="e.g. Gold"
                value={top}
                onChange={setTop}
                suggestions={suggestions?.tops}
              />
              {top.trim() !== '' && (
                <div className="top-preview">
                  <TabBadge tab={colorizeTab(top)} />
                </div>
              )}
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
              <select id="e-stato" value={stato} onChange={(e) => setStato(e.target.value)}>
                {/* un valore storico fuori lista resta selezionato finché non lo cambi */}
                {(CONDITIONS.includes(stato) ? CONDITIONS : [...CONDITIONS, stato]).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="field field-full">
              <legend className="field-label">Opening</legend>
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
            </fieldset>
            <div className="field field-full">
              <label htmlFor="e-descrizione">More Info</label>
              {similarInfo.length > 0 && (
                <div className="moreinfo-suggest">
                  <span className="moreinfo-suggest-lbl">Like similar cans:</span>
                  {similarInfo.map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      className="filter-chip"
                      onClick={() => setDescrizione(s.text)}
                    >
                      {s.text} <span className="chip-count">{s.count}</span>
                    </button>
                  ))}
                </div>
              )}
              <SuggestInput
                id="e-descrizione"
                multiline
                value={descrizione}
                onChange={setDescrizione}
                suggestions={suggestions?.descriptions}
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
      {menuIdx !== null && (
        <PhotoSlotMenu
          slot={menuIdx + 1}
          filled={pending[menuIdx] !== null}
          onAction={(a) => runAction(menuIdx, a)}
          onClose={() => setMenuIdx(null)}
        />
      )}
      {cameraFrom !== null && (
        <CameraCapture
          previews={pending.map(slotSrc)}
          start={cameraFrom}
          onDone={(shots) => {
            shots.forEach((f, i) => f && takeFile(i, f));
            setCameraFrom(null);
          }}
          onClose={() => setCameraFrom(null)}
        />
      )}
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
    </dialog>
  );
}
