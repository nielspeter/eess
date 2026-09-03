# Plan 0235: the emitter takes a receipt, not an array

## Status

- **State:** Draft — **the freeze was refused on 2026-09-03.** Six review lenses
  reached "do not build as written" independently. _Decisions, taken_ below now
  answers what that review opened. ADR-014 was amended the same day with every
  change Phase 0 owed it; what stands between this and `/plan-ready` is the
  freeze itself. [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)
  (Accepted 2026-09-03) is not in question; this document was the sketch of its
  build and it under-scoped the work.
- **Priority:** High — the ROADMAP's own definition: closes a gap between what
  eess claims and what it checks. ADR-010 says an evidence-free pass is
  unrepresentable; at the emitter it is one line, measured in the field as
  three inert gates in a week, written by an agent told to use eess properly.
- **Effort:** **High** — raised from Medium by the review, and the raise is not
  the point. The estimate rested on an accessor that does not exist and on a
  census that counted the wrong population. Migration size is a cost to pay, not
  a reason to shrink the contract.
- **Created:** 2026-09-03 · **Reviewed:** 2026-09-03
- **Builds:** ADR-014. Proposal 009's Ask A, **reshaped**; its disposition row
  names this plan. No `**Implements:**` line, deliberately: 009's ruling is
  `Split and sequence`, which `ACCEPTED_RULINGS` does not admit, so no plan is
  owed against it and a declaration would claim it builds the whole proposal.
- **Claims to close** [bug 0190](../bugs/0190-the-preset-constructs-nothing-finding-cannot-fire.md)
  and [bug 0206](../bugs/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md).
  Both close only if D4's declaration reaches the emitter, which is why it is
  decided rather than deferred.

## Problem

`finishPreset(violations: ArchViolation[])` and
`reportViolations(violations: ArchViolation[])` take a bare array.
`reportViolations`'s second line is `if (violations.length === 0) return`. A
consumer who imports eess's types, eess's printer and eess's corpus loader — and
no `RuleBuilder` — can hand either emitter an empty array from a loop that
examined nothing, and eess prints green.

ADR-014 records the decision: **evidence is required at every seam where a
verdict leaves eess.** The emitters take the evidence shape every terminal
already produces — `CollectResult`'s `{ violations, examined }`
(`packages/core/src/terminal-builder.ts:39`) — and a value with no evidence, or
evidence of zero without a declaration, is a configuration finding. The device
is a **required field, not a registry**: the measured failure was an honest
mistake, not forgery, and against that target _unomittable_ is the whole
requirement. It also keeps ADR-010 §2's cap on kernel registries untouched.

