# V1 Split Plan

## Completion Note

The v1 split is implemented in the Graphite stack:

- `codex/v1-image-scope-docs`
- `codex/v1-prepare-image-layout`
- `codex/v1-prepare-image-cli`
- `codex/v1-product-split-cleanup`

The broader lab state is preserved on `origin/codex/saved-instagram-lab-work`.

## Goal

Cut the current repo down to a production v1 that does one thing:

```sh
prepare-image <input> --out <file-path> [--border-px <integer>]
```

The command accepts PNG, JPEG, or TIFF source images and writes one highest-quality baseline sRGB JPEG for manual Instagram app upload.

The current broader lab work should be preserved on a follow-up branch, but removed or hidden from the v1 product surface.

## V1 Product Contract

- Input formats: PNG, JPEG, TIFF.
- Output format: highest-quality baseline sRGB JPEG.
- Output engine: FFmpeg.
- Metadata: respect EXIF orientation visually, then strip source EXIF/XMP metadata from the output.
- Transparency: composite onto white.
- Target selection after EXIF orientation:
  - `width > height`: landscape ratio `3:2`, maximum `2160x1440`.
  - otherwise: portrait ratio `3:4`, maximum `1440x1920`.
  - square uses portrait.
- White canvas: always render source onto white.
- Border:
  - one non-negative integer value.
  - default `57px`.
  - `0px` is valid.
  - landscape uses the effective border as exact equal outer border.
  - portrait uses the effective border as minimum border.
- Landscape fit:
  - center-cover source into the inner frame.
  - crop centered if needed to preserve equal border.
- Portrait fit:
  - center-contain source.
  - preserve full image.
- No upscaling:
  - never enlarge source pixels.
  - if source is too small, export a smaller same-ratio canvas.
  - scale border proportionally from full target.
  - round scaled border to nearest integer, minimum `1px` when configured border is greater than `0`.
  - small landscape dimensions stay on `3x2` multiples; small portrait dimensions stay on `3x4` multiples.
- Output path:
  - `--out` is a full file path, not a directory.
  - normalize output extension to `.jpg`, replacing any provided extension.
  - create missing parent directories.
  - never overwrite existing output.
  - suffix collisions as `name-1.jpg`, `name-2.jpg`, etc.
  - print the actual written path to stdout.
- Errors:
  - concise error to stderr.
  - non-zero exit.
  - no warning for normal metadata stripping.

## Keep In V1

### Product code

- A pure layout module for target selection, border scaling, output dimensions, source placement, and crop/contain math.
- A small output-path module for `.jpg` normalization, parent directory creation, and collision suffixing.
- A small FFmpeg image export path for PNG/JPEG/TIFF to baseline sRGB JPEG.
- One CLI command: `prepare-image`.
- Minimal shared argument parsing/help support if it stays simpler than command-local parsing.
- Minimal media probing needed to know source dimensions after EXIF orientation.

### Tests

- Focused layout unit tests:
  - landscape cover/crop with equal border,
  - portrait contain,
  - small no-upscale shrink,
  - proportional border scaling,
  - square-to-portrait,
  - `0px` border,
  - integer output dimensions on `3x2` and `3x4` grids.
- Output path unit tests:
  - extension replacement,
  - extension addition,
  - directory rejection,
  - parent directory creation,
  - `name-1.jpg` / `name-2.jpg` suffixing.
- CLI tests:
  - success prints actual output path only,
  - failure writes stderr and exits non-zero,
  - `--help` shows one-line usage and only `--out` / `--border-px`,
  - rejects unknown flags,
  - rejects invalid `--border-px`.
- Minimal FFmpeg integration tests:
  - PNG input,
  - JPEG input,
  - TIFF input,
  - transparent input composites to white,
  - EXIF orientation is applied,
  - output dimensions match the layout result,
  - output is JPEG and metadata is stripped where practical.

### Repo support

- `bun run typecheck`.
- `bun run lint`.
- A small fast test script covering v1.
- CI for typecheck, lint, and v1 fast tests.
- Documentation for the one-command workflow.

## Move To Saved-Work Branch

These are useful but out of v1:

- `recommend` as standalone profile picker.
- broad `analyze` CLI and media-inspection report surface.
- old `export-image` lab-style command.
- `export-video`.
- `report`.
- `report-export`.
- `benchmark`.
- `validate-matrix`.
- `watch-folder`.
- `overlay`.
- `grid-preview`.
- `doctor` as user-facing command.
- `experimental` mode.
- `api_scheduler` workflow and API file-size checks.
- `feed_compat`, `feed_app_direct`, story/reel canvas profiles.
- `polaroid_classic` as a named alternate style.
- broad e2e snapshot matrix.
- visual/pixel/property test suites that only guard removed lab behavior.
- committed generated export artifacts that only support removed lab snapshots.

