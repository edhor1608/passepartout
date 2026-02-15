# Phase 1 Knowledge (2026-02-15)

## Problem

Implement executable, testable milestones of P17 without drifting from locked recommendation policy and white-canvas rules.

## What Was Implemented

- Deterministic recommendation engine (`recommend`) with mode/surface/orientation/workflow inputs.
- Deterministic analyze engine (`analyze`) with file input and tier classification output.
- Analyze media inspector expanded from `PPM` to `PNG`, `JPEG`, `MP4`, and `MOV`.
- Video probing baseline added with `ffprobe` (`width`, `height`, `aspect`, `orientation`, `codec`, `fps`).
- Analyze metadata baseline extended for video to include `duration_seconds` and `bitrate_kbps`.
- Analyze metadata baseline extended for audio presence with `has_audio` and `audio_codec`.
- Analyze metadata baseline extended for detailed audio fields: `audio_channels`, `audio_sample_rate_hz`, `audio_bitrate_kbps`.
- Added `export-image` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing.
- Added `export-video` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing (`MP4`/H.264 output).
- `export-video` contract now includes output-probed metadata (`output_width`, `output_height`, `output_codec`, `output_fps`).
- `export-video` contract now includes output audio-strip proof fields (`output_has_audio`, `output_audio_codec`).
- Externalized rules in `config/ruleset.v1.json`.
- White-canvas policy logic for feed profiles with workflow-gated `feed_app_direct` fallback.
- Locked margin formula v1 and contain/no-crop invariant flags.
- CLI command and JSON/human outputs.
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

## Deferred

- Remaining audio stream metadata (`channel_layout`, `sample_fmt`) and color metadata are still deferred.
- Advanced video export/transcode policies (audio mapping, bitrate controls, codec variants beyond baseline MP4/H.264).
- Empirical quality validation harness.
