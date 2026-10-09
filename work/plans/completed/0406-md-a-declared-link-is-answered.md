# Plan 0406: md — a declared link is answered

## Status

- **State:** Done — built 2026-10-09: all three phases, the sabotage matrix and both
  non-vacuity tiers measured (see Build notes), then reviewed by five lenses and corrected (see
  "Review round"). Frozen Ready 2026-10-07 at the maintainer's request, written the same day from
  proposal 013's decisions 1, 3, 4, 7, 8, 9 and 10. A first freeze was withdrawn when architect,
  enforcement, method and testing review found mechanisms the kernel cannot build; a second
  architect, enforcement and testing review settled what remained.
- **Priority:** Medium — no shipped rule checks this property.
- **Effort:** Medium — one condition with options, one selector, findings per cause, a dogfood rule
  over this repository's ADRs, and non-vacuity at both tiers.
- **Created:** 2026-10-07
- **Implements:** proposal 013
- **Why this plan declares it:** it ships the proposal's last ask, so when it closes every ask is
  built, and the lane promotes a proposal only on such a declaration. Asks C and A are built by
  [plan 0404](./0404-md-one-link-resolver-names-each-case.md) and
  [plan 0405](./0405-md-select-the-links-a-block-declares.md), on which this plan depends.

## Problem

When a record declares a relation to another record, nothing checks that the other record answers.
A consuming project wrote that check as a custom condition. Proposal 013 measured that the obvious
composition with released parts, `correspondence().beComplete()`, gives a false red on a target that
links back twice and passes green on a misspelt label (bug 0400).

## Design

```ts
const resolveOptions = { tryExtensions: ['.md'] }
links(c)
  .that()
  .areLabelled('Related to')
  .and()
  .haveLiveTargets(resolveOptions)
  .should()
  .beLinkedBack(resolveOptions)
  .rule({ id: 'corpus/related-links-back', because: '…', suggestion: '…' })
```

- **The answer is any link back** from the target to the source (decision 1). Several links back are
  one answer. The documentation names the blind spot: an incidental mention counts.
- **`beLinkedBack(options?: LinkResolveOptions)`** takes the options `resolve()` takes, so a corpus
  that resolves extensionless links resolves declarations and back-links the same way.
- **Set membership, not a join.** On first evaluate the condition builds, from every internal link in
  the corpus resolved with `resolveLink` and the same options, an index from each document to the
  documents that link to it. Each selected link is looked up. `examined` is the selected links
  (ADR-010 §1), so an empty selection fails with the zero-examined finding, and bug 0400 does not
  apply. The condition is not marked cardinality-exempt.
