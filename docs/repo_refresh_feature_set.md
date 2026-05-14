# Repo Refresh Feature Set

## Purpose

This document inventories the feature set now present on `main` after the repo-refresh stack. It is not the final v1 scope decision. Its job is to name the product capabilities clearly enough that a later pass can split code and files into:

- a production-ready v1 branch, and
- a follow-up branch that preserves useful but out-of-scope lab work.

## Current Product Shape

The repo currently behaves like an Instagram media export lab, but the intended v1 product is much smaller:

1. A PNG, JPEG, or TIFF source image the user wants to post goes in.
2. A ready-to-upload highest-quality baseline sRGB JPEG comes out.
3. The output should use the best practical format, dimensions, and aspect ratio for Instagram image quality.
4. Every output should place the source image on a solid white canvas, creating a polaroid-ish look while still producing the correct final aspect ratio.
5. v1 targets manual upload through the Instagram app, not scheduler/API upload.
6. v1 needs portrait and landscape variants. Landscape outputs should remain real landscape images, not portrait-canvas posts.
7. v1 uses maximum sRGB targets: `2160x1440` for landscape and `1440x1920` for portrait. It should not export larger-than-target images.
8. v1 has only these two output shapes.
9. v1 auto-detects portrait vs landscape from input dimensions after EXIF orientation by default; square inputs use the portrait path.
10. The minimum white border should be configurable as a non-negative integer in pixels; the v1 default is `165px`, converted from `124pt`, and `0px` is valid. Fitting should adapt automatically to the source image.
11. Landscape outputs should keep an equal `165px` outer border and may use centered crop inside the image to preserve that border; portrait outputs should use centered contain fit and preserve the full image with at least the minimum border.
12. V1 should expose one user-facing command, tentatively `prepare-image <input> --out <file-path> [--border-px <integer>]`.
13. `prepare-image --help` should show a one-line usage string and only `--out` / `--border-px`.
14. `--out` must be a full file path, not a directory.
15. V1 should normalize the output extension to `.jpg` automatically, replacing any provided non-JPEG extension.
16. V1 should create missing parent directories for `--out`.
17. V1 should not overwrite existing outputs by default; it should write to `name-1.jpg`, `name-2.jpg`, and so on when needed.
18. V1 should always print the actual written output path. Normal metadata stripping should not print a warning.
19. V1 failures should print a concise error to stderr and exit non-zero.
20. V1 should strip source EXIF/XMP metadata while still exporting sRGB.
21. V1 should composite transparent source pixels onto white.
22. V1 should respect EXIF orientation visually before stripping metadata.
23. V1 should never upscale source images; small sources should export smaller canvases with the same target ratio and proportionally equivalent white borders.
24. The configured border is defined at full target size and scales down proportionally for smaller no-upscale outputs.
25. Scaled borders should round to the nearest integer pixel, minimum `1px` when configured border is greater than `0`; configured `0px` stays `0px`.
26. Small no-upscale outputs should use integer dimensions on the target ratio grid: landscape multiples of `3x2`, portrait multiples of `3x4`.
27. V1 should use FFmpeg as the image processing engine.
28. V1 should not optimize for output file size or show file-size warnings.

The current code supports three broad feature groups:

1. Core media decision and export workflows.
2. Operator checks and production hardening.
3. Lab, validation, and empirical-research scaffolding.

That distinction matters because some modules are clean v1 candidates, while others are valuable but may be too much for a first production release.

## Public Command Surface

