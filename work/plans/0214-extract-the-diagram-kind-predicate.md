# Plan 0214: one lexer for "what kind of Mermaid diagram is this"

## Status

- **State:** Draft — the fourth and smallest shape. Three earlier drafts each designed a
  mechanism the next round removed; the fourth review found that the fix for
  [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md) needs no new mechanism at
  all. See "What four drafts got wrong" — kept because the falsifiers bound any future
  attempt.
- **Implements:** proposal 006
- **Priority:** Medium — closes a live fail-open defect.
- **Effort:** Small. One function moves; one call site changes what it tests.
- **Created:** 2026-08-22

## Problem

`md-mermaid-er` selects ER fences with `ER_HEADER = /^\s*erDiagram\b/` tested against the
**raw fence body** (`packages/crossvalidate/src/md-mermaid-er.ts:53`). Mermaid permits `%%`
comments, `%%{init}%%` directives and `---` frontmatter before the keyword, so a themed ER
diagram parses fine and is **silently not selected** — [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md).

The defect is not that the selector is an allowlist. It is that the allowlist is anchored to
the raw body instead of to the **declared kind**.

## Approach

1. **Move `declaredKind()` into `eess-mermaid`**, exported as `diagramKind()`, returning the
   **normalised kind token** (today it returns the raw line `graph TD` and callers normalise
   separately via `kindOf`). It handles `%%` comments, single- and multi-line `%%{init}%%`
   blocks and `---` frontmatter — Mermaid grammar constructs, so this is a language fact
   currently living in a binding package.

   **Not the kernel**: `packages/core` holds no artifact vocabulary, and a Mermaid lexer
   there would be one dialect's concept taxed on five.

2. **`md-mermaid-er` keeps its allowlist and tests the declared kind instead of the raw
   body.** Measured — `ER_HEADER` against `diagramKind(body)`:

   | fence                           | raw body       | declared kind  |
   | ------------------------------- | -------------- | -------------- |
   | `%%{init}%%` + `erDiagram`      | ✗ not selected | **✓ selected** |
   | `---` frontmatter + `erDiagram` | ✗ not selected | **✓ selected** |
   | plain `erDiagram`               | ✓              | ✓              |
   | `sequenceDiagram`               | ✗              | ✗              |
   | untagged/bare fence             | ✗              | ✗              |

   That closes bug 0210 outright. Nothing else changes.

3. **`md-mermaid` imports the moved function** instead of declaring it. Its behaviour is
   unchanged — it already calls `declaredKind()`.

## Why this does _not_ make `md-mermaid-er` fail-closed

An earlier draft prescribed flipping ER to a denylist, "the shape 0209 established". Review
falsified that, twice over:

- **It reproduces a failure this plan already records.** An unknown kind would be in neither
  binding's exclusion set, so it reaches `parseErDiagram` **and** `diagram()` — two
  contradictory findings for one fence. Draft 2 was rejected for exactly this and Draft 4
  prescribed it anyway.
- **It is unsound here.** `md-mermaid` gates `b.lang === 'mermaid'` first; `md-mermaid-er`
  also accepts `b.lang === null`. Today that is harmless because the allowlist asks a
  positive one-token question. Under exclusion, every untagged fence — **789 of them in this
  corpus** — would reach `parseErDiagram`.

The allowlist/denylist asymmetry does not transfer, because the two selectors ask different
questions: _"is this an `erDiagram`?"_ versus _"is this **not** something else?"_ Bug 0210's
own Fix said so first — "reuse `declaredKind()` rather than re-derive it" — and four drafts
escalated past it.

## What four drafts got wrong

Kept because each names a falsifier, and together they are the floor a future lockstep
attempt has to clear:

1. **Move the lexer, call it a registry.** `md-mermaid.ts:186` already calls `declaredKind()`,
   so relocating it changes one import and leaves `FOREIGN_HEADER` — the list that actually
   goes stale — untouched.
2. **`denylist = MERMAID_KINDS − consumed`.** Puts `classDiagram-v2` in the denylist, turning
   a loud finding into `skipped += 1`, and inverts the ER binding.
3. **ADR-011 — three categories, only a sibling's kinds deniable.** Retracted before merge:
   its generalisation was false (`eess-gherkin` already models `Scenario Outline | Scenario |
Example` with a deliberately unmodelled `Background:` at `packages/gherkin/src/load.ts:41-42`,
   and its two bindings restate nothing); it contradicted a committed fixture
   (`scripts/nonvacuity/bad-md-mermaid.mjs` asserts `mixed-diagram.md`'s `sequenceDiagram`
   yields **no** parse finding); and its middle category was member-less, because
   `classDiagram-v2` is an alias for `classDiagram`, not an unmodelled kind.
