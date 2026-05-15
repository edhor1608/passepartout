# Prepare Image Directory Input

## Problem

Running `prepare-image` once per file works, but manual batch usage needs shell loops. Directory input should keep the same v1 export behavior while removing that repeated command work.

## Decision

When `<input>` is a directory, `--out` is treated as an output directory. The CLI processes top-level PNG, JPEG, and TIFF files in sorted filename order, skips unsupported files, and prints one final output path per export.

## Rationale

The single-image `prepareImage` domain function remains the source of truth for layout and FFmpeg export. Directory mode is only CLI orchestration around that function, so the product surface grows without duplicating image logic.

## Validation

- `bun run check`

## Lessons learned

- Batch mode can stay boring by making file mode and directory mode share the same export path.
- Sorted output gives deterministic stdout and predictable processing without adding extra options.
