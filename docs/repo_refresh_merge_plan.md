# Repo Refresh Merge Plan

## Goal

Merge the repo-refresh Graphite stack bottom-up with normal code review discipline, not as a blind bulk merge. The stack is already submitted as draft PRs #41 through #55, and the last local verification before this plan was:

- 2026-05-02: `bun run test:ci` passed locally.
- 2026-05-02: `bun run test:slow` passed locally.

## Merge Order

Merge from the bottom of the stack upward:

1. PR #41 `repo-refresh-config-hardening`
2. PR #42 `repo-refresh-onboarding-ci`
3. PR #43 `repo-refresh-export-profile-loading`
4. PR #44 `repo-refresh-agent-guide-cleanup`
5. PR #45 `repo-refresh-shared-cli-args`
6. PR #46 `repo-refresh-media-process-adapter`
7. PR #47 `repo-refresh-config-validation`
8. PR #48 `repo-refresh-temp-test-outputs`
9. PR #49 `repo-refresh-lint-gate-cleanup`
10. PR #50 `repo-refresh-upload-report-checks`
11. PR #51 `repo-refresh-benchmark-confidence-evidence`
12. PR #52 `repo-refresh-pixel-visual-invariants`
13. PR #53 `repo-refresh-media-inspector-split`
14. PR #54 `repo-refresh-cli-help-usage`
15. PR #55 `repo-refresh-report-snapshot-updates`

## Review Plan

Before merging each PR, do a normal code review pass. Focus on bugs, behavioral regressions, missing tests, and confusing changes. Keep review scope tied to that PR; do not use the merge pass to refactor unrelated code.

For PRs #41 through #49, prioritize repo hygiene risks: clean-clone behavior, CI scripts, config loading, CLI parser behavior, adapter boundaries, config validation coverage, test isolation, and lint gate reliability.

For PRs #50 through #55, review more carefully for product semantics: upload workflow policy, API scheduler vs app direct behavior, benchmark confidence wording, visual regression strategy, CLI help output, and snapshot correctness.

Use existing CodeRabbit reviews where available. If CodeRabbit web reviews are missing because of rate limits, try the CodeRabbit CLI for the missing PRs. If the CLI is also unavailable or rate-limited, do a manual review with local diffs:

- `gt checkout <branch>`
- `gt diff`
- `bun run test:ci`
- Add focused test commands when the PR touches slow or e2e behavior.

## Merge Procedure

For each PR:

1. Check Graphite status and CI state.
2. Read existing review comments, including CodeRabbit comments if present.
3. Perform a local code review of the PR diff.
4. Fix only blockers or clearly justified review findings on that branch.
5. Re-run the smallest relevant test first.
6. Run `bun run test:ci` before merging a group of foundational PRs and before any product-facing PR with fixes.
7. Merge through Graphite, then continue to the next PR.

After PR #49 is merged, run:

```sh
bun run test:ci
```

After PR #55 is merged, run:

```sh
bun run test:ci
bun run test:slow
```

## Risk Notes

The stack is large enough that merging everything at once is unnecessary risk. Bottom-up Graphite merging keeps failures local and makes restacking predictable.

The highest product-review value is in PR #50 and PR #51. PR #50 defines upload workflow checks and app-direct guidance. PR #51 changes the meaning of benchmark confidence so automated local evidence cannot claim high empirical confidence.

The highest mechanical-risk PRs are #45 through #47 because they touch shared CLI parsing, subprocess boundaries, and config validation. Those should get close diff review even if tests are green.

## Stop Conditions

Stop the merge pass if any of these happen:

- CI fails and the failure is not clearly unrelated.
- A review comment identifies a real bug or product decision that needs user input.
- Graphite reports stack divergence that cannot be fixed with a straightforward restack.
- A merge conflict requires changing behavior rather than only reconciling moved or nearby lines.

If stopped, document the blocked PR, the failing command or review finding, and the exact next action.

## Execution Status

2026-05-02: Local code review and CodeRabbit follow-up fixes are complete for PRs #41 through #55. `bun run test:ci` and `bun run test:slow` passed locally, all PRs are published, and merge-when-ready has been requested through Graphite.

The merge pass is stopped at PR #41 because `gt merge --dry-run --no-interactive` reports `Needs more reviewers` for every PR in the stack. The stale CodeRabbit change-request reviews on PR #45 and PR #55 were dismissed after their fixes landed and latest CodeRabbit statuses were green. The next action is an external reviewer approval; self-approval is blocked by GitHub.
