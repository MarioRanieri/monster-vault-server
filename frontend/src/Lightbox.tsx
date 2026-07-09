import { useEffect, useRef, useState } from 'react';
import { cloudinaryThumb } from './cloudinary';
import { ZOOM_RESET, zoomAt, panBy, type ZoomState } from './zoomPan';

// Lightbox a schermo intero riusabile: ✕ per chiudere, ‹ › per scorrere le foto,
// ESC per uscire. Zoom: rotellina e pinch (verso il cursore, 1–4x), doppio
// click/tap 2.5x, trascinamento (mouse o dito) per il pan da zoomati, swipe
// orizzontale per cambiare foto quando NON si è zoomati. Usato dal dettaglio e
// dalla vista wall.
export function Lightbox({
  photos,
  start = 0,
  alt,
  onClose,
}: Readonly<{
  photos: string[];
  start?: number;
  alt?: string;
  onClose: () => void;
}>) {
  const [idx, setIdx] = useState(start);
  const [zoom, setZoom] = useState<ZoomState>(ZOOM_RESET);
  const imgRef = useRef<HTMLImageElement>(null);
  // Ultimo zoom leggibile dai listener nativi (il wheel non-passive vive fuori
  // dal ciclo di render).
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // Gesto in corso (mouse drag / pinch / pan a un dito), fuori dallo stato React:
  // aggiornato nei listener senza re-render intermedi superflui.
  const gesture = useRef({
    dragging: false,
    px: 0,
    py: 0,
    pinchDist: 0,
    swipeX: null as number | null,
  });

  const prev = () => {
    setZoom(ZOOM_RESET);
    setIdx((i) => (i + photos.length - 1) % photos.length);
  };
  const next = () => {
    setZoom(ZOOM_RESET);
    setIdx((i) => (i + 1) % photos.length);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [photos.length]);

  // Coordinate del cursore relative all'origine della trasformazione (centro
  // dell'immagine nel layout): il rect misurato include il translate corrente,
  // quindi va ricompensato.
  const toCenter = (clientX: number, clientY: number) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return { cx: 0, cy: 0 };
    const z = zoomRef.current;
    return {
      cx: clientX - (r.left + r.width / 2) + z.x,
      cy: clientY - (r.top + r.height / 2) + z.y,
    };
  };

  // Il wheel deve essere non-passive (preventDefault blocca lo scroll della
  // pagina sotto l'overlay): listener nativo via ref, non onWheel di React.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { cx, cy } = toCenter(e.clientX, e.clientY);
      setZoom(zoomAt(zoomRef.current, e.deltaY > 0 ? 1 / 1.25 : 1.25, cx, cy));
    };
    img.addEventListener('wheel', onWheel, { passive: false });
    return () => img.removeEventListener('wheel', onWheel);
  }, [idx]);

  const onDblClick = (e: React.MouseEvent) => {
    if (zoom.scale > 1) setZoom(ZOOM_RESET);
    else {
      const { cx, cy } = toCenter(e.clientX, e.clientY);
      setZoom(zoomAt(zoom, 2.5, cx, cy));
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom.scale <= 1) return;
    e.preventDefault();
    gesture.current.dragging = true;
    gesture.current.px = e.clientX;
    gesture.current.py = e.clientY;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const g = gesture.current;
      if (!g.dragging) return;
      setZoom((z) => panBy(z, e.clientX - g.px, e.clientY - g.py));
      g.px = e.clientX;
      g.py = e.clientY;
    };
    const up = () => {
      gesture.current.dragging = false;
    };
    globalThis.addEventListener('mousemove', move);
    globalThis.addEventListener('mouseup', up);
    return () => {
      globalThis.removeEventListener('mousemove', move);
      globalThis.removeEventListener('mouseup', up);
    };
  }, []);

  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (e.touches.length === 2) {
      g.pinchDist = dist(e.touches);
      g.swipeX = null;
    } else if (e.touches.length === 1) {
      g.px = e.touches[0].clientX;
      g.py = e.touches[0].clientY;
      g.swipeX = zoom.scale <= 1 ? e.touches[0].clientX : null;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current;
    if (e.touches.length === 2 && g.pinchDist) {
      const d = dist(e.touches);
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const { cx, cy } = toCenter(mx, my);
      setZoom((z) => zoomAt(z, d / g.pinchDist, cx, cy));
      g.pinchDist = d;
    } else if (e.touches.length === 1 && zoom.scale > 1) {
      setZoom((z) => panBy(z, e.touches[0].clientX - g.px, e.touches[0].clientY - g.py));
      g.px = e.touches[0].clientX;
      g.py = e.touches[0].clientY;
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gesture.current;
    g.pinchDist = 0;
    // swipe per cambiare foto, solo da non zoomati (come il vecchio)
    if (g.swipeX != null && photos.length > 1 && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - g.swipeX;
      if (dx <= -40) next();
      else if (dx >= 40) prev();
    }
    g.swipeX = null;
  };

  if (photos.length === 0) return null;

  return (
    <div className="lightbox open" role="dialog" aria-label="Enlarged photo">
      <button type="button" className="lb-close" aria-label="Close photo" onClick={onClose}>
        ✕
      </button>
      {photos.length > 1 && (
        <button type="button" className="lb-nav lb-prev" aria-label="Previous photo" onClick={prev}>
          ‹
        </button>
      )}
      <img
        ref={imgRef}
        src={cloudinaryThumb(photos[idx], 1200, 1200)}
        alt={alt}
        draggable={false}
        onDoubleClick={onDblClick}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
          cursor: zoom.scale > 1 ? 'grab' : 'auto',
          touchAction: 'none',
        }}
      />
      {photos.length > 1 && (
        <button type="button" className="lb-nav lb-next" aria-label="Next photo" onClick={next}>
          ›
        </button>
      )}
    </div>
  );
}
