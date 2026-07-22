# Passepartout

Passepartout prepares photos for manual Instagram app upload.

The v1 product surface is one command: `prepare-image`. It accepts a single PNG, JPEG, or TIFF file, or a directory containing those files, places each image on a white canvas, and writes high-quality baseline sRGB JPEG exports.

## What It Does

- Adds the white-canvas look used for the final Instagram post.
- Exports landscape images as `3:2`, up to `2160x1440`.
- Exports portrait and square images as `3:4`, up to `1440x1920`.
- Uses a `57px` default border at full target size.
- Avoids upscaling small source images.
- Applies EXIF orientation before choosing landscape or portrait output.
- Strips EXIF/XMP metadata from the final JPEG.
- Never overwrites existing exports.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH` are preferred. Bundled fallback binaries are installed through `bun install`.

## Install

```bash
bun install --frozen-lockfile
```

## Usage

Prepare one image:

```bash
bun run prepare-image /full/path/input.png --out /full/path/exports/photo
```

Prepare every supported top-level image in a directory:

```bash
bun run prepare-image /full/path/input-directory --out /full/path/exports
```

Set a custom border:

```bash
bun run prepare-image /full/path/input.jpg --out /full/path/exports/photo --border-px 0
```

## Options

- `--out <file-path-or-directory>`: required output path. For file input, this is a file path and the extension is normalized to `.jpg`. For directory input, this is the output directory.
- `--border-px <integer>`: optional non-negative border size. Default is `57`. `0` is valid.

## Output Rules

- File inputs print one output path.
- Directory inputs process top-level PNG, JPEG, and TIFF files in filename order and print one output path per export.
- Existing outputs are suffixed as `photo-1.jpg`, `photo-2.jpg`, and so on.
- Landscape inputs use centered cover fitting into an equal-border inner frame.
- Portrait and square inputs use contain fitting so the full source image remains visible.
- Transparent pixels are composited onto white.

## Quality Gate

```bash
bun run check
```

This runs TypeScript 7 typechecking, type-aware Oxlint, Oxfmt verification, unit tests, and the v1 integration test.
The integration test fixture helpers call system `ffmpeg` and `ffprobe`, so local checks still need both tools on `PATH`.

## Project Structure

- `src/cli/prepare_image.ts`: command parsing, file-vs-directory orchestration, and stdout/stderr behavior.
- `src/domain/prepare_image.ts`: source probing, layout selection, and FFmpeg export.
- `src/domain/prepare_image_layout.ts`: pure target, border, crop, and contain math.
- `src/domain/output_path.ts`: `.jpg` normalization, parent directory creation, and suffixing.
- `src/domain/media_process.ts`: FFmpeg/ffprobe process boundary.
- `tests/integration/prepare_image.integration.test.ts`: CLI and FFmpeg integration coverage.

## Docs

- `docs/v1_split_plan.md`: product contract and split plan.
- `docs/plans/decisions-log.md`: decision log.
- `docs/plans/v1-prepare-image-layout.md`: layout slice notes.
- `docs/plans/v1-prepare-image-cli.md`: CLI slice notes.
- `docs/plans/prepare-image-directory-input.md`: directory input slice notes.
