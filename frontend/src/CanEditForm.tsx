import { useState } from 'react';
import type { Can } from './types';

// Form di modifica di una lattina; comunica la can aggiornata via onSave.
export function CanEditForm({
  can,
  onSave,
  onCancel,
  onUploadPhoto,
}: {
  can: Can;
  onSave: (can: Can) => void;
  onCancel: () => void;
  onUploadPhoto?: (slot: number, file: File) => void;
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
        Nome
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
        Stato
        <input value={stato} onChange={(e) => setStato(e.target.value)} />
      </label>
      {onUploadPhoto && (
        <label>
          Foto 1
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadPhoto(1, file);
            }}
          />
        </label>
      )}
      <button type="submit">Salva</button>
      <button type="button" onClick={onCancel}>
        Annulla
      </button>
    </form>
  );
}