4. **Flip ER to fail-closed.** See the section above.

**A fifth constraint, carried from the retracted ADR because it is the sharpest thing in it:**
any published kind set is only as honest as its derivation. A hand-editable constant is a
**suppression registry** — adding a name silently removes coverage — so a derivation must come
from the artifacts themselves. That is a fourth falsifier, not a design.

**The census a future attempt starts from** — five restatements of Mermaid kind knowledge,
across two packages:

| restatement              | where                                            |
| ------------------------ | ------------------------------------------------ |
| `HEADER_PATTERN`         | `packages/mermaid/src/core/diagram.ts:5`         |
| `KNOWN_UNMODELLED`       | `packages/crossvalidate/src/md-mermaid.ts:32`    |
| `FOREIGN_HEADER`         | `packages/crossvalidate/src/md-mermaid.ts:34`    |
| `kindOf` (normalisation) | `packages/crossvalidate/src/md-mermaid.ts:166`   |
| `ER_HEADER`              | `packages/crossvalidate/src/md-mermaid-er.ts:32` |

**What this plan leaves undone, stated rather than gated.** Nothing keeps the grammar set and
the selectors in lockstep. That risk is pre-existing and this plan neither closes it nor
enlarges it — the count of stale-able lists is the same after as before. Four attempts to gate
it have each been wrong somewhere else, so it is recorded rather than half-built.

## Files Changed

- `packages/mermaid/src/parser/` + `index.ts` — the exported, normalised `diagramKind()`
- `packages/crossvalidate/src/md-mermaid.ts` — import instead of declare; drop `kindOf`
- `packages/crossvalidate/src/md-mermaid-er.ts` — test `diagramKind(b.value)`, allowlist intact
- `scripts/nonvacuity/bad-md-mermaid-er/` **and** `bad-md-mermaid-er.mjs`, **and** its row in
  `scripts/check-nonvacuity.mjs`'s hand-maintained gates array — a fixture directory with no
  registered row is inert
- a changeset: `@nielspeter/eess-mermaid` minor (new export),
  `@nielspeter/eess-crossvalidate` **minor** — ER fences that were silently skipped are now
  compared, so an adopter's green build can go red with no rule change of their own. No
  `**Breaking**` marker: nothing narrows, and no call signature changes for a consumer.

## Verification

**This plan ships bug 0210's fix; 0210 closes `done-otherwise → 0214`** — and 0210 itself is
updated in the same PR, so the coupling is not one-directional.

- [ ] Red first: a themed `erDiagram` fixture is not selected today.
- [ ] After the fix it is selected and compared, and `tableErStats` counts it.
- [ ] A `---` frontmatter'd ER diagram likewise.
- [ ] A non-ER fence is still skipped, **and the document is not skipped with it**.
- [ ] An untagged (`lang === null`) non-ER fence is still not selected — the property that
      makes keeping the allowlist sound, and the one a denylist would have broken.
- [ ] A break class in `scripts/nonvacuity/`, registered in the gates array, driving the
      harness. Note honestly: `tableErAgree` has **no production consumer** in this repo —
      `scripts/check-crossval.mjs` imports `md-mermaid` only — which is itself why bug 0210
      sat undetected. Wiring one is out of scope; the fixture is the gate.
- [ ] `check:family` green — the export is dialect-local and `eess-crossvalidate` already
      peer-depends on `eess-mermaid`.

## Out of Scope

- **Any kind registry or lockstep gate.** Four falsifiers above are the floor.
- **`classDiagram-v2` as a lexer alias.** Real and small — it is the same language, and today
  an author is told their syntax is wrong. Its own record.
- **Wiring a production consumer for `tableErAgree`.** Named because its absence is why 0210
  went unnoticed.
- **The language-tag divergence** — `md-mermaid-er` accepts `lang === null`, `md-mermaid`
  requires `'mermaid'`. Untouched, and this plan's approach is chosen so it stays inert.
- `diagram()`'s sniff — [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md).
  Merge-order coupling only (both touch `packages/mermaid/src/index.ts` and both need an
  `eess-mermaid` changeset). An earlier draft claimed a soundness dependency; review measured
  that `parseErDiagram` touches no filesystem and this plan widens nothing reaching `diagram()`.
