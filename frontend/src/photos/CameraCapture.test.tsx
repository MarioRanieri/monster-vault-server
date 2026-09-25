import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CameraCapture } from './CameraCapture';
import { loadZoom, saveZoom } from './camera';

// La fotocamera vera non esiste in jsdom: stream e traccia finti, e il
// fotogramma (canvas) sostituito da un File.
vi.mock('./camera', async (orig) => ({
  ...(await orig<typeof import('./camera')>()),
  grabFrame: vi.fn(async () => new File(['x'], 'shot.jpg', { type: 'image/jpeg' })),
}));

type Caps = { zoom?: { min: number; max: number } };
function fakeCamera({
  caps = { zoom: { min: 1, max: 10 } } as Caps,
  size = { width: 1920, height: 1440 },
  devices = [] as Partial<MediaDeviceInfo>[],
} = {}) {
  const track = {
    getCapabilities: () => caps,
    getSettings: () => size,
    applyConstraints: vi.fn(async () => {}),
    stop: vi.fn(),
  };
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] };
  const getUserMedia = vi.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia, enumerateDevices: vi.fn(async () => devices) },
  });
  return { track, getUserMedia };
}

const noop = () => {};
const EMPTY = [null, null, null, null];
const shutter = () => userEvent.click(screen.getByRole('button', { name: /take picture/i }));

beforeEach(() => {
  localStorage.clear();
  HTMLMediaElement.prototype.play = vi.fn(async () => {});
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:shot');
});

test('apre la fotocamera posteriore in 4:3 alla massima risoluzione e la mostra', async () => {
  const { getUserMedia } = fakeCamera();
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  expect(await screen.findByText('1920×1440')).toBeTruthy();
  const video = (getUserMedia.mock.calls[0] as unknown as [MediaStreamConstraints])[0]
    .video as MediaTrackConstraints;
  expect(video.facingMode).toEqual({ ideal: 'environment' });
  expect(video.aspectRatio).toEqual({ ideal: 4 / 3 });
  expect(video.width).toEqual({ ideal: 4032 });
});

test('una risoluzione bassa viene segnalata', async () => {
  fakeCamera({ size: { width: 1280, height: 720 } });
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  const res = await screen.findByText('1280×720');
  expect(res.classList.contains('cam-res-low')).toBe(true);
});

test('gli scatti riempiono gli slot di fila e dopo il quarto si chiude da solo', async () => {
  fakeCamera();
  const onDone = vi.fn();
  render(<CameraCapture previews={EMPTY} start={0} onDone={onDone} onClose={noop} />);
  await screen.findByText('1920×1440');
  expect(screen.getByText('Photo 1 · Main')).toBeTruthy();
  await shutter();
  expect(await screen.findByText('Photo 2')).toBeTruthy();
  await shutter();
  await screen.findByText('Photo 3');
  await shutter();
  await screen.findByText('Photo 4');
  expect(onDone).not.toHaveBeenCalled();
  await shutter();
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  const shots = onDone.mock.calls[0][0] as (File | null)[];
  expect(shots.every((f) => f instanceof File)).toBe(true);
});

test('gli slot già pieni vengono saltati', async () => {
  fakeCamera();
  render(
    <CameraCapture
      previews={['a.jpg', 'b.jpg', null, null]}
      start={2}
      onDone={noop}
      onClose={noop}
    />,
  );
  await screen.findByText('Photo 3');
  await shutter();
  expect(await screen.findByText('Photo 4')).toBeTruthy();
});

test('riscattare uno slot pieno non chiude il mirino; Done consegna lo scatto', async () => {
  fakeCamera();
  const onDone = vi.fn();
  render(
    <CameraCapture
      previews={['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']}
      start={0}
      onDone={onDone}
      onClose={noop}
    />,
  );
  await screen.findByText('1920×1440');
  await userEvent.click(screen.getByRole('button', { name: 'Shoot slot 2' }));
  expect(screen.getByText('Photo 2')).toBeTruthy();
  await shutter();
  await waitFor(() => expect(screen.getByText('1 / 4')).toBeTruthy());
  expect(onDone).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Done' }));
  const shots = onDone.mock.calls[0][0] as (File | null)[];
  expect(shots[1]).toBeInstanceOf(File);
  expect(shots[0]).toBeNull();
});

test('lo zoom 2× si applica alla traccia e resta per la lattina dopo', async () => {
  const { track } = fakeCamera();
  const { unmount } = render(
    <CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />,
  );
  await screen.findByText('1920×1440');
  await userEvent.click(screen.getByRole('button', { name: '2×' }));
  expect(track.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ zoom: 2 }] });
  expect(loadZoom()).toBe(2);
  unmount();

  const second = fakeCamera();
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  await waitFor(() =>
    expect(second.track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] }),
  );
  expect(screen.getByRole('button', { name: '2×' }).getAttribute('aria-pressed')).toBe('true');
});

test('senza zoom nella traccia, 2× passa all’obiettivo tele', async () => {
  saveZoom(1);
  const { getUserMedia } = fakeCamera({
    caps: {},
    devices: [
      { kind: 'videoinput', deviceId: 'wide', label: 'Back Camera' },
      { kind: 'videoinput', deviceId: 'tele', label: 'Back Telephoto Camera' },
    ],
  });
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  await userEvent.click(await screen.findByRole('button', { name: '2×' }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  const video = (getUserMedia.mock.calls[1] as unknown as [MediaStreamConstraints])[0]
    .video as MediaTrackConstraints;
  expect(video.deviceId).toEqual({ exact: 'tele' });
});

test('senza zoom né tele i pulsanti di zoom non ci sono', async () => {
  fakeCamera({ caps: {} });
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  await screen.findByText('1920×1440');
  expect(screen.queryByRole('button', { name: '2×' })).toBeNull();
});

test('le miniature degli scatti restano valide finché il mirino è aperto', async () => {
  fakeCamera();
  const revoke = vi.fn();
  globalThis.URL.revokeObjectURL = revoke;
  const { unmount } = render(
    <CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />,
  );
  await screen.findByText('1920×1440');
  await shutter();
  await screen.findByText('Photo 2');
  await shutter();
  await screen.findByText('Photo 3');
  expect(revoke).not.toHaveBeenCalled();
  unmount();
  expect(revoke).toHaveBeenCalledTimes(2);
});

test('✕ scarta gli scatti e spegne la fotocamera', async () => {
  const { track } = fakeCamera();
  const onClose = vi.fn();
  const onDone = vi.fn();
  const { unmount } = render(
    <CameraCapture previews={EMPTY} start={0} onDone={onDone} onClose={onClose} />,
  );
  await screen.findByText('1920×1440');
  await shutter();
  await userEvent.click(screen.getByRole('button', { name: /close camera/i }));
  expect(onClose).toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
  unmount();
  expect(track.stop).toHaveBeenCalled();
});

test('fotocamera negata: messaggio che rimanda alla fotocamera del telefono', async () => {
  fakeCamera().getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
  render(<CameraCapture previews={EMPTY} start={0} onDone={noop} onClose={noop} />);
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toMatch(/phone camera/i);
});
