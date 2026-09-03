# Proposal 007 — ts: expose a `TerminalBuilder`-family rule's declared requirement content and exclusions publicly

**State:** Draft — surveyed against the shipped 0.4.0 source (not just the consuming project's comments); not measured against a spike, no red test written yet.
**Priority:** Medium — closes a gap between what a consumer can verify about its own rules and what the library exposes, but the two known consumers (below) already work around it safely today.
**Origin:** inbound — a consuming project (`@nielspeter/eess-ts` pinned at `^0.2.1`), found while an agent working in that repo was asked to audit whether the project's own `arch.rules.ts` was adhering to eess's design or hacking around it. The project is not named here: this repo does not carry consumer identities.
**Affects:** `packages/ts/src/tsconfig/tsconfig-builder.ts` (`TsconfigBuilder`), `packages/ts/src/core/terminal-builder.ts` (`TerminalBuilder`, shared by the smell-detector family too).

## Problem

The consuming project's `arch.rules.ts` runs its own module-load-time integrity check (`assertArchIntegrity()`) that goes beyond what `eess-ts check` verifies today — most relevantly, whether a `tsconfig()` rule's frozen "enforcement snapshot" has drifted (a requirement silently weakened, e.g. `strict: true` → `false`) and whether a `.excluding()` call has silently neutered a rule's floor (BUG-043's class, in that project's own tracker — a catch-all exclusion turns a floor off while every other signal, including the requirement count, stays unchanged).

Both checks need the _actual declared content_ of a `TsconfigBuilder` rule — not just whether it asserts something, but _what_ it asserts — to freeze it, diff it, or cross-check it against the compiler's resolved options. `TsconfigBuilder` declares `_requirements` and (via the shared `TerminalBuilder`) `_exclusions` as `private`/`protected`. Neither is reachable from outside the class.

**This is not the same gap as `assertsSomething()`/`examinedUnits()`, which already ship (both public on `RuleBuilder` and `TsconfigBuilder` since after `0.2.1`, per the CHANGELOG — proposal 019/plan 0070 territory) and answer "did this rule assert _anything_."** The consuming project's own workaround duplicates that already-solved question via a private-field read too, and will delete that half once it upgrades. This proposal is about the half `assertsSomething()`/`examinedUnits()` cannot answer: **what**, specifically, did the rule assert.

## Evidence

Verified directly against `packages/ts/src/tsconfig/tsconfig-builder.ts` (current, 0.4.0):

- `private _requirements: Partial<CompilerOptions> = {}` — no getter of any kind for its contents. `assertsSomething()` returns a boolean (`Object.keys(this._requirements).length > 0`) and `examinedUnits()` returns a count — neither returns the entries.
- `packages/ts/src/core/terminal-builder.ts:127` — `protected _exclusions: (string | RegExp)[] = []`. The only place it leaves the instance is `filterContext()` (same file, `:754`), which is `private` and feeds `applyFilters` internally — not reachable from a consumer.

The consuming project's `arch.rules.ts` (comments dated 2026-08-12/2026-08-14, current file) reads both fields directly, with the coupling stated in its own source:

> "Reads `_requirements`, which `TsconfigBuilder` declares `private`. That is a deliberate, documented coupling to a library internal … and it exists because the two public alternatives cannot distinguish the state we must catch: `violations()` returns `[]` for a HEALTHY config and `[]` for an EMPTY spec … `describeRule().rule` returns the rule ID … so freezing it would freeze the id against itself." (`requirementEntriesOf`, in the consumer's own `arch.rules.ts`)

> "`_exclusions` is declared on `RuleBuilder` too … BUG-043 … a catch-all exclusion turns the whole floor off while `_requirements` stays intact: check 2 counts all thirteen requirements, check 4 sees a byte-identical fingerprint … and `pnpm arch` reports zero violations." (`exclusionsOf`, in the same consumer file)

Both comments independently arrive at "if upstream ever exposes a public accessor, switch to it and delete this" — the consumer is not asking for permission to keep the workaround, it is naming the exit condition.

## Proposed API

Two additions to `TerminalBuilder` (so both `TsconfigBuilder` and the smell-detector family inherit them for free, matching how `assertsSomething()`/`examinedUnits()` are already shared):

```ts
/** This rule's declared exclusions, in the order added. Read-only — a copy, not the live array. */
declaredExclusions(): readonly (string | RegExp)[]
```

And on `TsconfigBuilder` specifically (its declared state has a shape — `Partial<CompilerOptions>` — that a generic `TerminalBuilder` method can't type usefully):

```ts
/** The compiler-option requirements this rule declared, as sorted [key, value] entries. Read-only. */
declaredRequirements(): readonly [string, unknown][]
```

Both are pure accessors over already-existing private state — no new internal bookkeeping, no behavior change to `check()`/`warn()`/`violations()`.

## Alternatives considered

- **A `diagnose()`-shaped result exposing this.** `terminal-builder.ts` already builds a `facts()` object for `vacuity-diagnosis.ts` with a similar shape of "rule's own account of itself" — but it's `private` and purpose-built for the internal diagnosis path, not a general consumer API. Reusing that shape publicly (rather than two narrow accessors) is a reasonable alternative if the maintainer prefers one wider surface over two narrow ones; noted as an open question below.
- **Consumer keeps reading the private fields.** Works today, and both call sites are narrowly scoped and tested. Rejected as the default answer because it is exactly the class of coupling `assertsSomething()`/`examinedUnits()` were already built to make unnecessary for the _count_ half of this same problem — the _content_ half is left with no equivalent.

## Acceptance criteria

- A `TsconfigBuilder` rule built with `.requires({strict: true})` returns `[['strict', true]]` from `declaredRequirements()`; one built with `.requires({})` returns `[]`. Break class: a future refactor of `_requirements`'s internal shape (e.g. to a `Map`) must not change this public return shape — pin with a test that constructs a rule and asserts the exact entries, not just a length.
- A rule built with `.excluding('strictNullChecks')` returns `['strictNullChecks']` from `declaredExclusions()`; a `RegExp` exclusion round-trips as the same `RegExp` (not stringified) so a consumer can distinguish a narrow exclusion from a catch-all `.excluding(/.*/)`. Break class: silently stringifying a `RegExp` exclusion would make a catch-all pattern indistinguishable from a narrow one to a consumer trying to flag BUG-043's exact failure mode.
- Both methods must return **copies**, not the live internal arrays/objects — a break class here is a consumer mutating the returned value and silently corrupting the rule's own enforcement state.

## Open questions

- Whether these belong on `TerminalBuilder` (shared with the smell-detector family, who may have their own equivalent "what did I declare" question with a different shape) or scoped to `TsconfigBuilder` alone — reserved for the maintainer; this proposal only speaks to the two concrete needs measured above.
- Whether a single `facts()`-shaped public result (see Alternatives) is preferred over two narrow accessors — a design taste call, not something the evidence here settles.

## Scope

`packages/ts` only. No change to `packages/core`, `packages/md`, or any other dialect.

## Review — 2026-09-03

**Ruling: Rewrite needed**

Three lenses (architect, product, enforcement) reviewed this independently and converged on the same conclusion from three directions: the problem is real and well-evidenced, and the proposal is aimed at the wrong half of it.

**The shippable thing is a finding eess should emit, not state eess should expose.** The Problem section's own motivating case — a catch-all exclusion turning a floor off while every other signal stays unchanged — is a library fail-open. eess already ships the inverted half: `.excluding()` discloses its _zero-match_ case (`packages/core/src/silent-exclusion.ts`), and `orphanExclusions()` makes "an exclusion comment naming no live rule" a first-class finding. Nobody has built the "an exclusion that does _everything_" direction. Verified structurally: `examined` is computed pre-exclusion (`packages/ts/src/core/terminal-execution.ts` runs `evidenceFloor` on the raw collect result), `.excluding()` is applied afterwards in `violations()`, and no floor reads post-filter cardinality. So `{ violations, examined }` — the seam ADR-010 exists to make a pass constructible from — is blind to suppression by construction.

The library predicted this exact moment. `packages/ts/src/core/execute-rule.ts:215-223` records the asymmetry, keeps the multi-match case advisory on the ADR-008 precedent that "the primary consumer does not read warnings", and states it is **"worth re-litigating if this loophole is measured firing in practice, not settled by the precedent alone."** This proposal is that measurement — and does not cite it. The existing coverage is also narrower than that comment implies: the advisory is gated on `v.identity?.startsWith('cycle-edge::')` (`:184`), so a `TsconfigBuilder` rule with a catch-all exclusion and a drifted config produces no unused-exclusion warning, no advisory, zero output, green build.

Handing the consumer the private array so they can build that detector themselves is outsourcing a fail-open. ADR-008 separates emission from **detection**; detection stays with the library. Every other adopter with the same hole stays exposed, and each re-derives the same harness.

**The placement is wrong, and rests on a claim that is false.** "Scope: `packages/ts` only. No change to `packages/core`" is stated as a virtue; it is the defect. `_exclusions` exists twice, identically — `packages/core/src/terminal-builder.ts:68` and `packages/ts/src/core/terminal-builder.ts:127` — and **both classes are named `TerminalBuilder` and both are public root exports**. Adding the accessor to one makes a single exported name carry two contracts across the family: a consumer of `eess-md`/`-mermaid`/`-gherkin`/`-crossvalidate` holds the kernel's and gets nothing. Plan 0188's measured inventory names this exact pair as duplication it is closing, so a ts-only accessor turns a mechanical merge into a behaviour-reconciling one.

The precedent cited for that placement does not exist. The proposal says the accessors match "how `assertsSomething()`/`examinedUnits()` are already shared". `examinedUnits(): number` is declared **nine times** across `eess-ts`, deliberately, because the unit differs per family — and `packages/ts/tests/core/evidence-at-every-seam.test.ts` enforces per-family declaration through its `COUNTS_AT_ITS_OWN_SEAM` census. The precedent is one a test exists specifically to prevent. It supports `declaredRequirements()` on `TsconfigBuilder` alone; it does not support putting `declaredExclusions()` on a base.

**The proposed return type is wrong, not merely incomplete.** `recordExclusions` (`packages/core/src/silent-exclusion.ts:56-69`) unwraps `silent(pattern)` and pushes the bare pattern into the same `_exclusions` array, recording only the index in a separate `_silentIndices` set. A flat `readonly (string | RegExp)[]` therefore cannot distinguish `.excluding(/.*/)` from `.excluding(silent(/.*/))` — and the silent form is _strictly more suspicious_, because it also suppresses the one warning eess does emit. A consumer using this accessor to detect a catch-all that neutered a floor would be blind to the worst variant of exactly what it is looking for. `readonly { pattern: string | RegExp; silent: boolean }[]` is the shape that answers the question the proposal asks.

Smaller, all load-bearing: `declaredRequirements(): readonly [string, unknown][]` discards the caller's type — `.requires()` takes `Partial<CompilerOptions>`, so a consumer who declared `{ strict: true }` gets `unknown` back; `Readonly<Partial<CompilerOptions>>` preserves it and still satisfies the copy criterion. Inside `packages/ts` the state lives on `RuleDeclaration`, not `TerminalBuilder`, and that split is deliberate and documented (`packages/ts/src/core/terminal-builder.ts:100-110`) — a declaration accessor on the execution half re-mixes what that refactor separated. `DiagnosableRule` (`packages/ts/src/core/diagnose.ts:23`) is the existing public, structural "what a rule can tell you about itself" interface and is the precedented shape, which answers Open Question 2 with something already shipped. And the guarantee has an unstated boundary: freezing `declaredRequirements()` catches `strict: true → false`, but not the rule being deleted, `.excluding()` being added, severity downgraded, or the rule dropping out of the loaded file — an accessor sold as a drift guard must say which drift it cannot see.

**Break classes.** All three acceptance criteria are real and correct, and all three are Tier-1 properties of a getter's return type. None is the corruption the capability exists to catch, because the accessors cannot produce a violation at all. The one break class that matters appears in the Problem section and is never carried into a criterion, because the design puts it outside eess. Non-vacuity: two read accessors correctly have no row in `scripts/check-nonvacuity.mjs` — there is no gate to empty — and saying so turns an apparent omission into a judgment.

**Recommended next step.** File the catch-all-exclusion disclosure as its own bug: _"an exclusion that suppressed every violation a rule produced is a configuration finding, not a silence."_ It has a break class, a tier (1 — statically decidable), a fixture shape (a rule with a real violation plus `.excluding(/.*/)` that must go red, asserting the new rule id), and the bookkeeping already exists — `matchedPatterns` (`packages/ts/src/core/execute-rule.ts:140`) plus pre/post-filter counts are all in scope at the reporting loop. That bug is worth more than this proposal asks for. Then rewrite this proposal as the secondary capability it actually is: kernel placement, the `{ pattern, silent }` return shape, `Readonly<Partial<CompilerOptions>>` for requirements, `DiagnosableRule` as the pattern, the false `examinedUnits()` precedent removed, and the drift boundary stated. It is not ready to become a plan.
