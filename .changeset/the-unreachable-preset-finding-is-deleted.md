---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** `presetConstructsNothingViolation` is removed
from `@nielspeter/eess/internal`.

It had **no call site anywhere**: not in any of the five dialects, not in this
repo's scripts, not in a test. Measured before removal — the only occurrence of
`presetConstructsNothingViolation(` in the workspace was its own definition. It
was a constructor for a finding nothing constructed, which is
[bug 0190](https://github.com/nielspeter/eess/blob/main/work/bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md):
an id with no producer reads as coverage while certifying nothing.

**Deleted rather than wired**, and that is the decision worth naming. The obvious
fix was to give it a caller. It was rejected because the finding it produces
names `(presetName, optionsHint)` — dialect vocabulary the kernel emitter cannot
know — and because
[ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
makes the emitter refuse an evidence-free verdict directly, which reaches every
hand-assembler rather than only the presets someone remembered to guard. A
finding with an id and no producer is bug 0190's shape with a label on it.

The preset-shaped diagnosis it was meant to carry already exists dialect-side and
is unchanged: `eess-ts`'s `assertEnabled` builds it with its own `ruleId`,
`bypassFilters` and remedy.

**Nothing that ran before stops running.** `dispatchRule`, `validateOverrides`,
`throwIfViolations` and `finishPreset` are untouched, and the `'off'` /
`'warn'` / `bypassFilters` precedence in `dispatchRule` is unchanged — the test
pinning it still passes.

The five dialects are named because they depend on the kernel and this is a
removed export, so their changelogs should say what changed rather than
"Updated dependencies" (bug 0185). None of them imported it; none needs a source
change.
