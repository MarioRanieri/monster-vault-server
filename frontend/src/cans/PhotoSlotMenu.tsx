import { useEscapeClose } from '../ui/useEscapeClose';

export type PhotoAction =
  'camera' | 'phone-camera' | 'gallery' | 'crop' | 'move' | 'url' | 'remove';

// Menu delle azioni di uno slot foto. Prima erano quattro icone da 24px stipate
// nell'angolo della miniatura (e il ✕ appariva solo col mouse: da telefono una
// foto non si poteva proprio cancellare). Qui sono righe da 52px, leggibili al
// tocco, e le voci cambiano se lo slot è pieno o vuoto.
export function PhotoSlotMenu({
  slot,
  filled,
  onAction,
  onClose,
}: Readonly<{
  slot: number;
  filled: boolean;
  onAction: (action: PhotoAction) => void;
  onClose: () => void;
}>) {
  useEscapeClose(onClose);
  const title = `Photo ${slot}${slot === 1 ? ' · Main' : ''}`;
  const rows: { action: PhotoAction; icon: string; label: string; danger?: boolean }[] = [
    // In-app: le 4 foto di fila con lo zoom che resta. Phone: l'app Fotocamera,
    // un solo scatto ma con la sua elaborazione (resta per confrontare la qualità).
    { action: 'camera', icon: '📸', label: 'Take photos (in-app camera)' },
    { action: 'phone-camera', icon: '📱', label: 'Take photo (phone camera)' },
    { action: 'gallery', icon: '🖼', label: filled ? 'Replace from gallery' : 'Add from gallery' },
    ...(filled
      ? ([
          { action: 'crop', icon: '✏️', label: 'Crop & straighten' },
          { action: 'move', icon: '⇄', label: 'Move to another slot' },
        ] as const)
      : []),
    { action: 'url', icon: '🔗', label: 'Paste image URL' },
    ...(filled
      ? ([{ action: 'remove', icon: '🗑', label: 'Remove photo', danger: true }] as const)
      : []),
  ];

  return (
    <dialog className="sheet-backdrop open" open aria-modal="true" aria-label={title}>
      {/* NOSONAR: sfondo cliccabile per chiudere, il menu vero è la lista sotto */}
      <button type="button" className="sheet-scrim" aria-label="Close menu" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-title">{title}</div>
        {rows.map((r) => (
          <button
            key={r.action}
            type="button"
            className={`sheet-row${r.danger ? ' sheet-row-danger' : ''}`}
            onClick={() => onAction(r.action)}
          >
            <span className="sheet-row-ico" aria-hidden="true">
              {r.icon}
            </span>
            {r.label}
          </button>
        ))}
        <button type="button" className="sheet-row sheet-row-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
