# 0066 — Deterministic autofix: the fix-side of the tier model

**Status:** IMPLEMENTED (2026-07-06)
**Priority:** Medium
**Effort:** ~2 sessions (kernel fix model → md fixers → CLI → dogfood)

## Problem

eess detects a broken link or a shortened pointer by **computing its unique
resolution** — `pointer-resolve.ts` already finds the one file the pointer
should name (that is how it reports the break vs. an ambiguous case). Emitting
the rewrite is a _byproduct_ of a check we already run; declining to apply it,
just to stay "read-only", hands rote mechanical toil back to the expensive,
probabilistic agent. That is the exact category error the system exists to
prevent (see the manifesto, _Detection and remediation both route by tier_).

So eess grows a deterministic autofix for the **mechanically unambiguous**
subset — the fix-side of the tier model. This also settles the autofix-ownership question: eess owns it, and a hand-built stale-link fixer is subsumed rather than kept as a standalone codemod.

**The honest boundary** (not "validators don't mutate" — linters have `--fix`):
_auto-apply only what is deterministic and unique; route everything else._

| Violation                                             | Remediation                                          |
| ----------------------------------------------------- | ---------------------------------------------------- |
| broken internal link → **one** file resolves          | **auto** — rewrite the URL                           |
| shortened/bare pointer → **one** file (unique suffix) | **auto** — rewrite to the full path                  |
| ambiguous (several files resolve)                     | agent — it chooses; never auto                       |
| stale pointer **line number** (file grew/shrank)      | agent/human — can't derive the new line mechanically |
| missing section/table, drifted spec claim, ADR policy | agent/human — judgment, not a rewrite                |

Soundness contract (unchanged, and sharper here): **a wrong autofix is worse
than none** — it silently corrupts. A fix is emitted only when the resolution
is provably unique; anything less is reported, not written.

## Phase 1 — kernel: a structured fix on the violation

`ArchViolation` gains an optional, engine-neutral text edit. Dialects populate
it; a generic applier consumes it (mirrors ESLint: rules produce fix objects,
the core applies them).

```ts
// packages/core/src/violation.ts
export interface ArchFix {
  /** Absolute file to edit. */
  readonly file: string
  /** Byte/char offsets of the span to replace (from the source the dialect parsed). */
  readonly start: number
  readonly end: number
  /** Replacement text. */
  readonly replacement: string
  /** One-line human description, e.g. "rewrite link → work/refinement/promoted/f1.md". */
  readonly describe: string
}

export interface ArchViolation {
  // …existing fields…
  /** Present only when a deterministic, unique fix exists (0066). */
  readonly fix?: ArchFix
}
```

A generic applier groups fixes by file, sorts by span, rejects overlaps
(overlapping fixes → skip both, report — never guess), and either previews
(dry-run) or writes:

```ts
// packages/core/src/apply-fixes.ts
export interface ApplyResult {
  readonly applied: number
  readonly skipped: number
  readonly files: string[]
}
export function applyFixes(violations: ArchViolation[], opts: { write: boolean }): ApplyResult
```

**Files changed:** `packages/core/src/violation.ts` (field),
`packages/core/src/apply-fixes.ts` (new), `packages/core/src/index.ts` (exports).

**Tests:** apply single/multiple edits in one file; multi-file; overlapping
spans → skipped, not corrupted; dry-run writes nothing; offsets map to the exact
span.

## Phase 2 — eess-md: populate fixes for unique link/pointer resolutions

The resolvers already find the unique target; attach the rewrite. Both carry the
source position of the URL/pointer text (links from mdast, pointers from the
`raw` span), so the `ArchFix` span is exact.

- **Broken internal link, unique resolution.** In `conditions/resolve.ts`: when
  an internal link fails exact resolution but resolves to exactly one file
  (moved/renamed), emit a `fix` rewriting the URL to the repo-relative path.
  Ambiguous → no fix (report).
- **Shortened/bare pointer, unique suffix.** In `conditions/pointer-resolve.ts`:
  when suffix mode resolves a shortened pointer to one file, emit a `fix`
  rewriting the pointer path to the full repo-relative path (line unchanged).
  Ambiguous → no fix; nonexistent → no fix (genuinely broken); stale line → no
  fix (not derivable).

Requires the model to carry the exact character span of the link URL / pointer
path (verify `MdLink`/`MdPointer` positions in-phase; if absent, add them — a
small model change with a test).

**Files changed:** `packages/md/src/conditions/{resolve,pointer-resolve}.ts`;
possibly `packages/md/src/model/{links,pointers}.ts` (span capture);
`packages/md/README.md`.

**Tests:** a moved-file link → fix rewrites to the new path; a shortened pointer
→ fix expands to the full path; ambiguous → **no** fix; nonexistent → **no** fix;
the fix span replaces exactly the URL/path text and nothing else.

## Phase 3 — CLI: `--fix` (dry-run) and `--fix --apply`

