# TypeScript 7 Migration

## Problem

The project typechecks with TypeScript 5.9.3 supplied through a `^5` peer dependency. For a private Bun CLI, the compiler is a build tool and should be pinned through `devDependencies`. TypeScript 7 is now stable, but its native compiler changes defaults and no longer exposes the legacy compiler API.

## Research

- The [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) describes 7.0 as the production-ready native compiler release.
- TypeScript 7 defaults `types` to `[]`; this project uses Bun, Node, and web globals supplied by `@types/bun`.
- TypeScript 7.0 has no compiler API. This repository only calls `tsc`, and no dependency imports `typescript`, so that limitation does not apply.

## Experiments

- TypeScript 7.0.2 without explicit ambient types started successfully but reported missing Bun and Node declarations.
- TypeScript 6.0.3 and 7.0.2 both checked the complete project successfully with `--types bun`.
- The TypeScript 7.0.2 check took about 0.15 seconds locally, compared with about 0.49 seconds for the installed TypeScript 5.9.3 compiler. The repository is too small for this benchmark to be an adoption reason.

## Decision

- Move `typescript` from `peerDependencies` to `devDependencies` at `^7.0.2`.
- Select `types: ["bun"]` explicitly in `tsconfig.json`.
- Keep the existing `bunx tsc --noEmit` command and avoid a TypeScript 6 side-by-side installation.

See [decisions-log.md](./decisions-log.md) for the ADR.

## Verification

- `bun install --frozen-lockfile`: passed with no lockfile changes.
- `bunx tsc --version`: reported `Version 7.0.2`.
- `bun run check`: passed typecheck, Biome lint, 10 unit tests, and 10 integration tests.
- `bun run prepare-image --help`: passed the production CLI smoke check.

Independent review is recorded in the final branch/PR history.
