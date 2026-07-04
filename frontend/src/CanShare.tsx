import { useState } from 'react';
import type { Can } from './types';
import { canShareUrl, canShareText, canWhatsappUrl, canTelegramUrl } from './shareCan';

// Bottone "Share" della lattina + sheet a tendina (classi .share-sheet* del vecchio):
// Copy link / Copy text / WhatsApp / Telegram. Visibile a tutti (guest e admin).
export function CanShare({
  can,
  onToast,
}: Readonly<{ can: Can; onToast?: (msg: string) => void }>) {
  const [open, setOpen] = useState(false);
  const url = canShareUrl(can.id);

  const copy = (text: string, msg: string) => {
    void navigator.clipboard?.writeText(text);
    onToast?.(msg);
    setOpen(false);
  };
  const go = (href: string) => {
    globalThis.open(href, '_blank', 'noopener');
    setOpen(false);
  };

  return (
    <div className="share-sheet-wrap">
      <button
        type="button"
        className="btn btn-ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="btn-label">Share</span>
      </button>
      {open && (
        <div className="share-sheet open" role="menu">
          <button
            type="button"
            className="share-sheet-item"
            onClick={() => copy(url, '🔗 Link copied ✓')}
          >
            Copy link
          </button>
          <button
            type="button"
            className="share-sheet-item"
            onClick={() => copy(canShareText(can, url), '📋 Text copied ✓')}
          >
            Copy text
          </button>
          <button
            type="button"
            className="share-sheet-item"
            onClick={() => go(canWhatsappUrl(can, url))}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className="share-sheet-item"
            onClick={() => go(canTelegramUrl(can, url))}
          >
            Telegram
          </button>
        </div>
      )}
    </div>
  );
}
