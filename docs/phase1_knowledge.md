# Phase 1 Knowledge (2026-02-16)

## Problem

Implement executable, testable milestones of P17 without drifting from locked recommendation policy and white-canvas rules.

## What Was Implemented

- Deterministic recommendation engine (`recommend`) with mode/surface/orientation/workflow inputs.
- Deterministic overlay guide engine (`overlay`) for crop-safe framing guides (`4:5`, `3:4`, `9:16`) with JSON + SVG output.
- Deterministic profile-grid preview engine (`grid-preview`) for center-square crop simulation (`4:5`, `3:4`, `9:16`) with JSON + SVG output.
- Deterministic watch-folder engine (`watch-folder`) for batch input directories with `--once` scan mode and stateful dedupe.
- Deterministic finite polling for watch-folder via `--max-cycles` to make repeated scan loops testable and bounded.
- Deterministic validation matrix runner (`validate-matrix`) for batch execution of benchmark cases from a JSON matrix file.
- Deterministic objective quality metrics baseline in report-export comparison output (`psnr_db`, `ssim`) via ffmpeg filters.
- Deterministic benchmark confidence baseline (`value`, `label`) derived from output-match, bitrate, and objective metric availability.
- Deterministic validate-matrix aggregate summary output (`avg_total_score`, `avg_confidence`, grade/confidence distributions).
- Deterministic validate-matrix artifact export via `--out-json` for overnight run persistence.
- Deterministic validate-matrix failure gating via `--fail-on-error` for CI/automation workflows.
- Validate-matrix timing visibility via `duration_ms` at run-level and per-case result level.
- Deterministic validate-matrix Markdown summary artifact output via `--out-md`.
- Deterministic validate-matrix case subset filtering via `--only <id1,id2,...>` for targeted reruns.
- Deterministic analyze engine (`analyze`) with file input and tier classification output.
- Deterministic report engine (`report`) layered on analyze output with checklist + next-actions contract.
- Deterministic report-export engine (`report-export`) that executes export and compares input/output media characteristics.
- Deterministic benchmark engine (`benchmark`) built on report-export with stable score/grade outputs.
- Analyze media inspector expanded from `PPM` to `PNG`, `JPEG`, `MP4`, and `MOV`.
- Video probing baseline added with `ffprobe` (`width`, `height`, `aspect`, `orientation`, `codec`, `fps`).
- Analyze metadata baseline extended for video to include `duration_seconds` and `bitrate_kbps`.
- Analyze metadata baseline extended for audio presence with `has_audio` and `audio_codec`.
- Analyze metadata baseline extended for detailed audio fields: `audio_channels`, `audio_sample_rate_hz`, `audio_bitrate_kbps`.
- Analyze metadata baseline extended for additional audio stream detail: `audio_channel_layout`, `audio_sample_format`.
- Added `export-image` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing.
- Added `export-video` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing (`MP4`/H.264 output).
- Added dedicated deterministic export profile registry in `config/export_profiles.v1.json` and wired export commands to profile IDs/default parameters.
- `export-video` contract now includes output-probed metadata (`output_width`, `output_height`, `output_codec`, `output_fps`).
- `export-video` contract now includes output audio-strip proof fields (`output_has_audio`, `output_audio_codec`).
- Externalized rules in `config/ruleset.v1.json`.
- White-canvas policy logic for feed profiles with workflow-gated `feed_app_direct` fallback.
- Locked margin formula v1 and contain/no-crop invariant flags.
- White-canvas style presets:
  - `gallery_clean` (baseline v1 margins)
  - `polaroid_classic` (deterministic larger bottom margin)
- White-canvas support expanded beyond feed to optional `story` and `reel` contain variants (`story_default`, `reel_default`).
- CLI style selection via `--canvas-style <gallery_clean|polaroid_classic>` across `recommend`, `analyze`, `report`, `report-export`, `benchmark`, `export-image`, and `export-video`.
- CLI command and JSON/human outputs.
- Added `report` CLI + domain slice with deterministic checklist checks and stable JSON snapshots.
- Added `report-export` CLI + domain slice with deterministic comparison fields (resolution/bitrate/colorspace/audio).
- Added `benchmark` CLI + domain slice with deterministic scoring breakdown (`resolution`, `bitrate`, `codec`) and grade.
- Layered test suite expansion:
  - unit tests
  - integration tests (CLI behavior and contract checks)
  - e2e tests (snapshot cases + full matrix across mode/surface/orientation/workflow)
  - visual regression tests (ASCII layout snapshots from fixture images)
  - pixel-level visual regression tests (binary snapshot diff)
  - property/invariant tests for margin formula behavior

