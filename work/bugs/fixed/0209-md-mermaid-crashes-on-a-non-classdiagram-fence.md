# Bug 0209: `md-mermaid` crashes on any non-`classDiagram` mermaid fence

## Status

- **State:** Fixed — reproduced red, fixed, reviewed by six personas **twice**,
  and reworked twice. The first fix was **wrong**: it closed the crash and opened
  a narrower version of the same silent-green, plus four verification claims that
  nothing asserted. The second round found the fix's own central behaviour had no
  production break class. All of it is recorded below rather than edited away.
- **Deferred:** [0210](../0210-er-fence-selector-is-an-allowlist.md) — the
  sibling `md-mermaid-er` has the identical allowlist hole, named by review and
  filed rather than fixed opportunistically here.
- **Found:** 2026-08-22, existing-code survey while filing
  [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md).

## Symptom

`embeddedDiagramsMatchCode()` selected fences by language **alone** and then
handed the fence body straight to `diagram()`, with no error handling anywhere
in the function. The two lines, as they stood before the fix:

```ts
if (block.lang !== 'mermaid') continue
const d = diagram(block.value)
```

(Quoted rather than cited by `path:line`. Review found the original citation had
gone stale inside its own branch — the fix moved those lines, and `check:corpus`
stayed green because the pointer rule proves a line _exists_, not that it still
says what the citing prose claims.)

