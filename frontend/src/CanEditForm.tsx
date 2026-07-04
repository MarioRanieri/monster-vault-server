import { useRef, useState } from 'react';
import type { Can } from './types';
import { PhotoCrop } from './PhotoCrop';
import { cloudinaryThumb } from './cloudinary';

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
  promos?: string[];
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
}: {
  can: Can;
  title?: string;
  suggestions?: Suggestions;
  onSave: (can: Can, uploads: Upload[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
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
  const [cropTarget, setCropTarget] = useState<{ idx: number; file: File } | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const setSlot = (i: number, s: Slot) => setPending((p) => p.map((x, j) => (j === i ? s : x)));

  const save = () => {
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
    onSave(canData, uploads);
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
              const src = !s
                ? null
                : s.kind === 'keep'
                  ? cloudinaryThumb(s.url, 400, 400)
                  : s.kind === 'url'
                    ? s.url
                    : s.preview;
              return (
                <div
                  key={slot}
                  id={`slot-${slot}`}
                  className="photo-slot"
                  onClick={() => fileRefs.current[i]?.click()}
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
                  <button
                    type="button"
                    className="photo-slot-url"
                    title="Paste URL"
                    aria-label="Paste URL"
                    onClick={(e) => {
                      e.stopPropagation();
                      const u = window.prompt('Paste image URL');
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
                      if (file) setCropTarget({ idx: i, file });
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
              <input id="e-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-sku">SKU</label>
              <input id="e-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-produttore">Manufacturer</label>
              <input
                id="e-produttore"
                list="dl-produttore"
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
                value={top}
                onChange={(e) => setTop(e.target.value)}
              />
              {datalist('dl-top', suggestions?.tops)}
            </div>
            <div className="field">
              <label htmlFor="e-promo">Promo</label>
              <input
                id="e-promo"
                list="dl-promo"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
              />
              {datalist('dl-promo', suggestions?.promos)}
            </div>
            <div className="field">
              <label htmlFor="e-valore">Est. Value (€)</label>
              <input id="e-valore" value={valore} onChange={(e) => setValore(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-stato">Condition</label>
              <input id="e-stato" value={stato} onChange={(e) => setStato(e.target.value)} />
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
          {onDelete && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginRight: 'auto' }}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
      {cropTarget && (
        <PhotoCrop
          file={cropTarget.file}
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
