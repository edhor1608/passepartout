# Phase 1 Knowledge (2026-02-15)

## Problem

Implement the smallest executable slice of P17 that validates locked recommendation policy decisions before analyzer/export work.

## What Was Implemented

- Deterministic recommendation engine (`recommend`) with mode/surface/orientation/workflow inputs.
- Deterministic analyze engine (`analyze`) with file input and tier classification output.
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

## Deferred

- `analyze` command and media metadata extraction.
- Any real renderer/export pipeline (FFmpeg/libvips).
- Empirical quality validation harness.
