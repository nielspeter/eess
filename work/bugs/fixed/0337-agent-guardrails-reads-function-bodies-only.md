# Bug 0337: agentGuardrails reads function bodies only

## Status

- **State:** Fixed — on branch `fix/0337-agent-guardrails-reads-module-scope`. The fix is the ruling
  [0333](./0333-the-recommended-floor-reads-functions-only.md) already made, applied to the sibling
  preset, with the three questions below answered by measurement rather than presumed.
- **Severity:** High — **false green in a preset sold to agent-focused projects.**
  `agentGuardrails(p, { noInlineLogic: ['eval'] })` reports `eval` inside a function and nothing for
  a bare top-level `eval` or one in a class's static block. Measured on this branch's build:
  `["c"]`, `[]`, `[]`. That is bug 0333's symptom exactly, in the preset whose own documentation
  said to prefer it alone.
- **Origin:** the method review of PR #149, 2026-09-20, which asked why the ruling stopped at one
  preset.
- **Reported:** 2026-09-20

## Symptom

Measured, `agentGuardrails(p, { src: '**/src/**', noInlineLogic: ['eval'], report: 'return' })`.
**Every fixture holds a function**, so the preset has a subject and ADR-010's empty-selection
finding cannot fire — the first version of this table used fixtures with no function at all, where
the `[]` rows were accompanied by an error-severity vacuity finding, which is the opposite of a
silent pass. The delta review of PR #149 caught that; the conclusion survived it, the evidence did
not:

| the file holds                                         | reported |
| ------------------------------------------------------ | -------- |
| `export function c() { eval('x') }`                    | `["c"]`  |
| `eval('x')` at top level, beside an unrelated function | **`[]`** |
| `class S { static { eval('x') } }`, beside a function  | **`[]`** |

## Root cause

Every rule the preset builds is built over `functions()`, which is what 0333 fixed for
`recommended`. The rules that would read more — `moduleNoEval`, `moduleNoSilentCatch` and the
`modules()` builder — already exist; what is missing is the subject decision per rule, which 0333
made for its own SPECS table and did not generalise.

## Fix

**The ruling applied, and the three open questions answered by measurement.**

`agentGuardrails` built every rule over `functions()`. Two rules now read the module; two keep the
function, and the test that separates them is **each rule's own imperative**: does it claim more than
its subject reads?

| rule                                        | subject now | why                                                                                                                                                          |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-inline-logic/<api>`                     | **module**  | `moduleNotContain(call(api))` exists; the imperative is not function-scoped. This is the record's measured symptom                                           |
| `no-generic-errors`                         | **module**  | its imperative is "Do NOT throw new Error()", not "…in a function". Needed a module variant, which is one line: `moduleNotContain(newExpr('Error'))`         |
| `no-stubs`                                  | function    | its imperative says **"in a function body"**, so wording and reading agree. A `// TODO` above a class is genuinely unreported, and that is not a false green |
| `no-empty-bodies`                           | function    | 0333's ruling: an empty body is a fact about a function and has no meaning at module scope                                                                   |
| `no-copy-paste`, `no-verdict-outside-rules` | unchanged   | a detector and an already-`modules()` rule; neither poses a subject question                                                                                 |

**What it costs adopters** — the second question — measured and declared in the changeset: new findings
in the positions that were silent; `expectEmpty` stops applying to the two rules that moved (a module
subject exists whenever the glob matches); and an element name can now be the file.

**Whether the two presets should agree by construction** — the third question — is **not** answered
here, deliberately. `recommended` carries a `SPECS` table with an explicit `subject` field; this preset
builds through a local `push` helper. Unifying them is a refactor of two presets' rule construction,
which is its own change with its own risk; what exists today is the paragraph at
`packages/ts/src/presets/recommended.ts:161`, rewritten to say that the two read the same code again
and that nothing binds them. **The standing risk is real and stated rather than fixed**: 0333 made the
ruling for one table and 0337 applied it to the other, two records for one decision.

### The sabotage matrix

Five rows plus a clean control, each a literal edit to one tracked file, the whole `eess-ts` suite run
against it, then a restore verified by sha256. **The first pass had a dirty control** — 1 failing, because
the new comment in `recommended.ts` linked to this record at its `fixed/` path before the record moved —
and was re-run rather than reported with its deltas taken against a red baseline.

