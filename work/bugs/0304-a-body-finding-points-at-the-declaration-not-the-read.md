# Bug 0304: a class or function body finding points at the declaration, not at the offending expression

## Status

- **State:** Draft — reproduced, and pinned by KNOWN-GAP tests.
- **Severity:** Medium — an honesty gap in the location a finding claims. The
  message names the right line; the finding's `line` field, which is what an editor,
  a GitHub annotation or an agent opens, names the declaration.
- **Origin:** found by review of
  [0297](./0297-no-process-env-reads-one-spelling-of-an-environment-read.md), and
  measured then.
- **Reported:** 2026-09-14

## Symptom

One file, one `process.env` read in a class method (line 4), one in a function
(line 9), one at top level (line 11):

| rule                     | finding `line`       | message                    |
| ------------------------ | -------------------- | -------------------------- |
| `noProcessEnv()`         | **1** — the class    | `… at line 4`              |
| `functionNoProcessEnv()` | **7** — the function | `… at line 9`              |
| `moduleNoProcessEnv()`   | 4, 9, 11 — the reads | `… at line 4` / `9` / `11` |

## Root cause

`classNotContain` builds the finding with `createViolation(cls, …)` and the message
with the matching node's line (`packages/ts/src/conditions/body-analysis.ts:59-61`),
so the location is the class while the text is the read. The function variant,
`packages/ts/src/conditions/body-analysis-function.ts`, anchors at the function the
same way. The module variant anchors at the node.

Nothing documents whether a finding's `line` means the subject or the offence; the
module variant chose the offence.

## Fix

Anchor the finding's `line` at the matching node while `element` stays the subject.
Check first what else reads `line`: exclusion-comment placement and baseline identity
are not measured here.

## Verification

- [x] KNOWN-GAP tests pin today's behaviour —
      `packages/ts/tests/conditions/a-body-finding-points-at-the-declaration.test.ts` ·
      `it('KNOWN GAP — a class body finding is anchored at the class, while its message names the read')`
      and `it('KNOWN GAP — a function body finding is anchored at the function, while its message names the read')`.
- [x] `it('CONTROL — a module finding is anchored at the read')`
- [ ] what reads `line` measured, then the fix, KNOWN-GAP tests inverted
- [ ] `npm run validate` green.

Deferred: none.
