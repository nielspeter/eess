# Bug 0143: `scripts/lib/proposal-ruling.mjs` hand-rolls a fence-stripper and a closed-vocabulary matcher `eess-md` already ships

## Status

- **State:** Draft — measured against the shipped `terms()`/`vocabulary()`
  primitive; not reproduced as a working replacement, no red test.
- **Severity:** Low — the hand-rolled parser is correct today, as of the
  correction below; this is a duplication/architecture finding, not a live
  defect. It would earn Medium if `proposal-ruling.mjs` picks up a second
  unrelated vocabulary-matching need and drifts further from the shipped
  primitive.

  > **Correction — 2026-08-14.** The claim above ("correct today, verified
  > against all five real proposals plus a branch review's adversarial edge
  > cases") was false when first written. A second review round (architect,
  > independently: customer, enforcement) found the hand-rolled
  > `RULING_LINE_RE_G`/`RULING_LABEL_RE` were anchored at column 0 with no
  > list-marker, blockquote, or indentation tolerance — a bulleted,
  > blockquoted, or indented `**Ruling:` line was silently invisible,
  > reproduced live against the real corpus. The shipped `terms()`/
  > `vocabulary()` primitive this bug is about does **not** have that defect
  > (`collectTerms` uses an unanchored `label.exec(line)` —
  > `packages/md/src/builders/vocabulary.ts:118` — so a line prefix is
  > irrelevant by construction). That is the strongest evidence this bug
  > argues, and the first draft undercut it by asserting correctness instead
  > of citing the defect. Now fixed (both sides share a `LABEL_PREFIX`
  > tolerating `-`/`*`/`+`/`>`/indentation) — see the Reproduction section,
  > updated in place rather than rewritten.

- **Origin:** self-found · architect review of the branch that built
  [plan 0142](../plans/0142-bind-proposals-to-plans.md), 2026-08-14
- **Reported:** 2026-08-14

## Symptom

`scripts/lib/proposal-ruling.mjs` hand-rolls, in ~150 lines of script-local
code:

- a fence-stripper (`stripFencedCode`) that blanks fenced code blocks before
  matching, so an illustrative `**Ruling: Ship as-is**` inside an example
  never misclassifies;
- a closed-vocabulary matcher built from a longest-first, escaped-alternation
  regex over `RULING_VOCABULARY`, so a shorter alternative can never truncate
  a longer one sharing a prefix.

Both are already shipped, dialect-level primitives in
`packages/md/src/builders/vocabulary.ts` and
`packages/md/src/rules/ledger.ts`'s `stateMatcher` — the module's own doc
comments say so explicitly ("the same discipline `packages/md/src/rules/
ledger.ts`'s `stateMatcher` applies to `State:`") while reimplementing rather
than reusing. `terms()`/`vocabulary()`/`.resolveAgainst()` specifically model
"labelled prose reference → closed term set → violation naming the offending
value" — exactly this module's Ruling-extraction problem — and today have
**zero** dogfood usage anywhere in this repo, in a project whose thesis is
dogfooding its own primitives.

## Reproduction

Measured live against the real corpus (architect review, 2026-08-14):

```js
terms(c, { label: /\*\*Ruling:/ })
  .that()
  .resideInFile('work/proposals/*.md')
  .should()
  .resolveAgainst(vocabulary(c, { terms: RULING_VOCABULARY }))
```

extracts all six real Rulings correctly (`Rewrite needed` ×4, `Docs-only`,
005's second round) and, with a garbled probe planted, reports
`work/proposals/905-g.md:5 'ship as-is' does not resolve against the
vocabulary (6 terms)` — naming the offending value directly, which the
hand-rolled `corpus/proposal-ruling-unparseable` message does not.

Not reproduced: whether `terms()`/`vocabulary()` can be made to express the
**Implements** side of the join (a bare number or a markdown-link form,
optionally bulleted, feeding a `keyBy` join rather than a closed-vocabulary
match), or the "last `## Review —`/`**Ruling:**` in the file wins" scoping
plan 0142's Phase 2 rework settled on. Both are open questions this bug does
not answer.

**The stronger evidence, found the same day.** The hand-rolled parser
independently reintroduced a defect the shipped primitive had already solved.
`packages/md/src/builders/vocabulary.ts`'s `collectTerms` matches via
`label.exec(line)` — unanchored, so a bulleted, blockquoted, or indented line
matches unconditionally — while `proposal-ruling.mjs`'s first cut anchored
`^\*\*Ruling:` at column 0, silently invisible on exactly those shapes
(measured: `- **Ruling: Ship as-is**`, `> **Ruling: Ship as-is**`, and an
indented line all parsed to `null` with no violation, on the real production
script). Fixed the same day by hand-widening the anchor to tolerate the same
prefixes `vocabulary.ts` never had to special-case. This is not a hypothetical
cost of not reusing the primitive — it is the actual cost, paid once already.

## Root cause

`scripts/lib/proposal-ruling.mjs` was written by extracting policy out of
`scripts/check-corpus.mjs` (following `scripts/lib/corpus-link-routing.mjs`'s
precedent) without first surveying `packages/md/src/builders/` for an
existing element type that already models "labelled value in prose, checked
against a closed vocabulary." The survey step [`review-proposal`](../../.claude/skills/review-proposal/SKILL.md)
itself mandates for a _proposal_ ("Step 2: Existing code survey... the most
important step") was not applied to this plan-build, because plan-build has
no equivalent mandated survey step for new script-local code.

## Why it matters

Not urgent: the hand-rolled parser is correct today, independently verified
by six reviewers plus mutation testing — after one review round found it was
not (see the Correction above). It matters because it is a second,
independently-maintained copy of logic `eess-md` already ships and tests —
exactly the drift class [bug 0141](./0141-no-check-binds-accepted-proposals-to-plans.md)
itself diagnosed (a documented
capability and its actual mechanism disagreeing), one level up, in the tool
that dogfoods the discipline of not doing that.

## Fix

Not designed here — this bug records the finding per this lane's own
"corrections stay in the record" discipline rather than either silently
fixing it or silently dropping it. A future pass should determine: whether
`terms()`/`vocabulary()` can express the full Ruling-extraction requirement
(closed vocabulary, last-wins scoping) without kernel changes; whether the
Implements side needs its own new dialect-level primitive or stays
script-local (it is a `keyBy` join input, not a vocabulary match); and
whether replacing `proposal-ruling.mjs`'s two duplicated helpers is worth the
churn against a parser that is currently correct and covered by non-vacuity
probes plus mutation testing.

## Verification

- [ ] Red test written first: none — this is a design/duplication finding,
      not a corruption with a red state.
- [ ] `npm run validate` green — n/a, no code changed by this bug's filing.

Deferred: none.
