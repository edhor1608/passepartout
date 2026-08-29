# Passepartout

Passepartout is a deterministic, local photo finisher. Its canonical product surface is the
scriptable `prepare-image` CLI: give it one original or a directory of originals and it creates
predictable JPEG exports for manual upload.

The current recipe prepares PNG, JPEG, and TIFF originals for Instagram on a white canvas. That is
the first clear recipe, not a mandate to become either an Instagram publishing suite or a generic
matrix of platforms, styles, modes, and presets.

## What makes Passepartout special

### 1. A boring happy path

The normal workflow should be one command with strong defaults and no image-engine knowledge
required from the user. New controls must solve a demonstrated finishing need that a safe default
cannot handle. Do not silently guess when export correctness or image quality is uncertain; fail the
affected operation with a concise, actionable error.

### 2. Trustworthy artifacts

Originals are read-only. Export rules are deterministic and existing files are not overwritten. A
completed run reports the paths it actually wrote. A successful process or an existing file is not
enough: the rendered artifact is the product.

### 3. Local and cross-platform

Photo finishing stays local. Uploading, scheduling, and social-account management are outside the
product core. macOS, Linux, and Windows are equal product surfaces; do not bake one machine's path,
shell, process, or binary behavior into product code.

### 4. One canonical workflow

The CLI remains the stable, scriptable product boundary. A future GUI may drive the same domain
workflow, but must not invent a second image engine, conflicting defaults, or different artifact
semantics.

## A note from Jonas

I want to select, finish, and post my photos. I do not want to manage export parameters, color
profiles, and filename collisions by hand every time. Let the implementation absorb that complexity
without leaking it back into the normal workflow.

## Product language

Use the complete glossary in `CONTEXT.md`. In normal discussion, keep these distinctions:

- **original**: a user-owned PNG, JPEG, or TIFF photo that Passepartout reads without modifying;
- **export**: a generated baseline JPEG; the current recipe's product contract requires sRGB
  delivery;
- **preparation run**: one `prepare-image` invocation for a file or directory;
- **batch**: a preparation run over supported top-level originals in one directory;
- **white canvas**: the solid background of the current recipe, not merely a technical border.

Do not call an original an input image or an export an output image when the ownership distinction
matters.

## How it works

`prepare-image` parses the command and decides whether the input is one original or a directory. A
batch sorts supported top-level files by name and sends every original through the same
`prepareImage` workflow. That workflow resolves a collision-safe `.jpg` path, probes dimensions and
orientation, asks the pure layout model for the target geometry, and invokes FFmpeg through the
media-process boundary. FFmpeg renders the original onto the white canvas, writes a high-quality
baseline JPEG, and strips original metadata. The CLI prints only actual export paths on success and a
concise error to stderr on failure.

Keep this causal path coherent. The CLI should stay boring, product decisions should stay
deterministic and testable without media I/O where possible, and filesystem/FFmpeg behavior should
remain at narrow side-effect boundaries.

## Current recipe invariants

- File and directory inputs accept PNG, JPEG, and TIFF. Batches are top-level only and run in
  filename order.
- Wider-than-tall originals use landscape `3:2`, up to `2160x1440`. All others, including squares,
  use portrait `3:4`, up to `1440x1920`.
- Landscape uses a centered cover crop to preserve an equal outer border. Portrait uses centered
  contain fit to preserve the complete original.
- The full-size default border is `57px`; `0px` is valid. Smaller no-upscale exports scale the border
  proportionally.
- Never upscale original pixels. Never exceed the selected target size.
- Apply visual orientation before choosing layout. Composite transparency onto white. The product
  contract requires a high-quality baseline sRGB JPEG with original EXIF/XMP metadata removed.
- Normalize export extensions to `.jpg`. Never overwrite: allocate `photo.jpg`, `photo-1.jpg`, and
  so on, and print the path actually written.
- Successful stdout is an interface for scripts. Do not add logs, warnings, summaries, or engine
  terminology to it. Failures go to stderr and exit non-zero.

If a task changes one of these rules, update the behavior, direct tests, `CONTEXT.md`, and user-facing
README together. Do not preserve a conflicting legacy path behind a hidden mode.

## Known live contract gaps

- **sRGB is required but not proved.** The current FFmpeg graph scales and composites pixels and
  selects a JPEG pixel format, but it does not explicitly perform ICC-aware conversion or attach an
  sRGB profile. The integration suite does not prove wide-gamut conversion. Treat the sRGB lane as
  unverified until the renderer and tests enforce it; do not report it as current live evidence.
