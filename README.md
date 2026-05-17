# Passepartout

One-command image prep for manual Instagram app uploads.

`prepare-image` puts a PNG, JPEG, or TIFF source image on a white canvas and writes a high-quality baseline sRGB JPEG.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH`.

## Install

```bash
bun install --frozen-lockfile
```

## Usage

```bash
bun run prepare-image /full/path/input.png --out /full/path/exports/photo
bun run prepare-image /full/path/input-directory --out /full/path/exports
```

Options:

- `--out <file-path-or-directory>`: required output path. For file input, the extension is normalized to `.jpg`. For directory input, this is the output directory.
- `--border-px <integer>`: optional non-negative border size. Default is `57`. `0` is valid.

Rules:

- Landscape inputs (`width > height`) export as `3:2`, up to `2160x1440`.
- Portrait and square inputs export as `3:4`, up to `1440x1920`.
- Directory inputs process top-level PNG, JPEG, and TIFF files in name order.
- Small inputs are not upscaled; output shrinks while preserving the selected ratio.
- Existing outputs are never overwritten. Collisions use `photo-1.jpg`, `photo-2.jpg`, and so on.
- Success prints only the actual output path.
- EXIF orientation is applied visually before choosing the export ratio.
- EXIF/XMP metadata is stripped from the output.

## Quality Gate

```bash
bun run check
```

This runs typecheck, Biome lint, unit tests, and the v1 integration test.

## Docs

- `docs/v1_split_plan.md`: product contract and split plan.
- `docs/plans/decisions-log.md`: decision log.
- `docs/plans/v1-prepare-image-layout.md`: layout slice notes.
- `docs/plans/v1-prepare-image-cli.md`: CLI slice notes.