This plan is the work. It is deliberately not the guardrail preset rule
(proposal 009's Ask C) — that is an opt-in lint an adopter may never enable, and
it ships separately. This is the contract.

## Review outcome (2026-09-03 — architect · product · enforcement · customer · devops · testing)

**Verdict: do not build as written.** All six lenses independently, and every
finding below was re-verified against source by the coordinator before landing
here. The decision is sound and the phase order is right. What failed is the
measurement: two load-bearing claims are false, and the census counted call
sites when the break is on the return type.

### How to sort these findings

**Loud red is fine. Silent green is the disease.** eess exists so that a green
build means something was examined. An adopter who upgrades into a compile error
is the system working, and needs no accommodation from this plan. What this plan
must not do — what would make it worse than not shipping — is leave any path on
which eess, or an agent driving eess, reports green over nothing examined.

So the findings below are ranked by one question: **does it let something lie
green?** Findings about migration cost are recorded because the work is real, but
they never outrank a lie, and they are never a reason to soften the contract.
Two consequences that resolve arguments this plan was having with itself:

- **A required field stays required.** Where the review found that making it
  required breaks adopters' hand-rolled rule files, that is the correct outcome.
  Optional is the omittable field ADR-014 §2 rejects, and an optional evidence
  field is a permanent licence to lie.
- **A false positive is not the mirror of a false green, but it is not free
  either.** It matters here only through ADR-009 rule 1: a finding an adopter
  cannot legitimately answer trains them to disable the gate, and a disabled gate
  is a green that means nothing. That, not the annoyance, is why D4 and D5 are
  decided rather than dropped.

**The worst of it, and the reason this is not a paperwork revision.** Migrating
exactly as Phase 3 instructed would make this repo's own ADR gate permanently,
silently green. `scripts/check-corpus.mjs:149-150` binds
`adrEnforcement(c, { dir: 'adr/**', report: 'return' })` and then reads
`.length` on it. Once that value is a receipt the read is `undefined`,
`undefined > 0` is `false`, and `adrError` is false forever — so `:790` prints
"tables + citations resolve" unconditionally and `:853` drops the ADR half of
its own verdict. It is untyped `.mjs`, so no compiler sees it, and no gate sees
it either: `corpus/adr`'s non-vacuity row drives the rebuilt `bad-adr.mjs`
fixture, never the production script. A plan whose purpose is to abolish false
greens would have created one in the gate that guards the ADRs, this one
included.

**The structural cause is one sentence: the break is on the return type, and
only call sites were censused.** Every consumer of a preset's return value is a
migration site too. None was counted. See _What was not measured_ below.

### Pile one — findings that let something lie green

These block. Each is a path on which a build reports success over nothing
examined, or a mechanism that claims coverage it does not have.

1. **The migration would make this repo's ADR gate silently green** (testing).
   The fail-open above. Nothing reddens: it is untyped `.mjs`, and `corpus/adr`'s
   non-vacuity row drives a rebuilt fixture, never the production script. → **Phase 4**
2. **`reportViolations` returns `void`, so its finding cannot fail anything**
   (five lenses). Every hand-assembling caller exits on its own array, so the
   finding prints above a green tick. Compounding it, three of them reach an
   emitter only inside the `--format json|github` branch, so on the path CI runs
   they never call one at all — the contract would be satisfied and inert. → **D2**
3. **Phase 4's dogfood rule selects nothing and would be marked `gated`**
   (enforcement, devops). `arch.internal.rules.ts:49-54` loads six
   `tsconfig.build.json` files, each with `"include": ["src"]` and no `allowJs`;
   there is no root `tsconfig.json`; `lint` covers `packages/*/src` and
   `packages/*/tests` only; `typecheck` is per-workspace and `scripts/` is not
   one. A rule over `scripts/**` matches zero modules and passes, while ADR-014's
   row moves from `pending` to `gated`. **A false green inside the enforcement
   table of the ADR about false greens.** → **D3**
4. **Nothing proves any migrated number means anything** (testing). ADR-014 §2
   delegates that guard in its own words: "only a fixture that breaks the loop
   and expects red proves the count means anything." Phase 1 shipped one fixture,
   against the kernel emitter, not against any site's number, and the ledger said
   `Deferred: none`. Without it, every `examined` in the repo is an unverified
   claim and the plan has built a type, not a check. → **the success criteria**
5. **The finding may be unfireable again** (enforcement). A declared-empty or
   cardinality-exempt rule hands up an empty list with zero examined
   (`packages/core/src/terminal-builder.ts:258-277`), byte-identical to a vacuous
   one. Choose "don't fire" and `presetConstructsNothingViolation` is
   unreachable exactly as bug 0190 found it, one seam further along, while this
   plan claims 0190 closes. A finding that cannot fire is coverage that is not
   there. → **D4**
6. **Phase 1's own assertions cannot be written**, so its fixtures could pass
   vacuously. `presetConstructsNothingViolation` carries **no `ruleId`**
   (`packages/core/src/preset-dispatch.ts:119-127`), so "assert the rule id" has
   nothing to key on and `gateNode`'s `mustSay` has no stable string — resolved
   in Phase 0 by keying on the finding that has one. The new
   non-vacuity row cannot be registered either: `gateCoverage()` fails closed on
   any row no `check:*` claims (`scripts/check-nonvacuity.mjs:1719`). And the
   bare-array test needs an ADR-005-legal JS-interop boundary the plan never
   declares.
7. **Deleting `throwIfViolations` disarms a live probe, silently** (three
   lenses). `scripts/check-nonvacuity.mjs:629` injects it as the violating
   payload for the family re-export probe, and that fixture's own comment records
   the identical accident when ADR-011 moved its predecessor: it "turned this
   fixture's violating input into a legal one and the probe green-for-nothing".
   The rule reads import specifiers, not the kernel's export set, so the probe
   would likely keep firing on a symbol that no longer exists — green for
   nothing, loudly confident.
8. **A JavaScript adopter's gate goes silently green** (customer). On the output
   side there is no guard at all: `if (violations.length > 0)` becomes
   `undefined > 0`, false forever. This is not the acceptable kind of breakage.
   A JavaScript adopter should break **loudly** or not at all. → **D2**
9. **A summed receipt is blind to one dead check** (round two: enforcement,
   testing, devops, independently). `scripts/check-corpus.mjs:749-763` folds
   nine hand-assembled checks and three builder-backed rules into one emitter
   call; `check-ledger.mjs:154-159` folds three. One dead loop among nine leaves
   the sum positive and the exit zero. That is the measured field failure —
   three gates going inert one at a time — and the emitter as first drafted
   would see it only once all were dead. The plan's top experiment was
   unwritable at that granularity. → **D7**
10. **`report: 'warn'` prints the finding and exits zero** (round two:
    enforcement). `packages/core/src/report.ts:81-87` never throws under
    `warn`, while the terminal precedent escalates an unsuppressable finding to
    a throw even under warn (`packages/core/src/execute-rule.ts:255-257`) and
    the finding's own text promises "not by .warn()"
    (`packages/core/src/unsuppressable.ts:34`). → **D2b**
11. **The flagship CLI and the test-file terminal accept a hand-rolled builder
    with no evidence and stay green** (round two: customer, architect). Rule
    files are loaded natively or through jiti with no type-check
    (`packages/ts/src/cli/import-rule-module.ts:33-45`); the loader admits any
    object with a `violations` function (`packages/ts/src/cli/load-rules.ts:111-117`);
    the CLI reads only the length of what comes back
    (`packages/ts/src/cli/commands/check.ts:186`) and its no-rules finding fires
    only on an empty export (`:176-178`). So `export default [{ violations: () => [] }]`
    in a rule file passes `eess-ts check` green, and `checkAll` over the same
    (`packages/ts/src/core/check-all.ts:33`) passes green in a test. D1's "stops
    compiling" is false for the one place adopters actually put builders. → **D7**

### Pile two — findings about cost, correctness of remedy, and shape

Real, and none of them outranks pile one. Recorded so the build does not
rediscover them.

12. **`examinedUnits()` does not exist outside `packages/ts`** (four lenses). The
    kernel keeps `collectViolations()` protected abstract
    (`packages/core/src/terminal-builder.ts:344`) and `evidencedViolations()`
    private (`:258`); the public `violations()` (`:194`) discards the count.
    `RuleBuilderLike` declares one member
    (`packages/core/src/rule-builder-like.ts:9`). eess-md's builders are kernel
    builders and are exactly what `dispatchRule` receives. This is work, not a
    lie — the seam has to be built. → **D1**
13. **An all-off preset becomes an unsuppressable red** (architect, product).
    `packages/core/src/preset-dispatch.ts:49` and
    `packages/ts/src/presets/shared.ts:59` return `[]` for `'off'`, and the ruling
    at `shared.ts:283-292` calls that "a permanent, legitimate decision, not a
    suppression. Silent." It stays on the list only because a finding an adopter
    cannot legitimately answer trains them to switch the gate off, and an
    switched-off gate is a meaningless green. → **D5**
14. **The remedy is addressed to the wrong audience** (architect). The "two
    findings, two owners" split gives preset-remedy ownership to `deliver()`,
    which exists only in eess-ts. `eess-md` and `eess-crossvalidate` call
    `finishPreset` directly (`packages/md/src/rules/adr.ts:156`,
    `packages/md/src/rules/ledger.ts:580`), so a preset user would be told to fix
    a selection they do not hold. ADR-009 rule 2's prohibition, and the message is
    what an agent acts on. → **D6**
15. **The return-consumer census was never taken** (testing) — the population
    that produces finding 1 and finding 8. → **Phase 4**
16. **The CLI verdict seam never calls an emitter** (product, round two).
    `packages/ts/src/cli/commands/check.ts:186` and `:304` aggregate
    `builder.violations()` and exit on the result. Not a lie — each `violations()`
    is terminal-gated, so a vacuous rule arrives as a finding — but the
    denominator is dropped, which is bug 0174's open half. Noted under D1.

**Corrections to this plan's own measurement**, recorded rather than edited away
so the next reader knows the table was wrong once:

| the plan said                                            | the source says                                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| the builder "has `examinedUnits()` in every family"      | only `packages/ts`; four packages have none                                                                    |
| `executeCheck` / `executeWarn` thread `examined` through | `executeWarn` calls no emitter; it writes through `writeStderr` directly. Only kernel `executeCheck` qualifies |
| both `eess-md` presets sum `dispatchRule` receipts       | `ledger.ts:580` never calls `dispatchRule`; its number had no stated source                                    |
| five gate scripts, one emitter call each                 | seven emitter calls: `check-baseline.mjs:69` and `:75`, `check-guardrails.mjs:68` and `:99`, three others once |
| "Every site is one line"                                 | `check-guardrails.mjs` reads its result at `:69`, `:73`, `:96`, `:97`, `:99`; `check-baseline.mjs` at three    |
| ADR-008 gains an amendment section (Phase 4)             | already landed in commit `371eba1` with the acceptance                                                         |

Stale pointers, all of which `check:corpus` passes because it resolves that a
line exists, not that it says what was claimed: `adr.ts:148` is
`packages/md/src/rules/adr.ts:156`; the `callerAggregates` bypass is
`packages/ts/src/presets/shared.ts:445-448`, not 441-444; `shared.ts:427` is
`deliver()`'s flatMap, its declaration is `:419`.

**One correction was owed outside this plan, and is made.** ADR-014's
Enforcement row claimed `check:family` "sees the removal" of `throwIfViolations`.
That gate ships one rule, about re-export **completeness**; a removed symbol
simply stops being owed, and `tsc` is what catches the dangling re-export. The
row now says so.

## Decisions, taken

The sorting principle decides most of what an earlier draft of this section left
open. Deferring an answerable question is the same hedge as ranking by cost, so
these are answers, not options. Each is overturnable by the maintainer; none is
overturnable by the build discovering it is inconvenient.

**D1 — the kernel exposes its evidence by making `violations()` return the
receipt.** Not an accessor beside it. An accessor can be walked around: a caller
keeps calling `violations()`, never asks for the count, and the evidence is
optional again by another route. `violations()` is documented adopter API
(`docs/api-reference.md:47`) and this is the largest break in the change, which
is the point — it is the only shape with no bypass. It also removes the
double-run objection, since `evidencedViolations()`
(`packages/core/src/terminal-builder.ts:258`) already computes violations and
evidence in one pass, and it makes `RuleBuilderLike`'s single member
(`packages/core/src/rule-builder-like.ts:9`) carry the evidence without adding a
second member anyone could omit. (`packages/mermaid/src/cli/load-rules.ts:5`
declares a `RuleBuilderLike` of its own, but with `check` and `describeRule`,
not `violations` — nothing there moves.) An adopter's hand-rolled rule file stops
compiling, and that is correct: a rule file that cannot say what it examined is
the shape ADR-014 exists to stop, and a compile error is the right way to learn
it. **This is a kernel public-API change and belongs in ADR-014.**

One consumer still drops the number, and the sentence "no bypass" is too strong
by exactly this much: the `eess-ts` CLI aggregates `builder.violations()` and
sets its exit code without any emitter (`packages/ts/src/cli/commands/check.ts:186`,
`:304`). The verdict there stays honest, because every `violations()` was
evidence-gated at the terminal before the CLI saw it, so a vacuous rule arrives
as a finding and reds. What is lost is the denominator — which is the open half
of [bug 0174](../bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md),
already filed, and not this plan's to close.

**D2 — `reportViolations` returns the receipt, and the three default paths route
through the emitter.** A finding that cannot change an exit code is a printed
apology. Every migrated caller exits on the returned receipt, never on the array
it passed in. The three scripts that reach an emitter only under `--format json`
(`check-corpus.mjs:764`, `check-ledger.mjs:166`, `check-release.mjs:377`) get
their default paths routed through it, because a contract that binds only the
machine-readable path is a contract that does not bind CI. This is a fourth
ADR-008 statement superseded and ADR-014 must say so.

**Sub-decision, because it is the difference between loud and silent.** The
receipt must not let a JavaScript consumer read `.length` as `undefined` and exit
zero. An array carrying `examined` as a property keeps `.length` and iteration
working and correct, where a plain object turns every untyped consumer green.
"`CollectResult`'s shape by name" is a tidiness argument and it loses to this.

**D2b — every door that does not hand the finding back throws on it.** Under
`report: 'return'` the finding is in the receipt and the caller owns it. Under
`warn`, and under a bare `reportViolations`, nothing is handed back that a
caller must act on, so a printed unsuppressable finding above a zero exit is the
lie by another name. The emitter escalates a `bypassFilters` finding to a throw
in those modes, exactly as `executeWarn` already does at
`packages/core/src/execute-rule.ts:255-257`, and as the finding's own text
promises. This amends ADR-008's "never throws" to "never throws on violations;
throws on a configuration finding it produced itself", and ADR-014 §5 and §6,
which currently codify the printed line.

**D3 — no row goes `gated` over a scope that selects nothing.** The dogfood rule
is redundant over `packages/*/src`, where the compiler already enforces the
field, and unreachable over `scripts/**`, which sits in no TypeScript project
(`arch.internal.rules.ts:49-54`, each `tsconfig.build.json` including only
`src`). So the mechanism for that clause is the break-the-loop fixture the
success criteria require,
which actually discriminates, and the rule row is written for the scope it truly
covers or not written at all. Putting `scripts/` into a TypeScript project is
allowed but is not what makes the clause enforced.

**D4 — it fires, and the declaration reaches the emitter so it does not have to
guess.** "Don't fire" makes `presetConstructsNothingViolation` unreachable
exactly as bug 0190 found it, one seam further along, while this plan claims
0190 closes. That is the lie. So the receipt carries the declaration beside
`sourceEmpty` — the terminal already knows, at
`packages/core/src/terminal-builder.ts:258-277`, and currently discards it. With
the fact on the receipt the emitter distinguishes "examined nothing and said so"
from "examined nothing", and neither lies nor false-positives. This is the same
move ADR-013 made: give the seam the fact, not the machinery to infer it. The
field is `declaredEmpty?: true` on the receipt, and it carries ADR-010 §3's
expiry with it: a receipt declared empty that arrives with `examined > 0` is
the expired-declaration finding, the emitter's mirror of what the terminal
already produces for its own rules at `packages/core/src/terminal-builder.ts:275`.
`assertsCardinality()` (`:265`) sets the same flag: a `.notExist()` over zero
subjects is a declaration by construction, and without the flag every such rule
inside a preset would be a false red at the emitter.

**D5 — an all-off preset is a declaration, not a carve-out.** `deliver()` knows
every rule was explicitly disabled (`packages/ts/src/presets/shared.ts:59`,
ruling at `:283-292`) and marks the receipt declared-empty for the same reason a
rule does. And the kernel's `dispatchRule` does the same in its own `'off'`
branch (`packages/core/src/preset-dispatch.ts:49`): it returns a declared-empty
receipt rather than `[]`, so a fully disabled `eess-md` preset, which never
passes through `deliver()`, sums to declared-empty too. Without that line D5
would hold for one dialect and lie for the rest.

And `deliver()` cannot infer the fact: it takes `(builders, options)`
(`packages/ts/src/presets/shared.ts:419-422`) and the all-off fact lives in each
preset's `attempted` list. "Empty builders means declared" is sound today only
because all five presets guard with `assertDiscovered` or `assertEnabled` first,
an invariant held by callers that a sixth preset would break silently. So the
fact is **passed** to `deliver()` — ADR-013's shape — and the five call sites
join the census. `deliver()` is not exported, so its half of D5 reaches exactly
this repo's five presets; the `dispatchRule` half is what reaches every dialect
and every adopter's preset. No exemption list, no new option, and the adopter keeps the legitimate
answer they have today. A finding whose only escape is switching the gate off
ends in a gate nobody runs, which is a green that certifies nothing.

**D6 — the message names the cause the receipt carries.** The receipt
distinguishes no evidence at all, empty source, declared empty, and zero
examined. Each gets its own remedy, and the kernel's generic one must be
answerable by any hand-assembler, because `eess-md` and `eess-crossvalidate`
reach `finishPreset` with no `deliver()` in between
(`packages/md/src/rules/adr.ts:156`, `packages/md/src/rules/ledger.ts:580`).
`deliver()` adds the preset-specific remedy where it applies. ADR-009 rule 2, and
the message is what an agent acts on.

**D7 — one receipt per assertion, and the merge is fail-closed.** ADR-010 §1
counts evidence at the examining seam, and a script that runs nine checks has
nine seams. A single receipt whose `examined` is their sum is honest about the
whole and blind to any one member — the measured failure shape. So every
hand-assembled check produces its own receipt, and the kernel's one merge
(Phase 2) is where bundling happens: a member with zero examined and no
declaration contributes the configuration finding to the merged result; the
merged receipt is declared-empty only if every zero-contributing member was;
`sourceEmpty` if any member is. A member that is a bare array — no integer
`examined` at all — contributes the no-evidence finding, and a merge over zero
members is zero examined, undeclared. **`checkAll` and the CLI aggregate through
this merge**, which is what closes pile-one finding 11: a rule file that exports
`{ violations: () => [] }` reaches the merge as a bare member and reds, and a
rule file that exports nothing reds as it does today. Bundling can then never
hide a dead member, in this repo's scripts or in an adopter's. The residual that
survives this is stated below: an adopter who sums by hand instead of calling
the merge.

**The census and the fixtures were never decisions.** The return-consumer census
is Phase 4 and the break-the-loop fixtures are the success criteria. An earlier
draft listed both as open questions, which is how work gets deferred by being
phrased as a choice.

**The naming collision dissolves.** With the declaration on the receipt (D4), `PresetReportOptions`
gains nothing, so there is no collision with eess-ts's
`expectEmpty?: readonly TRuleId[]` (`packages/ts/src/presets/shared.ts:383`).

## What exists, measured (corrected)

**The kernel's finding is dead and the dialect's is alive.**
`presetConstructsNothingViolation` (`packages/core/src/preset-dispatch.ts:111`)
has no call site and no `ruleId` — bug 0190's whole subject. `assertEnabled`
(`packages/ts/src/presets/shared.ts:299`) is the finding that actually fires for
a preset that constructed nothing, with an id, and it is wired into two presets
of five. Phase 0 decides between them.

| site                                                                                                    | what it holds at the emitter                                                           | the receipt it can hand over                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| kernel `executeCheck` (`packages/core/src/execute-rule.ts:217`)                                         | the filtered array of an already-gated terminal                                        | the terminal's own `examined`, threaded one call further                   |
| kernel `finishPreset` → `reportViolations` (`packages/core/src/report.ts:83`)                           | whatever the caller passed                                                             | the same receipt, forwarded                                                |
| kernel `dispatchRule` (`packages/core/src/preset-dispatch.ts:37`)                                       | `builder.rule(meta).violations()`, from a builder with **no public evidence accessor** | blocked on D1                                                              |
| kernel `throwIfViolations` (`packages/core/src/preset-dispatch.ts:137`)                                 | a bare array forwarded to `finishPreset`                                               | nothing: removed, see the deletion list below                              |
| `eess-ts` `deliver()` (`packages/ts/src/presets/shared.ts:419`)                                         | `RuleBuilderLike[]`, an interface with one member                                      | blocked on D1                                                              |
| the four synthetic builders in `shared.ts` (`:127`, `:199`, `:265`, `:321`)                             | a `RuleBuilderLike` with no evidence                                                   | `1` each — they examined the preset's own configuration                    |
| six `eess-crossvalidate` presets (`md-gherkin.ts:144`, `gherkin-ts.ts:166`, `:244`, `:312`, and two)    | a hand-assembled array over what it iterated                                           | the count it iterated; each already exports a stats function               |
| `eess-md` `adrEnforcement` (`packages/md/src/rules/adr.ts:156`)                                         | an array from three `dispatchRule` calls                                               | the sum of those receipts, blocked on D1                                   |
| `eess-md` `honestyAtClose` (`packages/md/src/rules/ledger.ts:580`)                                      | an array from three direct `.violations()` calls, one conditionally `.expectEmpty()`   | under D1 those calls return receipts; it merges them, declaration included |
| two scripts wrapping a preset (`check-baseline.mjs:69` and `:75`, `check-guardrails.mjs:68` and `:99`)  | a preset's `report: 'return'` result, plus a pre-run `filesScanned` that is diagnosis  | the preset's receipt; each script also has return reads to fix             |
| three scripts hand-assembling (`check-corpus.mjs:764`, `check-ledger.mjs:166`, `check-release.mjs:377`) | a hand-assembled array — **and each call is inside the `--format json` branch only**   | the units its assertions ran over, subject to D2                           |

Not a migration site, and worth stating so nobody "fixes" it: the
undocumented-exclusion push at `packages/core/src/execute-rule.ts:171` builds a
literal **inside `applyFilters`** — pipeline output, evidenced by the terminal
that called it.

**The dialect has a path that never reaches the emitter.** Bug 0206:
`deliver()` throws `ArchRuleError` itself when `callerAggregates()`
(`packages/ts/src/presets/shared.ts:445-448`), bypassing `finishPreset`. Note
0206's own record: it and [bug 0205](../bugs/0205-four-emitters-restate-the-suppression-rule-and-disagree.md)
prescribe **opposite** fixes for that site, and whichever ships first makes the
other's wrong. This plan must pick one, not offer "either" as Phase 3 did.

## What was not measured — the return-type census

The break is on the return type. Every reader of a preset's `report: 'return'`
result is a migration site, and the table above lists none of them.

| population                                               | count | note                                                                                     |
| -------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| `report: 'return'` sites in `packages/*/tests`           | 14    | across five files; none inventoried anywhere in this plan                                |
| non-vacuity fixtures reading a preset return as an array | 5     | `bad-adr.mjs`, `bad-ledger.mjs`, `bad-ledger-dead-selector.mjs`, and two more            |
| gate-script return reads                                 | many  | enumerated under Phase 4, not counted; including the fail-open at `check-corpus.mjs:150` |
| documentation teaching the array return                  | 4     | `docs/presets.md:22`, `packages/ts/README.md:185`, `docs/markdown.md:441` and `:455`     |

**This side has no guard, and it fails green.** ADR-014's runtime guard covers
the **input**. On the output, `if (violations.length > 0)` becomes
`undefined > 0`, permanently false, silently — in this repo's own `.mjs` gates
and in any JavaScript adopter's. That is not the acceptable kind of breakage. A
consumer who cannot be broken loudly here must be broken loudly somewhere, or
the release ships a new way to report green over nothing. D2 decides it: an array
carrying `examined`, so `.length` keeps working rather than reading `undefined`.

**The deletion list for `throwIfViolations` was one row and is six.**
`docs/api-reference.md:567`; `packages/ts/src/index.ts:489`;
`packages/ts/src/presets/index.ts:24`;
`packages/ts/tests/matrix/vacuity-classification.ts:226` and `:238`; and
`scripts/check-nonvacuity.mjs:629`, which injects
`import { throwIfViolations } from '@nielspeter/eess'` as the violating payload
for the family re-export probe. That fixture's own comment records the identical
accident once already, when ADR-011 moved its predecessor behind `/internal`
"which turned this fixture's violating input into a legal one and the probe
green-for-nothing". Worse this time: the rule reads import specifiers, not the
kernel's export set, so the probe would likely keep firing on a symbol that no
longer exists. Repoint the payload in the same commit.

## Implementation

### Phase 0 — the ADR amendments (done), and settle which finding fires for a preset

**Done 2026-09-03.** ADR-014 was amended by its maintainer the same afternoon:
§1 (the receipt is an array carrying its evidence; `violations()` returns it),
§3 (the declaration rides the receipt), §5 (the finding throws under `warn` and
a bare `reportViolations`), §6 (four ADR-008 statements superseded) and a new
§7 (bundled verdicts merge fail-closed), with an amendment record naming the
silent green behind each. ADR-008's amendment section and the CLAUDE.md index
row moved with it. The plan no longer contradicts the law it builds.

**Bug 0190 closes as "gone", not "producible".** `presetConstructsNothingViolation`
(`packages/core/src/preset-dispatch.ts:111`) takes `(presetName, optionsHint)`,
which D6 forbids the kernel emitter from ever naming, so the kernel cannot be its
producer. The dialect already has the producer: `assertEnabled`
(`packages/ts/src/presets/shared.ts:299`) builds the preset-shaped finding with
its own `ruleId`, `bypassFilters` and remedy, and today only two of the five
presets call it (`packages/ts/src/presets/agent-guardrails.ts:213`,
`packages/ts/src/presets/data-layer.ts:145`). So: delete the kernel constructor
and its `/internal` export (`packages/core/src/internal.ts:50`), route all five
presets through `assertEnabled` from `deliver()`, and key the preset fixtures on
the id it already stamps. The kernel's generic finding — for a receipt with no
declaration and zero examined — is **new**, gets its own stable `ruleId`, and
names only what any hand-assembler can act on. A finding with an id and no
producer would be 0190's shape with a label on it.

**The changeset is Phase 0 work, not Phase 5.** `check:release` is the second
step of `validate` and the first gate CI runs on a pull request; six packages
touched means six declarations, and until they exist every CI run stops there
and never reaches the tests. `scripts/release-gate.mjs:513-520` requires the
five dialects **at `minor`** when the kernel breaks, not merely named. And the
changeset names what a consumer sees per surface: `.violations()` changes type
on every builder; every preset's `report: 'return'` changes; `throwIfViolations`
leaves two `eess-ts` entry points. And `eess-crossvalidate`'s peer floors
(`>=0.4.0` on `eess-ts`, `>=0.5.0` on `eess-md`, `>=0.3.0` on the others) are
raised in the same changeset: it reads a dialect builder's `.violations()`
(`packages/crossvalidate/src/md-mermaid.ts:153`), and an old dialect under an
unbounded floor would hand it a bare array.

**Bug 0206's direction is picked: the receipt rides the throw.** `deliver()`'s
aggregating branch keeps throwing without emitting, and the `ArchRuleError` it
throws carries the receipt with the finding already in it. The alternative,
teaching the kernel finisher a run-level aggregation mode, is plan 0188's scope,
and a plan that must close in one PR does not reach into another plan's.

### Phase 1 — red first

Unchanged in intent; three prerequisites from the review:

- Key every preset fixture on `assertEnabled`'s `ruleId`, and give the kernel's
  new generic finding its own, before any fixture is written (Phase 0).
- The two non-vacuity rows have homes before they are written: the kernel-emitter
  probe under `check:vacuity` (`GATE_FOR` maps it to `vacuity-matrix`,
  `scripts/check-nonvacuity.mjs:1535`, and probing an exported emitter with an
  evidence-free value is exactly what that matrix exists for), and the
  production-script row under `check:corpus`. Neither is a kernel behaviour
  orphaned from every `check:*`, and neither goes into `INSTRUMENTS`, which is
  the harness's own self-measurement and is excluded from the count by design.
- The bare-array test uses `// @ts-expect-error`, not a cast behind an
  `eslint-disable`: ADR-005-legal, and self-sabotaging — loosen the emitter's
  type and `tsc` reds on the unused directive.
- A test pins the merge's precedence: declared only if every zero-contributing
  member declared, `sourceEmpty` if any member is, a bare member is the
  no-evidence finding, zero members is zero examined. A `some()` where an
  `every()` was meant lets one declared part vouch for a hand-counted zero, and
  only a test pins it.

Then the tests, each asserting **identity, not count**: the evidence-free value
produces the finding; `examined: 0` with no declaration and no violations does
too; with a declaration, nothing; a value already carrying a `bypassFilters`
finding comes out carrying **that same finding**, asserted by identity, not
`toHaveLength(1)`; the finding is present under `return`, ridden by the throw,
and named in the text written under `warn`; and, under a run-level aggregating
caller, a preset summing to zero throws carrying the finding with nothing
emitted. Plus the remedy-remediates fixtures, which the review called the
strongest item here and the only part satisfying ADR-009 rule 2's behavioural
corollary.

**Rewrite `packages/core/tests/report.test.ts`, not two tests in it.** `:32-38`
asserts `reportViolations([])` emits nothing — the exact line ADR-014 names;
`:64-68` asserts `finishPreset([])` returns `[]`; `:48-62` and `:70-74` pass bare
arrays and assert `toHaveLength(n)`, which become `n + 1` the moment the finding
is appended. The helper at `:6-13` builds violations with no `ruleId`, so every
identity assertion needs a different one.

**The mutation for the break-the-loop fixtures is specified, because only one
kind discriminates.** A `continue` inserted as the first statement of the loop
body is the ADR §2 honest mistake: it examines nothing and leaves everything
loaded. An emptied iterable does not discriminate count placement, and an
emptied corpus fires the terminal's own `sourceEmpty` under a different rule id
and proves nothing about the emitter.

Also owed: two cases for `violationsEmittedCount()`
(`packages/core/src/report.ts:51-57`), which `packages/ts/src/core/execute-rule.ts:508`
reads as a delta. A healthy receipt with no violations must not move it; the
synthesised finding must.

### Phase 2 — the retype

As D1, D2, D4, D5 and D6 decide it. The parts the review left standing:

- **one receipt shape, everywhere.** `CollectResult` becomes the receipt: an
  `ArchViolation[]` carrying `examined: number`, `sourceEmpty?: true` and
  `declaredEmpty?: true` as own properties, built by one kernel factory that is
  also where the runtime guard lives. Every terminal produces it, `violations()`
  returns it (D1), every emitter accepts and returns it (D2). The nine
  `collectViolations()` implementations that return an object literal today
  change to the factory — that is cost, not a decision. No second evidence
  vocabulary: the object form and the array form do not coexist, and the type
  **keeps the name `CollectResult`** — "receipt" is this plan's prose word for
  it, never a second exported name;
- **one constructor and one merge, exported by the kernel and re-exported by
  every dialect** so `check:family` stays green. `push(...)`, spread, `filter`
  and `flatMap` all return bare arrays, and `adr.ts:139-153`, `ledger.ts:580`,
  `shared.ts:427` and `preset-dispatch.ts:62` all do one of them today. Without
  a shared merge, each dialect hand-rolls the `examined` sum and the
  `sourceEmpty` / `declaredEmpty` precedence — four emitters restating one rule
  and disagreeing, which is [bug 0205](../bugs/0205-four-emitters-restate-the-suppression-rule-and-disagree.md)'s
  class. The constructor stamps a **fresh** array: `applyFilters`
  (`packages/core/src/execute-rule.ts:46`) returns the same reference when no
  exclusion applies, and stamping onto it would mutate whatever a family
  memoized;
- **`formatViolationsJson` carries `examined` by hand**, one line, because
  `JSON.stringify` drops an array's own properties. Otherwise `--format json`
  forecloses bug 0174's machine-readable half;
- the finding is produced **before** delivery is chosen, so it is in the
  returned value, rides the throw, and is written under `warn`;
- a value already carrying a finding passes through untouched;
- **no new `WeakSet`** — `packages/core/src/cardinality.ts` stays the sole home
  of the registries ADR-010 §2 caps.

### Phase 3 — the migration, each site stating what it examined

In the table's order, kernel first. Corrected from the reviewed draft:
`executeWarn` is **not** a site. The two preset-wrapping scripts are **two**
calls each. `honestyAtClose` sums its own iterated counts, not `dispatchRule`
receipts. And bug 0206's branch gets **one** decided fix, sequenced against bug 0205.

Three sites the first census did not hold:

- **The `eess-ts` terminal fork.** Every `eess-ts` gate runs
  `packages/ts/src/core/terminal-builder.ts`, not the kernel's: it declares its
  own `CollectResult` (`:42`) and its own `_expectEmpty` (`:148`). D4's
  declaration goes on both terminals' receipts, or the flagship dialect's
  presets arrive undeclared. Plan 0188 unifies the two later; this plan does not
  wait for it.
- **`check:release` legitimately examines zero on a quiet `main`.** Its `noDiff`
  branch (`scripts/check-release.mjs:386`) is a clean tree at the base; right
  after `changeset version` there are also zero pending changesets. Routed
  through the emitter it reds `validate` on every quiet day. It declares empty
  **only under `noDiff`**, from that fact — an unconditional declaration would
  be the guard switched off for that script, D5's own failure.
- **The run-level aggregators use the kernel merge.** `checkAll`
  (`packages/ts/src/core/check-all.ts:33`), the CLI
  (`packages/ts/src/cli/commands/check.ts:186`, `:304`), the baseline generator
  (`packages/ts/src/helpers/baseline-generator.ts:20`) and
  `packages/crossvalidate/src/md-mermaid.ts:153` all `flatMap` over
  `violations()` and would drop every receipt's evidence on the floor. Each
  goes through the merge instead, so the denominator survives to wherever bug
  0174 decides to print it — and, per D7, so that a bare member reds. This is
  the site for pile-one finding 11, with its own non-vacuity fixture: a rule
  file exporting `{ violations: () => [] }` must red `eess-ts check`.
- **Four more structural `violations()` shapes are retyped to the receipt**, or
  they keep compiling as `ArchViolation[]` and drop evidence until the emitter:
  `Dispatchable` (`packages/core/src/preset-dispatch.ts:25-28`), `PresetRule`
  (`packages/ts/src/presets/shared.ts:29-35`),
  `packages/ts/src/helpers/baseline-generator.ts:18` and
  `packages/ts/src/core/terminal-execution.ts:16`.

The measure of done is not that it compiles. It is that a reviewer can read each
site and say what number it handed over and why that number is honest.

### Phase 4 — the return consumers (new)

The census above, migrated: nine gate-script reads, five harness fixtures,
fourteen test sites, four documentation teachings. `scripts/check-corpus.mjs:150`
is the one that fails **open** and is the reason this phase exists.

**Enumerate, do not count.** The gate-script reads, from the diff rather than
memory: `check-baseline.mjs:70`, `:74`, `:77`; `check-guardrails.mjs:69`, `:73`,
`:96`, `:97`; `check-corpus.mjs:150` and `:848`; `check-ledger.mjs:154`, `:167`,
`:202-228`; `check-release.mjs:378`, `:408-411`, `:432`, `:442`, `:459-473`.
Plus `.violations()` consumers the first census missed:
`scripts/check-corpus.mjs:130-144`, `scripts/release-gate.mjs:553-554`,
`docs/api-reference.md:47` and `packages/core/README.md:52`, both of which
teach the old return type.

D1 has its own consumer population, and it is larger: `.violations()` is called
at roughly 690 sites across 90 test files, 38 in `packages/*/src`, and a handful
in scripts and rule files. Most keep working under the array-carrying-evidence
shape, which is the point of that shape. The ones that aggregate are listed
under Phase 3; the rest are enumerated from the diff, per ADR-009 rule 5's
first corollary, not from memory.

### Phase 5 — the gates

Two non-vacuity rows, in two homes. The kernel-emitter probe — a hand-assembled
evidence-free value at `finishPreset` — under `check:vacuity`, beside the
vacuity-matrix probe it is a sibling of. And a **production-script** row under
`check:corpus`: the harness today drives `bad-adr.mjs` for ADRs
(`scripts/check-nonvacuity.mjs:1290`) and never the real `check-corpus.mjs`,
which is exactly why the fail-open at `check-corpus.mjs:150` had nothing to
catch it; the new row runs the production script with a `continue` planted in
one check's loop and asserts the emitter's rule id. Then the `WeakSet` rule; the
vacuity-matrix comment; the rule row written for the scope it truly covers, per
D3; ADR-014's rows moved to `gated` with exact `it('…')` citations; and the
`docs/api-reference.md` rows — the two
stale ones removed, and **new rows for the receipt, both emitters, the
constructor and the merge**, which have none today, so an adopter is not asked
to produce a required shape they can read about nowhere. The changeset is
already in from Phase 0.

Three fixture details that decide whether the rows above prove anything. The
`check:vacuity` home is honest only if `scripts/vacuity-matrix.mjs` actually
hands `finishPreset` an evidence-free value — its probes today call presets
bare and read the thrown error (`:191-234`) — so that probe is added, not
assumed. The repointed family probe payload at `scripts/check-nonvacuity.mjs:629`
names a **live** root symbol `eess-md` does not re-export (`reportViolations`
qualifies), with a clean-direction assertion that the payload resolves in the
kernel, because the rule reads specifiers (`scripts/lib/family-re-exports.mjs:84-100`)
and would fire on a dead name forever. And after Phase 5, the sabotage matrix
is enumerated **from the diff** in an isolated worktree, per ADR-009 rule 5's
corollaries — not from this document's list of what it thinks it changed.

ADR-008's amendment is **already done** (commit `371eba1`) and is not work here.

## Out of scope — each with its home

- **The published guardrail preset rule** (009's Ask C for adopters): its own
  plan. Opt-in, independently closable; holding this plan on it would couple a
  contract to a lint.
- **A catch-all `.excluding()` turning a rule off** —
  [bug 0233](../bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md).
  Same failure class, different seam.
- **The two crossvalidate presets that return `void`** —
  [bug 0097](../bugs/0097-crossval-presets-bypass-caller-owns-reporting.md).
- **Detecting a wrong `examined`.** ADR-014's stated ceiling, including its
  honest half: a count taken before the loop's own `continue` is the same
  mistake one line earlier, and the required field cannot tell it from the right
  number. **This plan must stop selling itself as closing the measured
  failures.** What ships is a compile-time nudge plus detection of the
  honestly-counted-zero sub-case.
- **Unifying the two `applyFilters`** — [plan 0188](./0188-unify-the-duplicated-engine-modules.md).

## Success definition

**The discrimination criteria — each one an experiment that must go red.** These
are the plan. Everything under them is bookkeeping.

- **Plant a `continue` as the first statement of ONE check's loop in
  `check-corpus.mjs`, and `check:corpus` exits non-zero naming the emitter's
  finding.** One check, not all nine, and not an emptied corpus. Today it exits
  0 and prints that citations resolve. This is the criterion that proves the
  dogfood is real rather than type-satisfaction, it is only writable under D7,
  and it must be a committed fixture run against the production script.
- **The same mutation in each hand-assembling site, and in each check inside
  it, reds.** One fixture per check. An `examined` nothing disagrees with is not
  evidence, it is a number, and a check without its fixture is a check whose
  number is a claim.
- **A `bypassFilters` finding under `report: 'warn'` and under a bare
  `reportViolations` throws**, as the terminal's warn path already does.
- **A rule file exporting `{ violations: () => [] }` reds `eess-ts check`, and
  the same builder reds `checkAll` in a test.** Today both are green. This is
  the adopter-side experiment, and it is the one an agent is most likely to
  produce while believing it did the right thing.
- **A hand-assembled evidence-free value at either emitter reds**, asserted by
  **rule id**, in a unit test and in a non-vacuity fixture, against the kernel's
  new generic finding; and **a preset that constructed nothing reds under all
  five `eess-ts` presets**, asserted on `assertEnabled`'s id, not two of five.
- **A preset whose rules were all disabled, and one that is legitimately empty,
  stay green** (D4 and D5's opposite direction). A guard that cannot stay quiet
  is a guard people switch off.
- **No mechanism is marked `gated` that examines nothing.** Specifically: the
  dogfood rule's declared scope must select a non-zero number of modules, or the
  row is not `gated`. ADR-014's Enforcement table is the last place a false green
  may live.
- **The removed alias's probe still discriminates.** Repoint
  `scripts/check-nonvacuity.mjs:629` and prove the fixture still fails on a real
  violation, rather than firing on a symbol that no longer exists.

Then the bookkeeping: every emitter call and every return consumer migrated,
each number the count its own assertions ran over and never what it loaded; a
terminal's own finding arriving once and present under every delivery mode; all
six references to the alias gone; no `WeakSet` added, with a rule saying so;
ADR-014 with no `pending` row; and `npm run validate` green from a run that
**reached the last step**, because bug 0126 records that a truncated chain looks
identical to a complete one.

**What this plan does not claim.** It does not close the measured field failure.
ADR-014's ceiling says why: a count taken before the loop's own `continue` is
the same mistake one line earlier, and the required field cannot tell it from
the right number. What ships is the unrepresentable-by-construction half plus
the honestly-counted-zero case. Selling more than that would be the same lie in
a different register.

Two more residuals, named so they are not mistaken for coverage. **An adopter who
sums by hand** instead of calling the kernel merge rebuilds the summed receipt
D7 removes from this repo, and the emitter sees their nine checks as one. **An
adopter who never calls an emitter** — formats and exits on their own array — is
ADR-014's stated ceiling, and D2b reaches them only if they call
`reportViolations` at all. Both are the guardrail rule's to catch (009's Ask C),
which is why that rule is a companion and not a footnote.

## Progress ledger

- [ ] Phase 0 — ADR amendments done 2026-09-03; still owed here: the changeset in, five dialects at minor; the kernel constructor deleted, `assertEnabled` wired into all five presets
- [ ] Phase 1 — the red tests written and measured red, keyed on real ids; the contradicted test removed
- [ ] Phase 2 — the retype
- [ ] Phase 3 — call sites migrated; 0206's branch fixed one way, sequenced against 0205
- [ ] Phase 4 — return consumers migrated; the `check-corpus` fail-open proven closed
- [ ] Phase 5 — the gates; ADR-014 `gated` and its `check:family` row corrected; changeset names all five dialects
- [ ] `/close` — 0190 and 0206 moved to `fixed/` in this PR

Deferred: none — **and the break-the-loop fixtures must keep that true, or name a
home. `Deferred: none` beside an unwritten fixture is the lie this plan is about.**
