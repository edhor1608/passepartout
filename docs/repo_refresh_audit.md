# Repo Refresh Audit

I reviewed the repo, docs, tests, configs, and current Instagram-quality context. I also ran:

- `bunx tsc --noEmit`: passes.
- local clean clone smoke: `bun install --frozen-lockfile && bun run test:unit`: passes.
- full `bun test` in this checkout: `236 pass`, `6 fail`, all failures were 5s timeout kills in slow ffmpeg/validate-matrix/e2e cases.

## Main Finding

The project has a good seed: small TypeScript domain modules, deterministic CLI slices, typed contracts, real fixture media, and real ffmpeg integration. The problem is that it is still "AI milestone code": lots of repeated CLI parsing, oversized snapshots, weak project onboarding, no CI quality gate, and tests that look broad but are not organized around confidence.

The repo is usable by an agent that already knows the machine. It is not yet ready for a fresh-clone agent workflow.

## Clean-Clone Gaps

### P0

- Document prerequisites: Bun version, TypeScript, `ffmpeg`, `ffprobe`, and fixture-generation caveat that `sips` is macOS-only.
- Add scripts: `typecheck`, `lint`, `format`, `check`, `test:fast`, `test:ci`, `test:slow`.
- Add CI that actually runs install, typecheck, lint, fast tests, and selected integration tests.
- Stop relying on default Bun 5s test timeout for ffmpeg-heavy tests. Either split slow tests or set explicit per-test timeout.
- README still contains a local absolute path and phase/status placeholders. It needs to become an operator guide.

### P1

- Replace `CLAUDE.md` with project-specific `AGENTS.md`: how to install, run, test, regenerate fixtures, expected tools, known slow tests, architecture map.
- Fix config loading consistency. `rules.ts` dirty change moves to module-relative loading; `export_profiles.ts` still uses `process.cwd()`.
- Add a `doctor` command or `preflight` script that checks Bun, ffmpeg, ffprobe, fixture presence, and writable temp/output dirs.

## Code Cleanup

The biggest slop is CLI duplication. Every CLI repeats hand-rolled parsing with casts like `next as Mode`. Create one small shared parser/validator layer and keep commands thin.

Other cleanup:

- Validate JSON configs fully. `rules.ts` only partially validates; `export_profiles.ts` trusts parsed JSON entirely.
- Move ffmpeg/ffprobe calls behind a small adapter. Domain code currently mixes policy, filesystem, and subprocess execution.
- Keep domain pure where possible: `recommend`, `tier`, `white_canvas`, `overlay`, `grid_preview` are good examples.
- `media_inspector.ts` is 411 lines and doing too much. Split by format or parser.
- The benchmark is not a true Instagram benchmark. It measures local export characteristics, not platform recompression or post-download quality.

## Testing Assessment

Useful tests:

- Unit tests for `recommend`, `white_canvas`, `tier`, `rules`, `overlay`, `grid_preview`.
- Media inspector tests with real PNG/JPEG/MP4/MOV fixtures.
- CLI integration tests that prove real commands and artifacts work.
- Failure-mode tests in `validate_matrix`.

Weak or misleading tests:

- Many e2e snapshot tests mostly assert current JSON shape. They catch accidental output changes, but they do not prove the product is correct.
- Pixel snapshots are 102MB of tracked PPM files. They test the in-repo simulated renderer, not actual ffmpeg output or Instagram output.
- Visual ASCII snapshots are cheap but mostly formula regression tests.
- `benchmark` confidence is self-referential: it rewards fields being present, not empirical confidence.
- Slow tests are mixed into normal test runs, causing timeout failures.

Missing coverage:

- CLI `--help`/usage consistency.
- Missing-value parsing bugs, e.g. flags without values.
- Config schema invalid cases beyond top-level ruleset.
- ffmpeg/ffprobe missing or incompatible.
- Temp-dir isolation; tests should not write shared fixture output names.
- Real-world photo cases: EXIF orientation, large JPEGs, color profiles, wide-gamut input, progressive JPEG, noisy gradients, sharp text, screenshots.
- Instagram-specific validation: API-compatible vs app-direct-compatible output rules.

## Linting/Quality Gate

Add Biome or ESLint, plus project rules/conventions:

- no `any`
- no unsafe enum casts in CLI parsing
- no `process.cwd()` for bundled config paths
- no direct `Bun.spawnSync` outside media adapters
- no tests writing outside temp dirs except explicit fixture-generation scripts
- no committed generated export outputs
- enforce `typecheck`, `lint`, `test:fast` before PR
- optional custom lint: CLI commands must use shared parser and shared error envelope

## Instagram Research Implications

Current repo assumptions are partly right, but need to be sourced and encoded as policy.

What current sources indicate:

- Instagram Help Center search result says photos are best up to 1080px wide, preserving resolution between 320 and 1080px wide if aspect ratio is within the accepted range; current Help Center snippets now mention up to 3:4 for app uploads.
- Buffer's current scheduler docs say API publishing still needs images between 4:5 and 1.91:1, and explicitly notes 3:4 is supported in Instagram's app but not Buffer/API publishing. This validates having separate `app_direct` and `api_scheduler` policy paths.
- Practical defaults remain: feed portrait `1080x1350`, square `1080x1080`, landscape `1080x566`, stories/reels `1080x1920`.
- Buffer's 2026 guide says grid previews are now 3:4, so the repo's grid-preview feature is directionally useful.
- High-quality upload settings matter for app uploads. Later recommends enabling high-quality uploads, exporting outside Instagram, and avoiding in-app editing/stickers for best video quality.

