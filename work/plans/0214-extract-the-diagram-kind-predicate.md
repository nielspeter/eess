# Plan 0214: one lexer for "what kind of Mermaid diagram is this"

## Status

- **State:** Draft — deliberately smaller than three previous drafts. Each of those
  tried to design a cross-package _contract_ here; the third was promoted to an ADR and
  the ADR was **retracted** before merge. What survives is the narrow, buildable part.
  See "The contract this plan no longer proposes" below — it is kept because the reasons
  it failed are the useful residue.
- **Implements:** proposal 006
- **Priority:** Medium — closes a live fail-open defect
  ([bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md)).
- **Effort:** Small — move one pure function into the package that owns the language,
  and make the second binding select the way the first already does.
- **Created:** 2026-08-22

## Problem

Two defects, one small and live, one large and speculative. This plan now owns only the
first.

**Live:** `md-mermaid-er` selects ER fences with an allowlist —
`ER_HEADER = /^\s*erDiagram\b/` (`packages/crossvalidate/src/md-mermaid-er.ts:32`) — so an
ER diagram behind a `%%{init}%%` theme directive parses fine and is **silently not
selected**. That is [bug 0210](../bugs/0210-er-fence-selector-is-an-allowlist.md), and it
is the identical hole [bug 0209](../bugs/fixed/0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)
fixed in the sibling binding: an allowlist drops whatever it fails to recognise.

**Speculative:** five restatements of Mermaid kind knowledge live across two packages, and
nothing keeps them agreeing. Ship a grammar, forget a list, and coverage vanishes quietly.
Real, but it has not happened, and three attempts to gate it have each been fail-open in a
different place.

## Approach

1. **Move `declaredKind()` into `eess-mermaid`**, exported, returning the **normalised kind
   token** (today it returns the raw line `graph TD`; callers normalise separately via
   `kindOf`). It handles `%%` comments, single- and multi-line `%%{init}%%` blocks and
   `---` frontmatter — those are Mermaid grammar constructs, so this is a language fact
   living in a binding package. **Not the kernel**: `packages/core` holds no artifact
   vocabulary, and a Mermaid lexer there would constrain five dialects to serve one.

2. **Both bindings consume it** rather than re-deriving. `md-mermaid` already calls it, so
   this is an import change there.

3. **Make `md-mermaid-er` fail-closed**, the shape 0209 established: select by _excluding_
   the kinds known to be something else, so an unrecognised header still reaches the parser
   and produces an attributed finding. That closes bug 0210.

Nothing else. In particular this plan does **not** publish a kind registry, does not add
per-binding consumption declarations, and adds no lockstep gate.

## The contract this plan no longer proposes

Three drafts tried to make "the grammar set and the selectors cannot disagree" mechanical.
Kept as a record because each failed differently, and the reasons bound what a fourth
attempt would have to survive:

- **Draft 1 — move the lexer, call it a registry.** `md-mermaid.ts` already calls
  `declaredKind()`, so relocating it changes one import and leaves `FOREIGN_HEADER` — the
  list that actually goes stale — untouched. The plan's own decisive criterion could not
  be delivered by its Approach.
- **Draft 2 — `denylist = MERMAID_KINDS − consumed`.** Puts `classDiagram-v2` in the
  denylist, converting today's loud, honestly-phrased finding into `skipped += 1`. It also
  inverts `md-mermaid-er`: every unknown kind would reach the ER parser too, two findings
  per fence from two presets.
- **Draft 3 — ADR-011, three categories, only a sibling's kinds deniable.** Retracted
  before merge, for three measured reasons:
  - **Its generalisation was false.** `eess-gherkin` already models a multi-token
    vocabulary (`Scenario Outline | Scenario | Example`, `packages/gherkin/src/load.ts:42`)
    and already has a deliberately unmodelled keyword (`Background:`, `load.ts:41`) — and
    its two bindings restate **nothing**, because they consume `GherkinScenario` objects.
    The failure mode does not reproduce in the one sibling that meets the precondition.
    The real bound is narrower than any of these drafts saw: it arises when a dialect's
    artifacts live in **a container the dialect does not own**, forcing consumers to select
    by kind _before_ parsing. Mermaid-in-Markdown is the family's only instance.
  - **It contradicted a committed fixture.** Under it, ~23 of the denied kinds become
    "must reach the parser and be reported", which inverts
    `scripts/nonvacuity/bad-md-mermaid.mjs`'s assertion that `mixed-diagram.md`'s
    `sequenceDiagram` produces **no** parse finding — and gives an adopter a permanently-red
    finding with no remedy they can apply.
  - **Its category model had a member-less middle.** `classDiagram-v2` — its only worked
    example of "known-unmodelled" — is an **alias** for `classDiagram`, the same language
    under the v2 renderer. Fold the alias in and the category has zero members. The honest
    fix for `-v2` is a lexer alias, not a grammar; see Out of Scope.

**What this leaves undone, stated rather than gated.** Nothing keeps the grammar set and
the selectors in lockstep. That risk is real and this plan does not close it. Under ADR-009
a stated-weak guarantee beats an over-claimed one, and three over-claims is enough.

## Files Changed

- `packages/mermaid/src/parser/` + `index.ts` — the exported, normalised `diagramKind()`
- `packages/crossvalidate/src/md-mermaid.ts` — import instead of re-derive
- `packages/crossvalidate/src/md-mermaid-er.ts` — fail-closed selection
- `scripts/nonvacuity/bad-md-mermaid-er/` — a themed-ER violating fixture
- a changeset: `@nielspeter/eess-mermaid` minor (new export),
  `@nielspeter/eess-crossvalidate` **minor, not patch** — ER fences that were silently
  skipped are now compared, so an adopter's green build can go red with no rule change of
  their own

## Verification

Bug 0210's five boxes, inherited in full — **0210 closes `done-otherwise → 0214`**:

- [ ] Red first: a themed `erDiagram` fixture is not selected today.
- [ ] After the fix it is selected and compared, and `tableErStats` counts it.
- [ ] A `---` frontmatter'd ER diagram likewise.
- [ ] A non-ER fence is still skipped, **and the document is not skipped with it** — the
      fail-open half.
- [ ] The selector has a break class in `scripts/nonvacuity/`, driving the production gate.
      Bug 0209's review measured that a unit suite can catch a selector regression while
      every production gate stays green; and round three measured that
      `mixed-diagram.md` does **not** cover an unrecognised header — a fence declaring an
      unknown kind (e.g. `zowieChart`) fires today and goes silent under an allowlist, so
      that is the fixture shape this box needs.
- [ ] `check:family` green — the export is dialect-local and `eess-crossvalidate` already
      peer-depends on `eess-mermaid`, so no standalone-sufficiency invariant moves.

## Out of Scope

- **Any kind registry or lockstep gate.** See above. If someone wants it, the three
  failures there are the floor a fourth attempt has to clear.
- **`classDiagram-v2` as a lexer alias.** A real, small fix — it is the same language and
  today an author is told their syntax is wrong. Its own record; do not fold it in here,
  because it changes what "unmodelled" means and that is exactly what went wrong above.
- `diagram()`'s sniff — [bug 0211](../bugs/0211-diagram-sniffs-its-input-and-reads-arbitrary-files.md).
  **Sequence 0211 first**: this plan widens the set of fence bodies reaching a parser entry
  point, and that entry point currently reads arbitrary local files.
- **The language-tag divergence** — `md-mermaid-er` accepts `lang === null`, `md-mermaid`
  requires `'mermaid'`. Untouched here; needs its own decision.