`diagram()` parses its input as a class diagram unconditionally
(`packages/mermaid/src/core/diagram.ts:7`). So **one** ` ```mermaid ` fence
holding any other diagram type — `sequenceDiagram`, `flowchart`, `graph`,
`stateDiagram-v2`, `gantt` — throws `MermaidUnitParseError` out of the preset and
aborts the whole run. Every classDiagram in the corpus goes unchecked, including
ones already validated before the crash.

Measured against the built package:

```
classDiagram       -> OK
sequenceDiagram    -> THROWS MermaidUnitParseError
flowchart          -> THROWS MermaidUnitParseError
graph              -> THROWS MermaidUnitParseError
stateDiagram-v2    -> THROWS MermaidUnitParseError
gantt              -> THROWS MermaidUnitParseError
```

A document holding an architecture class diagram **and** a sequence diagram is
ordinary — it is how most projects document a subsystem. This binding cannot read
such a corpus at all.

## The sibling gets it right

`md-mermaid-er` — same package, same shape, written later — selects on fence
**content**, not just language, at
`packages/crossvalidate/src/md-mermaid-er.ts:53`, and handles a parse failure on
the blocks it does accept by reporting it as a violation rather than throwing.

So the correct behaviour is already established in this package. `md-mermaid` is
the divergent one.

## Root cause

A language tag is not a diagram type. `lang === 'mermaid'` says "this fence is
Mermaid", not "this fence is a class diagram" — and the only parser behind
`diagram()` is the class-diagram parser. The selector and the parser disagree
about what is being selected, and nothing catches the disagreement because there
is no `try` in the function.

## Why the obvious fix is wrong on its own

Adding a content filter stops the crash. It also converts a **loud failure into a
silent one**: a corpus with no `classDiagram` fences would then examine zero
blocks, produce zero violations, and return green. Under ADR-010 a pass must be
constructed from evidence, and this function has no `examined` notion at all —
there is no counter, no stats export, and no zero-guard anywhere in
`packages/crossvalidate/src/md-mermaid.ts`.

Its sibling already ships the missing half: a stats function for exactly this
purpose at `packages/crossvalidate/src/md-mermaid-er.ts:179`. `md-mermaid` has no
equivalent, so a caller cannot currently prove a green run examined anything.

**Fixing only the crash would trade a defect that fails loudly for one that
fails green.** That is a worse position than today's, by this repo's own standard.

## Fix

Three parts. **Part 1 was wrong on the first attempt** — see the correction
below it.

1. **Select on content — by exclusion, not by allowlist.** Skip the fences whose
   declared kind is known to be something else. A sequence diagram is not a
   broken class diagram; it is a different artifact and is correctly out of
   scope. An _unrecognised_ kind still reaches the parser, which either parses
   it or produces an attributed finding.

   > **Correction (review, 2026-08-22).** The first implementation did the
   > opposite: it _required_ the body to start with `classDiagram`, mirroring
   > `md-mermaid-er`'s `ER_HEADER`. That is an allowlist, and an allowlist is
   > fail-open — it drops whatever it fails to recognise. Mermaid's grammar
   > treats `%%` lines as hidden terminals, so a fence opening with a
   > `%%{init}%%` theme directive parses fine and was silently skipped.
   > Measured: a drifted kernel diagram behind a theme directive made
   > `check:crossval` exit 0 while printing a denominator of 1. All six review
   > personas found this independently. It is the same defect class this record
   > was written about, reintroduced one layer over — the analysis below was
   > right and the aim was wrong. `md-mermaid-er`'s `ER_HEADER` has the
   > identical hole and needs its own record.

2. **Report a parse failure, don't throw it.** A fence that _does_ declare
   `classDiagram` and still fails to parse is a real finding about that document,
   and must surface as a violation pointing at the markdown file and fence line —
   not as an exception that aborts the run.
3. **Expose an examined count**, so a caller can tell "no drift" from "nothing
   looked at", and **wire it into the gate that consumes this preset**. Mirrors
   `md-mermaid-er`'s stats export, plus a `skipped` count.

   > **Correction (review, 2026-08-22).** The first implementation shipped the
   > export and left `scripts/check-crossval.mjs` re-deriving its own
   > denominator as `lang === 'mermaid'` — a population the preset no longer
   > selects. The gate could therefore print `1 mermaid fence(s)` over zero
   > diagrams compared. An evidence export with no consumer is not evidence;
   > the gate now asks the preset what it examined.

## Verification

Rewritten after review. The **first** ledger claimed four things nothing
asserted — that the violation named `embedded-malformed.md:5`, that it carried a
`Why:` and a `Fix:`, and that stats counted one diagram rather than two fences.
Mutating each produced **0 failing tests**. Those claims are now assertions.

- [x] Red first: `docs/embedded-mixed.md` (a `classDiagram` beside a
      `sequenceDiagram`) threw before the fix, with a Langium parse error.
- [x] The class diagram beside a skipped foreign fence is **still checked** —
      `embedded-mixed-bad.md` puts a `GhostClass` there and the run reds.
- [x] A class diagram behind a `%%{init}%%` directive is examined, not skipped —
      `embedded-directive-bad.md` reds; `embedded-directive-good.md` passes and
      reports `diagrams: 1`. This is the review regression, pinned.
- [x] An unparseable fence reports `ruleId`, `file`, `line`, `because` and
      `suggestion`, and carries the real diagnosis rather than the constant
      prefix `MermaidUnit parse failed:`.
- [x] `documents` and `diagrams` are independently asserted via a two-diagram
      document (`{documents: 1, diagrams: 2}`); `skipped` is asserted via a
      foreign-only document (`{0, 0, skipped: 1}`).
- [x] `scripts/check-crossval.mjs` asks the preset what it examined instead of
      re-deriving it. Proved end-to-end: a directive-prefixed, drifted kernel
      diagram makes the gate **exit non-zero**, where the first fix exited 0.
- [x] The selector has a **production** break class — a fourth non-vacuity case,
      `directive-diagram.md`. Reverting to the allowlist makes
      `bad-md-mermaid.mjs` exit 0 and name the cause.
- [x] **Sabotage matrix**, 12 tests. Every row reds, including the five that the
      first version left invisible:

      | mutation                                          | first fix | now       |
      | ------------------------------------------------- | --------- | --------- |
      | revert to the allowlist selector                   | n/a       | 2 fail    |
      | selector returns nothing                           | 2 fail    | 8 fail    |
      | `diagrams += 1` instead of `+= blocks.length`      | **0**     | 1 fail    |
      | `documents += blocks.length` instead of `+= 1`     | **0**     | 1 fail    |
      | parse-error `line` → `1`                           | **0**     | 1 fail    |
      | take the prefix line, dropping the diagnosis       | **0**     | 1 fail    |
      | drop `ruleId`                                      | **0**     | 1 fail    |
      | `skipped` always `0`                               | n/a       | 1 fail    |

### Second review round (six personas) — what it added

The rework above was itself reviewed. It found three things the first rework's
matrix could not see, all now closed:

- [x] **`declaredKind()` was half-unfalsifiable.** Deleting both its `%%`-comment
      and `---`-frontmatter skips left **0 of 87** crossvalidate tests red. The
      three directive fixtures pin the _denylist_, not the skip — a `%%` line
      fails `FOREIGN_HEADER` either way. The break class is a themed **foreign**
      fence, which no fixture had. Three fixtures added; each mutation now reds.
- [x] **The fix's central behaviour had no production break class.** Reverting the
      selector to the pre-fix predicate left `bad-md-mermaid` at exit 1 and
      `check:nonvacuity` green — every non-vacuity fixture held only class
      diagrams, so the harness had never seen a foreign fence. `mixed-diagram.md`
      added; the revert now reds with _"the foreign-fence skip is not skipping"_.
- [x] **The parse-failure path had no fixture.** Emptying the `catch` to a bare
      `continue` left every gate green. `unparseable-diagram.md` added.
- [x] **The remedy was exploitable.** The suggestion ended _"or remove the fence
      if it is not a class diagram"_. Measured: prepending `flowchart TD` to a
      drifted fence takes it from 1 violation to 0 with the drift still in the
      document. Reduced to one remedy that does not destroy evidence.
- [x] **The gate comment over-claimed.** It said "ask the preset what it examined;
      do NOT re-derive the denominator" — but the stats call is a second pass
      sharing the _predicate_, not the _observation_. Neutering the comparison
      loop still printed `1 diagram(s)`. The comment now states what the guard
      proves and names the fixture that covers the rest.
- [x] Multi-line `%%{init}%%` blocks defeated the single-line skip, making
      `skipped` report 0 while counting a sequence diagram as examined. Fixed.
- [x] `embedded-none.md` was committed unreferenced — five of six reviewers
      flagged the orphan. Now carries the "no mermaid at all" assertion.

**Still open, deliberately:** whether a crossvalidate preset may pass over zero
examined units with only opt-in evidence. Review is right that this is an
ADR-010 perimeter question affecting all five dialects — `scripts/vacuity-matrix.mjs`
probes only `eess-ts`, so no sibling preset is covered — and that deciding it
inside a bug record would bury it. Not answered here.

      One instrument note kept from the first pass: an early mutation attempt
      produced `Tests no tests` — a syntactically broken file. That is a failed
      probe, not a red, and was redone as a valid mutation before counting.

## Out of scope

- **Widening the language check.** `md-mermaid-er` also accepts `lang === null`;
  `md-mermaid` requires `lang === 'mermaid'`. That divergence is real but is a
  separate decision about untagged fences, not part of this defect.
- **`ER_HEADER`'s identical allowlist hole.** `md-mermaid-er` selects with
  `/^\s*erDiagram\b/` and drops a themed ER fence exactly as this binding did.
  Pre-existing, found by this review, and it needs its own record.
- **Lifting the diagram-kind predicate into `eess-mermaid`.** Three copies of
  the header knowledge now exist. Review is right that one exported predicate is
  the end state — but that answers [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md)'s
  open question 1, which is under review. Deciding it inside a bug fix is how a
  binding decision gets buried.
- **`classDiagram-v2`.** Legal Mermaid; the grammar knows only the bare keyword,
  so it is selected and then reported as unparseable. Loud, not silent, and a
  grammar question rather than a selector one.
- **Supporting the other diagram types.** Whether eess should model
  `sequenceDiagram` at all is [proposal 006](../../proposals/006-mermaid-beyond-classdiagram.md)'s
  question, and it is deliberately not answered here. This bug makes the binding
  _survive_ them; the proposal asks whether it should _understand_ them.
