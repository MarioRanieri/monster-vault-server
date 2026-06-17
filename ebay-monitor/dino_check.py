#!/usr/bin/env python3
"""
DINOv2 offline check — come clip_check.py ma con embedding DINOv2.
DINOv2 è auto-supervisionato e cattura feature visive fini → dovrebbe distinguere
lo STESSO oggetto molto meglio del CLIP (che vede 'tutte le Monster uguali').

Misura, sulle foto multi-angolo del sito:
  intra = max similarità verso ALTRE foto della STESSA lattina  (deve essere ALTA)
  inter = max similarità verso foto di ALTRE lattine             (deve essere PIÙ BASSA)
Buona separazione intra >> inter = riconoscimento utilizzabile.

NB: le similarità DINOv2 hanno scala diversa dal CLIP (soglie tipiche più basse).
Avvio:  py dino_check.py
"""
import sys
import numpy as np
import requests
import torch
from PIL import Image

import config
from ebay_monitor import download_image, HTTP_HEADERS

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MAX_CANS = 40
MEAN = np.array([0.485, 0.456, 0.406], dtype="float32")
STD  = np.array([0.229, 0.224, 0.225], dtype="float32")

_model = None
def get_model():
    global _model
    if _model is None:
        print("Carico DINOv2 (dinov2_vits14, ~85MB la prima volta)...")
        _model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14",
                                pretrained=True, trust_repo=True)
        _model.eval()
    return _model


def preprocess(img):
    img = img.convert("RGB").resize((224, 224), Image.BICUBIC)
    a = np.asarray(img, dtype="float32") / 255.0
    a = (a - MEAN) / STD
    return torch.from_numpy(a.transpose(2, 0, 1))


@torch.no_grad()
def embed(images):
    model = get_model()
    out = []
    for i in range(0, len(images), 16):
        batch = torch.stack([preprocess(im) for im in images[i:i + 16]])
        feats = torch.nn.functional.normalize(model(batch), dim=1)
        out.append(feats.cpu().numpy())
    return np.concatenate(out, axis=0)


def main():
    print("Scarico /api/cans dal sito...")
    cans = requests.get(config.SITE_API_URL, timeout=120, headers=HTTP_HEADERS).json()
    multi = []
    for c in cans:
        photos = [c.get(s) for s in ("p1", "p2", "p3", "p4") if c.get(s)]
        if len(photos) >= 2:
            multi.append(photos)
    print(f"  {len(multi)} lattine con ≥2 foto; uso le prime {min(MAX_CANS, len(multi))}.")
    multi = multi[:MAX_CANS]

    imgs, owner = [], []
    for i, photos in enumerate(multi):
        for u in photos:
            im = download_image(u)
            if im is not None:
                imgs.append(im); owner.append(i)
    if len(imgs) < 4:
        print("Troppe poche immagini. Stop."); return

    print(f"Embedding DINOv2 di {len(imgs)} foto...")
    E = embed(imgs)
    owner = np.array(owner)
    S = E @ E.T
    np.fill_diagonal(S, -1.0)

    intra, inter = [], []
    for a in range(len(imgs)):
        same = (owner == owner[a]); same[a] = False
        if same.any():
            intra.append(float(S[a, same].max()))
        diff = (owner != owner[a])
        if diff.any():
            inter.append(float(S[a, diff].max()))
    intra, inter = np.array(intra), np.array(inter)

    def stt(x):
        return (f"min {x.min():.2f}  p10 {np.percentile(x,10):.2f}  "
                f"mediana {np.median(x):.2f}  max {x.max():.2f}")

    print("\n=== DINOv2 ===")
    print(f"STESSA lattina (intra): {stt(intra)}")
    print(f"ALTRE lattine  (inter): {stt(inter)}")
    lo, hi = np.percentile(intra, 10), np.percentile(inter, 90)
    print(f"Soglia suggerita ~ {round((lo + hi) / 2, 2)}  (p10 stessa={lo:.2f}, p90 altre={hi:.2f})")
    print("Trade-off per soglia:")
    for t in (0.30, 0.40, 0.50, 0.60, 0.70):
        tp = (intra >= t).mean() * 100
        fp = (inter >= t).mean() * 100
        print(f"  soglia {t:.2f}:  stessa-lattina riconosciute {tp:4.0f}%  |  falsi positivi {fp:4.0f}%")


if __name__ == "__main__":
    main()
