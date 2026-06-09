# CardioQ — Color System

Logo-derived brand palette for **CardioQ.ai**, the cardio-AI engine. Distinct from the ZiffyHealth green system: CardioQ is an **azure→cyan blue heart** with a **coral-red ECG "pulse"** accent, on **blue-black** — dark-native, with an accessible light theme.

**Live swatch:** `swatch.html`

## Core
| Role | Name | Hex |
|---|---|---|
| Primary | Azure | `#1F6FE5` |
| Signal / secondary | Cyan | `#22C3ED` |
| Accent (heartbeat) | Pulse | `#FB5249` |
| Base | Ink (blue-black) | `#0A0F1A` |

**Signature gradient:** `linear-gradient(135deg, #1A4FD0, #1F6FE5 42%, #22C3ED)` — the heart.

## Ramps (50–950)
- **Azure** (primary) · **Cyan** (signal) · **Pulse** (accent) · **Slate** (cool neutral) — full 11-step ramps in `tokens.json` / `tokens.css`.

## Files
| File | What |
|---|---|
| `swatch.html` | Visual palette + applied dark/light theme previews |
| `tokens.json` | Source of truth (core, ramps, gradient, semantic light/dark, type) |
| `tokens.css` | CSS custom properties (`--cq-*`); light default, dark via `[data-theme="dark"]` / `prefers-color-scheme` |

## Rules
- **Blue leads, cyan signals, pulse alerts.** Pulse (coral-red) is the heartbeat — vitals, alerts, the ECG line, live states. High-impact, low-frequency; **never a large fill** (reads as danger at scale).
- **Dark-native.** Design dark-first (the mark lives on black), then the light theme.
- **WCAG-AA:** on light, use `--cq-secondary #11718F`, `--cq-accent #D4231D`, `--cq-primary-solid #1659C4` for text + white-text buttons; the lighter `-solid` cyans are for fills with dark text.
- **Keep separate from ZiffyHealth green.** Co-brand with logos, not by mixing palettes.

## Type
Outfit (display) · Plus Jakarta Sans (body) · JetBrains Mono (mono).
