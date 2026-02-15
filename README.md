# instagram-upload-quality-lab

Phase 1 implements a deterministic `recommend` vertical slice for Instagram profile selection.

Example fixture image used in tests:

- `tests/fixtures/images/portrait_sample_30x40.ppm`

## Install

```bash
bun install
```

## Run CLI

```bash
bun run recommend --mode reliable --surface feed --orientation portrait
```

JSON output:

```bash
bun run recommend --mode reliable --surface feed --orientation portrait --json
```

Analyze from file:

```bash
bun run analyze tests/fixtures/images/portrait_sample_30x40.ppm --mode reliable --surface feed --json
```

Generate crop-safe overlay guide geometry:

```bash
bun run overlay --ratio 4:5 --json
```

Export image using deterministic preset:

```bash
bun run export-image tests/fixtures/images/portrait_sample_30x40.png --out tests/fixtures/exports/demo.jpg --mode reliable --surface feed --json
```

Export image with white-canvas `polaroid_classic` style:

```bash
bun run export-image tests/fixtures/images/landscape_sample_48x32.jpg --out tests/fixtures/exports/demo_white_classic.jpg --mode reliable --surface feed --white-canvas --canvas-profile feed_compat --canvas-style polaroid_classic --json
```

Analyze supports this slice's image fixtures:

- `PPM` (`.ppm`)
- `PNG` (`.png`)
- `JPEG` (`.jpg`, `.jpeg`)

## Test

```bash
bun test
```

Layered test commands:

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
bun run test:visual
bun run test:visual-pixel
bun run test:property
bun run test:all
```

Regenerate snapshots/fixtures when needed:

```bash
bun run fixtures:images
bun run fixtures:images:raster
bun run fixtures:e2e
bun run fixtures:e2e:analyze
bun run fixtures:e2e:overlay
bun run fixtures:e2e:export
bun run fixtures:visual
bun run fixtures:pixel
```
