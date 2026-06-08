# Anatomy assets — sources, licenses & attribution

All artwork used in the ZiffyHealth body map is **open-licensed** (Public Domain).
Nothing here carries a copyleft or non-commercial restriction, so it is safe to
ship in the commercial product.

---

## ✅ In use

### `internal-organs.svg`  →  `organs-clean.svg`  (PRIMARY illustration)
- **Title:** “Human anatomy” (a.k.a. “Man shadow anatomy”)
- **Author:** Mariana Ruiz Villarreal (**LadyofHats**)
- **Source:** Wikimedia Commons — https://commons.wikimedia.org/wiki/File:Human_anatomy.svg
  (part of the “Human body diagrams” project)
- **License:** **Public Domain** (released by the author with no conditions worldwide)
- **Attribution string (optional for PD, shown in the UI as courtesy):**
  > Anatomical illustration: “Human anatomy” by Mariana Ruiz Villarreal (LadyofHats) · Wikimedia Commons · Public Domain
- **What it is:** A translucent full-figure (head → pelvis) with realistically
  colored internal organs (brain, lungs, heart, liver, stomach, spleen, pancreas,
  kidneys, intestines, bladder) plus faint vasculature and lymphatics. Mixed
  vector + embedded raster (the organs are high-quality embedded bitmaps); the
  body outline and vessels are vector.
- **Derivation (`organs-clean.svg`):** machine-stripped the 20 `<text>` callout
  labels and the 21 black leader-lines, and added an explicit
  `viewBox="0 0 1363 1212"` so the interactive overlay can register exactly.
  No anatomy paths were altered. Recoloring is **not** applied — the realistic
  organ colors are kept; health status is conveyed by the overlaid zone-colored
  rings + status dots in `body-map-v2.html`.

---

## ⛔ Downloaded, evaluated, NOT used

### `circulatory-system.svg`  /  `circulatory-clean.svg`
- **Title:** “Circulatory System en.svg”
- **Author:** Mariana Ruiz Villarreal (**LadyofHats**)
- **Source:** https://commons.wikimedia.org/wiki/File:Circulatory_System_en.svg
  (original: https://upload.wikimedia.org/wikipedia/commons/2/29/Circulatory_System_en.svg)
- **License:** **Public Domain**
- **Why not used:** This is a beautiful *full-body* (incl. legs) vector vascular
  figure — the closest match to the reference’s red/blue limb vasculature. BUT
  its 55 anatomical labels are **outlined text converted to `<path>` glyphs**
  (not `<text>`), drawn in the same red / blue / purple as the real vessels.
  Removing the `<text>` nodes and the green leader-lines still leaves the label
  *letterforms* baked into the artwork, and they cannot be separated from the
  vessel paths by color. Reliable de-labeling would require manual path surgery.
  Kept here as a reference / future option if someone wants to hand-clean it and
  composite it under the organs for a full-body (with-legs) version.

### `svgrepo-anatomy-body.svg`  — REMOVED
- Not a real asset: the download returned a Vercel “Security Checkpoint” HTML
  page, not an SVG. Deleted.

### `organs-freesvg.svg`  — REMOVED
- 0-byte failed download. Deleted.

---

## Reproduce the cleaning

```bash
# from design/assets/anatomy/
python3 - <<'PY'
import re
# organs: strip <text> labels + black leader lines, add viewBox
o = open('internal-organs.svg').read()
o = re.sub(r'<text\b[^>]*>.*?</text>', '', o, flags=re.DOTALL)
def strip(svg):
    out=[]; last=0
    for m in re.finditer(r'<path\b[^>]*?/>', svg, re.DOTALL):
        seg=m.group(0)
        if 'stroke:#000000' in seg and 'fill:none' in seg:
            out.append(svg[last:m.start()]); last=m.end()
    out.append(svg[last:]); return ''.join(out)
o = strip(o)
o = re.sub(r'(<svg\b[^>]*?)>', r'\1 viewBox="0 0 1363 1212">', o, count=1)
open('organs-clean.svg','w').write(o)
PY
```
