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
bun run fixtures:e2e
bun run fixtures:e2e:analyze
bun run fixtures:visual
bun run fixtures:pixel
```
