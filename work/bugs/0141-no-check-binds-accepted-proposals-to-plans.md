# Bug 0141: nothing verifies an accepted proposal ever got a plan — the `Ruling` a proposal carries is never checked against reality

## Status

- **State:** Draft — measured against real corpus state and a synthetic
  fixture pair; a working check spiked and reverted, not yet built. No red
  test yet. **Reviewed 2026-08-14 (all six personas): the gap is real, the
  Fix as specified is not buildable — see `## Review — 2026-08-14` below.
  Do not implement the Fix section as written.**
- **Severity:** Medium — an honesty gap between a stated claim (`PROPOSALS.md`'s
  own vocabulary: "an accepted proposal becomes a Draft plan on the roadmap")
  and its actual mechanism (none). Not High: no proposal has ever been
  accepted in this repo, so nothing is passing over drift that is present
  today — the gap is unexercised, not currently lying.
- **Origin:** self-found · asked directly whether proposal→plan linkage is
  dogfooded, while closing out proposal 005's own two-round review
- **Reported:** 2026-08-14

## Symptom

`work/proposals/PROPOSALS.md` states the intended lifecycle directly: _"An
accepted proposal becomes a Draft plan on the roadmap... any binding decision
inside it becomes an ADR."_ Nothing checks that this actually happens. The
board's own "Related plans" column is documented as unmechanized in the same
file: _"Nothing mechanizes that derivation today; it is asserted by whoever
last updated the board."_

Verified directly, not from the document's own claims:

```bash
grep -rli "proposal" work/plans/*.md work/plans/completed/*.md
# work/plans/0089-family-standalone-sufficiency.md
# work/plans/0090-adopt-ts-archunit-work-corpus.md
# work/plans/0101-sibling-gates-go-fail-closed.md
# work/plans/ROADMAP.md
```

Read each: 0089/0101 both _exclude_ proposal 001's concept from their own
scope ("out of scope for this plan"); 0090 describes ts-archunit's own
historical proposals as heritage being folded in, and cites proposal 002 only
as a dependency to re-check at close. **None of the four is a plan that
implements a proposal.** No proposal file anywhere contains a "→ plan NNNN"
back-reference either. The link this repo's own documentation describes has
never existed in either direction.

`check:corpus` gates `work/proposals/**` and `work/plans/**` for cross-link
resolution (Tier 1: does a link point at a real file), but that is a
different claim than "does an accepted proposal have a plan at all" — a
proposal with _no_ plan-link has nothing for `check:corpus` to resolve or
fail to resolve. The absence is invisible to it by construction, the same
shape [0138](./0138-pointer-resolve-proves-existence-not-truth.md) names for
`path:line` pointers: a gate that proves a reference resolves is not a gate
that proves a required reference exists.

## Reproduction

No real accepted proposal exists to reproduce this against (`grep -n
"\*\*Ruling: Ship" work/proposals/*.md` — zero hits), so this was spiked
against synthetic fixtures instead, mirroring how this repo's own nonvacuity
fixtures prove a condition without a real corrupted corpus to point at.

Three fixture proposals, one fixture plan, built entirely from public APIs
(`docs()`, `correspondence()`, `beComplete()` — no kernel changes):

```js
const RULING_RE = /\*\*Ruling:\s*([A-Za-z][A-Za-z -]*?)\s*—/
const ACCEPTED = new Set(['Ship as-is', 'Ship with changes'])
// ...bind accepted proposals (left) to plans (right) that cite them back,
// matchBy: plan.text.includes(`proposals/${proposal.relPath}`)
correspondence({ left, right, matchBy }).should().beComplete({ direction: 'left-to-right' })
```

Results, measured:

| fixture | Ruling     | plan cites it back | check result                             |
| ------- | ---------- | ------------------ | ---------------------------------------- |
| 0900    | Ship as-is | yes (plan 0950)    | 0 violations — silent                    |
| 0901    | Ship as-is | no                 | **flagged**, named, with a suggested fix |
| 0902    | Reject     | no (correctly)     | not evaluated — excluded, not accepted   |

Negative control: removing plan 0950's citation of 0900 immediately flagged
**both** 0900 and 0901 — confirmed the mechanism discriminates, not a fluke of
which fixture happened to be checked. Reverted after measuring; nothing in
the real corpus was touched.

