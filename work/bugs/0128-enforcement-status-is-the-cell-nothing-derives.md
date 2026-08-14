# Bug 0128: `Status` is the only Enforcement cell nothing validates — 20 rows claim `gated`, and 3 cite a mechanism the resolver can check

## Status

- **State:** Draft — measured against `adr/` and against the rule that gates it;
  every number independently re-derived by three reviewers. No red test yet.
- **Severity:** Medium — no row measured today is false. The defect is that the
  cell a reader trusts most is the only one in the table that is a hand-typed
  claim, so it can become false without any gate moving.
- **Origin:** self-found · same measurement as
  [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md), scoping the
  ts-archunit doctrine port
- **Reported:** 2026-08-12

## Symptom

27 Enforcement rows across the eight ADRs: 20 `gated`, 6 `manual`, 1 `pending`.
`gated` asserts _"mechanism runs in CI, failing blocks"_. What the 20 cite:

| what the mechanism cell names             | rows | who verifies the claim                                      |
| ----------------------------------------- | ---- | ----------------------------------------------------------- |
| `it('…')` — a case the AST resolver reads | 3    | `check:crossval` — resolves the title against the real test |
| a `.test.ts` file, no case named          | 5    | `check:corpus` — the file exists                            |
| a source or config path only              | 12   | `check:corpus` — the file exists                            |

The first row is the **strong** one: those three are the only clauses whose named
mechanism is checked at case granularity. The other 17 are verified at
file-existence granularity — the file is there, and nothing reads what it says.
[0138](./0138-pointer-resolve-proves-existence-not-truth.md) is the same defect
one level finer: `corpus/pointers-resolve` verifies a `path:line` citation to
line-range granularity, still without reading what the line says.

The five test-file-only rows are all ADR-008's, and that ADR **discloses the
limitation in its own preamble** (`adr/008-caller-owns-reporting.md:57`): the
resolver scans only the eess-ts project, so `packages/core` tests are cited in
prose deliberately. That is honest and is not the defect.

The defect is the last column of every row. `adrEnforcement` validates that the
section exists, that the tier is 1–5, and that cited paths resolve. It never reads
the Status value — not its truth, and not even its membership in the fixed
vocabulary. `packages/md/src/rules/adr.ts:41`:

```ts
const RULE_IDS = ['adr/enforcement-declared', 'adr/valid-tiers', 'adr/citations-resolve'] as const
```

Three rules. None is about Status. `columns.status` exists only to **locate** the
column for `haveTable`; no cell value is ever read.

## Reproduction

ADR-005's first row reads:

| Clause             | Tier | Mechanism                                                                        | Status |
| ------------------ | ---- | -------------------------------------------------------------------------------- | ------ |
| No `any` in source | 1    | eslint `@typescript-eslint/no-explicit-any: error` (`eslint.config.ts`); CI lint | gated  |

`eslint.config.ts:28` is the **sole** enforcement of that clause — the eess-ts rule
`eess/adr005-no-type-assertions` covers `as`, not `any`. Set it to `off`:
`eslint.config.ts` still exists, so `check:corpus` passes; lint passes; the row
still reads `gated`; `npm run validate` stays green; and the clause is enforced by
nothing. The same holds for ADR-001's `Node.js >= 24` row — nothing reads
`engines.node` or the CI matrix, only that the two files exist.

Shorter and equally decisive: set any Status cell to `definitely-gated`. Measured —
`✓ corpus integrity — 250 checks across 59 documents, 0 violations`.

## Root cause

`check:corpus` verifies citations at **file-existence granularity**. That is the
right check for a path and the wrong granularity for the claim the row makes —
`gated` is a statement about CI behaviour.

The manifesto is deliberate about the neighbouring case, `docs/manifesto.md:422`:
_"The gate fails on a MISSING declaration — not on low hardness."_ That ruling is
about **Tier** — a soft tier declared honestly must pass, and Tier is validated for
membership even though it too is hand-typed. `Status` is a different kind of cell:
not a self-assessment the author is entitled to make, but an assertion about
whether CI blocks, which is a fact about the repo.

Related, one layer down and already filed:
[0116](./0116-gated-row-resolves-against-a-skipped-test.md) — a `gated` row that
resolved against `it.skip(…)`, so even a case-level citation proved nothing about
whether the test runs — and [0111](./0111-md-adr-citations-resolve-by-prefix.md),
where the resolver matched by prefix. This record is the third: those two are about
the resolver being wrong; this one is about how few rows it reaches at all.

Note there are **two** `it()` resolvers of differing strength, which slightly
sharpens the case: `check:crossval` resolves against the real test AST, while
`adrEnforcement`'s own `testDefinesIt` (`packages/md/src/rules/adr.ts:47`) matches
at text level under `adr/citations-resolve` — its own comment says 0059 upgrades it
to AST.

