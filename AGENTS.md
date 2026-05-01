# AGENTS.md

## Purpose

This repo is an Instagram media export lab. It provides deterministic CLI slices for recommending upload profiles, analyzing fixtures, exporting image/video media, generating overlay guides, previewing grid crops, and running validation matrices.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH`.
- macOS `sips` only when regenerating PNG/JPEG raster fixtures with `bun run fixtures:images:raster`.

Run `bun run doctor` after install to verify local tools, writable temp/output directories, and required fixture media.

## Install

```bash
bun install --frozen-lockfile
bun run doctor
```

## Quality Gates

Use `bun run check` before small PRs. It runs typecheck, Biome lint, and fast tests.

Use `bun run test:ci` for the same gate CI runs. Use `bun run test:slow` before changing ffmpeg-heavy export, report-export, benchmark, validate-matrix, e2e, visual, or property behavior.

The full test suite is intentionally explicit about timeout with `bun run test:all`, because ffmpeg-heavy tests should not rely on Bun's default 5 second per-test timeout.

## Common Commands

```bash
bun run recommend --mode reliable --surface feed --orientation portrait --json
bun run analyze tests/fixtures/images/portrait_sample_30x40.png --mode reliable --surface feed --json
bun run export-image tests/fixtures/images/portrait_sample_30x40.png --out tests/fixtures/exports/demo.jpg --mode reliable --surface feed --json
bun run export-video tests/fixtures/images/portrait_video_360x640.mp4 --out tests/fixtures/exports/demo.mp4 --mode reliable --surface reel --json
bun run validate-matrix tests/fixtures/matrix/cases_basic.json --json
```

## Test Layers

- `bun run test:unit`: pure domain and helper tests.
- `bun run test:fast`: unit tests plus lightweight CLI/overlay/grid/watch-folder integration tests.
- `bun run test:slow`: ffmpeg-heavy integration, e2e, visual, and property suites.
- `bun run test:all`: every Bun test with an explicit 30 second timeout.

## Fixture Regeneration

Only regenerate fixtures when behavior intentionally changes.

```bash
bun run fixtures:images
bun run fixtures:images:raster
bun run fixtures:e2e
bun run fixtures:visual
bun run fixtures:pixel
```

`fixtures:images:raster` uses `sips`, so it is macOS-only. Video fixtures use `ffmpeg`.

## Architecture Map

- `src/cli`: command entry points and argument parsing.
- `src/domain`: deterministic policy, analysis, export, report, benchmark, and validation logic.
- `src/types/contracts.ts`: shared public contracts.
- `config`: versioned ruleset and export profile JSON.
- `tests/fixtures`: source media and golden outputs.

## Known Slow Areas

The slowest tests are export, export-video, report-export, benchmark, validate-matrix, e2e snapshots, and pixel visual checks. They invoke ffmpeg, ffprobe, or compare generated media artifacts.

## Branch Knowledge

For feature branches, update the relevant file in `docs/` with the problem, decisions, commands run, and lessons learned. For this refresh stack, use `docs/repo_refresh_audit.md`.
