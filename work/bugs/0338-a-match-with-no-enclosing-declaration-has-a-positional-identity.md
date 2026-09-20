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

## Related

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
- [ ] the fix, with the pins inverted
- [ ] a changeset — any change here moves existing baseline entries
- [ ] `npm run validate` green.

Deferred: none.
