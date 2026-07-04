import type { Can } from './types';

// Builder puri per condividere una singola lattina (link /share/{id}, testo,
// WhatsApp, Telegram). Portati dal vecchio share.ts:shareCanLink.
const isFull = (can: Can) => (can.note ?? '').toUpperCase().includes('FULL');

export function canShareUrl(id: string): string {
  return `${window.location.origin}/share/${encodeURIComponent(id)}`;
}

export function canShareText(can: Can, url: string): string {
  const parts: string[] = [];
  if (can.nome) parts.push(can.nome);
  if (can.lingua) parts.push(can.lingua);
  if (can.size) parts.push(can.size);
  if (can.sku) parts.push(`SKU: ${can.sku}`);
  if (isFull(can)) parts.push('FULL');
  parts.push(url);
  return parts.join(' · ');
}

export function canWhatsappUrl(can: Can, url: string): string {
  const parts: string[] = [];
  if (can.nome) parts.push(`*${can.nome}*`);
  if (can.lingua) parts.push(can.lingua);
  if (can.size) parts.push(can.size);
  if (can.sku) parts.push(`SKU: ${can.sku}`);
  if (isFull(can)) parts.push('✅ FULL');
  parts.push(url);
  return `https://wa.me/?text=${encodeURIComponent(parts.join(' · '))}`;
}

export function canTelegramUrl(can: Can, url: string): string {
  const title = `${can.nome || 'Monster Vault'} — Mario Ranieri's collection`;
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}