| row — one literal edit, restored and sha256-verified         | vitest        | what reddened                                                                                                                                                                                        |
| ------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0 control (no edit)                                         | `3854 passed` | —                                                                                                                                                                                                    |
| R1 no-inline-logic back to functions()                       | `1 failed`    | `reports an inline-logic call wherever the file runs it, named by its scope` — the record's own symptom                                                                                              |
| R2 no-generic-errors back to functions()                     | `2 failed`    | `reports a generic Error thrown outside any function`, and the handler-map naming case                                                                                                               |
| R3 moduleNoGenericErrors matches the wrong constructor       | `6 failed`    | 6 — the new suite plus the `no-generic-errors` cases in `agent-guardrails.test.ts`; a wrong constructor cannot hide behind a right subject                                                           |
| R4 REVERSE: no-stubs moved to modules (the control must red) | `4 failed`    | 4 — **reverse sabotage.** Moving `no-stubs` TO modules reds `CONTROL: no-stubs stays function-scoped`, so the control that stops this fix becoming “make everything module-scoped” is not decorative |
| R5 the new test drops the line from its identity             | `5 failed`    | 5 — dropping the line from the test's own identity reds the suite, so `element @ line` is load-bearing rather than decoration (the cardinality scan's point, pinned)                                 |

Two rows are deliberately **reverse** sabotage: R4 moves a rule the fix left alone, and R5 weakens the
new test's own identity. A matrix of only forward rows cannot tell a control from a comment.

### This widens bug 0338, measured

The interaction was predicted before the fix and then measured, rather than discovered afterwards. One
fixture directory, edited in place so the file path is constant, hashed with the real
`hashViolation`:

| the edit                                                             | silently accepted | reported new |
| -------------------------------------------------------------------- | ----------------- | ------------ |
| baseline two **top-level** `eval`s; fix the first, add another below | **2**             | **0**        |
| the same edit with each `eval` in its own **named function**         | 1                 | **1**        |

A module-scope match with nothing named enclosing it is identified by position within its file, so a
baseline accepts the wrong one — [0338](../0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md)
exactly, now reachable through a second preset. Shipped anyway, and the reasoning is stated rather than
assumed: before this fix the finding was **not reported at all**, which is a certain false green; after
it, the finding is reported and a baseline can accept a replacement of it on a fix-and-add edit in one
file. A reported-but-weakly-identified finding beats an unreported one, and an adopter with no baseline
gains outright. The changeset says so under "Known limit".

A second, narrower instance is recorded on 0338 as well: a throw inside `const routes = { objectHandler:
() => … }` was `routes.objectHandler` under the function subject and is `handlers.ts` under the module
subject, because `enclosingScopeName` cannot name an arrow held in a `PropertyAssignment`. Not fixed
here: the two ways to fix it are a global change to `enclosingScopeName` (blast radius: every
condition's element names, so every adopter baseline) or a second derivation of object-literal naming
beside `arch-function.ts`'s.

## Related

- [0333](./0333-the-recommended-floor-reads-functions-only.md) — the same defect in
  `recommended`, fixed; its ruling is the one to apply here.
- [0330](../0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — why a ruling that binds a
  second preset is hard to find when it lives in a fixed record.

## Verification

- [x] reproduced: the record's table re-measured on this branch, and extended — `no-generic-errors` is
      silent at top level and in a static block too, while `no-stubs` is silent by its own wording.
- [x] a red-first test — `packages/ts/tests/presets/agent-guardrails-reads-module-scope.test.ts`,
      confirmed red in exactly the two defects with all three controls passing. It asserts
      `element @ line` identities, never counts: the repo's own
      `tests/tools/scan-cardinality-assertions.test.ts` rejected the first version for asserting
      lengths, and its reason applies — a dead selector also yields exactly one violation.
- [x] the fix, with `moduleNoGenericErrors()` added beside its class and function siblings as the same
      `notContain(newExpr('Error'))` over a third subject, so there is no second derivation of what a
      generic error is.
- [x] the 0338 interaction measured, not assumed — the table above.
- [x] the stale claim in `recommended.ts:161` rewritten. It said the two presets "no longer READ the
      same code" and cited this bug; leaving it would have been a comment outliving its mechanism.
- [x] a sabotage matrix — 5 rows plus a clean control at 3854, every one fires; the table is above.
      Two rows are reverse sabotage, so the controls are shown to be controls.
- [x] a changeset — `.changeset/agent-guardrails-reads-module-scope.md`, `minor` and marked breaking,
      declaring the new findings, the `expectEmpty` change, the element-name change, and the 0338 limit.
- [x] `npm run validate` green.

Deferred: none. The unification question is answered — not now, and why — rather than deferred.
