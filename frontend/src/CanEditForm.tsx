import { useState } from 'react';
import type { Can } from './types';

// Form di modifica di una lattina; comunica la can aggiornata via onSave.
export function CanEditForm({
  can,
  onSave,
  onCancel,
  onUploadPhoto,
  onUploadPhotoUrl,
}: {
  can: Can;
  onSave: (can: Can) => void;
  onCancel: () => void;
  onUploadPhoto?: (slot: number, file: File) => void;
  onUploadPhotoUrl?: (slot: number, url: string) => void;
}) {
  const [nome, setNome] = useState(can.nome);
  const [sku, setSku] = useState(can.sku ?? '');
  const [size, setSize] = useState(can.size ?? '');
  const [promo, setPromo] = useState(can.promo ?? '');
  const [stato, setStato] = useState(can.stato ?? '');

  return (
    <form
      className="can-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...can, nome, sku, size, promo, stato });
      }}
    >
      <label>
        Name
        <input value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label>
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} />
      </label>
      <label>
        Size
        <input value={size} onChange={(e) => setSize(e.target.value)} />
      </label>
      <label>
        Promo
        <input value={promo} onChange={(e) => setPromo(e.target.value)} />
      </label>
      <label>
        Status
        <input value={stato} onChange={(e) => setStato(e.target.value)} />
      </label>
      {onUploadPhoto && (
        <div className="edit-photos">
          {([1, 2, 3, 4] as const).map((slot) => {
            const url = can[`p${slot}` as 'p1' | 'p2' | 'p3' | 'p4'];
            return (
              <div key={slot} className="edit-photo-slot">
                {url ? (
                  <img src={url} alt={`Photo ${slot}`} />
                ) : (
                  <div className="edit-photo-ph">—</div>
                )}
                <label>
                  Photo {slot}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadPhoto(slot, file);
                    }}
                  />
                </label>
                {onUploadPhotoUrl && (
                  <input
                    type="url"
                    className="edit-photo-url"
                    placeholder="…or paste URL"
                    aria-label={`Photo ${slot} URL`}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      const el = e.currentTarget;
                      const u = el.value.trim();
                      if (u) {
                        onUploadPhotoUrl(slot, u);
                        el.value = '';
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <button type="submit" className="btn btn-primary">
        Save
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
