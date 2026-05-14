# V1 Prepare Image CLI

## Context

The second implementation slice makes the v1 product runnable without deleting the existing lab commands yet.
It builds on the pure layout and output path branch.

## Decisions

- Added `prepare-image` as a Bun script and CLI entrypoint.
- Kept parsing command-local and limited to `<input>`, `--out`, `--border-px`, and `--help`.
- Set the default border to `57px`, matching the desired visual border on a `2160x1440` export.
- Added `prepareImage` as the domain entrypoint for probing, layout, FFmpeg export, metadata stripping, and final path reporting.
- Used `ffprobe` for source dimensions so TIFF and later EXIF-orientation cases can be handled through the media tool boundary.
- Used one FFmpeg filter graph with a white background and overlay so transparent inputs can composite onto white.

## Validation

- `bun test tests/integration/prepare_image.integration.test.ts`
- `bunx tsc --noEmit`
- `biome lint src/cli/prepare_image.ts src/domain/prepare_image.ts tests/integration/prepare_image.integration.test.ts tests/helpers/cli.ts package.json`