## Implementation Order

### 1. Preserve Current Broad Work

Before cutting v1, create or confirm a saved-work branch from the current broad repo state.

Suggested branch:

```sh
gt create codex/saved-instagram-lab-work --no-interactive
```

If this plan is already merged and v1 work starts from `main`, create the saved-work branch before deleting lab files.

### 2. Add V1 Layout Module First

Create a pure module, for example:

- `src/domain/prepare_image_layout.ts`
- `tests/prepare_image_layout.test.ts`

The module should expose a small structured result:

- variant: `landscape` or `portrait`
- output width/height
- effective border
- source render width/height
- source render offset
- optional crop rectangle for landscape

Do not call FFmpeg from this module.

### 3. Add Output Path Module

Create a small path helper, for example:

- `src/domain/output_path.ts`
- `tests/output_path.test.ts`

It should handle:

- `.jpg` normalization,
- non-JPEG extension replacement,
- directory rejection,
- parent directory creation,
- collision suffixing.

Keep filesystem writes limited to the directory creation and existence checks needed for path resolution.

### 4. Add Prepare-Image Export Function

Create the production image path, for example:

- `src/domain/prepare_image.ts`

Responsibilities:

- inspect source dimensions after EXIF orientation,
- select layout,
- run FFmpeg,
- render white canvas,
- apply source placement/crop,
- convert/ensure sRGB,
- output highest-quality baseline JPEG,
- strip metadata,
- return actual output path.

Keep FFmpeg argument construction testable. Prefer one small adapter call through the existing `media_process.ts` boundary.

### 5. Add Prepare-Image CLI

Create:

- `src/cli/prepare_image.ts`

Command behavior:

```sh
bun run prepare-image --help
bun run prepare-image input.png --out exports/photo
bun run prepare-image input.tiff --out exports/photo.png --border-px 0
```

Only accepted flags:

- `--out <path>`
- `--border-px <integer>`
- `--help`

Success stdout is only the actual written path.

### 6. Wire Package Scripts

Replace the product command surface with:

```json
"prepare-image": "bun run src/cli/prepare_image.ts"
```

Keep only quality/test scripts that still apply to v1.

### 7. Cut Lab Commands And Contracts

After v1 tests exist, remove or move out of production:

- CLI files for removed commands.
- domain files only used by removed commands.
- broad contracts in `src/types/contracts.ts`.
- config profiles and ruleset matrix that no longer apply.
- tests and fixtures only covering removed lab features.

Be conservative around shared helpers. Keep only what `prepare-image` needs.

### 8. Rewrite README And AGENTS

README should show:

- install,
- `prepare-image` usage,
- supported inputs,
- output rules,
- examples,
- quality gate.

AGENTS should reflect:

- this is now a one-command image-prep tool,
- FFmpeg required,
- v1 tests,
- no broad lab command surface.

### 9. Run Gates

Run after each meaningful cut:

```sh
bun run typecheck
bun run lint
bun test tests/prepare_image_layout.test.ts tests/output_path.test.ts
```

Run before submitting:

```sh
bun run check
```

If `check` is redefined during the split, it should mean typecheck, lint, and v1 fast tests.

## Suggested File End State

Approximate target structure:

```text
src/
  cli/
    prepare_image.ts
    args.ts
  domain/
    prepare_image.ts
    prepare_image_layout.ts
    output_path.ts
    media_process.ts
    image_inspector.ts
  types/
    contracts.ts
tests/
  prepare_image_layout.test.ts
  output_path.test.ts
  prepare_image.integration.test.ts
  fixtures/
    images/
```

This is directional, not a rename mandate. Keep existing names if they make the cut smaller and clearer.

## Stop Conditions

Stop and ask before continuing if:

- FFmpeg cannot preserve the required visual orientation without metadata.
- sRGB conversion behavior is unclear or cannot be verified.
- no-upscale plus equal landscape border creates impossible dimensions for a realistic input.
- removing a lab module would require rewriting unrelated infrastructure.
- tests show the current source fixtures are insufficient for the layout guarantees.

## First Branch Recommendation

Start with a narrow tracer branch:

```text
codex/v1-prepare-image-layout
```

Scope:

- pure layout module,
- output path helper,
- unit tests only,
- no deletion of old lab commands yet.

This gives the v1 split a stable core before cutting broad code.