`eess-ts check` gains autofix, **safe by default** (matches the external repo's `graph:fix`:
dry-run unless `--apply`), so mutation is never a surprise:

- `eess-ts check <files> --fix` → run the checks, print the edits it _would_
  make (file:span → replacement), write nothing, exit 0 if all remaining
  violations are auto-fixable else 1.
- `eess-ts check <files> --fix --apply` → write the edits, re-report anything
  left (non-auto violations), exit accordingly.

Only violations with a `fix` are applied; the rest print as normal. Loud on
overlaps (skip + report).

**Files changed:** `packages/ts/src/cli/{index,commands/check}.ts` (flags +
applier wiring); `docs/cli.md`.

**Tests:** dry-run lists edits, writes nothing; `--apply` writes and re-checks
clean; a mix (one auto-fixable + one judgment violation) → fixes the first,
reports the second, exits 1.

## Phase 4 — dogfood + supersede the external repo's graph:fix

- Run `npm run check:corpus`-style rules with `--fix` (dry-run) on this repo;
  confirm it proposes only correct rewrites (there should be ~none to fix —
  the corpus is clean — so seed a temp moved-file fixture to prove it, then
  revert).
- Autofix ownership resolved — eess owns it. A hand-built
  `graph-fix-stale-links.ts` is retired in the consolidation, not kept as a
  codemod. `eess:check --fix --apply` replaces `pnpm graph:fix`.
- Non-vacuity: a fix that would be _wrong_ (ambiguous) must never be emitted —
  add a fixture asserting ambiguous resolutions yield no `fix`.

**Files changed:** `work/dogfood-coverage.md` (note),
`packages/md/tests/**` (ambiguous-no-fix fixture).

## Out of scope

- **Fixes beyond unique link/pointer path resolution** — stale line numbers,
  missing sections/tables, drifted spec claims, ADR policy. Those route to
  agent/human by design (manifesto). Not auto.
- **The Enforcement-table `remediation` column** (`auto`/`agent`/`human`) — the
  manifesto names it; wiring it into `adrEnforcement` is a separate plan.
- Autofix in other dialects (eess-ts code edits, mermaid) — this plan is md
  links/pointers, the proven-valuable case (the external repo's `graph:fix`). Generalizing
  the kernel `ArchFix` makes later dialects cheap, but they are their own plans.
- Any git/commit behavior — `--apply` edits files; staging/committing is the
  caller's job.

## Success definition

`eess-ts check --fix` deterministically rewrites broken links and shortened
pointers that resolve uniquely, is dry-run unless `--apply`, and **never** emits
a fix for an ambiguous or non-derivable case (proven by a non-vacuity fixture).
It subsumes a hand-built stale-link fixer (eess owns remediation). The
family's first mutation ships behind the soundness contract: only what is
provably unique is ever written.

## As-built record (2026-07-06)

Phases 1–3 shipped; `npm run validate` green (exit 0). Phase 4 folded in
(dogfood via the CLI smoke test + the ambiguous-no-fix non-vacuity test).

| Phase | Delivered                                                                                                                            | Commit    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 1     | kernel `ArchFix` + `applyFixes` (group by file, end-to-start, skip overlaps, dry-run/write); +5 tests                                | `1c05d2b` |
| 2     | md link/pointer char-span capture + fixes on unique moved-link / shortened-pointer; +5 tests; ambiguous/renamed/unlocatable → no fix | `30b2dfa` |
| 3     | `eess-ts check --fix` (dry-run) / `--fix --apply` (write); `RuleBuilderLike.violations()`; +3 CLI tests; docs                        | `db41ff0` |

Verified end-to-end through the real CLI: a moved link → `--fix` previews
`rewrite link "./target.md" → "./moved/target.md"` (writes nothing, exit 0) →
`--fix --apply` rewrites it → re-check clean (exit 0).

**Soundness held (the whole point):** a fix is emitted only when the resolution
is provably unique. Ambiguous basename/suffix, a renamed file (no basename
match), an unlocatable URL span, or a non-derivable stale line number → **no
fix, reported**. `autofix.test.ts` asserts the ambiguous and no-match cases
yield no fix — the "never write a guess" contract, tested. `applyFixes` also
skips overlapping fixes on a file entirely rather than guess.

**Scope delivered vs deferred:** md links + pointers (the external repo `graph:fix`
case). Kernel `ArchFix` is dialect-neutral, so eess-ts code fixes and mermaid
fixes are cheap later — their own plans. Stale line numbers, missing
sections/tables, drifted specs, ADR policy stay agent/human (manifesto). No
git/commit behavior — `--apply` edits files only.

**Autofix ownership:** eess owns it; a hand-built
`graph-fix-stale-links.ts` is retired in the consolidation, not kept as a
codemod. `eess:check --fix --apply` (once the external repo rules run through the CLI)
supersedes `pnpm graph:fix`.
