# OWNER: grok-skins lane (Grok). Pixel diff: share of pixels where any channel
# differs by more than THRESH (default 8/255). Usage: python3 tools/grok-skins-diff.py a.png b.png [...pairs]
import sys, json
from PIL import Image, ImageChops
THRESH = 8
args = sys.argv[1:]; out = []
for a, b in zip(args[::2], args[1::2]):
    A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')
    assert A.size == B.size, (a, b, A.size, B.size)
    d = ImageChops.difference(A, B).getdata()
    n = len(d); bad = sum(1 for p in d if max(p) > THRESH); mx = max(max(p) for p in d)
    out.append({'a': a, 'b': b, 'pixels': n, 'over8': bad, 'pct': round(100 * bad / n, 4), 'maxDelta': mx})
print(json.dumps(out, indent=1))
