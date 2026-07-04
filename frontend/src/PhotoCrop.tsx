import { useEffect, useRef, useState } from 'react';
import { normalizeRect } from './cropRect';

// Editor di crop: l'utente trascina un rettangolo sull'immagine; Apply ritaglia
// via canvas e ritorna un File; Skip usa l'originale. (Il ritaglio su canvas non è
// eseguibile in jsdom → qui sono testati i pulsanti e la logica pura sta in cropRect.)
export function PhotoCrop({
  file,
  onApply,
  onCancel,
}: Readonly<{
  file: File;
  onApply: (f: File) => void;
  onCancel: () => void;
}>) {
  const [src, setSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<{
    ax: number;
    ay: number;
    bx: number;
    by: number;
  } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setSrc(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const rect = drag ? normalizeRect(drag.ax, drag.ay, drag.bx, drag.by) : null;

  const rel = (e: React.PointerEvent) => {
    const b = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - b.left, b.width)),
      y: Math.max(0, Math.min(e.clientY - b.top, b.height)),
    };
  };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 4 || rect.h < 4) {
      onApply(file); // nessuna selezione utile → originale
      return;
    }
    const sx = img.naturalWidth / img.width;
    const sy = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * sx);
    canvas.height = Math.round(rect.h * sy);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onApply(file);
      return;
    }
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
        onApply(
          blob
            ? new File([blob], file.name.replace(/\.\w+$/, '') + '_crop.jpg', {
                type: 'image/jpeg',
              })
            : file,
        );
      },
      'image/jpeg',
      0.92,
    );
  };

  return (
    <div className="crop-overlay" role="dialog" aria-label="Crop photo">
      <div className="crop-stage">
        <img
          ref={imgRef}
          src={src}
          alt="To crop"
          draggable={false}
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
        <button type="button" className="btn btn-primary" onClick={apply}>
          Apply
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => onApply(file)}>
          Skip crop
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
