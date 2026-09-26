# Bug 0338: a match with no enclosing declaration has a positional identity, and a baseline accepts the wrong one

## Status

- **State:** Draft — measured by two reviews of PR #149 and reproduced against the real
  `generateBaseline` / `filterNew`. The fix is a decision about what makes a finding identifiable.
- **Severity:** High — **false green with a baseline**, in the default floor. Baseline two top-level
  `eval` calls in one file, fix the first and add a different one below it: the **new** call is
  accepted silently. The same shape holds for the file-level absence findings, which carry no
  identity at all: baseline `index.ts` missing something, fix that file and break a different one,
  and the new breakage is accepted.
- **Origin:** the enforcement reviews of PR #149, 2026-09-20 — first as the weakest identity in the
  system, then confirmed on the delta after the silent-catch half was fixed.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #149's build:

| what is baselined, then changed                                                     | reported as new |
| ----------------------------------------------------------------------------------- | --------------- |
| two top-level `eval`s in one file; fix the first, add another below                 | **none**        |
| a top-level `eval` in file A; delete it, add one in file B                          | one (correct)   |
| two silent catches in one file; fix the first, add another                          | **none**        |
| `moduleContain` absence findings in two files; fix one, break the other differently | **none**        |

The cross-file direction was fixed by PR #149 (each identity carries its file). The **within-file**
direction was not, and the absence findings were never in scope.

**A second, narrower instance, measured by bug 0337 (2026-09-26).** A match can have an enclosing
function that the module-scope namer still cannot name. `enclosingScopeName` names a class, an
interface, a function declaration, a member, and an arrow assigned to a **variable** — but not an
arrow held in a `PropertyAssignment`, which is the handler-map shape agents generate constantly.
Measured on `tests/fixtures/presets/handler-map`: a `throw new Error()` inside
`const routes = { objectHandler: () => … }` is `routes.objectHandler` under a function subject and
**`handlers.ts`** under a module subject. So widening a rule to module scope does not only expose
matches with no enclosing declaration — it **degrades** the identity of matches that had a perfectly
good one, because two namers disagree about the same node. `models/arch-function.ts` already derives
the good name (`owningBindingName` + the collected key path); `core/violation.ts` has no access to it,
and adding a second derivation of it is the failure this repository spends most of its guards on.

**0337 also measured how much widening a preset costs here**, which is the number this record lacked:

| the edit, through `agentGuardrails` after 0337                       | silently accepted | reported new |
| -------------------------------------------------------------------- | ----------------- | ------------ |
| baseline two **top-level** `eval`s; fix the first, add another below | **2**             | **0**        |
| the same edit with each `eval` in its own **named function**         | 1                 | **1**        |

Two presets now reach this, not one.

## Root cause

`identifyMatches` (`packages/ts/src/conditions/match-identity.ts:44`) buckets by
`getElementName(node)` and appends an ordinal within the bucket. For a match with no enclosing named
declaration — a call at top level, a catch in module scope — `getElementName` answers with the
node's KIND (`CallExpression`, `CatchClause`), so every such match in a file shares one bucket and
is told apart only by position. That module's own docstring rejects a per-file counter; for these
matches it degenerates into one.

The file-level findings in `packages/ts/src/conditions/body-analysis-module.ts:44` and `:157` set no
`identity` at all, so their baseline subject is `element::message`, and the message names the file
without a line.

Before bug 0333 the floor read function bodies only, so none of these positions was reported and the
bucket did not exist. Widening what the floor reads is what made a weak identity reachable from the
default preset.

## Fix

Not decided. The candidates differ in what they claim a finding IS:

- **Name the match, not its scope** — include the matched text, or a structural path, in the key.
  Survives reordering; changes when the code changes, which is the point of a baseline entry.
- **Fall back to the line** when nothing named encloses the match. Cheap and wrong the moment an
  edit above moves it, which is exactly what a baseline must tolerate.
- **Refuse to baseline what cannot be identified**: report such findings as unbaselineable rather
  than accepting them positionally. Honest, and noisy in a way adopters will feel.

Whatever is chosen, the file-level absence findings need an identity too, or the same decision that
they cannot have one.

### And a second sub-problem, which none of the candidates above touches

The instance bug 0337 added — an arrow held in a `PropertyAssignment`, whose module-scope name is the
FILE where the function-scope name was `routes.objectHandler` — has a different cause and a different
fix from the three candidates above. Those are about a match with **no** enclosing declaration; this is
a match **with** one that a second namer cannot see. Review of PR #151 flagged the risk plainly: settle
the three candidates, tick their boxes, and this survives with nothing pointing at it.

- **Teach `getStructuralName`** to name an arrow or function expression held in a `PropertyAssignment`
  (`packages/ts/src/core/violation.ts:56` names one only when the parent is a `VariableDeclaration`).
  Blast radius: `enclosingScopeName` feeds `getElementName`, so this moves element names for every
  condition, and element names are baseline keys.
- **Share the derivation instead.** `models/arch-function.ts` already computes the good name —
  `owningBindingName` (`:540`) plus the collected key path (`:414`) — and it is module-private. Exposing
  it is smaller than reimplementing it, and reimplementing it is the two-derivations-of-one-fact
  failure this repository spends most of its guards on.

Its own box is below, so this record cannot close over it.

## Related

- [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md) — the second preset to widen into
  this, which measured the cost above and the object-literal naming instance.
- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) — the change that made these
  positions reachable from the floor, and fixed the cross-file half.
- [0336](./0336-a-rule-that-changes-subject-re-reports-accepted-findings-with-no-diagnostic.md) —
  the other baseline record from the same reviews: what the baseline cannot SAY, where this one is
  what it cannot distinguish.

## Verification

- [x] reproduced — the table above, against `generateBaseline` and `filterNew`, not by reasoning
      about the hash.
- [ ] a pin per row, each asserting the new finding IS reported
- [ ] a ruling on what identifies a match with no enclosing declaration
- [ ] the `PropertyAssignment` sub-problem — a match that HAS an enclosing function the module-scope
      namer cannot name (added 2026-09-26 from [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md)).
      **None of the three candidates above addresses it**, so it carries its own box: the record must
      not be able to close over it.
- [ ] the fix, with the pins inverted
- [ ] a changeset — any change here moves existing baseline entries
- [ ] `npm run validate` green.

Deferred: none.