| Command | Capability | Primary files | Current scope read |
| --- | --- | --- | --- |
| `recommend` | Select upload profile for mode, surface, orientation, workflow, and optional white canvas. | `src/cli/recommend.ts`, `src/domain/recommend.ts`, `src/domain/rules.ts`, `src/domain/white_canvas.ts` | Strong v1 candidate. This is the smallest deterministic product core. |
| `analyze` | Inspect image/video dimensions, aspect, codec, bitrate, audio, and color metadata, then classify tier. | `src/cli/analyze.ts`, `src/domain/analyze.ts`, `src/domain/media_inspector.ts`, `src/domain/tier.ts` | Strong v1 candidate, but metadata breadth should stay practical. |
| `export-image` | Produce deterministic still-image export with profile-driven resolution and optional white canvas. | `src/cli/export_image.ts`, `src/domain/export_image.ts`, `src/domain/export_profiles.ts` | Strong v1 candidate. |
| `export-video` | Produce deterministic H.264 MP4 export, strip audio, and report output probe fields. | `src/cli/export_video.ts`, `src/domain/export_video.ts`, `src/domain/export_profiles.ts` | Likely v1 candidate if video export is part of v1. Audio behavior needs an explicit decision. |
| `report` | Build checklist and next actions from analysis, upload workflow, API file-size, codec/audio, and color metadata. | `src/cli/report.ts`, `src/domain/report.ts` | V1 candidate as an operator-facing safety layer. |
| `report-export` | Export media, re-analyze output, and compare input/output resolution, bitrate, colorspace, audio, PSNR, and SSIM. | `src/cli/report_export.ts`, `src/domain/report_export.ts`, `src/domain/objective_metrics.ts` | Borderline. Useful for QA, maybe too lab-heavy for user-facing v1. |
| `benchmark` | Score report-export output and assign grade plus capped confidence. | `src/cli/benchmark.ts`, `src/domain/benchmark.ts` | Likely out of v1 unless framed as internal QA. Current confidence is intentionally not empirical. |
| `validate-matrix` | Run benchmark cases from JSON, filter cases, export JSON/Markdown/CSV capture artifacts, and optionally fail on errors. | `src/cli/validate_matrix.ts`, `src/domain/validate_matrix.ts` | Likely out of user-facing v1. Valuable for internal/research branch. |
| `watch-folder` | Batch-export changed media files from an input directory with stateful dedupe and bounded polling. | `src/cli/watch_folder.ts`, `src/domain/watch_folder.ts` | Borderline. Nice automation, but broadens v1 beyond deterministic single-file export. |
| `overlay` | Generate crop-safe overlay geometry/SVG for `4:5`, `3:4`, and `9:16`. | `src/cli/overlay.ts`, `src/domain/overlay.ts` | Borderline. Useful companion feature, not required for export core. |
| `grid-preview` | Generate Instagram grid crop geometry/SVG for `4:5`, `3:4`, and `9:16`. | `src/cli/grid_preview.ts`, `src/domain/grid_preview.ts` | Borderline. Useful companion feature, not required for export core. |
| `doctor` | Check local prerequisites, writable dirs, and required fixtures. | `src/cli/doctor.ts` | Out of v1 product surface. Keep only as developer/support tooling if needed. |

## Domain Feature Groups

### 1. Recommendation Policy

Current capability:

- Modes: `reliable`, `experimental`.
- Surfaces: `feed`, `story`, `reel`.
- Feed orientations: `portrait`, `square`, `landscape`.
- Upload workflows: `app_direct`, `api_scheduler`, `unknown`.
- Rules loaded from `config/ruleset.v1.json`.

V1 read:

- Keep `reliable` policy as the production default.
- Treat `experimental` as likely out-of-scope for production v1 unless the product explicitly wants research profiles visible.
- Keep workflow awareness because `app_direct` vs `api_scheduler` changes real behavior and warnings.

### 2. White-Canvas Export

Current capability:

- Feed white-canvas profiles: `feed_compat` at `1080x1350`, `feed_app_direct` at `1080x1440`.
- Non-feed contain variants: `story_default`, `reel_default`.
- Styles: `gallery_clean`, `polaroid_classic`.
- Margin formula and no-crop invariants have unit/property coverage.

V1 read:

- Keep `gallery_clean`.
- Decide whether `polaroid_classic` is product scope or a preserved experiment.
- Decide whether non-feed white canvas is v1 or later; it is useful but expands the mental model.

### 3. Media Inspection

Current capability:

- Image parsing for PPM, PNG, JPEG.
- Video probing for MP4/MOV through `ffprobe`.
- Metadata includes dimensions, orientation, codec, fps, duration, bitrate, audio presence, audio codec/channels/layout/sample rate/sample format/bitrate, and colorspace.

