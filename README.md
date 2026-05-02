# instagram-upload-quality-lab

Deterministic Bun CLIs for experimenting with Instagram-oriented media recommendations, exports, reports, and validation matrices.

The project currently supports profile recommendations, media inspection, image/video export through ffmpeg, white-canvas variants, crop-safe overlays, profile-grid previews, watch-folder scans, report-export comparisons, and benchmark summaries.

## Prerequisites

- Bun 1.3 or newer.
- TypeScript through `bunx tsc`.
- `ffmpeg` and `ffprobe` on `PATH`.
- macOS `sips` only if you regenerate raster image fixtures.

## Install

```bash
bun install --frozen-lockfile
bun run doctor
```

## Run

Recommend an upload profile:

```bash
bun run recommend --mode reliable --surface feed --orientation portrait --json
```

Analyze fixture media:

```bash
bun run analyze tests/fixtures/images/portrait_sample_30x40.png --mode reliable --surface feed --json
```

Export an image:

```bash
bun run export-image tests/fixtures/images/portrait_sample_30x40.png --out tests/fixtures/exports/demo.jpg --mode reliable --surface feed --json
```

Export a video:

```bash
bun run export-video tests/fixtures/images/portrait_video_360x640.mp4 --out tests/fixtures/exports/demo.mp4 --mode reliable --surface reel --json
```

Generate overlay and grid-preview geometry:

```bash
bun run overlay --ratio 4:5 --json
bun run grid-preview --ratio 4:5 --json
```

Run a validation matrix:

```bash
bun run validate-matrix tests/fixtures/matrix/cases_basic.json --json
```

## Quality Gates

```bash
bun run typecheck
bun run lint
bun run check
```

`bun run check` is the normal pre-PR gate: typecheck, lint, and fast tests.

Test layers:

```bash
bun run test:unit
bun run test:fast
bun run test:ci
bun run test:slow
bun run test:all
```

`test:slow` and `test:all` use an explicit 30 second per-test timeout for ffmpeg-heavy cases.

## Fixtures

Source fixtures live under `tests/fixtures/images`. Generated export outputs go to `tests/fixtures/exports`.

Regenerate fixtures only when behavior intentionally changes:

```bash
bun run fixtures:images
bun run fixtures:images:raster
bun run fixtures:e2e
bun run fixtures:visual
bun run fixtures:pixel
```

`fixtures:images:raster` depends on macOS `sips`. Video fixture generation depends on `ffmpeg`.

## Docs

- `AGENTS.md`: fresh-clone setup, quality gates, architecture map, and agent workflow notes.
- `docs/repo_refresh_audit.md`: refresh audit findings, decisions, and follow-up order.
- `docs/phase1_knowledge.md`: previous milestone implementation notes.

<!-- status:start -->
## Status
- State: active
- Summary: Repo refresh stack in progress.
- Next: Submit Graphite stack after checks pass.
- Updated: 2026-05-01
- Branch: `repo-refresh-onboarding-ci`
- Working Tree: clean
- Last Commit: chore: add repo refresh onboarding and CI
<!-- status:end -->
