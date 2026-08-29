# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This is a single-context repo.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/plans/decisions-log.md`** for durable product and engineering decisions.
- Existing files under **`docs/plans/`** only when their historical branch context is directly
  relevant. Revalidate them against the live source and decision log.

Do not create new per-feature plan or ADR files. Update the living context or decision log only when
its owned truth changes.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   └── plans/
│       └── decisions-log.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, either you're inventing language the project doesn't use or there's a real gap. Note it for `grill-with-docs`.

## Flag decision conflicts

If your output contradicts an existing decision record, surface it explicitly rather than silently overriding it.