V1 read:

- Keep dimensions, aspect, orientation, codec, duration, bitrate, and audio presence.
- Audio-detail fields may be more than v1 needs unless report/export decisions depend on them.
- Color metadata currently supports warnings, but the repo does not yet deeply normalize or transform profiles.

### 4. Deterministic Export

Current capability:

- Image export through `ffmpeg`.
- Video export through `ffmpeg`, H.264 output, `yuv420p`, `+faststart`, CRF defaults, and audio stripping.
- Export profiles loaded from `config/export_profiles.v1.json`.
- Media subprocesses isolated in `src/domain/media_process.ts`.

V1 read:

- This is the strongest production feature after recommendation/analyze.
- The v1 question is not whether export belongs, but how many knobs belong in the first release.
- Audio stripping is a product decision, not just an implementation detail.

### 5. Report and Workflow Checks

Current capability:

- Input width baseline.
- Aspect-fit warning.
- Audio present warning for videos.
- H.264 codec preference.
- Upload workflow warning when unknown.
- API scheduler image-size baseline at 8 MiB.
- Color metadata warning when unknown.
- Next-action text for export and app-direct high-quality-upload workflow.

V1 read:

- Good v1 safety layer.
- The report should remain plain and concrete; avoid turning it into a pseudo-certification score.

### 6. Quality Comparison and Benchmarking

Current capability:

- `report-export` compares input/output dimensions, bitrate, colorspace, audio, PSNR, and SSIM.
- `benchmark` assigns score, grade, and capped confidence.
- Confidence is capped because local output evidence is not Instagram upload/download evidence.

V1 read:

- Valuable internal QA.
- Risky as public v1 unless wording is very clear. A "benchmark grade" can imply authority the system does not have.

### 7. Validation Matrix and Capture Artifacts

Current capability:

- JSON case matrix execution.
- Case filtering through `--only`, `--only-file`, `--max-cases`.
- JSON, Markdown, and manual capture CSV outputs.
- Failure gating through `--fail-on-error`.
- Summary aggregation and duration visibility.

V1 read:

- Strong internal/research tooling.
- Probably not production v1 user surface.
- Keep on the saved-work branch if v1 needs to be small.

### 8. Batch Watch Folder

Current capability:

- Scans supported image/video files from an input directory.
- Exports changed files to output directory.
- Tracks file size and mtime in `.watch-state.json`.
- Supports `--once`, polling interval, and max cycles.

V1 read:

- Useful automation, but it expands support burden around filesystem state, dedupe, retries, and partial failures.
- Good candidate for "nice, but maybe later" unless batch export is central to v1.

### 9. Overlay and Grid Preview

Current capability:

- Overlay geometry and SVG output for crop-safe framing.
- Grid-preview square crop geometry and SVG output.
- Ratios: `4:5`, `3:4`, `9:16`.

V1 read:

- Useful companion tools for Instagram planning.
- Not required for core export correctness.
- Could stay in v1 if the product is positioned as a media-prep toolkit, but move later if v1 is only export/report.

### 10. Repo Hardening and Operator Infrastructure

Current capability:

- `AGENTS.md` onboarding.
- README operator guide.
- Bun scripts for typecheck, lint, check, fast/slow/full tests, fixture generation.
- GitHub Actions CI for typecheck, lint, doctor, fast tests.
- Shared CLI argument parsing and help output.
- Config shape validation.
- Test output isolation.

V1 read:

- Keep all of this in v1. It reduces operational risk and does not bloat the user-facing product.

## Preliminary Scope Buckets

### Likely v1 Core

- PNG input analysis needed for export decisions
- image export to the production Instagram target
- always-on white-canvas export for solid-white border/padding without cropping
- manual app-upload target behavior
- maximum sRGB output targets: `2160x1440` landscape and `1440x1920` portrait
- source EXIF/XMP metadata stripping
- exactly two output shapes
- default variant auto-detection from source dimensions after EXIF orientation; square uses portrait
- portrait and landscape image variants, with landscape sources preserved as real landscape outputs
- adaptive minimum-border fitting on fixed final canvases
- landscape equal-border cover/crop fitting
- portrait no-crop contain fitting
- single `prepare-image` command
- v1 CLI options limited to `--out` and `--border-px`
- output path suffixing instead of overwrite-by-default
- plain text output path reporting
- small FFmpeg image processing path
- shared CLI parsing/help
- config loading and validation
- media subprocess adapter
- CI, test split, onboarding docs

