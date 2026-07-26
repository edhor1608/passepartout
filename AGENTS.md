# AGENTS.md

## Purpose

This repo is a v1 Instagram image-prep tool. The production surface is one command:

```bash
bun run prepare-image <input> --out <file-path-or-directory> [--border-px <integer>]
```

The command accepts PNG, JPEG, and TIFF images or a directory of those images, places each image on a white canvas, and exports high-quality baseline sRGB JPEGs for manual Instagram app upload.

## Prerequisites

- Bun 1.3.6.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH` are preferred. Bundled fallback binaries are installed through `bun install`.

## Install

```bash
bun install --frozen-lockfile
```

## Quality Gates

Use `bun run check` before PRs. It runs TypeScript 7 typechecking, type-aware Oxlint, Oxfmt verification, and the v1 acceptance test.
The acceptance-test oracle calls system `ffmpeg` and `ffprobe`, so local checks still need both tools on `PATH`. A dedicated test removes them from the product process's `PATH` to prove its bundled adapters independently.

## Common Commands

```bash
bun run prepare-image /full/path/input.png --out /full/path/exports/photo
bun run prepare-image /full/path/input-directory --out /full/path/exports
bun run prepare-image /full/path/input.tiff --out /full/path/exports/photo.png --border-px 0
bun run prepare-image --help
```

## Test Layers

- `bun run test`: every acceptance test with an explicit 60 second per-test timeout.
- `bun run test:integration`: the v1 command and Image engine acceptance test.

## Architecture Map

- `src/cli/prepare_image.ts`: argv and stdout/stderr adapter.
- `src/domain/prepare_image.ts`: deep Prepare image workflow module for source discovery, staging, atomic output allocation, commit, and rollback.
- `src/domain/image_engine.ts`: deep concrete Image engine module for FFmpeg/ffprobe adapters, orientation, layout, white-canvas rendering, and JPEG export.

## Branch Knowledge

Record durable architecture or product decisions immediately in `docs/plans/decisions-log.md`. Keep executable work in Linear and prefer explicit code plus local comments over new slice Markdown.

## Agent skills

### Issue tracker

Executable work is tracked in Linear Issues/Subissues; cross-repository and project planning knowledge lives in Linear Documents. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the repo triage mapping with Linear `AFK` for agent-ready work and `HITL` for human-led work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: read `CONTEXT.md` and `docs/plans/decisions-log.md` before domain-sensitive work. See `docs/agents/domain.md`.