> **Correction — 2026-08-14.** The testing reviewer rebuilt this exact spike
> independently and could not reproduce either claim above from the `matchBy`
> as printed at line 67 (`` plan.text.includes(`proposals/${proposal.relPath}`) ``).
> `relPath` is repo-root-relative (`work/proposals/0900-x.md`), so the needle
> interpolates to `proposals/work/proposals/0900-x.md` — a string no plan
> contains. Under the code as literally printed: 0900 (claimed "0
> violations — silent") is **flagged**, and the negative control reports 2
> violations before removing the citation and 2 after — **no discrimination
> at all**. Only a "charitable" `basename(relPath)` variant, never shown in
> this record, reproduces the table and control above. Either that variant is
> what actually ran and the snippet was transcribed wrong, or the printed
> code ran and the constant 2-violation output was misread as a working
> control. Either way, the code shown is not the code that produced these
> results. See `## Review — 2026-08-14` below.

A real defect surfaced while building the reproduction itself, worth
recording rather than silently fixing: the first version of `RULING_RE`
terminated on any hyphen, and `Ship as-is` contains one (`as-is`) — the regex
silently truncated the capture to `"Ship as"`, which matched nothing in
`ACCEPTED`, and the spike reported "0 accepted" on a corpus where two fixtures
were plainly accepted. Fixed by terminating only on the em dash that actually
separates the `Ruling` token from its gist in every real proposal
(`grep -n '^\*\*Ruling:' work/proposals/*.md` — all five use `—`, never a bare
`-`, at that position). Caught only by checking the raw count against what was
planted, not by trusting the tool's own silence — the same discipline this
repo's own reproduction guidance (`arch.rules.ts`'s `-F` note, 0127's
`sed -i ''` note) keeps naming as necessary.

> **Correction — 2026-08-14.** The claim above ("all five use `—`, never a
> bare `-`, at that position") is false, falsified independently by all six
> reviewers of this record. Two of the five real `**Ruling:` lines have no em
> dash at that position at all:
>
> ```
> work/proposals/002-comment-embedded-links.md:117:**Ruling: adopt the problem, decline the primitive, defer the API behind plan
> work/proposals/005-crossvalidate-stale-wip-detection.md:204:**Ruling: not plan-ready, second time. The Rewrite's placement argument was
> ```
>
> `RULING_RE`'s `[A-Za-z -]` class excludes the comma and period that appear
> before any em dash on both lines, so it does not match either — the regex
> silently reports "not accepted" for both, the same class of failure this
> paragraph credits itself for catching once. It wasn't run against the raw
> corpus, only read by eye. Running it: 0 of 5 real Ruling lines parse to a
> value in `ACCEPTED` — the other three parse to lowercase free prose
> (`docs-only`, `rewrite needed`) against a title-case `ACCEPTED` set that
> matches none of them either. See `## Review — 2026-08-14` below.

## Root cause

`PROPOSALS.md`'s "Related plans" column and its stated lifecycle are prose —
asserted by whoever last edited the board, per the file's own admission.
Nothing derives either fact from the corpus. `check:corpus` binds `work/`
cross-links for resolution but has no correspondence between the _proposals_
lane and the _plans_ lane specifically — the closest existing primitive,
`correspondence()` + `beComplete()`, is never invoked for this pair anywhere
in the dogfood chain.

## Why it matters

Not urgent today — zero proposals have been accepted, so the gap has never
been exercised. It matters because the failure mode is silent by design: an
`## Review` section can carry `**Ruling: Ship as-is**` forever with no plan
ever following, and nothing in this repo's own dogfood chain would notice.
The board's own "Read of the board" note already tracks this by hand
("No proposal here has spawned a plan") — a fact currently true only because
someone keeps checking and writing it down, not because anything enforces it.

## Fix

> **Correction — 2026-08-14.** The design below is not buildable as written —
> see `## Review — 2026-08-14`. Kept in place per this repo's own
> corrections-stay-in-the-record convention rather than rewritten quietly.
> Do not implement this section until it is revised.

Extend `scripts/check-corpus.mjs` with a fourth check alongside links,
pointers, and ADR enforcement: bind proposals whose `## Review` section
carries `**Ruling: Ship as-is**` or `**Ruling: Ship with changes**` (left) to
plans (right), asserting `beComplete({ direction: 'left-to-right' })` — every
accepted proposal has at least one plan whose text cites it back. Reuses the
spiked shape above; the extraction regex is the one thing to carry forward
carefully, given the demonstrated failure mode.

A `scripts/nonvacuity/bad-proposal-plan-link.mjs` fixture, the shape of the
spike's fixtures above (a committed accepted-and-orphaned proposal + a
committed accepted-and-implemented one, both outside `work/proposals/**` so
they never enter the real corpus — matching how `bad-links/`, `bad-adr/` etc.
already live under `scripts/nonvacuity/` rather than the real lanes),
registered in `GATE_FOR['check:corpus']`.

## Review — 2026-08-14

Six-persona review (`architect`, `product`, `enforcement`, `testing`,
`devops`, `customer`) of this record. All six independently confirmed: the
gap is real and the 0138 framing is the right generalization, but the Fix
section as specified would ship a gate that goes silently, permanently
green. Two claims in the Reproduction section were independently falsified
by all six (annotated in place above). Disposition: **stays Draft.** The
Fix section is not to be implemented until rewritten to address the
critical findings below.

