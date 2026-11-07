# AGENTS.md

## Purpose

This repo is a v1 Instagram image-prep tool. The production surface is one command:

```bash
bun run prepare-image <input> --out <file-path-or-directory> [--border-px <integer>]
```

The command accepts PNG, JPEG, and TIFF images or a directory of those images, places each image on a white canvas, and exports high-quality baseline sRGB JPEGs for manual Instagram app upload.

The iPhone app in `ios/` applies the same layout to photos from the Photos library. See [iOS App](#ios-app).

## Compatibility

Add compatibility code only for a documented consumer or an explicit
compatibility requirement.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH` are preferred. Bundled fallback binaries are installed through `bun install`.

## Install

```bash
bun install --frozen-lockfile
```

## Quality Gates

Use `bun run check` before PRs. It runs TypeScript 7 typechecking, type-aware Oxlint, Oxfmt verification, unit tests, and the v1 integration test.
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

## iOS App

`ios/` holds a SwiftUI iPhone app that frames photos picked from the Photos library and saves each result as a new photo. Its layout is a Swift port of `src/domain/prepare_image_layout.ts`. `tests/layout_parity.test.ts` generates the fixture the port must match. After a deliberate layout change, regenerate it with `UPDATE_LAYOUT_PARITY=1 bun test tests/layout_parity.test.ts`.

The app needs Xcode 26 or newer and `xcodegen` (`brew install xcodegen`). The kit tests run on the Mac host, so `check` and `test` also need macOS 26 or newer.

```bash
make -C ios check         # swift-format lint, kit tests on the Mac and the simulator, app build
make -C ios test          # kit tests on the Mac host only
make -C ios run           # build, install, and launch on the booted simulator
make -C ios build-device  # signed build for a real iPhone
make -C ios format        # apply swift-format
```

- `ios/PassepartoutKit/`: all logic and tests: layout port, photo framer, session, Photos bridge.
- `ios/Passepartout/`: the SwiftUI app shell.
- `ios/project.yml`: the xcodegen spec. The generated `ios/Passepartout.xcodeproj` is gitignored.

## Branch Knowledge

For feature branches, update the relevant markdown in `docs/plans/` with the problem, decisions, commands run, and lessons learned.

## Agent skills

### Issue tracker

Executable work is tracked in Linear Issues/Subissues; durable planning knowledge lives in Linear Documents. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the repo triage mapping with Linear `AFK` for agent-ready work and `HITL` for human-led work. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: read root `CONTEXT.md` and root decision docs before domain-sensitive work. See `docs/agents/domain.md`.
