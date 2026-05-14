# V1 Prepare Image Layout

## Context

V1 needs one reliable command: `prepare-image <input> --out <file-path> [--border-px <integer>]`.
Before wiring FFmpeg, the layout math and output path rules need to be isolated and tested because they define the product behavior.

## Decisions

- Added `computePrepareImageLayout` as a pure domain function.
- Landscape sources use a `3:2` canvas capped at `2160x1440`, equal outer border, and centered cover crop.
- Portrait and square sources use a `3:4` canvas capped at `1440x1920`, centered contain fit, and no source crop.
- Small inputs shrink to the largest same-ratio canvas that does not require source upscaling.
- Configured borders scale from the full target size and round to the nearest integer, with a minimum of `1px` when the configured border is greater than `0`.
- Added `resolvePrepareImageOutputPath` for `.jpg` normalization, parent directory creation, directory rejection, and readable suffixing.

## Validation

- `bun test tests/prepare_image_layout.test.ts tests/output_path.test.ts`
