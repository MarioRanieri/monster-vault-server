import { useRef, useState } from 'react';
import { normalizeRect } from './cropRect';

// Editor di crop on-demand: si apre cliccando una foto (già caricata o esistente).
// L'utente trascina un rettangolo; Apply ritaglia via canvas e ritorna un File.
// Sorgente = una URL (objectURL per un file appena caricato, o URL Cloudinary per una
// foto esistente: crossOrigin così il canvas non viene "tainted"). Cancel chiude senza
// modifiche. Il ritaglio su canvas non è eseguibile in jsdom → la logica pura sta in cropRect.
export function PhotoCrop({
  src,
  onApply,
  onCancel,
}: Readonly<{
  src: string;
  onApply: (file: File) => void;
  onCancel: () => void;
}>) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{
    ax: number;
    ay: number;
    bx: number;
    by: number;
  } | null>(null);

  const rect = drag ? normalizeRect(drag.ax, drag.ay, drag.bx, drag.by) : null;
  const canApply = !!rect && rect.w >= 4 && rect.h >= 4;

  const rel = (e: React.PointerEvent) => {
    const b = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - b.left, b.width)),
      y: Math.max(0, Math.min(e.clientY - b.top, b.height)),
    };
  };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !rect || !canApply) return;
    const sx = img.naturalWidth / img.width;
    const sy = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * sx);
    canvas.height = Math.round(rect.h * sy);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onCancel();
      return;
    }
    try {
      ctx.drawImage(
        img,
        rect.x * sx,
        rect.y * sy,
        rect.w * sx,
        rect.h * sy,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      canvas.toBlob(
        (blob) => {
          if (blob) onApply(new File([blob], 'crop.jpg', { type: 'image/jpeg' }));
          else onCancel();
        },
        'image/jpeg',
        0.92,
      );
    } catch {
      // canvas "tainted" (foto cross-origin senza CORS) → niente crop
      onCancel();
    }
  };

  return (
    <div className="crop-overlay" role="dialog" aria-label="Crop photo">
      <div className="crop-stage">
        <img
          ref={imgRef}
          src={src}
          alt="To crop"
          draggable={false}
          crossOrigin={/^https?:/.test(src) ? 'anonymous' : undefined}
          onPointerDown={(e) => {
            const p = rel(e);
            setDrag({ ax: p.x, ay: p.y, bx: p.x, by: p.y });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            const p = rel(e);
            setDrag((d) => (d ? { ...d, bx: p.x, by: p.y } : d));
          }}
        />
        {rect && rect.w > 2 && rect.h > 2 && (
          <div
            className="crop-box"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>
      <div className="crop-actions">
        <button type="button" className="btn btn-primary" onClick={apply} disabled={!canApply}>
          Apply crop
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
