# Bug 0351: an ADR citation in a source comment is gated by nothing, and one derived corollary has hardened into a quotation

## Status

- **State:** Draft — measured, with a live instance that propagated outside the
  repository.
- **Severity:** Medium — **no false green in the product.** What is wrong is that
  eess's own binding decisions are cited 349 times in code that no gate reads, so a
  citation can drift, be inferred, or be wrong by an ADR number and nothing says
  so. This repo gates citations in ADRs (`check:corpus`) and test citations
  (`check:crossval`); an ADR reference in a source comment falls between them by
  construction.
- **Origin:** an architecture reviewer quoted `ADR-009 Rule 4's "identities, never
a bare total"` at this session, 2026-09-28. The clause does not exist in `adr/`.
  The reviewer had not invented it — they read it in
  `packages/ts/src/helpers/baseline.ts`, which is where this record starts.
- **Reported:** 2026-09-28

## Symptom

Measured over `packages/*/src`:

|                                      |                               |
| ------------------------------------ | ----------------------------- |
| ADR references in source comments    | **349**, across **115 files** |
| of those, naming a specific `Rule N` | **82**                        |
| gated by anything                    | **0**                         |

Two sub-classes, and they are different defects.

### 1. A derived corollary hardened into a quotation (11 sites)

`ADR-009 rule 4` is cited 11 times. Rule 4 is **"No snapshot assertions in
agent-consumed tests."** The citations split:

- **Derivation, and sound** — e.g. `packages/ts/src/core/diagnose.ts`: _"A count is
  a snapshot, and under ADR-009 rule 4 a snapshot is the…"_. That reasons _from_
  the rule.
- **Quotation, and not** — `packages/ts/src/helpers/baseline.ts`: `// Identities,
never a bare total (ADR-009 rule 4).`; `packages/core/src/comment-suppression.ts`:
  `## Identities, not a total (ADR-009 rule 4)`;
  `packages/ts/src/helpers/baseline-diagnostics.ts`: `Identities, never a total
(ADR-009 rule 4)`. These read as the rule's own words. They are not.

So this is not eleven typos. It is **one inference compressed into a slogan and
then repeated until it was indistinguishable from the text it was derived from.**
The inference is defensible; the compression is what makes it a citation to
something that cannot be checked.

**It escaped the repository.** A reviewer read it, quoted it back as the ADR's
words, and this session nearly propagated it into a plan. It was caught only
because the session had spent the day being corrected for exactly this.

### 2. A wrong ADR number — the ts-archunit numbering leak

`packages/ts/src/builders/correspondence-builder.ts` cites **"ADR-008 Rule 5"**.
ADR-008 has **zero** numbered rules (`grep -c "^### Rule" adr/008-…` → 0). The
content described — _"two derivations plus a disagreement test"_ — is **ADR-009
Rule 5**.

This is the imported-numbering drift `.claude/skills/review/SKILL.md` already
records: _"'ADR-008/009' is ts-archunit's numbering, imported with the port; in
this repo ADR-008 is caller owns reporting"_ — and it names three persona files and
one gate message carrying the same off-by-one, calling it "its own small cleanup".
That cleanup has not happened, and this is a fourth site in shipped source.

## Root cause

`check:corpus` resolves links and `path:line` pointers in `work/`, `adr/` and
`docs/`. `check:crossval` resolves `it('…')` citations against the test AST. Both
read **documents**. An ADR reference inside a TypeScript comment is read by
neither, so the one place the decisions are cited most often is the one place
nothing checks.

The ADR-009-rule-4 class needs more than a resolver, though: every one of those 11
citations names a _real_ rule. What is wrong is the words attributed to it, and no
mechanism distinguishes "derived from Rule 4" from "quoted from Rule 4".

## Fix

Not decided, but the shape is clear and **the derive/quote split is the gate's
design, not merely its sizing** — conflating the two makes the check either
toothless or unbuildable.

**Two checks, both Tier 1:**

| reference                                                          | what must hold                                   | catches                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **deriving** — "under rule 4 a snapshot is barred"                 | the number **resolves**: ADR-009 has a Rule 4    | the `ADR-008 Rule 5` class outright, since ADR-008 has no numbered rules at all                         |
| **quoting** — backticked or quote-marked text attributed to a rule | that text **occurs in the cited rule's section** | "Identities, never a bare total" — and **only** this check would, because its number resolved perfectly |

The harness exists. This is the raw-source-text discipline `check:crossval` already
applies to `it('…')` titles, pointed at a different corpus. The 82 `Rule N`
references give the first check a real denominator on day one; the quoting subset
is smaller, and it is where the slogans live.

### Why the quoting check is the one that matters

**A slogan that compresses a sound inference is harder to catch than a typo,
precisely because it reads _better_ than the source.** It is the sentence someone
wished the ADR had said. "Identities, never a bare total" is tighter, more
quotable and more memorable than "No snapshot assertions in agent-consumed tests",
which is exactly why it spread to eleven sites and then out of the repository.

**A gate that only resolves numbers would ratify every one of them.** That is the
trap this record exists to name: the cheap check is the one that makes the
expensive problem look solved.

### Either way

Fix the live instances: the slogans, and the `ADR-008 Rule 5`, which is wrong on
its face.

## Related

- [0347](./0347-the-always-loaded-index-does-not-reach-the-doctrine-digest.md) — the
  same family from the other end: there the doctrine is unreachable from where
  agents read, here it is quoted where nothing checks.
- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — a binding
  ruling that exists and cannot be found.

## Verification

- [x] measured: 349 references / 115 files / 82 naming a Rule, the 11 rule-4 sites
      read individually, and `ADR-008` having no numbered rules.
- [x] the escape confirmed: a reviewer quoted the slogan as the ADR's words.
- [ ] a ruling on the two-check design above — in particular whether the quoting
      check can distinguish an attributed quotation from ordinary prose reliably
      enough to gate
- [ ] the resolver, failing on a seeded bad citation
- [ ] the live instances corrected
- [ ] `npm run validate` green.

Deferred: none.