## Why it matters

The Enforcement table is how this repo tells a reader — increasingly an agent —
which decisions are load-bearing and which are aspiration. `gated` is the strongest
word in the vocabulary and it is the cheapest to type. ts-archunit's ADR-008 Context
table has the row already: _"A hand-typed count in a roadmap — already wrong."_

The asymmetry is the hazard. Tier is validated, citations are validated, and the
diligence of both makes the untouched cell beside them look equally derived.

**Outside this repo it is a lower bound.** The portable kit instructs an adopting
team to write ADRs with a tiered `## Enforcement` table and wires `check:corpus` to
gate them, but `kit/` never states the Status vocabulary anywhere. A kit-adopting
team invents its own words and `adrEnforcement` accepts every one, silently. That
also orders the fixes below: (1) is the one that pays for kit adopters, and it
cannot be written against a vocabulary the kit does not state.

## Fix

Three, in ascending cost; the first is independent of any engine work.

1. **Validate the vocabulary — as an option, not a literal.** A fourth rule,
   `adr/valid-status`, rejecting anything outside the declared set. **Ship the set
   as `statuses?: readonly string[]` with the six-token eess default**, following
   the precedent one line up: `tiers?: readonly number[]`
   (`packages/md/src/rules/adr.ts:36`) exists so a team can bring its own tier set,
   and the preset's own docstring says teams whose ADRs differ compose their own
   gate. Hardcoding this repo's convention into a published preset would make it a
   constraint on every adopter's ADRs.
   - **Which package moves:** `@nielspeter/eess-md` only; the kernel is untouched.
   - **It is a behaviour change.** An adopter whose Status column says
     `enforced`/`todo` passes today and fails on upgrade. For a validation tool
     that is a `breaking`-flagged changelog entry with a migration line, not a
     quiet minor — and `check:release` will require the changeset regardless.
   - The opt-out already works: `validateOverrides(options.overrides, [...RULE_IDS])`
     (`packages/md/src/rules/adr.ts:115`) accepts the new id, so
     `overrides: { 'adr/valid-status': 'off' }` is reachable. Document it in the
     same entry, or the first an adopter learns of it is a red build.
   - **The kit must state the vocabulary in the same PR**, or the rule ships a
     default that adopting teams were never told about.
2. **Print the denominator, and make `gated` earn its granularity.** Report
   `N of M gated rows carry a case-level citation` on success, and either require a
   resolvable citation for `gated` or introduce an honest weaker token for "CI runs
   it, nothing binds the clause to a case". Widening the resolver past eess-ts is
   the enabling work, named in ADR-008's preamble and parked in plan 0070's Out of
   scope. **Its real cost is not runtime** (~5–10s) but the **uniqueness domain**:
   CLAUDE.md requires a cited `it('…')` title to be unique across the suite, and
   widening the resolver widens "the suite" from one package to six. The three
   currently-cited titles survive — all unique, all in `packages/ts` — but the
   ambient duplicate population across `packages/*/tests` is large, so every future
   citation acquires a repo-wide uniqueness obligation.
3. **Bind the config-shaped rows to their content** — the 12 rows nothing reaches
   today. **This cannot live in `packages/md`.** Reading an eslint rule's severity
   out of `eslint.config.ts` is AST work (ADR-002/ADR-007, `eess-ts`'s territory),
   and `eess/md-isolated` forbids `packages/md` importing `packages/ts`. The home is
   `packages/crossvalidate` — an ADR row bound to a TypeScript fact is exactly the
   two-dialect correspondence that package exists for. A row citing `engines` is the
   easy case (JSON, readable anywhere). Per-row work, worth it only where the clause
   is expensive to lose.

## Verification

- [ ] Red test written first: an ADR row with an invalid Status token fails
      `check:corpus`. Passes silently today — measured with `definitely-gated`.
- [ ] **The new rule gets its own non-vacuity fixture**: a bad ADR under
      `scripts/nonvacuity/bad-adr/` carrying an invalid Status token, and a gate row
      asserting `adr/valid-status` fired. Without it, `adr/valid-status` ships as the
      next rule nothing can prove — this record's sibling
      ([0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)) is exactly
      that population, and a record about unverified claims must not add one.
- [ ] The vocabulary is an option with an eess default, and `kit/` states it.
- [ ] A changeset naming `@nielspeter/eess-md`, `breaking`-flagged, with the
      migration line and the `overrides` opt-out.
- [ ] `npm run validate` green.

Deferred, each re-homed:

- **Case-level granularity for `gated`** (fix 2) — needs the resolver widened past
  eess-ts, which is plan 0070's Out of scope and not this record's to reopen.
- **The 12 config-shaped rows** (fix 3) — `packages/crossvalidate`, per-row, its own
  record when a clause justifies it.
