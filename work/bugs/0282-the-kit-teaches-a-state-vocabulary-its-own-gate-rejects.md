# Bug 0282: the kit teaches a state vocabulary its own close ritual then violates

## Status

- **State:** Draft — measured inside `kit/` alone; no red test yet.
- **Severity:** Medium — a false RED on a correctly-closed record, hit by an
  adopter on the first proposal they close, with a message that sends them to
  edit the record rather than the call. Not a fail-open.
- **Origin:** **external** — surfaced while checking a consuming project's report
  that `honestyAtClose`'s defaults rejected their lane vocabulary. Their specific
  claim is **not** what this record files; see "What the report got wrong".
- **Reported:** 2026-09-12

## Symptom

`kit/` teaches one `State:` vocabulary for every lane, and ships a close ritual
that writes a token outside it. An adopter who follows both, and wires
`check:ledger` the way the kit's README tells them to, gets
`ledger/unknown-state` on a record they closed correctly.

Two kit artifacts, in direct contradiction:

- `kit/templates/work/README.md:38` — "**State token** — every item's header
  carries `**State:**` with a leading `Draft` / `Ready` / `Open` / `Done` /
  `Won't-do`". _Every item._ No lane is excepted.
- `kit/skills/close/SKILL.md:64` — "**The proposals lane closes differently.** A
  proposal is not 'done', it is _dispatched_: `Promoted` … or `Rejected`."

`Promoted` is not in the vocabulary the kit's own README declares. The default
behind `honestyAtClose` is that same README vocabulary
(`packages/md/src/rules/ledger.ts:86`), so the token the kit instructs you to
write is the token its own gate reports.

## Reproduction

No code needed — the two files above are the reproduction. Mechanically:

1. Seed a corpus from `kit/templates/work/`.
2. Add a proposals lane and close a proposal per `kit/skills/close/SKILL.md:64`
   (`**State:** Promoted`).
3. Run `honestyAtClose(corpus)` with no `states` — the kit documents no other
   calling convention, and ships no reference `check-ledger.mjs` to copy (which
   is [bug 0151](./0151-honesty-at-close-options-undiscoverable-past-source.md)).
4. `ledger/unknown-state` on a record the kit told you to write.

## Root cause

The kit grew a third lane in its skills without its templates' vocabulary
following. `work/README.md`'s state-token bullet was written when the method had
plans and bugs and one shared enum; `close/SKILL.md` later gained the proposals
paragraph with `Promoted`/`Rejected`, and nothing binds the two.

The same split shows in the preset's own JSDoc, which describes the default as
"the plan lane's enum" and says "a bug-shaped lane passes its own"
(`packages/md/src/rules/ledger.ts:56`). That is a **third** account: the kit says
one vocabulary for every lane, the JSDoc says the default is one lane's of
several, and the close skill writes a token neither list contains.

This repo does not hit it because `scripts/check-ledger.mjs:67` carries a per-lane
`LANES` table and passes each lane its own vocabulary — the shape neither the kit
nor the docs teach. So the dogfood is green precisely where the adopter is red,
which is the signal [bug 0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md)
says this family has no channel for.

## What the report got wrong (recorded, not filed)

The consuming project reported two gaps. Verified against the published packages,
**neither is what this record files**:

1. **"`findState` is not exported."** Does not reproduce.
   `@nielspeter/eess-md@0.6.1` exports `findState` from `rules/ledger` alongside
   `honestyAtClose` and `ledgerStats`. They measured against `0.5.0`; it was added
   since. True when written, stale now.
2. **"the default `states`/`terminalStates` are wrong."** Not a defect as
   reported. The options exist, are published in the `.d.ts`, and the behaviour is
   documented deliberately at `docs/markdown.md:454` — an unreadable state is
   **reported rather than skipped**, on purpose, because a record whose status
   nobody can parse is indistinguishable from one that has none
   ([bug 0120](./0120-no-state-and-cannot-find-it-are-the-same-answer.md)).
   Passing your own vocabulary is the designed answer, not a workaround.

What survives verification is neither claim: it is that **the kit contradicts
itself**, so an adopter following it exactly cannot pass. That is filed here. The
adjacent misdirection in the message itself is [bug 0283](./0283-unknown-state-names-the-vocabulary-not-the-option.md).

## The corruption that must produce a violation

A kit whose taught vocabulary omits a token its own close ritual writes must not
be able to ship green. Candidate mechanisms, cheapest first:

1. **Make the kit's README declare per-lane vocabularies** and name the
   `states`/`terminalStates` calling convention — a docs fix, gated by nothing.
2. **Ship the reference `kit/scripts/check-ledger.mjs`** with a `LANES` table, the
   way `next-number.mjs` is already shipped as a template (0151's fix names this
   too). Then the taught vocabulary and the enforced one are the same artifact and
   cannot drift apart.
3. **Bind them:** a corpus rule over `kit/` asserting every state token any kit
   skill instructs an author to write appears in the vocabulary `kit/`'s README
   declares. That is `correspondence()`'s shape, and it is the only option of the
   three that stays true after the next lane is added.

(3) is the honest one — this defect is a drift between two documents, which is
what this family exists to catch, and (1) and (2) both fix today's instance while
leaving the next one silent.

## Verification ledger

- [x] Both kit artifacts read; the contradiction is between
      `kit/templates/work/README.md:38` and `kit/skills/close/SKILL.md:64`.
- [x] Default confirmed in the published package, not just in source.
- [x] Confirmed this repo passes a per-lane vocabulary rather than the default.
- [x] Both reported gaps checked against the published packages; recorded above
      rather than filed.
- [x] Checked whether eess's own corpus already violates this: two records carry
      `**State:** Done` in a bug lane whose vocabulary excludes it
      (`work/bugs/0120-no-state-and-cannot-find-it-are-the-same-answer.md:40`, `work/bugs/fixed/0119-placement-check-never-ran.md:34`) — **both inside
      fenced code blocks as illustrations**, so the gate is correctly green. Not a
      fail-open; recorded because it looked like one.
- [ ] Red first: a fixture corpus seeded from `kit/templates/` with a `Promoted`
      proposal, asserting the finding — then asserting it is gone.
- [ ] The mechanism chosen (docs, shipped script, or the binding rule).

Deferred: none.
