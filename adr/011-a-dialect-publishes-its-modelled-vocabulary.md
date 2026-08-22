# ADR-011: A Dialect Publishes Its Modelled Vocabulary; Bindings Derive From It

## Status

Accepted (2026-08-23). **Prospective** — nothing in `packages/` implements this
today, and every Enforcement row below is `pending` for that reason. The decision
lands ahead of the work, per this repo's split: an ADR decides, a plan implements.
[Plan 0214](../work/plans/0214-extract-the-diagram-kind-predicate.md) is the
implementation; [bug 0210](../work/bugs/0210-er-fence-selector-is-an-allowlist.md)
is the live defect that motivated it.

Raised as open question 4 on
[proposal 006](../work/proposals/006-mermaid-beyond-classdiagram.md) — _"which
authority owns the set of modelled artifact kinds, and what fails when the parser
set and a binding's selector disagree?"_ Today the answers are **nobody** and
**nothing**. An earlier draft of plan 0214 tried to settle that inside its Approach;
review's finding was that a cross-package contract binding every future dialect is a
decision, not work, and belongs here.

## Context

`eess-mermaid` models two diagram kinds. Which kinds those are is restated, in
different shapes, in five places across two packages:

| restatement        | where                                            | shape                                                            |
| ------------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| `HEADER_PATTERN`   | `packages/mermaid/src/core/diagram.ts:5`         | `classDiagram` only; drives a path-vs-source sniff               |
| `ER_HEADER`        | `packages/crossvalidate/src/md-mermaid-er.ts:32` | allowlist — fail-open (bug 0210)                                 |
| `FOREIGN_HEADER`   | `packages/crossvalidate/src/md-mermaid.ts:35`    | denylist of ~25 kinds                                            |
| `KNOWN_UNMODELLED` | `packages/crossvalidate/src/md-mermaid.ts:32`    | kinds that must reach the parser anyway, to be reported honestly |
| `declaredKind()`   | `packages/crossvalidate/src/md-mermaid.ts:40`    | the lexer that finds the kind at all                             |

Nothing keeps them in agreement. Ship a grammar and forget a list, and every fence
of the new kind is skipped while the gate prints a denominator and exits 0 — the
fail-open shape ADR-009 and ADR-010 exist to prevent, at the level of the feature
rather than the rule.

This is not a Mermaid problem. Any dialect that grows a second artifact kind — a
Gherkin dialect that models `Rule:` as well as `Scenario:`, a Markdown dialect that
models a second table shape — reproduces it, and each binding over that dialect
restates the vocabulary independently.

## Decision

**A dialect owns the vocabulary of artifact kinds it models, publishes it, and no
consumer restates it.**

Three parts, and the third is the one an earlier draft got wrong:

1. **The dialect publishes the set.** `MODELLED_KINDS` is exported by the dialect
   that owns the grammars, derived so it cannot disagree with them — a kind is
   modelled if and only if something can parse it.

2. **A binding declares which modelled kinds it consumes**, and declares the rest
   explicitly as not-consumed. `md-mermaid` consumes `classDiagram`;
   `md-mermaid-er` consumes `erDiagram`; each says so about the other's.

3. **Three categories, not two.** The complement of the modelled set is _not_
   uniformly deniable:

   | category             | example                        | selector must                                                                                                                                |
   | -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
   | **modelled**         | `classDiagram`                 | select, per the consuming binding's declaration                                                                                              |
   | **known-unmodelled** | `classDiagram-v2`              | **reach the parser** — a legal artifact the dialect cannot yet read is a finding, phrased as a grammar gap rather than as the author's error |
   | **unknown**          | a kind Mermaid ships next year | **reach the parser** — fail-closed; a loud false positive, never vanished coverage                                                           |

   So only kinds a _sibling binding_ consumes may be denied. Everything else
   reaches the parser. A two-set design (`modelled` / `everything else`) silently
   converts the middle row from a violation into a skipped counter, which is the
   defect this ADR exists to prevent, committed by its own remedy.

**Not the kernel.** `packages/core` holds no artifact-kind vocabulary. A kind is
dialect knowledge, and putting it in the kernel would constrain five dialects to
serve one — the same argument `eess/kernel-no-dialects` already enforces for
imports.

## Consequences

- A binding cannot restate kind knowledge; it declares consumption against the
  published set. Adding a grammar is one edit in one place.
- The disagreement becomes checkable: a modelled kind no binding declares is a
  finding, in either direction. That is two-sided completeness — the kernel's
  `correspondence()`, not a second join engine.
- **A new failure mode is created and must be gated:** the published set is only
  as honest as its derivation. If it can be hand-edited without adding a parser, it
  becomes a suppression registry — adding a name silently removes coverage. The
  derivation must therefore be from the artifacts themselves.
- Bindings still differ legitimately in ways this contract does not cover — for
  example the two md-mermaid bindings disagree today on whether an untagged fence
  (`lang === null`) counts. Those remain per-binding options; the contract governs
  _kind_ vocabulary only.

## Alternatives considered

- **Leave it as prose.** Five restatements agreeing by convention is what bug 0210
  already is: a themed `erDiagram` silently dropped for months, in shipped code.
- **One shared regex.** Removes duplication and not the failure mode — a regex
  still has no relationship to the grammar set, so it goes stale the same way.
- **Denylist derived as `all-known − consumed`.** The earlier draft of plan 0214.
  Rejected above: it denies the known-unmodelled row and converts a loud finding
  into a silent skip.
- **Put the vocabulary in the kernel.** Rejected: dialect knowledge, and it would
  bind every dialect to one dialect's artifact model.

## Enforcement

| Clause                                                                        | Tier                                             | Mechanism                                                                                                                                                                                                                                                                  | Status    |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A dialect exports the set of artifact kinds it models                         | 1 (static — an export either exists or does not) | not built. [Plan 0214](../work/plans/0214-extract-the-diagram-kind-predicate.md) adds `MODELLED_KINDS` to `@nielspeter/eess-mermaid`                                                                                                                                       | `pending` |
| The published set is derived from the artifacts, not hand-listed beside them  | 2 (behavioral — the derivation must run)         | not built. Plan 0214 must derive it such that adding a grammar file without registering it cannot leave the set unchanged; a hand-editable constant is a suppression registry and does not satisfy this clause                                                             | `pending` |
| A modelled kind that no binding declares — in either direction — is a finding | 2                                                | not built. Plan 0214 specifies two-sided completeness over the per-binding declarations via the kernel's `correspondence()`, with a `scripts/nonvacuity/` fixture for the corruption                                                                                       | `pending` |
| A known-unmodelled kind reaches the parser and is reported, never skipped     | 2                                                | not built, and this is the clause the earlier design violated. Plan 0214 owes a fixture whose corruption is "a known-unmodelled kind was moved into the denied set", asserted to redden                                                                                    | `pending` |
| An unknown kind reaches the parser (fail-closed)                              | 2                                                | partially built for one binding: `packages/crossvalidate/src/md-mermaid.ts:186` selects by excluding known-foreign kinds, so an unrecognised header still reaches `diagram()`. `scripts/nonvacuity/bad-md-mermaid/mixed-diagram.md` is its break class. Not yet a contract | `warn`    |
| No artifact-kind vocabulary in `packages/core`                                | 1                                                | `eess/kernel-no-dialects` (`arch.rules.ts`) gates the import direction, which makes a kernel-side kind list unbuildable in practice rather than merely discouraged                                                                                                         | `gated`   |
