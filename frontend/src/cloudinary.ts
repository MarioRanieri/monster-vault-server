// Trasforma un URL Cloudinary in una miniatura ottimizzata (c_fit, f_auto, q_auto)
// o in un LQIP (versione minuscola e sfocata da mostrare mentre carica la vera).
// URL non-Cloudinary → ritornato invariato. Portato dal vanilla core.ts.
export function cloudinaryThumb(url: string | undefined, w = 400, h = 400): string {
  if (!url || !url.includes('cloudinary.com')) return url ?? '';
  return url.replace('/upload/', `/upload/c_fit,w_${w},h_${h},f_auto,q_auto/`);
}

export function cloudinaryLqip(url: string | undefined): string {
  if (!url || !url.includes('cloudinary.com')) return '';
  return url.replace('/upload/', '/upload/w_20,e_blur:200,q_auto,f_auto/');
}
