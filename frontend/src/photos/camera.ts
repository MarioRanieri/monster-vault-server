// Logica del mirino in-app (CameraCapture): scelta dello slot successivo,
// soglia di risoluzione e zoom ricordato tra una lattina e l'altra.

// Sotto i 1440px sul lato corto lo scatto è più piccolo delle foto di oggi
// (che all'upload diventano 1350×1800): il mirino lo segnala.
const MIN_SHORT_SIDE = 1440;
const ZOOM_KEY = 'mv.cameraZoom';

export type Zoom = 1 | 2;

// Prossimo slot vuoto dopo `from`, ripartendo dall'inizio; null se sono pieni.
export function nextEmptySlot(filled: boolean[], from: number): number | null {
  for (let k = 1; k <= filled.length; k++) {
    const i = (from + k) % filled.length;
    if (!filled[i]) return i;
  }
  return null;
}

export function lowRes(w: number, h: number): boolean {
  return Math.min(w, h) < MIN_SHORT_SIDE;
}

// try/catch: in navigazione privata o con storage bloccato localStorage può lanciare.
export function loadZoom(): Zoom {
  try {
    return localStorage.getItem(ZOOM_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}

export function saveZoom(z: Zoom): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(z));
  } catch {
    // non ricordarlo non è grave
  }
}

// Un fotogramma del video a piena risoluzione dello stream, come JPEG.
// Il ridimensionamento a 1800px resta a compressImage, all'upload.
export function grabFrame(video: HTMLVideoElement): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('no canvas'));
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (b) =>
        b
          ? resolve(new File([b], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
          : reject(new Error('empty frame')),
      'image/jpeg',
      0.95,
    );
  });
}
