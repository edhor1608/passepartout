# Passepartout

*Pronounced: **PASS-par-too** (`/ˈpæs.pɑːr.tuː/`)*

A photography-first export tool that frames any image with adaptive white canvas and outputs Instagram-optimized formats with reliable and experimental quality modes.

## Why

Instagram quality and framing are inconsistent when source photos come in mixed ratios and resolutions.  
Passepartout creates a consistent visual language (clean white/polaroid framing) while keeping exports aligned with practical Instagram constraints.

## Core Modes

| Mode | Purpose | Output Strategy |
|---|---|---|
| `reliable` | Compatibility-first publishing | Uses safe, orientation-based defaults |
| `experimental` | Research / A-B testing | Tries higher-dimension profiles with explicit risk labels |

## Default Output Targets (Reliable)

| Surface | Target | Ratio |
|---|---|---|
| Feed portrait | `1080x1350` | `4:5` |
| Feed square | `1080x1080` | `1:1` |
| Feed landscape | `1080x566` | `1.91:1` |
| Story / Reel | `1080x1920` | `9:16` |

## White Canvas (Polaroid Feature)

- Preserves the full source image (`contain`, no crop in v1).
- Uses one consistent feed canvas ratio by default (`4:5`).
- Supports optional app-direct profile (`3:4`, `1080x1440`).
- Uses adaptive whitespace by source orientation:
- Portrait/square: balanced margins.
- Landscape: smaller left/right, larger top/bottom margins.

## Planned CLI

- `analyze <file> --mode reliable|experimental --surface feed|story|reel`
- `recommend --mode reliable|experimental --surface ... --orientation ... --white-canvas`

## Status

Planning phase.  
Specs and decision logs are defined before implementation.

## License

Apache License 2.0
