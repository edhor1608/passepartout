# AGENTS.md

## Purpose

This repo is a v1 Instagram image-prep tool. The production surface is one command:

```bash
bun run prepare-image <input> --out <file-path> [--border-px <integer>]
```

The command accepts PNG, JPEG, and TIFF images, places them on a white canvas, and exports a high-quality baseline sRGB JPEG for manual Instagram app upload.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH`.

## Install

```bash
bun install --frozen-lockfile
```

## Quality Gates

Use `bun run check` before PRs. It runs typecheck, Biome lint, unit tests, and the v1 integration test.

## Common Commands

```bash
bun run prepare-image /full/path/input.png --out /full/path/exports/photo
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
- `src/domain/media_process.ts`: FFmpeg/ffprobe process boundary.

## Branch Knowledge

For feature branches, update the relevant markdown in `docs/plans/` with the problem, decisions, commands run, and lessons learned.