### Needs Product Decision

- `experimental` mode
- `api_scheduler` workflow and API-specific checks
- `polaroid_classic` white-canvas style
- non-feed white-canvas contain variants
- `overlay`
- `grid-preview`
- `watch-folder`
- video audio stripping behavior
- how much audio metadata appears in public JSON

### Likely Saved For Later

- `recommend` as a standalone profile-picker surface
- broad `analyze` as a standalone media-inspection surface
- `export-image` as a lab-style standalone command
- `export-video`
- `report`
- `benchmark`
- `validate-matrix`
- `watch-folder`
- `overlay`
- `grid-preview`
- `experimental` mode
- manual capture CSV artifacts
- objective metric scoring as a public promise
- broad e2e snapshot matrix beyond the cases needed to guard v1

## Preparation Notes For The Split Pass

The split should not be purely file-based. Some files contain both v1 and later-scope behavior:

- `src/types/contracts.ts` mixes all public contracts.
- `config/ruleset.v1.json` mixes reliable and experimental policy.
- `config/export_profiles.v1.json` mixes reliable and experimental export profiles.
- `src/domain/white_canvas.ts` includes both baseline style and extra style/profile variants.
- `src/domain/report.ts` is v1-shaped, but wording should be reviewed for production promises.
- `tests/fixtures/e2e` and snapshot generators are much broader than likely v1.

The next pass should first resolve product decisions, then cut. Otherwise the repo risks keeping or deleting code based on file boundaries instead of feature boundaries.

Before cutting broad lab coverage, add focused v1 layout tests for landscape cover/crop, portrait contain, small no-upscale shrink, proportional border scaling, square-to-portrait, `0px` border, and output path suffixing.

The actionable cut plan lives in `docs/v1_split_plan.md`.

## Research Notes For V1 Target

Official Instagram help still describes best-resolution photo uploads as up to `1080px` wide when the aspect ratio is between `1.91:1` and `3:4`. That supports a conservative `1080x1440` target for a `3:4` manual app upload.

The user-provided Stephen Knight Photography article argues from testing that manual Instagram mobile app uploads can benefit from `1440px` wide output. For mobile app uploads, it recommends `1440px` on the horizontal edge across aspect ratios and lists `1440x1920` for `3:4` as the presumed portrait target. It also recommends sRGB export and warns against uploading above the practical target because extra downscaling/compression can hurt quality.

The user-provided NoirAngelPhotography guide, as indexed by search because Reddit returned `429 Too Many Requests` during direct fetch, also argues for a `1440x1920` `3:4` canvas when the goal is full grid visibility and best practical quality. It specifically frames `1440x1920` as the largest supported `3:4` option and recommends fitting the original image inside that canvas with solid-color padding when needed.

Working implication: v1 optimizes for best practical manual app-upload quality rather than official-safe compatibility. The locked product targets are `2160x1440` for landscape and `1440x1920` for portrait, exported in sRGB, with optional white padding used to avoid cropping when the source does not already match the target shape.

Sources:

- Instagram Help Centre: https://www.facebook.com/help/instagram/1631821640426723
- Stephen Knight Photography: https://www.stephenknightphotography.com/post/best-instagram-upload-resolution-in-2025
- NoirAngelPhotography Reddit guide: https://www.reddit.com/user/NoirAngelPhotography/comments/1j4hugh/a_definitiveish_guide_to_how_instagram_handles/

## Commands Used For This Inventory

- `gt sync --no-interactive`
- `git status --short --branch`
- `rg --files`
- `git log -30 --oneline --decorate --date=iso`
- `sed -n` over README, docs, configs, contracts, report, watch-folder, and validate-matrix modules
- `wc -l` over source and tests
