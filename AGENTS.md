# AGENTS.md

## Purpose

This repo is a v1 Instagram image-prep tool. The production surface is one command:

```bash
bun run prepare-image <input> --out <file-path-or-directory> [--border-px <integer>]
```

The command accepts PNG, JPEG, and TIFF images or a directory of those images, places each image on a white canvas, and exports high-quality baseline sRGB JPEGs for manual Instagram app upload.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH` are preferred. Bundled fallback binaries are installed through `bun install`.

## Install

```bash
bun install --frozen-lockfile
```

## Quality Gates

Use `bun run check` before PRs. It runs typecheck, Biome lint, unit tests, and the v1 integration test.
The integration test fixture helpers call system `ffmpeg` and `ffprobe`, so local checks still need both tools on `PATH`.

## Common Commands

```bash
bun run prepare-image /full/path/input.png --out /full/path/exports/photo
bun run prepare-image /full/path/input-directory --out /full/path/exports
bun run prepare-image /full/path/input.tiff --out /full/path/exports/photo.png --border-px 0
bun run prepare-image --help
```

## Test Layers

- `bun run test:unit`: pure layout and output path tests.
- `bun run test:integration`: the v1 CLI/FFmpeg integration test.
- `bun run test:fast`: unit plus v1 integration tests.
- `bun run test:all`: every Bun test with an explicit 30 second timeout.

## Architecture Map

- `src/cli/prepare_image.ts`: command parsing and stdout/stderr behavior.
- `src/domain/prepare_image.ts`: source probing, layout selection, and FFmpeg export.
- `src/domain/prepare_image_layout.ts`: pure target, border, crop, and contain math.
- `src/domain/output_path.ts`: `.jpg` normalization, parent directory creation, and suffixing.
- `src/domain/media_process.ts`: packaged FFmpeg/ffprobe process boundary.

## Branch Knowledge

For feature branches, update the relevant markdown in `docs/plans/` with the problem, decisions, commands run, and lessons learned.

## Agent skills

### Issue tracker

Executable work is tracked in Linear Issues/Subissues; durable planning knowledge lives in Linear Documents. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the repo triage mapping with Linear `AFK` for agent-ready work and `HITL` for human-led work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: read root `CONTEXT.md` and root decision docs before domain-sensitive work. See `docs/agents/domain.md`.
