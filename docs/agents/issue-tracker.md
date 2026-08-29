# Issue tracker: Linear

Issues and implementation work for this repo live in Linear. Use the Linear tools for all operations.

## Conventions

- **Initiatives**: Long-running outcomes or business directions.
- **Projects**: The work container for a feature, product area, or themed effort.
- **Documents**: Detailed planning knowledge such as PRDs, RFCs, research, and project planning
  notes. Attach Documents to the relevant Linear project unless the user asks for a different
  location. Canonical product and engineering decisions remain in the repository's single decision
  log.
- **Issues**: Executable work. Create issues only for work that someone or an agent can actually implement, verify, or decide.
- **Subissues**: Vertical slices or child work under a parent Linear issue. Use `parentId` when breaking an existing issue into slices.
- **Labels**: Use domain labels for product area and the mapped triage labels for workflow state. See `triage-labels.md`.

Keep the Linear project description short: goal, scope, and links to important Documents. Do not use
the project description as a replacement for a PRD/RFC/Research Document.

## Naming conventions

Bracketed prefixes are a naming convention for grouping work by product, effort, surface area, or work type. Preserve established local prefixes instead of inventing a new taxonomy.

- **Project prefixes**: Use the existing bracketed project prefixes for product or effort areas, for example `[Product]`, `[Tooling]`, or another prefix already present in the relevant Linear project.
- **Issue prefixes**: Use existing bracketed issue prefixes for type or surface area, for example `[API]`, `[UI]`, `[Feature]`, `[Milestone]`, or another prefix already present in nearby issues.
- **Domain labels**: Keep domain/product labels separate from workflow labels. Domain labels answer "where does this belong?"; workflow labels such as `AFK`, `HITL`, and `needs-triage` answer "how should this move next?"
- **New work**: Follow the nearest existing Project and Issue naming pattern in this repo/project. If no local pattern is clear, ask before creating new prefixes.

## Common operations

- **Create or update a PRD/RFC/Research artifact**: create or update a Linear Document on the
  relevant project.
- **Record a durable product or engineering decision**: update
  `docs/plans/decisions-log.md`; link it from the relevant Linear plan when useful.
- **Read source material**: fetch the referenced Linear Document, Project, or Issue, including comments when the source is an issue.
- **Create implementation work**: create Linear Issues in the relevant project.
- **Create vertical slices from an existing issue**: create Linear subissues with `parentId`.
- **Represent dependencies**: use Linear issue relations (`blockedBy` / `blocks`) and also mention blockers in the issue body for readability.
- **Comment on work**: use Linear comments on issues. Do not put implementation discussion into Documents unless it changes the durable plan.

## When a skill says "publish to the issue tracker"

For PRDs/RFCs/Research, create or update a Linear Document on the relevant project. Record the
canonical result of a durable product or engineering trade-off in
`docs/plans/decisions-log.md`.

For executable work, create Linear Issues or Subissues in the relevant project.

## When a skill says "fetch the relevant ticket"

Fetch the Linear Issue if the reference points to executable work. Fetch the Linear Document or Project if the reference points to planning or durable knowledge.
