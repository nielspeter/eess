---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess):** every builder's `violations()` returns a
receipt, and the emitters take one.

[ADR-014](https://github.com/nielspeter/eess/blob/main/adr/014-the-emitter-refuses-a-verdict-without-evidence.md):
evidence is required at every seam where a verdict leaves eess, not only at the
terminal. `CollectResult` is now an `ArchViolation[]` carrying `examined`,
`sourceEmpty` and `declaredEmpty` as own properties. `finishPreset`,
`reportViolations` and `throwIfViolations` accept and return it.

**Why this break exists.** A consuming project shipped four corpus gates as
hand-rolled loops, importing eess's types and its printer and never a
`RuleBuilder`. Three went inert in one week — a `continue` on a malformed row, a
counter that fell from 38 compared against 0, a header count compared against
nothing. Each printed green. The agent that wrote them had been told to use eess
properly and had a working rule file in the same directory, so neither
documentation nor example reached it. The seam had to refuse.

**What breaks for you.**

- `.violations()` returns `CollectResult`, not `ArchViolation[]`. It is still an
  array — `.length`, iteration, `map`, `filter` and `for…of` are unchanged — so
  most call sites keep compiling. Across this whole workspace the retype produced
  **15 type errors**, which is the measured size of the migration.
- **`expect(x.violations()).toEqual([])` now fails.** A deep-equal against a bare
  `[]` compares the receipt's own properties too. Use `toHaveLength(0)`, or
  `expect(v.map((x) => x.ruleId)).toEqual([])` to keep asserting identity.
- A custom builder's `collectViolations()` must return `collectResult(violations,
{ examined })` instead of an object literal. You get one compile error naming
  the member.
- Handing an emitter a bare array is now a type error, and at runtime a
  configuration finding — `emitter/no-receipt`.

**Three new unsuppressable rule ids**, the kernel's first hardcoded ones:
`emitter/no-receipt` (no evidence at all), `emitter/pass-without-evidence` (zero
examined, zero violations, no declaration) and `emitter/expired-declaration`
(declared empty, then examined something).

**A preset that examines nothing now says so**, which is the point and the part
most likely to redden an existing build. If your corpus legitimately has none of
a preset's subject — no ER diagrams, no exemptions — declare it with
`expectEmpty: true`, now on `PresetReportOptions` and therefore on every preset
in the family. The declaration **expires**: the day the subject appears, it reds
with `emitter/expired-declaration`. That expiry is what makes it a declaration
rather than a mute button, and it is why `overrides: { id: 'off' }` is not
accepted as one — an instruction eess would have to read intent into, and a claim
nothing can contradict.

`--format json`'s `summary` gains `examined` (`null` when the caller supplied no
evidence), because `JSON.stringify` drops an array's own properties.

The five dialects are named because the break is the kernel's and their
changelogs should say what changed rather than "Updated dependencies"
(bug 0185). Each also re-exports the new constructor and merge, so a standalone
consumer of one dialect never needs a second kernel install.
