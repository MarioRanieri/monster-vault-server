import { useRef, useState } from 'react';
import type { Can } from './types';
import { PhotoCrop } from './PhotoCrop';
import { cloudinaryThumb } from './cloudinary';

// Modale di modifica/creazione (classi .modal/.photo-grid/.photo-slot/.field-grid
// del vecchio): 4 slot foto (click per caricare + crop, incolla URL, rimuovi) e
// tutti i campi. Salva la can aggiornata via onSave.
export function CanEditForm({
  can,
  title = 'Edit Can',
  onSave,
  onCancel,
  onDelete,
  onUploadPhoto,
  onUploadPhotoUrl,
  onRemovePhoto,
}: {
  can: Can;
  title?: string;
  onSave: (can: Can) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onUploadPhoto?: (slot: number, file: File) => void;
  onUploadPhotoUrl?: (slot: number, url: string) => void;
  onRemovePhoto?: (slot: number) => void;
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
  const [cropTarget, setCropTarget] = useState<{ slot: number; file: File } | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const save = () =>
    onSave({
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
    });

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
          {onUploadPhoto && (
            <div className="photo-grid">
              {([1, 2, 3, 4] as const).map((slot) => {
                const url = can[`p${slot}` as 'p1' | 'p2' | 'p3' | 'p4'];
                return (
                  <div
                    key={slot}
                    className="photo-slot"
                    onClick={() => fileRefs.current[slot - 1]?.click()}
                  >
                    {url ? (
                      <img src={cloudinaryThumb(url, 300, 300)} alt={`Photo ${slot}`} />
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
                    {url && onRemovePhoto && (
                      <button
                        type="button"
                        className="photo-slot-del"
                        aria-label={`Remove photo ${slot}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePhoto(slot);
                        }}
                      >
                        ✕
                      </button>
                    )}
                    {onUploadPhotoUrl && (
                      <button
                        type="button"
                        className="photo-slot-url"
                        title="Paste URL"
                        aria-label="Paste URL"
                        onClick={(e) => {
                          e.stopPropagation();
                          const u = window.prompt('Paste image URL');
                          if (u?.trim()) onUploadPhotoUrl(slot, u.trim());
                        }}
                      >
                        🔗
                      </button>
                    )}
                    <input
                      ref={(el) => {
                        fileRefs.current[slot - 1] = el;
                      }}
                      type="file"
                      accept="image/*"
                      aria-label={`Photo ${slot}`}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCropTarget({ slot, file });
                        e.currentTarget.value = '';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="field-grid">
            <div className="field field-full">
              <label>
                Name
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                SKU
                <input value={sku} onChange={(e) => setSku(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Manufacturer
                <input value={produttore} onChange={(e) => setProduttore(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Size
                <input value={size} onChange={(e) => setSize(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Language / Country
                <input value={lingua} onChange={(e) => setLingua(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Top / Tab
                <input value={top} onChange={(e) => setTop(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Promo
                <input value={promo} onChange={(e) => setPromo(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Est. Value (€)
                <input value={valore} onChange={(e) => setValore(e.target.value)} />
              </label>
            </div>
            <div className="field">
              <label>
                Condition
                <input value={stato} onChange={(e) => setStato(e.target.value)} />
              </label>
            </div>
            <div className="field field-full">
              <label>
                Opening
                <input
                  value={note}
                  placeholder="e.g. TOP OPENED, FULL"
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>
            <div className="field field-full">
              <label>
                More Info
                <textarea
                  value={descrizione}
                  style={{ minHeight: 80 }}
                  onChange={(e) => setDescrizione(e.target.value)}
                />
              </label>
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
            onUploadPhoto?.(cropTarget.slot, f);
            setCropTarget(null);
          }}
          onCancel={() => setCropTarget(null)}
        />
      )}
    </div>
  );
}
