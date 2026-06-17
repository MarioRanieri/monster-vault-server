#!/usr/bin/env python3
"""
OCR offline check: l'OCR riesce a leggere il NOME/GUSTO stampato sulle lattine?
Scarica un campione di lattine dal sito, fa l'OCR della foto principale e
confronta il testo letto col nome della lattina → stima se l'OCR cattura il gusto.

Avvio:  py ocr_check.py
"""
import sys
import re
import requests
import numpy as np

import config
from ebay_monitor import download_image, HTTP_HEADERS

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SAMPLE = 25
STOP = {"monster", "energy", "drink", "can", "lattina", "ml", "the", "and"}


def norm(s):
    return re.sub(r"[^a-z0-9 ]", " ", (s or "").lower())


def main():
    print("Scarico /api/cans dal sito...")
    cans = requests.get(config.SITE_API_URL, timeout=120, headers=HTTP_HEADERS).json()
    sample = [c for c in cans if c.get("p1") and c.get("nome")][:SAMPLE]

    print("Carico easyocr (la prima volta scarica i modelli ~80MB)...")
    import easyocr
    reader = easyocr.Reader(["en"], gpu=False)

    hits = 0
    done = 0
    for c in sample:
        img = download_image(c["p1"])
        if img is None:
            continue
        done += 1
        texts = reader.readtext(np.array(img), detail=0)
        ocr = norm(" ".join(texts))
        words = [w for w in norm(c["nome"]).split() if len(w) >= 3 and w not in STOP]
        found = [w for w in words if w in ocr]
        ok = bool(found)
        hits += ok
        print(f"[{'OK ' if ok else '   '}] {c['nome'][:30]:<30} -> letto: {ocr[:55]}")

    print(f"\nNome/gusto riconosciuto dall'OCR: {hits}/{done} "
          f"({(100*hits/done if done else 0):.0f}%)")


if __name__ == "__main__":
    main()
