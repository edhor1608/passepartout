# V1 Product Split Cleanup

## Context

The docs, layout slice, and first CLI slice established the v1 product contract, but the repo still exposed the older Instagram media lab.
This branch completes the split by keeping only the v1 `prepare-image` product surface.

## Decisions

- Preserved the broad lab state on remote branch `origin/codex/saved-instagram-lab-work` before deletion.
- Removed out-of-scope lab commands, domains, config profiles, generated fixtures, snapshot suites, and broad docs from the v1 branch.
- Rewrote `README.md` and `AGENTS.md` around the one-command product.
- Kept the default border at `57px` after real-image comparison showed `165px` was too wide on the final export.
- Kept only the modules needed for v1: CLI, export orchestration, layout math, output-path resolution, and the FFmpeg process boundary.
- Made the v1 integration test generate PNG/JPEG/TIFF/transparent inputs at runtime so v1 does not need committed lab fixtures.
- Added direct coverage for EXIF orientation before layout selection and EXIF metadata stripping.

## Validation

- `bun run check`

## Lessons learned

- The product split works best as deletion plus a saved lab branch, not feature flags inside v1.
- Real-image comparison corrected the default border from the source-scale `165px` reference to the final-export `57px` value.
- Runtime-generated fixtures keep the v1 test suite small while still covering PNG, JPEG, TIFF, transparency, EXIF orientation, and metadata stripping.
