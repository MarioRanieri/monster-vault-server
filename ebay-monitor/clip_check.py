#!/usr/bin/env python3
"""
Validazione CLIP OFFLINE (senza eBay).
Usa le foto multi-angolo delle tue lattine sul sito per misurare quanto bene il
CLIP distingue "stessa lattina" da "lattine diverse", e suggerisce una soglia.

Per ogni foto calcola:
  - intra : max similarità verso le ALTRE foto della STESSA lattina (deve essere ALTA)
  - inter : max similarità verso foto di ALTRE lattine               (deve essere PIÙ BASSA)
La soglia ideale (CLIP_THRESHOLD) sta tra le due distribuzioni.

Avvio:  py clip_check.py
"""
import sys
import numpy as np
import requests

import config
from ebay_monitor import embed, download_image, HTTP_HEADERS

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MAX_CANS = 40   # campione: limita download e tempo


def main():
    print("Scarico /api/cans dal sito...")
    cans = requests.get(config.SITE_API_URL, timeout=120, headers=HTTP_HEADERS).json()

    multi = []
    for c in cans:
        photos = [c.get(s) for s in ("p1", "p2", "p3", "p4") if c.get(s)]
        if len(photos) >= 2:
            multi.append((c.get("nome") or c.get("id") or "?", photos))
    print(f"  {len(multi)} lattine con ≥2 foto; uso le prime {min(MAX_CANS, len(multi))}.")
    multi = multi[:MAX_CANS]

    imgs, owner = [], []
    for i, (nome, photos) in enumerate(multi):
        for u in photos:
            im = download_image(u)
            if im is not None:
                imgs.append(im); owner.append(i)
    if len(imgs) < 4:
        print("Troppe poche immagini scaricate. Stop.")
        return

    print(f"Embedding CLIP di {len(imgs)} foto...")
    E = embed(imgs)                 # (N, d) normalizzati
    owner = np.array(owner)
    S = E @ E.T                     # (N, N) cosine
    np.fill_diagonal(S, -1.0)       # ignora la similarità con sé stessa

    intra, inter = [], []
    for a in range(len(imgs)):
        same = (owner == owner[a]); same[a] = False
        if same.any():
            intra.append(float(S[a, same].max()))
        diff = (owner != owner[a])
        if diff.any():
            inter.append(float(S[a, diff].max()))
    intra, inter = np.array(intra), np.array(inter)

    def stats(x):
        return (f"min {x.min():.2f}  p10 {np.percentile(x,10):.2f}  "
                f"mediana {np.median(x):.2f}  max {x.max():.2f}")

    print("\n=== RISULTATI ===")
    print(f"STESSA lattina (intra): {stats(intra)}")
    print(f"ALTRE lattine  (inter): {stats(inter)}")
    lo, hi = np.percentile(intra, 10), np.percentile(inter, 90)
    print(f"\nSoglia suggerita ~ {round((lo + hi) / 2, 2)}  (p10 stessa={lo:.2f}, p90 altre={hi:.2f})")
    print("Trade-off per soglia:")
    for t in (0.80, 0.82, 0.85, 0.88, 0.90):
        tp = (intra >= t).mean() * 100
        fp = (inter >= t).mean() * 100
        print(f"  soglia {t:.2f}:  stessa-lattina riconosciute {tp:4.0f}%  |  falsi positivi {fp:4.0f}%")


if __name__ == "__main__":
    main()
