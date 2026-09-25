import { useEffect, useRef, useState } from 'react';
import { useEscapeClose } from '../ui/useEscapeClose';
import { grabFrame, loadZoom, lowRes, nextEmptySlot, saveZoom, type Zoom } from './camera';

type Shots = (File | null)[];

// Mirino in-app: con <input capture> iOS apre la sua app Fotocamera per UN solo
// scatto e la richiude, quindi zoom e impostazioni ripartono da zero ogni volta.
// Qui lo stream resta aperto: si scattano le 4 foto di fila e lo zoom resta.
// Il prezzo: è un fotogramma del video, non la pipeline foto di Apple (Safari
// non ha ImageCapture.takePhoto); per questo nel menu resta anche la fotocamera
// del telefono e qui si mostra la risoluzione ottenuta.
export function CameraCapture({
  previews,
  start,
  onDone,
  onClose,
}: Readonly<{
  previews: (string | null)[]; // anteprime degli slot già pieni nel form
  start: number;
  onDone: (shots: Shots) => void;
  onClose: () => void;
}>) {
  useEscapeClose(onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shots>([null, null, null, null]);
  const [thumbs, setThumbs] = useState<(string | null)[]>([null, null, null, null]);
  const [cur, setCur] = useState(start);
  const [res, setRes] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState<Zoom>(loadZoom);
  // 'track': la traccia accetta lo zoom; 'lens': si passa all'obiettivo tele.
  const [zoomMode, setZoomMode] = useState<'track' | 'lens' | null>(null);
  const teleId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const stop = () => streamRef.current?.getTracks().forEach((t) => t.stop());

  // 4:3 come le foto di oggi, alla risoluzione più alta che iOS concede.
  const open = async (deviceId?: string) => {
    stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } }),
        aspectRatio: { ideal: 4 / 3 },
        width: { ideal: 4032 },
        height: { ideal: 3024 },
      },
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.play()?.catch(() => {});
    }
    const track = stream.getVideoTracks()[0];
    const s = track.getSettings();
    if (s.width && s.height) setRes({ w: s.width, h: s.height });
    return track;
  };

  const applyZoom = async (z: Zoom, mode: typeof zoomMode, track?: MediaStreamTrack) => {
    if (mode === 'track') {
      const t = track ?? streamRef.current?.getVideoTracks()[0];
      await t?.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] });
    } else if (mode === 'lens') {
      await open(z === 2 ? (teleId.current ?? undefined) : undefined);
    }
  };

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const track = await open();
        if (gone) return stop();
        const caps = track.getCapabilities?.() as { zoom?: { max: number } } | undefined;
        let mode: typeof zoomMode = null;
        if (caps?.zoom && caps.zoom.max >= 2) mode = 'track';
        else {
          // le etichette dei dispositivi si leggono solo dopo il permesso
          const devices = await navigator.mediaDevices.enumerateDevices();
          const tele = devices.find((d) => d.kind === 'videoinput' && /telephoto/i.test(d.label));
          if (tele) {
            teleId.current = tele.deviceId;
            mode = 'lens';
          }
        }
        if (gone) return;
        setZoomMode(mode);
        if (zoom === 2) await applyZoom(2, mode, track);
      } catch {
        if (!gone) setFailed(true);
      }
    })();
    return () => {
      gone = true;
      stop();
    };
    // lo stream si apre una volta sola, al montaggio
  }, []);

  // Le miniature servono solo qui (il form si crea le sue): si liberano alla chiusura.
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;
  useEffect(() => () => thumbsRef.current.forEach((t) => t && URL.revokeObjectURL(t)), []);

  const pickZoom = (z: Zoom) => {
    saveZoom(z);
    setZoom(z);
    applyZoom(z, zoomMode).catch(() => setFailed(true));
  };

  const shoot = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    try {
      const f = await grabFrame(video);
      const wasEmpty = !previews[cur] && !shots[cur];
      const next = shots.map((s, i) => (i === cur ? f : s));
      setShots(next);
      setThumbs((t) => t.map((u, i) => (i === cur ? URL.createObjectURL(f) : u)));
      const target = nextEmptySlot(
        next.map((s, i) => Boolean(s || previews[i])),
        cur,
      );
      if (target !== null) setCur(target);
      else if (wasEmpty) onDone(next);
    } finally {
      setBusy(false);
    }
  };

  const title = `Photo ${cur + 1}${cur === 0 ? ' · Main' : ''}`;
  const taken = shots.filter(Boolean).length;

  return (
    <dialog className="cam-overlay" open aria-label="Camera">
      <div className="cam-top">
        <button type="button" className="cam-close" aria-label="Close camera" onClick={onClose}>
          ✕
        </button>
        <div className="cam-title">
          {title}
          <small>Tap a slot to retake</small>
        </div>
        <button type="button" className="cam-done" onClick={() => onDone(shots)}>
          Done
        </button>
      </div>
      <div className="cam-view">
        {/* muted + playsInline: senza, iOS non avvia il video o lo apre a schermo intero */}
        <video ref={videoRef} autoPlay muted playsInline />
        {failed && (
          <p className="cam-error" role="alert">
            Camera unavailable. Close and use “Take photo (phone camera)”.
          </p>
        )}
        {res && (
          <span className={`cam-res${lowRes(res.w, res.h) ? ' cam-res-low' : ''}`}>
            {res.w}×{res.h}
          </span>
        )}
        {zoomMode && (
          <div className="cam-zoom">
            {([1, 2] as const).map((z) => (
              <button
                key={z}
                type="button"
                aria-pressed={zoom === z}
                className={zoom === z ? 'on' : undefined}
                onClick={() => pickZoom(z)}
              >
                {z}×
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="cam-strip">
        {[0, 1, 2, 3].map((i) => {
          const src = thumbs[i] ?? previews[i];
          return (
            <button
              key={i}
              type="button"
              aria-label={`Shoot slot ${i + 1}`}
              className={`cam-slot${src ? ' full' : ''}${i === cur ? ' cur' : ''}`}
              onClick={() => setCur(i)}
            >
              {src && <img src={src} alt="" />}
              <span>{i + 1}</span>
            </button>
          );
        })}
      </div>
      <div className="cam-shoot">
        <button
          type="button"
          className="cam-shutter"
          aria-label="Take picture"
          disabled={busy || failed}
          onClick={shoot}
        >
          <i />
        </button>
        <span className="cam-count">{taken} / 4</span>
      </div>
    </dialog>
  );
}