## Product Direction

The project should become an "Instagram media export lab," not just a preset picker. The next good version should clearly support:

- `app_direct`: can experiment with 3:4 / `1080x1440`, high-quality-upload workflow notes.
- `api_scheduler`: conservative 4:5 / `1080x1350`, 8MB/API-compatible checks.
- `quality report`: concrete warnings about size, aspect, file size, color profile, codec, audio, and upload path.
- `export`: deterministic artifacts plus a manifest explaining why each setting was chosen.
- `empirical lab`: manual upload/download capture, not fake "confidence."

## Recommended Order

1. Add `AGENTS.md`, prerequisite docs, scripts, CI, and test split.
2. Fix test timeouts and temp-dir isolation.
3. Extract shared CLI parsing and config validation.
4. Split ffmpeg/ffprobe adapters from domain policy.
5. Replace bulky pixel snapshots with smaller focused fixtures or generated-on-demand visual checks.
6. Update rules/docs using the app-direct vs API distinction from research.
7. Redefine benchmark/confidence so it measures real evidence, not internal output shape.

## Refresh Stack Notes

### 2026-05-01: onboarding and CI slice

Context: The P0 clean-clone gaps were blocking fresh agents and CI from knowing which local tools are required or which tests are safe to run as a normal PR gate.

Decision: Add root `AGENTS.md`, rewrite `README.md` as an operator guide, add `typecheck`/`lint`/`check`/`test:fast`/`test:ci`/`test:slow` scripts, add a `doctor` CLI, and add a GitHub Actions CI workflow that installs Bun, ffmpeg, dependencies, then runs typecheck, lint, doctor, and fast tests.

Rationale: This keeps the first refresh branch focused on making the existing repo executable from a clean clone without changing product behavior. Slow ffmpeg-heavy suites remain available through explicit timeout-backed scripts instead of being mixed into the default fast gate.

Consequence: CI now depends on `@biomejs/biome` and Ubuntu `ffmpeg`. Future cleanup branches can tighten lint scope or add slow scheduled jobs once existing code is normalized.

### 2026-05-01: export profile loading consistency

Context: The audit identified that `rules.ts` was moving toward module-relative config loading while `export_profiles.ts` still depended on `process.cwd()` and trusted parsed JSON.

Decision: Load the default export profile config relative to the module and reject missing top-level `image`/`video` keys with a clear error.

Rationale: CLI behavior should not depend on the caller's current directory, and malformed config should fail at load time instead of surfacing later as undefined profile lookups.

Consequence: Validation is still intentionally shallow. Full profile schema validation remains part of the broader config cleanup item.

### 2026-05-01: agent guide replacement

Context: The audit called out `CLAUDE.md` as a generic tool guide that did not document this project.

Decision: Remove `CLAUDE.md` after adding the project-specific root `AGENTS.md`.

Rationale: Keeping both files invites agents to follow stale generic Bun notes instead of the repo's actual setup, test split, and fixture workflow.

Consequence: Agent onboarding now has one canonical root guide.

### 2026-05-01: shared CLI argument parsing

Context: The audit identified repeated CLI parsing, unsafe enum casts, and missing-value parsing bugs as a major cleanup target.

Decision: Add `src/cli/args.ts` with shared flag value, integer, positional, and literal-union parsers, then migrate all CLI entry points to use it instead of `next as Mode`-style casts.

Rationale: The smallest useful fix is to centralize value extraction and validation while leaving command-specific option shapes in each existing CLI file. This removes the bug class where `--mode --surface feed` treats `--surface` as a mode value.

Consequence: Commands still own their own required-argument checks and range checks. A deeper parser abstraction can wait until there is a stronger reason to collapse command-specific parsing further.

### 2026-05-01: media subprocess adapter

Context: The audit identified direct `Bun.spawnSync` calls for ffmpeg/ffprobe in production domain modules.

Decision: Add `src/domain/media_process.ts` with `runFfmpeg` and `runFfprobe`, then route export, inspection, and objective-metric subprocess calls through it.

Rationale: This isolates process execution without changing ffmpeg argument construction or domain behavior. It is the smallest useful boundary for future missing-binary handling and subprocess tests.

Consequence: Fixture-generation scripts still call `Bun.spawnSync` directly because they are test tooling, not product domain behavior.

### 2026-05-01: full config shape validation

Context: The audit identified shallow config validation: malformed nested rules or export profile fields could load successfully and fail later as undefined lookups or bad ffmpeg settings.

Decision: Validate all required ruleset and export-profile branches, required mode/surface/orientation entries, profile string fields, resolutions, risk levels, quality, CRF, and boolean fields during config load.

Rationale: Config files are part of the product contract. Loader-time validation gives deterministic, actionable errors and prevents partial configs from reaching recommendation/export logic.

Consequence: Validation remains hand-written to avoid adding a schema dependency for two small local JSON files.

## Sources

- [Instagram Help Center](https://www.facebook.com/help/1631821640426723/)
- [Buffer aspect ratio requirements](https://support.buffer.com/article/622-instagrams-accepted-aspect-ratio-ranges)
- [Buffer Instagram sizes 2026](https://buffer.com/resources/instagram-image-size/)
- [Tailwind API image requirements](https://support.tailwindapp.com/en/articles/2082658-what-types-of-images-can-i-use-with-tailwind-for-instagram-s-auto-post-feature)
- [Later high-quality upload guide](https://later.com/resources/videos/how-to-upload-high-quality-reels-on-instagram/)
