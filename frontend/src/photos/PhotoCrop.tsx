import { useRef, useState } from 'react';
import { coverScale, moveRect, resizeRect, type Corner, type Rect } from './cropRect';
import { useEscapeClose } from '../ui/useEscapeClose';

const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
const MAX_ANGLE = 15;

// Editor di ritaglio: il riquadro nasce sulla foto intera e si aggiusta
// trascinando gli angoli (o spostandolo da dentro) — prima andava disegnato da
// capo a ogni correzione, e un tocco secco lo azzerava. "Straighten" ruota la
// foto di pochi gradi come nell'app Foto; l'ingrandimento di copertura evita gli
// angoli vuoti che la rotazione lascerebbe.
// Sorgente = una URL (objectURL per un file appena scattato, o URL Cloudinary per
// una foto esistente: crossOrigin così il canvas non viene "tainted"). Il disegno
// su canvas non gira in jsdom → la matematica sta in cropRect, testata lì.
export function PhotoCrop({
  src,
  onApply,
  onCancel,
}: Readonly<{
  src: string;
  onApply: (file: File) => void;
  onCancel: () => void;
}>) {
  useEscapeClose(onCancel);
  const imgRef = useRef<HTMLImageElement>(null);
  // dimensioni della foto come è mostrata: il riquadro vive in queste coordinate
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [angle, setAngle] = useState(0);
  // trascinamento in corso: angolo trascinato, o 'move' per lo spostamento
  const drag = useRef<{ mode: Corner | 'move'; x: number; y: number } | null>(null);

  const rad = (angle * Math.PI) / 180;
  const cover = disp ? coverScale(disp.w, disp.h, rad) : 1;
  const canApply = !!rect && rect.w >= 8 && rect.h >= 8;

  const reset = (d: { w: number; h: number }) => {
    setDisp(d);
    setRect({ x: 0, y: 0, w: d.w, h: d.h });
    setAngle(0);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !rect || !disp) return;
    e.preventDefault();
    if (d.mode === 'move') {
      setRect(moveRect(rect, e.clientX - d.x, e.clientY - d.y, disp.w, disp.h));
      drag.current = { ...d, x: e.clientX, y: e.clientY };
      return;
    }
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return;
    setRect(resizeRect(rect, d.mode, e.clientX - box.left, e.clientY - box.top, disp.w, disp.h));
  };

  const startDrag = (mode: Corner | 'move') => (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = { mode, x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !rect || !disp || !canApply) return;
    // il canvas lavora in pixel veri della foto: tutto ciò che è in coordinate
    // "mostrate" va moltiplicato per questo fattore
    const k = img.naturalWidth / disp.w;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * k);
    canvas.height = Math.round(rect.h * k);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onCancel();
      return;
    }
    try {
      // stessa trasformazione che si vede a schermo: centro, rotazione, copertura
      ctx.translate((disp.w / 2 - rect.x) * k, (disp.h / 2 - rect.y) * k);
      ctx.rotate(rad);
      ctx.scale(cover, cover);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
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
    <dialog className="crop-overlay" open aria-label="Crop photo">
      <div
        className="crop-stage"
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
      >
        <div className="crop-img-wrap" style={disp ? { width: disp.w, height: disp.h } : undefined}>
          <img
            ref={imgRef}
            src={src}
            alt="To crop"
            draggable={false}
            crossOrigin={/^https?:/.test(src) ? 'anonymous' : undefined}
            style={{ transform: `rotate(${angle}deg) scale(${cover})` }}
            onLoad={(e) => reset({ w: e.currentTarget.width, h: e.currentTarget.height })}
          />
          {rect && (
            <div
              className="crop-box"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
              onPointerDown={startDrag('move')}
            >
              <div className="crop-grid" />
              {CORNERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`crop-handle crop-handle-${c}`}
                  aria-label={`Crop corner ${c}`}
                  onPointerDown={startDrag(c)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="crop-dial">
        <output className="crop-deg">{angle > 0 ? `+${angle}` : angle}°</output>
        <input
          type="range"
          className="crop-range"
          aria-label="Straighten"
          min={-MAX_ANGLE}
          max={MAX_ANGLE}
          step={0.5}
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
        />
      </div>
      <div className="crop-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => disp && reset(disp)}
          disabled={!disp}
        >
          Full photo
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={!canApply}>
          Apply crop
        </button>
      </div>
    </dialog>
  );
}
