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
- Converts completely and recognizably tagged non-sRGB sources, strips source EXIF/XMP, and adds only a generated sRGB color marker.
- Never overwrites existing exports.
- Publishes a directory run only after every source has been prepared successfully.

## Prerequisites

- Bun 1.3.6.
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
- Directory outputs are staged as one batch; a failed run publishes none of its outputs.
- Existing outputs are atomically preserved and new outputs are suffixed as `photo-1.jpg`, `photo-2.jpg`, and so on.
- Landscape inputs use centered cover fitting into an equal-border inner frame.
- Portrait and square inputs use contain fitting so the full source image remains visible.
- Transparent pixels are composited onto white.

## Quality Gate

```bash
bun run check
```

This runs TypeScript 7 typechecking, type-aware Oxlint, Oxfmt verification, and the v1 acceptance test.
The independent test oracle calls system `ffmpeg` and `ffprobe`, so local checks still need both tools on `PATH`; the product's bundled fallback is covered in a separate child-process scenario.

## Project Structure

- `src/cli/prepare_image.ts`: argv and stdout/stderr adapter.
- `src/domain/prepare_image.ts`: source discovery, staging, atomic output allocation, commit, and rollback.
- `src/domain/image_engine.ts`: executable selection, orientation, layout, white-canvas rendering, and JPEG export.
- `tests/integration/prepare_image.integration.test.ts`: command and Image engine acceptance coverage.

## Docs

- `CONTEXT.md`: current product vocabulary and behavior.
- `docs/plans/decisions-log.md`: decision log.
