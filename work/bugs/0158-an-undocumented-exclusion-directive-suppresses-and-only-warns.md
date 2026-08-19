# Bug 0158: An undocumented exclusion directive suppresses a real violation and only warns

## Status

- **State:** Draft — fix **built and measured** in an isolated worktree (see
  Fix); no red test committed yet.
- **Severity:** High — false green, and in published code. A reason-free
  `// eess-exclude <rule-id>` is a working kill switch for any rule, on any
  line, and the only feedback is a stderr line that does not fail the build.
- **Origin:** self-found · fold audit of ts-archunit's fixed-bug corpus
  (upstream bug 0039), prompted by [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
- **Shipped in:** published `@nielspeter/eess` `0.2.2` / `eess-ts` `0.2.1` —
  the defect predates plan 0088's fold.
- **Reported:** 2026-08-19

## Symptom

The exclusion grammar documents `// eess-exclude <rule-id>: <reason>`. A
directive written **without** the reason is treated as valid: it suppresses,
and emits only a stderr warning. The documented requirement is not enforced.

A second, independent half: **nested block directives mangle**. An inner
`-end` closes the outer block, and an inner `-start` is dropped entirely.

## Reproduction

Verified against `packages/ts/dist`, with both controls:

| fixture (directive adjacent to the `eval`)           | violations         |
| ---------------------------------------------------- | ------------------ |
| `// eess-exclude demo/no-eval` (no reason)           | **0** ← suppressed |
| `// eess-exclude demo/no-eval: deliberate` (control) | 0                  |
| no directive at all (vacuity control)                | **1** ✓            |

The vacuity control fires, so the rule genuinely produces a finding on this
fixture and the suppression rows are real. stderr carries
`[eess] Undocumented exclusion at …` and the build exits 0.

Nested blocks, through `parseExclusionComments` directly:

```
outer -start rule-a (line 1..7), inner -start rule-a (line 3..5)
  exclusions: [{ id: rule-a, line: 1, end: 5 }]   ← outer silently ends at the INNER -end

outer -start rule-a, inner -start rule-b
  exclusions: [{ id: rule-a, line: 1, end: 5 }]   ← rule-b never applies AND rule-a ends early
```

Two wrong results from one input.

## Root cause

`packages/core/src/exclusion-comments.ts:177-189` (`handleSingleLine`) and
`:149-161` (`handleBlockStart`) warn when `reason === ''` and then push the
exclusion anyway. `ExclusionWarning` (`:24-31`) has **no `kind` field**, so a
caller cannot distinguish "undocumented" from "malformed" and route them
differently; `packages/core/src/execute-rule.ts:129-131` dumps every warning
undifferentiated to stderr. `grep -rn "[Uu]ndocumented" packages/*/src/`
finds only the warning text itself — nothing produces a finding.

Nested blocks: `handleBlockStart` early-returns when `openBlocks.size > 0`
(`:138-145`), state is a `Map` (`:207`), and `handleBlockEnd` closes **every**
open block at once (`:103-107`). Upstream replaced this with a stack of frames.

**Same file, same freeze as [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md).**
`exclusion-comments.ts` has **one** commit in its history — the initial
monorepo commit (`9ec8f06`). `git show --stat 6dbc6f4 -- packages/core/src/exclusion-comments.ts`
is **empty**: the fold never touched this file at all. It is in its pre-fix
shape for both upstream 0039 and 0043. The fold carried the `execute-rule.ts`
ordering change (upstream 0041) but left this file untouched.

## Why it matters

It is **worse in eess than it was upstream at filing time.** eess carries
upstream's 0041 fix, which widened exclusion-comment reach from one condition
family to all of them. It does not carry 0039. So the fail-open now spans every
condition family — including the dependency and module-body conditions an
adopting team reaches for first.

## Fix — measured 2026-08-19

Built and measured alongside [bug 0154](./0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md)
(same file, same pass), in an isolated worktree against a green baseline.

| check                                                     | before                           | after                      |
| --------------------------------------------------------- | -------------------------------- | -------------------------- |
| reason-free `// eess-exclude a/b`                         | suppresses                       | **no exclusion** ✓         |
| colon-only `// eess-exclude a/b:`                         | suppresses                       | **no exclusion** ✓         |
| documented directive (control)                            | applies                          | applies                    |
| nested blocks, same id                                    | outer ends at inner `-end` (1–5) | **inner 3–5, outer 1–7** ✓ |
| nested blocks, different ids                              | inner dropped entirely           | **both resolve** ✓         |
| unclosed `-start` at EOF (control)                        | no exclusion                     | no exclusion               |
| `-end` with no start (control)                            | no exclusion                     | no exclusion               |
| **e2e: reason-free directive vs a real `eval` violation** | **0 findings**                   | **1 finding** ✓            |

1. **`kind: 'undocumented' \| 'malformed'`** added to `ExclusionWarning`, and an
   undocumented directive now **fails closed** — it suppresses nothing. The
   structural warnings (unmatched/`-end`-without-start) carry `'malformed'`, so
   a caller can turn the inert-waiver case into a finding without also
   promoting file-shape complaints. Making it an _unsuppressable finding_
   rather than a warning is left to the caller and is **not** done here — that
   is ADR-009 rule 1 territory and belongs with bug 0155's warning-vs-finding
   decision, which is still open.
2. **Block frames form a stack**; one `-end` closes one `-start`. Nesting is now
   legal and emits no warning.

**Five tests encoded the old behaviour** and were updated as part of the fix,
across two files — `packages/ts/tests/helpers/exclusion-comments.test.ts` (3)
and `packages/ts/tests/integration/coverage-gaps.test.ts` (2). Each asserted
the defect: that a reason-free directive _produces_ an exclusion, and that
nesting _warns_. They now assert by identity and span. One control was added
(a documented HTML exclusion still applies).

Full suite after: **2216/2217**, the single failure pre-existing and
environmental (a substring assertion that trips on a temp path containing a
digit — baselined on unpatched code before crediting it).

The original prescription, kept for reference:

Landing (1) will surface violations in any corpus that currently relies on a
reason-free directive — that is the fix working. This repo's own directives
should be audited for reason-free instances before it lands.

Coordinate with bug 0154: both fixes touch the same parser, and 0154's own
design question (how to blank literals in a kernel that cannot import
ts-morph) may change this file's shape. Sequencing them together is likely
cheaper than separately.

## Verification

- [ ] Red test first: a reason-free directive does **not** suppress, and
      produces a finding. Fails today.
- [ ] Red test: nested `-start`/`-end` pairs close one-for-one, asserted on
      `result.exclusions` — not merely that a "Nested" warning exists.
      (`packages/ts/tests/helpers/exclusion-comments.test.ts:76-80` sets up
      this fixture today and never inspects `exclusions`, which is exactly how
      the behaviour stayed invisible.)
- [ ] Control: a documented directive still suppresses.
- [ ] Vacuity control: the fixture yields a real finding without any directive.
- [ ] This repo's own `// eess-exclude` directives audited for reason-free
      instances.
- [ ] `npm run validate` green.

Deferred: none.
