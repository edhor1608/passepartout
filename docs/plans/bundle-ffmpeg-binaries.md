# Bundle FFmpeg Binaries

## Problem

The v1 command depends on FFmpeg and ffprobe, but requiring both tools on `PATH` makes setup less predictable for local use and CI.

## Decision

Install `ffmpeg-static` and `ffprobe-static` as package dependencies, but prefer `ffmpeg` and `ffprobe` from `PATH` when available. Use bundled binary paths only as fallback.

## Rationale

This keeps the command boring for users: machines with the known-good system FFmpeg keep using it, and machines without FFmpeg on `PATH` still get a working fallback from `bun install`.

## Validation

- `bun run check`

## Lessons learned

- PATH-first resolution preserves existing output behavior on configured machines while still simplifying setup elsewhere.
- The media process adapter is the right boundary for this change; layout and CLI behavior do not need to know where binaries come from.
- The command can fall back to bundled binaries, but the current integration test fixture helpers still call system `ffmpeg`/`ffprobe`.
