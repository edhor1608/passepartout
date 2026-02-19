# Phase 1 Knowledge (2026-02-15)

## Problem

Implement executable, testable milestones of P17 without drifting from locked recommendation policy and white-canvas rules.

## What Was Implemented

- Deterministic recommendation engine (`recommend`) with mode/surface/orientation/workflow inputs.
- Deterministic analyze engine (`analyze`) with file input and tier classification output.
- Analyze media inspector expanded from `PPM` to `PNG`, `JPEG`, `MP4`, and `MOV`.
- Video probing baseline added with `ffprobe` (`width`, `height`, `aspect`, `orientation`, `codec`, `fps`).
- Added `export-image` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing.
- Added `export-video` CLI baseline using `ffmpeg` with deterministic profile-driven output sizing (`MP4`/H.264 output).
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
- Introduced raster fixture generation (`ffmpeg`) and analyze e2e coverage for PNG/JPEG fixtures.
- Added video fixture generation (`ffmpeg`) and analyze coverage for MP4/MOV fixtures.
- Added export integration/e2e snapshot tests with fixture outputs in `tests/fixtures/exports`.
- Added export-video integration/e2e snapshot tests and dedicated export-video snapshot fixtures.

## Deferred

- Advanced video inspection fields (`bitrate`, `duration`, audio stream metadata, color metadata).
- Advanced video export/transcode policies (audio mapping, bitrate controls, codec variants beyond baseline MP4/H.264).
- Empirical quality validation harness.
