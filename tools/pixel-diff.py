#!/usr/bin/env python3
"""Pixel diff for shots/grok-size before/after pairs.
Reports mean absolute error (0-255 scale), the share of pixels whose max
channel delta exceeds 8 and 32, and writes a heatmap per pair."""
import sys, json, glob, os
import numpy as np
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else 'shots/grok-size'
out = {}
for b in sorted(glob.glob(os.path.join(d, 'before-*.png'))):
    a = b.replace('before-', 'after-')
    if not os.path.exists(a): continue
    x = np.asarray(Image.open(b).convert('RGB')).astype(np.int16)
    y = np.asarray(Image.open(a).convert('RGB')).astype(np.int16)
    diff = np.abs(x - y); m = diff.max(axis=2)
    name = os.path.basename(b)[7:-4]
    out[name] = {'meanAbs': round(float(diff.mean()), 3), 'pct>8': round(float((m > 8).mean() * 100), 3), 'pct>32': round(float((m > 32).mean() * 100), 3)}
    heat = np.clip(m * 4, 0, 255).astype(np.uint8)
    Image.fromarray(heat).save(os.path.join(d, f'diff-{name}.png'))
print(json.dumps(out, indent=1))
json.dump(out, open(os.path.join(d, 'pixel-diff.json'), 'w'), indent=1)