## What Was Tried

- Tests were written first and run to failure before implementation.
- Strict TypeScript check caught undefined parsing risk in resolution parsing; fixed in `src/domain/rules.ts`.
- Added real image fixtures in `tests/fixtures/images` (PPM) and used them in visual tests.
- Added media inspector baseline for PPM (`P3` + `P6`) and wired analyze e2e snapshot tests.
- Added raster fixture generation (`sips`) and analyze e2e coverage for PNG/JPEG fixtures.
- Added video fixture generation (`ffmpeg`) and analyze coverage for MP4/MOV fixtures.
- Added failing-first tests and analyze snapshot updates for duration/bitrate metadata fields.
- Added audio-video fixture generation and failing-first tests for `has_audio` / `audio_codec`.
- Added failing-first tests and snapshot coverage for detailed audio metadata fields.
- Added export integration/e2e snapshot tests with fixture outputs in `tests/fixtures/exports`.
- Added export-video integration/e2e snapshot tests and dedicated export-video snapshot fixtures.
- Added failing-first export-video assertions to verify returned output metadata against the exported file.
- Added failing-first export-video assertions proving audio is stripped from audio-input videos in baseline export mode.
- Added report integration/e2e snapshot tests and deterministic report fixtures.
- Added report-export integration/e2e snapshot tests and deterministic report-export fixtures.
- Added benchmark integration/e2e snapshot tests and deterministic benchmark fixtures.
- Added failing-first style tests for `white_canvas`, `recommend`, `export-image`, and `export-video`.
- Expanded visual and pixel-level snapshot matrices with `classic` style scenarios.
- Regenerated e2e snapshots for style-enabled analyze/report/export/report-export/benchmark/recommend paths.
- Added failing-first tests for `audio_channel_layout` + `audio_sample_format` and extended analyze/report/report-export/benchmark snapshots.
- Added failing-first tests and e2e cases for non-feed white-canvas behavior (story/reel recommend + export/report/report-export/benchmark flows).
- Added failing-first tests for overlay geometry + CLI output and fixture-based e2e snapshot coverage for overlay ratios.
- Added failing-first tests for profile-grid crop simulation geometry + CLI output and fixture-based e2e snapshot coverage.
- Added failing-first tests for export profile selection and export output profile fields (`export_profile_id`, `quality_used`, `crf_used`).
- Added failing-first integration and e2e snapshot tests for `watch-folder --once` with deterministic processed/skipped/error summaries.
- Added fixture directories for watch-folder coverage (`tests/fixtures/watch`, `tests/fixtures/watch_e2e`) and deterministic state file snapshot baselines.
- Added failing-first integration + e2e coverage for `watch-folder` finite polling (`--interval-sec` + `--max-cycles`) and deterministic multi-cycle output behavior.
- Added failing-first integration + e2e coverage for `validate-matrix` with fixture-based matrix case execution and deterministic snapshot output.
- Added failing-first report-export integration checks for objective metrics fields and regenerated report-export/benchmark/validate-matrix e2e snapshots.
- Added failing-first benchmark integration checks for confidence output and regenerated benchmark/validate-matrix snapshots.
- Added failing-first validate-matrix integration checks for aggregate summary fields and regenerated validate-matrix snapshots.
- Added failing-first validate-matrix integration checks for `--out-json` artifact writing with deterministic payload persistence.
- Added failing-first validate-matrix integration/e2e checks for partial-failure scenarios and non-zero exit gating with `--fail-on-error`.
- Added failing-first validate-matrix timing assertions and snapshot normalization strategy for volatile `duration_ms` fields.
- Added failing-first integration checks for `--out-md` output and Markdown report content.
- Added failing-first validate-matrix integration and e2e snapshot coverage for targeted subset execution via `--only`.

## Deferred

- Remaining advanced media metadata (beyond current audio/video baseline) and color metadata are still deferred.
- Advanced video export/transcode policies (audio mapping, bitrate controls, codec variants beyond baseline MP4/H.264).
- Empirical quality validation harness.
- Additional style profiles beyond `gallery_clean` + `polaroid_classic` remain deferred.