**Critical (confirmed by ≥2 reviewers each):**

1. `matchBy` cannot distinguish "a plan implements this proposal" from "a
   plan cites it to declare it out of scope." The only three real
   plan→proposal citations in this repo today
   (`work/plans/0089-family-standalone-sufficiency.md:176`,
   `work/plans/0101-sibling-gates-go-fail-closed.md:117` — both citing
   proposal 001 to exclude it; `work/plans/0090-adopt-ts-archunit-work-corpus.md:237`
   — citing 002 only as a re-check dependency) would all satisfy
   `plan.text.includes(...)`. This record's own Symptom section (lines
   36-39) reads those three as non-implementations; its own Fix would score
   all three as implementations.
2. The `matchBy` as printed (line 67) cannot reproduce this record's own
   results table or negative control — see the Correction on that section
   above. `relPath` is repo-root-relative, so the literal needle can never
   occur in real plan text.
3. `RULING_RE`/`ACCEPTED` fail on the real corpus: 0 of 5 real `**Ruling:`
   lines parse into `ACCEPTED` — 2/5 don't match the regex at all (a comma
   or period precedes the first em dash), the other 3 parse to lowercase
   free prose (`docs-only`, `rewrite needed`) against a title-case
   `ACCEPTED` set that matches none of them. See the Correction above.
4. The non-vacuity fixture design (`scripts/nonvacuity/bad-proposal-plan-link.mjs`,
   citing `bad-links/`/`bad-adr/` as precedent) regresses to the exact tier
   bug [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)
   deleted the same day, for the same reason: `bad-links/` no longer
   exists, deleted by 0127's own fix, because a hand-built fixture proves
   only that the rule fires in isolation, never that the production script
   invokes it. `scripts/check-corpus.mjs`'s `ROOTS` does not include
   `scripts/nonvacuity/`, so a fixture placed there is structurally
   invisible to the check under test. Correct shape: `gateCorpusProbe()`
   against a real ephemeral probe under `work/proposals/`, asserting both
   `--format json` and the bare terminal exit code.
5. A proposal can carry more than one `## Review` / `Ruling` — 005 already
   has two (lines 45 and 204, from two review rounds). The non-global regex
   reads the first, so a proposal accepted on a later round would be
   permanently misread by its earlier verdict. Not addressed in the
   original Fix.

**Important:**

- Root cause runs one level deeper than diagnosed: there is no single
  literal token for "Ruling" anywhere in the chain — the `review-proposal`
  skill itself never emits the word, `PROPOSALS.md` documents one
  (title-case) vocabulary, and every real proposal file writes a third
  thing, in free lowercase prose. No extraction regex is safe until the
  Ruling becomes a structured, literal field the skill emits consistently
  — that is a prerequisite, not a regex fix.
- `kit/` ships no proposals lane at all (no skill, no template, not
  mentioned in `docs/working-method.md`). The Fix should say explicitly
  this check is repo-local, not silently omit the question.
- `correspondence()`/`beComplete()` are kernel exports (`@nielspeter/eess`),
  not `@nielspeter/eess-md`'s — "built entirely from public APIs... no
  kernel changes" understates real kernel coupling, relevant to plan 0089's
  open concern about md-only consumers being unaware they depend on the
  kernel.
- `beComplete({direction: 'left-to-right'})` reports `leftAmbiguous` for a
  left element matching more than one right — a proposal split across
  multiple plans (`Split and sequence`) was never fixture-tested and may
  not behave as the Fix assumes.
- The Verification checklist's red-test box ("no such check exists to even
  fail red") is not a red test — it never observes a failure. Needs: commit
  a real probe, assert exit 1 + rule/file identity, confirm sabotage
  (emptying the check) reddens it.
- With 0 proposals accepted today, this check's contribution to
  `totalChecked` would read 0 indefinitely, indistinguishable from "the
  extraction is broken" — the report needs an explicit checked-denominator
  line, not a bare zero.

Full findings (six full reviews, Critical/Important/Minor/Praise each) are
in the session record; not reproduced here in full per this file's own
brevity convention. The recommended next step, per the reviewers converging
independently: do not implement the Fix as specified; first settle where
the `Ruling` token becomes a literal, structured field (skill + format
prerequisite), then redesign `matchBy` around a declared back-reference
rather than substring co-occurrence, then rebuild the non-vacuity fixture on
`gateCorpusProbe()`.

## Verification

- [ ] Red test written first: the fixture pair above, committed, proving
      `check:corpus` does not currently assert this (no such check exists to
      even fail red — the red state is "the check doesn't exist yet").
- [ ] `npm run validate` green.

Deferred: none.
