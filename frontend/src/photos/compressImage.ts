// Compressione immagini lato client PRIMA dell'upload — portata dal vecchio
// photos.ts (la migrazione React l'aveva persa). Senza questa, le foto da
// telefono (3-8MB) sfondavano il limite multipart del backend e l'upload
// falliva: su desktop con immagini piccole non si notava, da mobile sì.
//
// Immagini piccole (< 400KB) o non-immagini passano intatte. Le altre vengono
// ridimensionate a max 1800px sul lato lungo e ri-codificate in JPEG.
const MAX_DIMENSION = 1800;
const SKIP_UNDER_BYTES = 400_000;
const JPEG_QUALITY = 0.85;

export function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size < SKIP_UNDER_BYTES) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w > h) {
          h = Math.round((h * MAX_DIMENSION) / w);
          w = MAX_DIMENSION;
        } else {
          w = Math.round((w * MAX_DIMENSION) / h);
          h = MAX_DIMENSION;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // niente canvas → meglio l'originale che niente
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // se non si decodifica, lascia decidere al backend
    };
    img.src = url;
  });
}
