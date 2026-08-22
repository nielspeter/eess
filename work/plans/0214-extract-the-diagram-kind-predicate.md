# Plan 0214: one authority for "what kind of Mermaid diagram is this?"

## Status

- **State:** Draft — the highest-value, lowest-cost item in this area, and the one the
  submission did not contain. Found by review; [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md)
  had already routed the decision here.
- **Implements:** proposal 006
- **Priority:** Medium — it closes a live fail-open defect (0210) and removes the
  precondition that makes any future diagram kind unsafe to add.
- **Effort:** Small-Medium — move a pure function, export it, rewire three call sites.
  `@nielspeter/eess-mermaid` minor, `@nielspeter/eess-crossvalidate` patch.
- **Created:** 2026-08-22

## Problem

Five kind-lists now live in **two** packages, four of them **outside** the package that
owns the Mermaid language:

| copy             | location                                         | shape                                                                                                          |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `HEADER_PATTERN` | `packages/mermaid/src/core/diagram.ts:5`         | `classDiagram` only; drives the unsound path-vs-source sniff (bug 0211)                                        |
| `ER_HEADER`      | `packages/crossvalidate/src/md-mermaid-er.ts:32` | allowlist, anchored to the raw body — fail-open, [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md) |
| `FOREIGN_HEADER` | `packages/crossvalidate/src/md-mermaid.ts:34`    | denylist of ~25 kinds                                                                                          |
| `declaredKind()` | `packages/crossvalidate/src/md-mermaid.ts:40`    | the real one — handles `%%` comments, single- and multi-line `%%{init}%%`, `---` frontmatter                   |

`declaredKind()` is a pure `string → kind` function with no markdown and no corpus
knowledge. It is the lexical prelude of the two `.langium` grammars, and it lives in a
binding package.

**The cost is not tidiness.** Nothing keeps the set of kinds a parser can model in lockstep
with the selector that decides which fences reach it. Ship a grammar and forget to update
`FOREIGN_HEADER`, and every fence of that kind is silently skipped while
`check:crossval`'s guard stays satisfied by unrelated class diagrams and the gate exits 0.
That is the fail-open class this repo exists to prevent, at the level of the feature itself.

## Approach

Move the predicate to the package that owns the language, and make the two bindings consume
it rather than re-derive it.

**Moving the lexer is not enough, and that was this plan's first defect.** `md-mermaid.ts:186`
_already calls_ `declaredKind()`, so relocating it changes one import line and leaves
`FOREIGN_HEADER` — the list that goes stale when a grammar ships — exactly as it was. The
Problem above and the Verification below are about a **registry**; the export is about a
**lexer**. They are different capabilities.

And the obvious repair is a trap: replacing the denylist with `modelledKinds.includes(kind)`
inverts fail-closed to fail-open, which is precisely the regression
[bug 0209](../bugs/fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)'s fix exists
to prevent. An _unknown_ kind must still reach the parser.

So `eess-mermaid` exports **two** sets and each binding derives its own selector:

- `MERMAID_KINDS` — the known-kind vocabulary (what Mermaid can spell);
- `MODELLED_KINDS` — the subset this dialect has a grammar for, **derived from the grammar
  set, not hand-listed beside it**, or the registry is forgeable in exactly the way this
  plan exists to prevent.

A binding's denylist is then `MERMAID_KINDS − (the kinds it consumes)`. Adding a grammar
moves one entry in one place; fail-closed survives, because a kind in neither set is unknown
and still reaches the parser.

- Export `declaredKind()` (or `diagramKind()`) from `packages/mermaid/src/parser/`.
  **It must return the normalised kind token**, not the raw line — the current
  implementation returns `graph TD` and callers normalise separately via `kindOf`'s
  `split(/[\s{]/)`. Shipping the raw-line version as public API bakes in a footgun.
- `md-mermaid` and `md-mermaid-er` both consume it. That fixes 0210 as a consequence:
  a themed `erDiagram` stops being silently dropped.
- **Not the kernel.** `packages/core` has no diagram concept and `arch.rules.ts`'s
  `eess/kernel-no-dialects` keeps it that way. Mermaid syntax knowledge in
  `@nielspeter/eess` would constrain all five dialects to serve one.

## Verification

- [ ] Red first: a themed `erDiagram` fixture is not selected today (bug 0210's repro).
- [ ] After the move it is selected and compared, and `tableErStats` counts it.
- [ ] **The lockstep check** — a kind in `MODELLED_KINDS` that **no binding declares**, in
      either direction, must red. This is the criterion the whole plan exists for; without
      it the duplication is removed and the failure mode is not.

      > Worded carefully, because the first draft's version — "a kind the parser models but
      > the selector excludes must red" — **reds a correct configuration today**: `erDiagram`
      > is modelled *and* excluded by `md-mermaid`, correctly, because that fence is
      > `md-mermaid-er`'s job. The property is *undeclared*, not *excluded*. Each binding
      > declares which modelled kinds it consumes, with an explicit not-consumed entry for
      > the rest, and the check is two-sided completeness over those declarations — which is
      > the kernel's `correspondence()`, not a second join engine.

- [ ] A break class in `scripts/nonvacuity/`, not only a unit test. Bug 0209's review showed
      the unit suite can catch a selector regression while every production gate stays green.
- [ ] `check:family` still green — the predicate is dialect-local and
      `eess-crossvalidate` already peer-depends on `eess-mermaid`, so no standalone
      sufficiency invariant moves.

## Who closes bug 0210

**This plan ships the fix; 0210 closes `done-otherwise → 0214`.** Stated because both
records described the same repair and neither named the owner, which is how a bug gets
marked fixed without its own floor being met. 0210's five verification boxes come with it —
including the two this plan's first draft dropped: a `---` frontmatter'd ER diagram must
also be selected, and a non-ER fence must still be skipped **without the document being
skipped with it**. That second one is the fail-open half.

## Out of Scope

- **Whether `eess-mermaid` iterates markdown itself.** That is proposal 006's OQ1, and its
  "corpus dialect" branch is gated shut by `eess/mermaid-isolated`. This plan moves
  **language** facts only; the container stays with `eess-md` and the loop with
  `eess-crossvalidate`. That distinction is the point, and it is why this plan does not
  need OQ1 answered first.
- `diagram()`'s sniff — [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md).
  It consumes this predicate, so 0214 makes 0211's fix cheaper, but they are separable.
- Any new grammar. Ask B is Held.