- **The frozen exemption is an explicit selector the author writes: `haveLiveTargets()`.** A
  condition called after `.should()` cannot add a selection filter: `addPredicate` in the condition
  phase records the predicate as misplaced, and the rule then reports that it asserts nothing (bug
  0155). So the exemption is a predicate in `.that()`, beside `pointers()`' `areLive()`:
  `haveLiveTargets(options?: LinkResolveOptions)`, taking the same options as `beLinkedBack`, so the
  two resolve a link the same way (the documentation passes one value to both). It resolves each
  link with `resolveLink` and keeps those whose target is not a frozen document ("frozen" is the
  adopter's `frozen` corpus option). Because the author writes it, the exemption is part of the
  rule's own text, which `explain` and every finding show; an all-frozen selection examines zero and
  fails. **Forgetting it fails closed:** a link into a frozen record is then examined. If the frozen
  record links back, the relation is answered and nothing is reported; if it does not, the finding
  says the target is frozen and names the selector, so the remedy works.
- **No count of the exempted links.** Proposal 013's decision 3 asked that the run disclose how many
  links the exemption left out. With the exemption an ordinary, visible predicate, it is like every
  other `.that()` filter, none of which is counted; and the kernel's result has no field for it.
  Proposal 013's disposition for Ask B becomes `Accepted, reshaped` with this reason.
- **One finding per cause, on the declaring link's line, naming the target.** Element names carry no
  line number (`source → target`), so an edit above a link does not stale an exclusion (ADR-018,
  Proposed, followed here as practice):

| `resolveLink` case               | finding                                                 | remedy named in the finding                                           |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `document`, live, no link back   | `a.md` declares `b.md`, and `b.md` does not link back   | add a link to `a.md` in `b.md`, or remove `b.md` from the declaration |
| `document`, frozen (no selector) | `b.md` is frozen and cannot answer                      | add `.haveLiveTargets()` to the rule, or remove `b.md`                |
| `not-in-corpus`, `outside-roots` | `b.md` is outside the corpus, so its links are not read | add its folder to the corpus `roots`, or correct the link             |
| `not-in-corpus`, `not-markdown`  | `b.png` is not a Markdown record                        | declare a record, not a file                                          |
| `not-in-corpus`, `ignored`       | `b.md` matches the corpus `ignore` option               | correct the link, or stop ignoring the path                           |
| `missing`                        | `b.md` does not exist                                   | the remedy `linkResolves` names, so one fix clears both               |
| `directory`                      | the link names a directory                              | link the record's file                                                |
| `self`                           | the link points at this record                          | remove it; a record does not relate to itself                         |
| `external`                       | the declaration links outside the repository            | declare a record in the corpus                                        |

Each remedy is verified to remediate (ADR-009 rule 2): a test applies it to a fixture that keeps
another declared link (so clearing one finding cannot leave an empty selection) and shows the
finding clears; for `missing`, both `linkResolves` and `beLinkedBack` clear.

## Phases

### Phase 1 — the condition and the selector

**Files:** `packages/md/src/conditions/linked-back.ts` (new), `packages/md/src/predicates/live-target.ts`
(new), `packages/md/src/builders/links.ts` (`beLinkedBack`, `haveLiveTargets`), `arch.rules.ts` (the two
new files join plan 0404's structural rule), `docs/markdown.md`,
`packages/md/src/corpus.ts` (the `frozen` option's docstring now names this use),
`.changeset/` (eess-md minor, additive).

### Phase 2 — dogfood it on this repository's ADRs (decision 9)

- ADR-014 and ADR-016 each gain an `**Extends:**` line in their Status block, holding only the ADRs
  they extend (ADR-014 → ADR-010; ADR-016 → ADR-009, ADR-010). Their Status prose already states
  these relations; the line restates them and changes no decision. ADR-018 stays out until ruled.
- ADR-009 and ADR-010 each gain an `**Extended by:**` line in their Status block, linking back.
- Every `path:line` pointer into these four ADRs that the added lines shift is re-pointed in the
  same change (`check:corpus` finds them; `work/proposals/010-ts-performance-at-scale.md` cites
  ADR-014 today).
- `scripts/check-corpus.mjs` runs the rule over `adr/` only, with no `.expectEmpty()`, and prints its
  examined count in its summary like its other checks.

**Files:** `adr/009-agent-first-failure-surfaces.md`, `adr/010-a-pass-is-constructed-from-evidence.md`,
`adr/014-the-emitter-refuses-a-verdict-without-evidence.md`,
`adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md`, `scripts/check-corpus.mjs`, and
whichever records hold shifted pointers.

### Phase 3 — non-vacuity at both tiers (decision 10)

- **Production row, one-way:** using the harness's `withRewrittenFile`, remove every link from
  ADR-010 to ADR-014, asserting none remains after the rewrite (so a later incidental link cannot
  make the row blame the rule), run the production `scripts/check-corpus.mjs --format json`, and assert a finding with
  this rule id **on `adr/014-…md`, whose message names ADR-010** and which is not the zero-examined
  finding (the lesson `firedNamingPayload` records in `scripts/check-nonvacuity.mjs`). No probe file
  is planted, so no gate needs an exclusion.
- **Production row, every label removed:** rewrite ADR-014 and ADR-016 without their `**Extends:**`
  lines, as two nested `withRewrittenFile` calls (each must change its file, or the harness throws),
  and assert the zero-examined finding with this rule id. This is what catches the rule being
  given `.expectEmpty()`.
- **Fixture rows** under `scripts/nonvacuity/bad-linked-back/` with `bad-linked-back.mjs`: one per
  row of the finding table, an all-frozen selection, a mixed selection whose frozen target does not
  link back, and a green control including a target that links back twice and back-links written
  `a.md`, `./a.md`, `../x/a.md`, `/x/a.md` and `a%20b.md`.

- **Selector pin** (added 2026-10-09, deferred here from plan 0405's final review): no row yet
  pins `areLabelled()` itself. A row over the dogfood rule's selection must go red when it
  over-selects (a link outside every `**Extends:**` declaration selected) and when it under-selects
  (an `**Extends:**` item annotated `- [ADR-010](…): why` dropped).

**Files:** `scripts/check-nonvacuity.mjs`, `scripts/nonvacuity/bad-linked-back/**` and
`scripts/nonvacuity/bad-linked-back.mjs` (new).

## Test inventory

Tests import from the package root, in `packages/md/tests/builders/linked-back.test.ts`, over
`packages/md/tests/fixtures/linked-back/`.

- each row of the finding table, asserted by message and remedy text, with the remedy applied and the
  finding cleared;
- several links back, one with a fragment: green; a back-link only inside a code fence or an HTML
  comment: red;
- back-link spellings (`a.md`, `./a.md`, `../x/a.md`, `/x/a.md`, `a%20b.md`, extensionless with
  `tryExtensions`): green;
- an all-frozen selection with `haveLiveTargets()`: red with the zero-examined finding;
- a mixed selection whose frozen target does not link back: green with the selector, and the frozen
  finding without it;
- an extensionless declaration into a frozen target, both methods given `tryExtensions`: green;
- a frozen target that links back, without the selector: green;
- a `self` declaration spelt as a path (`./self.md`): the `self` finding;
- an empty selection: red.

**Sabotage rows** (ADR-009 rule 5; published API, rule 6's deepest level), in an isolated worktree,
from a green baseline, verdicts read from exit codes, plus an adversarial review before merge:

- the membership lookup always true: the one-way row goes red;
- `haveLiveTargets` deleted (always true): the mixed-selection row goes red;
- the condition marked cardinality-exempt: the empty-selection row goes red;
- one row per finding cause, its cause swapped for another: that cause's row goes red (nine rows);
- the production rule given `.expectEmpty()`: the every-label-removed production row goes red;
- `beLinkedBack` ignoring its options: the extensionless back-link row goes red;
- `haveLiveTargets` ignoring its options: the extensionless frozen-target row goes red.

**Merge order:** this plan's PR lands after bug 0403's record (PR #190) is on `main`, since it
links that record.

**Vacuity matrix:** it probes constructors over empty input and so reaches `links()`, not this
condition. Covering eess-md there is [bug 0403](../../bugs/0403-the-vacuity-matrix-probes-one-dialect-of-five.md)'s
fix, and this plan does not wait for it.

## Out of scope

- A stricter answer (under the same label, or a counterpart such as "Superseded by"): a separately
  named predicate, added when someone needs it.
- ADR-018's relation, until ADR-018 is ruled.
- A kernel "at least one counterpart" option for `correspondence()` (proposal 013, decision 6).

## Success

- A one-way declared relation fails the build with a finding naming its cause and a remedy that
  clears it.
- This repository's `check:corpus` runs the rule over the ADRs' Extends relation, and both production
  rows prove the real run fires it.
- `npm run validate` green.

## Progress ledger

- [x] Phase 1 — `beLinkedBack`, `haveLiveTargets`, the findings per cause, docs
- [x] Phase 2 — ADR `**Extends:**` / `**Extended by:**` lines, pointers re-pointed, the rule in `check:corpus`
- [x] Phase 3 — the two production rows and the fixture rows
- [x] the selector pin: a row red on over- and on under-selection (added 2026-10-09)
- [x] each remedy verified to remediate
- [x] the sabotage rows go red; adversarial review before merge
- [x] proposal 013 moves to `promoted/` in the PR that ships this plan, since this plan declares
      `**Implements:** proposal 013`
- [x] `npm run validate` green

## Build notes — 2026-10-09

- **Tests** (`packages/md/tests/builders/linked-back.test.ts`, 17): every row of the finding table by
  element, message and suggestion, each with its remedy applied to a temp copy of its fixture and the
  finding shown to clear — for `missing`, `resolve()` clears too. Every fixture but the empty and
  all-frozen ones keeps a declaration that does link back, so a remedy cannot pass by emptying the
  selection.
- **One reason for a file the corpus did not load.** `resolveLink` lists every reason; the finding
  names one, by the remedy that comes first — not Markdown, then ignored, then outside the roots — so a
  `.png` outside the roots is told to declare a record, not to widen the roots.
- **The structural rule now covers predicates/.** Plan 0404's `eess/md-one-link-resolver` selects
  `{conditions,predicates}/*.ts`; measured by planting a `node:path` import in
  `predicates/live-target.ts`, which reds the rule on that file. `basenameIndex()` moved beside
  `movedLinkFix` in `model/resolve-link.ts`, so `linkResolves` and `beLinkedBack` share one index.
- **The dogfood.** ADR-014 and ADR-016 declare `**Extends:**`; ADR-009 and ADR-010 answer with
  `**Extended by:**`. `check:corpus` runs `corpus/adr-extends-linked-back` over its own `adr/**`
  corpus and prints `extends 3 ADR Extends link(s) · ✓ each answered`. ADR-016's line is a list item
  and the others paragraphs, so both label shapes are exercised. ADR-018 is out of the rule
  because it is Proposed — this plan keeps it out until it is ruled. Its `- **Extends** [ADR-009]`
  line has no colon, so the rule could not read it anyway, and nothing reports a colon-less label:
  bug 0408 (PR #196), stated in the rule's comment. That line opens a prose sentence, so it is the
  counter-example bug 0408's fix is measured against.
- **Pointers.** The added ADR lines and the shortened `conditions/resolve.ts` moved the lines 21
  pointers in live records cite. `check:corpus` reports a pointer past a file's end, not one that now
  lands on the wrong line, so all 21 were re-pointed from a diff-derived old→new line map, each
  checked to cite the same text as before.
- **Sabotage** (each restored before the next; `linked-back.test.ts`, the 13 fixture scenarios, and
  for the production rule the two production rows): the membership lookup always true — 4 tests, 4
  fixture rows; `haveLiveTargets` always true — 3, 2; the condition marked cardinality-exempt — 2,
  `all-frozen`; each of the nine causes swapped for another — 1–3 tests and that cause's fixture row
  each; `beLinkedBack` ignoring its options — 2, `green-control`; `haveLiveTargets` ignoring its
  options — 1 test (the extensionless frozen target), no fixture row, as the plan specified; the
  production rule given `.expectEmpty()` — the `every-label-removed` production row. 15 rows, all red;
  17 green after.
- **Non-vacuity:** 15 rows. Two production (`corpus/adr-extends/one-way`,
  `corpus/adr-extends/every-label-removed`) run the real `check-corpus.mjs` both ways over sabotaged
  ADRs; thirteen fixture (`corpus/linked-back/*`) each assert an exact finding set, so a missing and
  an extra finding both fail — `selector-pin` is plan 0405's deferred residual: an annotated item is
  declared, a link outside the label is not.
- **Validate:** `npm run validate` green in 9m04s on the build, and again in 8m51s after the review
  round's corrections, `check:fast` first each time. The ledger's
  validate and review boxes were ticked before they ran, because `check:ledger` inside validate
  reads them; the reviews are recorded in the PR.

## Review round — 2026-10-09

Architect, product, enforcement, method and testing reviewed the build (1501af5). No Critical.

- **The frozen remedy under mismatched options** (product, enforcement, architect — all three
  measured it). `haveLiveTargets()` and `beLinkedBack()` each take options; given different ones,
  the frozen finding told the author to add `.haveLiveTargets()` to a rule that had it. The remedy
  now says to pass it the options `beLinkedBack()` gets, and a test applies that and shows it
  clears. One options value per rule, so the two cannot differ, is a design change this plan does
  not make; the remedy is now right in both cases.
- **ADR-018's colon-less label** (enforcement, architect) is a gap in plan 0405's label grammar,
  not in this plan: recorded as bug 0408 (PR #196, reviewed by the method lens, which corrected
  this plan's first claim that the missing colon was the only reason ADR-018 is unchecked), and stated in the dogfood rule's comment with the rule's
  other blind spots (a different spelling, the reverse direction). The rule's `because` no longer
  claims both directions.
- **Pointers** (method). The first sweep skipped `corpus.ts`, which this plan also changed: bug
  0087 and proposal 001 now cite `corpus.ts:77-80` again, and proposal 013 cites the `frozen` option
  at `:32`. Bug 0136's re-mapped pointers had cited the wrong code since plan 0404; they now cite
  `model/resolve-link.ts:152`, `:270` and `:278`, and its older references carry a dated note
  rather than a re-certification. Pointers already stale on `main` and not touched here (proposal
  002's `corpus.ts:91` and `:50-67`) are left.
- **The freeze history** this plan's State had dropped is restored.
- **Tests** (testing): the finding's line is in every key — unit tests and fixture rows — so a
  finding on the wrong line fails; the moved-link autofix is asserted equal to `resolve()`'s; an
  ignored `.png` is told to declare a record; temp copies are removed; the all-frozen test asserts
  `examined` 0. Unit tests: 20.
- **Fixture rows** (testing, method): a `fence` scenario guards the one fake-green fixture — a
  back-link only in a code fence or comment — and the three folders no scenario read were removed.
  Fourteen fixture rows; the selector pin runs over a fixture with the dogfood's selector shape, not
  over the ADRs themselves.
- **A third production row** (enforcement): `corpus/adr-extends/list-item` removes ADR-009's link to
  ADR-016, whose declaration is the one list item, and asserts the finding on ADR-016 naming
  ADR-009. Seventeen non-vacuity rows in all.
- **Docs** (product, architect): the not-loaded row is three rows, one per finding; a missing or
  external target's element is its URL; a declaration inside a frozen record is still examined,
  with the `satisfy()` filter for leaving it out; CLAUDE.md's ADR convention names the
  `**Extends:**` / `**Extended by:**` relation.
- **Not changed:** the receipt member passed to `mergeCollectResults` is built the way the
  neighbouring pointer check's is (architect M1); the per-condition indexes (M2) and the second
  repo walk for the adr/ corpus (M3) are costs, not defects, at this repository's size.
