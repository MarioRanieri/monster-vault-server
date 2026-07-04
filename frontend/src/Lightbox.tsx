import { useEffect, useState } from 'react';
import { cloudinaryThumb } from './cloudinary';

// Lightbox a schermo intero riusabile: ✕ per chiudere, ‹ › per scorrere le foto,
// ESC per uscire. Usato dal dettaglio e dalla vista wall.
export function Lightbox({
  photos,
  start = 0,
  alt,
  onClose,
}: {
  photos: string[];
  start?: number;
  alt?: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(start);
  const prev = () => setIdx((i) => (i + photos.length - 1) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length]);

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
      <img src={cloudinaryThumb(photos[idx], 1200, 1200)} alt={alt} />
      {photos.length > 1 && (
        <button type="button" className="lb-nav lb-next" aria-label="Next photo" onClick={next}>
          ›
        </button>
      )}
    </div>
  );
}