- **Batch failure is not atomic.** A batch writes exports sequentially but buffers stdout paths until
  every original succeeds. A later failure can therefore leave earlier exports on disk without
  reporting them. Never assume a failed batch wrote nothing, and do not infer cleanup paths. A task
  that changes this behavior must explicitly decide and test rollback or partial-result reporting.

## Check the blast radius

Before calling a behavior change done, decide which entries are affected, not affected, or
intentionally unsupported. Test only the relevant combinations, but never omit the decision.

- Invocation: one original and batch; file output and directory output; stdout and stderr.
- Originals: PNG, JPEG, TIFF; landscape, portrait, and square; EXIF rotation and transparency.
- Layout: full-size and small no-upscale; default, zero, and custom border; landscape crop and
  portrait contain.
- Artifact: dimensions, visible pixels, color, metadata, JPEG encoding, extension, collision
  suffixing, and preservation of existing files.
- Media engine: system `ffmpeg`/`ffprobe` and bundled fallback resolution where relevant.
- Platforms: macOS, Linux, and Windows. Inspect current CI before claiming which lanes it proves.
- Surfaces: the canonical CLI and any future client using the same workflow.

## Originals and real test data

Generated fixtures remain the default for automated tests. Agents may also read Jonas's local photos
without separate permission when real camera data or visual composition is relevant. They may write
test exports next to those originals.

Never edit, rename, move, delete, or commit an original. Record every newly created test-export path
at creation time. For an adjacent visual test, choose a unique explicit `--out` basename and confirm
that its normalized `.jpg` path does not exist before the run. Capture the actual path from successful
stdout; delete it automatically only when it matches that pre-checked path. An unexpected suffix or
ambiguous result is not cleanup authority. Never derive cleanup targets from a glob, filename
pattern, suffix range, or directory scan. If ownership of a path is uncertain, leave it in place and
report it. Never commit personal photos or visual-test exports.

## Verifying

Use the smallest proof that observes the changed behavior while iterating, then run the canonical
gate before declaring implementation work complete.

- Pure layout and path behavior: focused Bun tests or `bun run test:unit`.
- CLI, FFmpeg, metadata, and rendered artifact behavior: focused integration cases or
  `bun run test:integration`.
- Complete local gate: `bun run check` for TypeScript 7, type-aware Oxlint, Oxfmt verification, unit
  tests, and the v1 integration suite.
- CLI contract smoke check when parsing or output changes: `bun run prepare-image --help` plus the
  affected success or failure invocation.

The integration fixture helpers invoke system `ffmpeg` and `ffprobe`; a green integration test does
not prove bundled fallback behavior or sRGB conversion. Likewise, one operating system does not
prove the three-platform contract.

Changes to layout, color, orientation, compositing, or JPEG rendering also require visual inspection
of at least one representative export from a real original. Report automated properties and visual
acceptance as separate evidence lanes, then apply the exact-path cleanup rule.

## Documentation and work artifacts

Keep one source of truth per audience:

- explicit code and nearby comments: implementation behavior and constraints that move with it;
- `CONTEXT.md`: canonical product language and relationships;
- `docs/plans/decisions-log.md`: durable product or engineering trade-offs;
- `README.md`: user-visible installation and behavior;
- Linear Documents: detailed plans and durable project knowledge;
- Linear Issues/Subissues: executable work.

Do not create new per-feature Markdown plans. Existing files under `docs/plans/` are historical
records, not templates to extend. Do not add command transcripts, implementation inventories, or
lessons-learned documents by default.

For domain-sensitive work, read `CONTEXT.md`, the decision log, and `docs/agents/domain.md`. For
Linear operations, follow `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.

## Taste

- Keep the common path obvious. Sophisticated internals are justified only when they remove user
  decisions or protect artifact quality.
- Prefer cohesive modules with real ownership over pass-through wrappers and shallow interfaces.
- Keep deterministic geometry and naming logic pure. Concentrate filesystem, process, and codec
  complexity at their boundaries.
- Do not build a generic recipe, profile, or plugin system before multiple proven workflows demand
  the same abstraction.
- Prefer inferred TypeScript types. Validate `unknown` at external boundaries; do not use `any` or
  casting wrappers to hide uncertainty.
- Comments explain why a boundary or non-obvious decision exists and how it is used. Keep them with
  the code they describe; do not narrate line-by-line behavior.
- Test the public behavior and final artifact, not private function shapes. Deleting or reorganizing
  internals should not require ceremonial regression tests when the product contract is unchanged.
- If a rule here conflicts with the task, surface the conflict and get explicit direction before
  breaking the product invariant.
