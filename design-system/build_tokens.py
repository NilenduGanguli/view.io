#!/usr/bin/env python3
"""ZiffyHealth color system generator.

BRAND / UI  = green family only (derived from Ziffy logo) + red (ECG) + green-tinted neutrals.
              No CardioQ blue/cyan. No amber/orange/navy in brand chrome.
CLINICAL    = green -> yellow(amber) -> orange -> red severity scale, used ONLY for
              lab-result zone encoding (the medical convention). Amber/orange never
              appear as brand colors.

OKLCH ramps (perceptually-even) + WCAG contrast checks.
Outputs: tokens.json, tokens.css, swatch.html   |   Re-run: python3 build_tokens.py
"""
import json, math, pathlib
OUT = pathlib.Path(__file__).resolve().parent

# ---------- sRGB <-> OKLab / OKLCH + WCAG ----------
def cbrt(x): return math.copysign(abs(x) ** (1/3), x)
def hex2rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16)/255 for i in (0, 2, 4))
def rgb2hex(r, g, b):
    f = lambda c: max(0, min(255, round(c*255)))
    return "#%02X%02X%02X" % (f(r), f(g), f(b))
def s2l(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def l2s(c): return 12.92*c if c <= 0.0031308 else 1.055*(c**(1/2.4))-0.055
def lin(t): return tuple(s2l(c) for c in t)
def unlin(t): return tuple(l2s(c) for c in t)
def lin2oklab(r, g, b):
    l = 0.4122214708*r+0.5363325363*g+0.0514459929*b
    m = 0.2119034982*r+0.6806995451*g+0.1073969566*b
    s = 0.0883024619*r+0.2817188376*g+0.6299787005*b
    l_, m_, s_ = cbrt(l), cbrt(m), cbrt(s)
    return (0.2104542553*l_+0.7936177850*m_-0.0040720468*s_,
            1.9779984951*l_-2.4285922050*m_+0.4505937099*s_,
            0.0259040371*l_+0.7827717662*m_-0.8086757660*s_)
def oklab2lin(L, a, b):
    l_ = L+0.3963377774*a+0.2158037573*b
    m_ = L-0.1055613458*a-0.0638541728*b
    s_ = L-0.0894841775*a-1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    return (4.0767416621*l-3.3077115913*m+0.2309699292*s,
            -1.2684380046*l+2.6097574011*m-0.3413193965*s,
            -0.0041960863*l-0.7034186147*m+1.7076147010*s)
def hex2oklch(h):
    L, a, b = lin2oklab(*lin(hex2rgb(h)))
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
def oklch2hex(L, C, H):
    hr = math.radians(H)
    mk = lambda c: unlin(oklab2lin(L, c*math.cos(hr), c*math.sin(hr)))
    rgb = mk(C)
    if min(rgb) < -1e-4 or max(rgb) > 1+1e-4:
        lo, hi = 0, C
        for _ in range(28):
            mid = (lo+hi)/2; rgb = mk(mid)
            if min(rgb) < -1e-4 or max(rgb) > 1+1e-4: hi = mid
            else: lo = mid
        rgb = mk(lo)
    return rgb2hex(*rgb)
def rellum(h): r, g, b = lin(hex2rgb(h)); return 0.2126*r+0.7152*g+0.0722*b
def contrast(a, b):
    x, y = rellum(a), rellum(b); x, y = max(x, y), min(x, y)
    return (x+0.05)/(y+0.05)

# ---------- ramps ----------
STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
L = {50:.972, 100:.940, 200:.886, 300:.815, 400:.740, 500:.668, 600:.600, 700:.523, 800:.445, 900:.360, 950:.285}
CM = {50:.30, 100:.45, 200:.62, 300:.80, 400:.93, 500:1.0, 600:1.0, 700:.94, 800:.83, 900:.70, 950:.58}

LOGO_GREEN = "#378224"   # exact Ziffy logo leaf-green (pixel-sampled)  -> PRIMARY
EMERALD    = "#10A05A"   # supporting cooler green (variety: gradients, secondary, charts)
ECG_RED    = "#E5392E"   # Ziffy logo ECG pulse  -> danger / critical
AMBER      = "#F4A52A"   # CLINICAL ONLY: borderline
ORANGE     = "#ED6A0C"   # CLINICAL ONLY: alert

def ramp(anchor, boost=1.0, cmin=0.02):
    _, C0, H0 = hex2oklch(anchor)
    C0 = max(C0, cmin) * boost
    return {s: oklch2hex(L[s], C0*CM[s], H0) for s in STEPS}

GREEN_H = hex2oklch(LOGO_GREEN)[2]
green   = ramp(LOGO_GREEN, 1.18)   # primary leaf green
emerald = ramp(EMERALD,    1.10)   # supporting green
red     = ramp(ECG_RED,    1.08)
amber   = ramp(AMBER,      1.05)   # clinical only
orange  = ramp(ORANGE,     1.05)   # clinical only
neutral = {s: oklch2hex(L[s], 0.0045 + 0.004*CM[s], GREEN_H) for s in STEPS}  # faint green-grey

hero = {  # deep forest-green premium surface (replaces navy)
    "from": oklch2hex(0.17, 0.060, GREEN_H),
    "via":  oklch2hex(0.24, 0.082, GREEN_H),
    "to":   oklch2hex(0.32, 0.098, GREEN_H),
}

BRAND    = {"green": green, "emerald": emerald, "red": red, "neutral": neutral}
CLINICAL = {"amber": amber, "orange": orange}
ALL      = {**BRAND, **CLINICAL}

# ---------- semantic tokens ----------
g, em, rd, n = green, emerald, red, neutral
def zone(name, accent, solid, bg, text): return {f"zone-{name}": accent, f"zone-{name}-solid": solid, f"zone-{name}-bg": bg, f"zone-{name}-text": text}
light = {
    "bg": n[50], "bg-subtle": n[100], "surface": "#FFFFFF", "surface-muted": n[50], "surface-sunken": n[100],
    "border": n[200], "border-strong": n[300], "divider": n[200],
    "text-strong": n[900], "text": n[800], "text-muted": n[600], "text-subtle": n[500], "text-inverse": "#FFFFFF",
    "primary": g[700], "primary-emphasis": g[600], "primary-bright": g[500], "primary-logo": LOGO_GREEN,
    "primary-hover": g[800], "primary-active": g[900], "primary-subtle": g[50], "primary-subtle-text": g[800], "on-primary": "#FFFFFF",
    "secondary": em[600], "secondary-subtle": em[50], "on-secondary": "#FFFFFF",
    "accent": g[500], "focus": g[500], "ink-deep": hero["to"],
    "success": g[700], "danger": rd[700], "warning": amber[700], "info": g[600],
    # clinical zones — green -> amber -> orange -> red (medical convention; clinical use only)
    **zone("normal",     g[600],     g[700],     g[50],     g[800]),
    **zone("borderline", amber[600], amber[700], amber[50], amber[800]),
    **zone("alert",      orange[600], orange[700], orange[50], orange[800]),
    **zone("critical",   rd[600],    rd[700],    rd[50],    rd[800]),
}
dark = {
    "bg": hero["from"], "bg-subtle": hero["via"], "surface": n[900], "surface-muted": n[800], "surface-sunken": "#0a1a10",
    "border": n[800], "border-strong": n[700], "divider": n[800],
    "text-strong": n[50], "text": n[100], "text-muted": n[400], "text-subtle": n[500], "text-inverse": n[950],
    "primary": g[400], "primary-emphasis": g[300], "primary-bright": g[400], "primary-logo": g[400],
    "primary-hover": g[300], "primary-active": g[200], "primary-subtle": "#10241a", "primary-subtle-text": g[200], "on-primary": n[950],
    "secondary": em[400], "secondary-subtle": "#0c2418", "on-secondary": n[950],
    "accent": g[400], "focus": g[400], "ink-deep": hero["from"],
    "success": g[400], "danger": rd[400], "warning": amber[400], "info": g[400],
    **zone("normal",     g[400],     g[500],     "#10241a", g[200]),
    **zone("borderline", amber[400], amber[500], "#241a06", amber[200]),
    **zone("alert",      orange[400], orange[500], "#241204", orange[200]),
    **zone("critical",   rd[400],    rd[500],    "#240b0a", rd[200]),
}

# ---------- contrast report ----------
def tag(r): return "AAA" if r >= 7 else ("AA" if r >= 4.5 else ("AA-lg" if r >= 3 else "FAIL"))
def chk(label, fg, bg): r = contrast(fg, bg); print(f"  {label:30} {fg}/{bg}  {r:4.2f}  {tag(r)}")
print("=== CONTRAST (light) ===")
chk("body / surface", light["text"], light["surface"])
chk("muted / surface", light["text-muted"], light["surface"])
chk("white / primary(green700)", "#FFFFFF", light["primary"])
for z in ["normal", "borderline", "alert", "critical"]:
    chk(f"white / {z}-solid", "#FFFFFF", light[f"zone-{z}-solid"])
chk("white / hero-to", "#FFFFFF", hero["to"])

# ---------- write tokens.json + tokens.css ----------
tokens = {
    "meta": {"brand": "ZiffyHealth", "source": "Ziffy logo (pixel-sampled)", "space": "OKLCH",
             "anchors": {"green": LOGO_GREEN, "emerald": EMERALD, "red": ECG_RED, "amber": AMBER, "orange": ORANGE},
             "rules": {"brand_ui": "green family + red + neutral only (no blue/cyan/amber/orange/navy)",
                       "clinical_only": ["amber", "orange"], "report_branding": "CardioQ retained"}},
    "ramp": BRAND, "clinical": CLINICAL, "hero": hero, "semantic": {"light": light, "dark": dark},
    "type": {"display": "Sora", "body": "Plus Jakarta Sans", "mono": "JetBrains Mono"},
}
(OUT/"tokens.json").write_text(json.dumps(tokens, indent=2))
cb = lambda d: "\n".join(f"  --{k}: {v};" for k, v in d.items())
rv = "\n".join(f"  --{nm}-{s}: {ALL[nm][s]};" for nm in ALL for s in STEPS)
css = f""":root {{
  /* ZiffyHealth ramps — brand: green, emerald, red, neutral · clinical-only: amber, orange */
{rv}
  --green-logo: {LOGO_GREEN};
  --hero-from: {hero['from']}; --hero-via: {hero['via']}; --hero-to: {hero['to']};
{cb(light)}
  --font-display:'Sora',system-ui,sans-serif; --font-body:'Plus Jakarta Sans',system-ui,sans-serif; --font-mono:'JetBrains Mono',ui-monospace,monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
{cb(dark)}
}} }}
[data-theme="dark"] {{
{cb(dark)}
}}
"""
(OUT/"tokens.css").write_text(css)

# ---------- swatch.html ----------
def tcol(hx): return "#0B1929" if rellum(hx) > 0.45 else "#FFFFFF"
def rowsw(nm):
    cells = "".join(f'<div class=sw style="background:{ALL[nm][s]};color:{tcol(ALL[nm][s])}"><b>{s}</b><span>{ALL[nm][s]}</span></div>' for s in STEPS)
    return f'<div class=ramp><div class=rl>{nm}</div><div class=cells>{cells}</div></div>'
brand_ramps = "".join(rowsw(nm) for nm in ["green", "emerald", "red", "neutral"])
clin_ramps = "".join(rowsw(nm) for nm in ["amber", "orange"])
zones = "".join(f'<div class=chip style="background:var(--zone-{z}-solid);color:#fff">{z.upper()}</div>' for z in ["normal", "borderline", "alert", "critical"])
zpills = "".join(f'<span class=pill style="background:var(--zone-{z}-bg);color:var(--zone-{z}-text)">{z}</span>' for z in ["normal", "borderline", "alert", "critical"])
swatch = f"""<!doctype html><html lang=en data-theme=light><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>ZiffyHealth Color System</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel=stylesheet>
<link rel=stylesheet href="tokens.css">
<style>
*{{box-sizing:border-box}} body{{margin:0;font-family:var(--font-body);background:var(--bg);color:var(--text);padding:40px 48px}}
h1{{font-family:var(--font-display);font-weight:800;font-size:30px;color:var(--text-strong);margin:0 0 4px}}
.sub{{color:var(--text-muted);margin:0 0 26px;max-width:780px}}
h2{{font-family:var(--font-display);font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-muted);margin:30px 0 12px;border-bottom:1px solid var(--border);padding-bottom:8px}}
.tag{{font-size:11px;font-weight:600;color:var(--primary);background:var(--primary-subtle);padding:2px 9px;border-radius:50px;margin-left:8px;text-transform:none;letter-spacing:0}}
.ramp{{display:flex;align-items:center;gap:14px;margin:8px 0}} .rl{{width:70px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);text-align:right;text-transform:capitalize}}
.cells{{display:grid;grid-template-columns:repeat(11,1fr);flex:1;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12)}}
.sw{{padding:16px 8px 10px;display:flex;flex-direction:column;gap:3px;font-family:var(--font-mono)}} .sw b{{font-size:11px}} .sw span{{opacity:.85;font-size:9px}}
.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:6px 0 18px}}
.btn{{font-family:var(--font-body);font-weight:600;border:none;border-radius:11px;padding:11px 22px;cursor:pointer}}
.btn-pri{{background:var(--primary);color:var(--on-primary)}} .btn-sec{{background:var(--secondary);color:var(--on-secondary)}} .btn-ghost{{background:var(--primary-subtle);color:var(--primary-subtle-text)}}
.chip{{font-weight:700;font-size:12px;letter-spacing:.06em;padding:6px 16px;border-radius:50px}}
.pill{{font-size:12px;font-weight:600;padding:4px 12px;border-radius:50px;text-transform:capitalize}}
.card{{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;max-width:520px;box-shadow:0 6px 20px rgba(0,0,0,.06)}}
.bar{{height:10px;border-radius:5px;margin:14px 0;background:linear-gradient(90deg,var(--zone-critical) 0%,var(--zone-alert) 16%,var(--zone-borderline) 30%,var(--zone-normal) 45%,var(--zone-normal) 62%,var(--zone-borderline) 76%,var(--zone-alert) 88%,var(--zone-critical) 100%)}}
.hero{{background:linear-gradient(135deg,var(--hero-from),var(--hero-via),var(--hero-to));color:#fff;border-radius:18px;padding:28px 30px;margin:10px 0}}
.toggle{{position:fixed;top:20px;right:24px}} .val{{font-family:var(--font-mono);font-weight:700}}
.dot{{display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--green-logo);vertical-align:middle;margin-right:6px}}
</style></head><body>
<button class="btn btn-ghost toggle" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme=='dark'?'light':'dark'">toggle theme</button>
<h1>ZiffyHealth Color System</h1>
<p class=sub><span class=dot></span>Green family derived from the <b>Ziffy logo</b> ({LOGO_GREEN}) + ECG red + green-tinted neutrals. OKLCH ramps, WCAG-checked. One source for every app &amp; frontend.</p>
<h2>Brand ramps <span class=tag>UI / chrome</span></h2>{brand_ramps}
<h2>Clinical severity <span class=tag>lab data only — never brand chrome</span></h2>{clin_ramps}
<h2>Buttons &amp; surfaces</h2>
<div class=row><button class="btn btn-pri">Primary</button><button class="btn btn-sec">Emerald</button><button class="btn btn-ghost">Subtle</button>
<a href=# style="color:var(--primary);font-weight:600">Link text</a></div>
<h2>Clinical zones &mdash; green &rarr; yellow &rarr; orange &rarr; red</h2>
<div class=row>{zones}</div><div class=row>{zpills}</div><div class=bar></div>
<h2>Applied &mdash; hero &amp; sample panel</h2>
<div class=hero><div style="font-family:var(--font-display);font-weight:800;font-size:22px">Ziffy<span style="color:var(--green-400)">Health</span> <span style="font-size:12px;opacity:.6;font-weight:400">powered by CardioQ.ai</span></div>
<div style="color:var(--green-300);font-size:13px;margin-top:6px">Deep forest-green premium surface</div></div>
<div class=card><div style="font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--text-strong)">LDL Cholesterol <span class=pill style="background:var(--zone-alert-bg);color:var(--zone-alert-text);float:right">Alert</span></div>
<div style="font-size:30px;color:var(--zone-alert)" class=val>148 <span style="font-size:13px;color:var(--text-muted)">mg/dL</span></div>
<div class=bar></div><div style="font-size:13px;color:var(--text-muted)">Optimal &lt;100 · Borderline 100&ndash;129 · High 130+</div></div>
</body></html>"""
(OUT/"swatch.html").write_text(swatch)
print("\nWROTE tokens.json, tokens.css, swatch.html")
print("brand greens: primary", g[700], "emphasis", g[600], "logo", LOGO_GREEN, "| emerald", em[600])
print("clinical: amber", amber[700], "orange", orange[700], "red", rd[700])
