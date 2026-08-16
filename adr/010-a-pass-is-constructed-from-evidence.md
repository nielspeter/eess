# ADR-010: A Pass Is Constructed From Evidence

## Status

Accepted (2026-08-14). Implements plan
[0088](../work/plans/completed/0088-fold-ts-archunit-into-eess.md). Ported from
`ts-archunit` [ADR-009](https://github.com/nielspeter/ts-archunit/blob/main/adr/009-a-pass-is-constructed-from-evidence.md)
(accepted there 2026-08-06, after a defect class recurred four times on the
source project). This ADR is **prospective on eess's own kernel**: the seam it
retypes (`{ violations, examined }`) does not exist in `packages/core` today —
plan 0088 Phase 4 builds it, Phase 4a builds the vacuity matrix that enforces
it behaviourally. The decision lands here, ahead of the fold: an ADR decides,
a plan implements — the same split `ts-archunit`'s own ADR-009 names
explicitly for its matrix's test inventory ("the test inventory that realises
it ... is the implementing plan's").

## Context

[ADR-009](./009-agent-first-failure-surfaces.md) establishes that a check
which cannot fail is worth less than no check. This ADR is that principle's
sharpest edge: **a verifier whose instrument failure is indistinguishable from
architectural cleanliness is worth less than no verifier, because it is
counted as coverage.** A dead glob, a solution-style `tsconfig` loading zero
files, a selector narrowing to nothing — every misconfiguration must not
collapse into the same output as "the architecture is clean."

`ts-archunit` closed this class wave by wave, and the mechanism behind every
wave's incompleteness is the same one ADR-009 rule 5 names: **an enumeration
derived from the work in front of you does not contain the family outside your
view.** Four completed waves on the source project, each correct over its own
enumeration, each followed by a family the enumeration could not see — until
the guarantee moved from "no rule currently examined selects nothing" (a
property of the rules) to "no verdict can be constructed without evidence" (a
property of the type). eess inherits the second, structural form directly,
rather than re-running the four waves against its own corpus first — the
measured cost of re-deriving it (a class recurring on unrelated code, closed
only when it stopped being reviewed and started being unrepresentable) is the
reason to adopt the destination, not the path.

**Why this lands now.** `@nielspeter/eess`'s kernel today has no `examined`
count anywhere in its return shape — `ArchViolation[]` is the terminal type
throughout `packages/core`. A rule whose selector matches nothing and a rule
that legitimately found zero violations are the same value on the wire. Plan
0088 folds in the honest-gate machinery that closes this — the exclusion/
comment/silent/unsuppressable/orphan-detection system, the `CollectResult`
shape, `zeroSubjectsAdvice` (Phase 1's kernel-bound classification) — and this
ADR is the decision that machinery answers to.

## Decision

> **A passing verdict is constructed from evidence of examination: a
> non-empty set of examined units, counted at the family's own examining seam
> — or an explicit declared-empty token. Zero loaded source files outranks
> any token. A pass that is merely "no violations were collected" is
> unrepresentable.**

Four parts, binding on every current eess rule family (`eess-ts`'s builders,
`eess-md`'s corpus rules, `eess-mermaid`'s diagram rules, `eess-gherkin`'s
feature rules) and every future one.

### 1. Evidence is counted at the family's examining seam, and the family names its unit

"Examined" means the set a family's own semantics hands to its assertion
logic, counted where that hand-off happens — not upstream (files loaded, globs
matched, selection size before filtering are **diagnosis**, attached to the
failure so the remedy can name the actual fault, per ADR-009 rule 2), and not
inside a user-authored `Condition`/`Predicate` body (a sanctioned extension
point; a user function that internally skips every subject is outside this
invariant — review-enforced residue, named honestly rather than silently
absorbed). Evidence is counted in units **iterated**, never in condition
matches — a condition-glob tripwire that iterates every subject and matches
none has non-empty evidence.

The unit differs per family and naming it is part of joining the enforcement
classification (see Enforcement): for `RuleBuilder`-based families, the
post-filter subject set handed to conditions; for `correspondence()`, the key
sets of its two sides.

### 2. The terminal seam's type requires the evidence

Every published family's terminal path — `.check()` / `.warn()` — flows
through one verdict site. That site's return type carries the evidence going
forward: `{ violations, examined }` in shape, the exact type left to plan
0088 Phase 4. `.check()`, `.warn()`, and `correspondence()`'s own terminal
keep their signatures; [ADR-003](./003-fluent-builder-dsl.md)'s grammar is
untouched. No free-standing verdict factory — nothing forces a terminal to
call one, which is the weakness this ADR rejects in the dogfood alternative
(see Alternatives). No third suppression mechanism beyond what Phase 1
classified as kernel-bound (the unforgeable `WeakSet`-backed registries) —
each guards a distinct, named audience, and nothing may add a fourth.

**This is a break of eess's own extension surface for the four sibling
dialects.** They consume the kernel's `RuleBuilder`/`correspondence` seam
without subclassing it (plan 0088's family-boundary note), so the retype is
kernel-internal for them and they inherit the honest-gate for free — no
sibling code changes to receive it, per plan 0088's own preservation-only
obligation to the siblings (0089 and 0101 own what they do with it next).

### 3. Empty is a declaration, never a default — and no declaration outranks a dead instrument

The legitimate empty cases stay legitimate: `.notExist()` (zero matching
subjects _is_ the assertion being satisfied) and an explicit
`.expectEmpty()` / `.expectNonEmpty()` pair (asserts emptiness, fails the day
it stops being true), reaching every family through the shared terminal seam.
Absent a declaration, zero examined units is a configuration finding — failing,
unsuppressable.

Two rulings carried over unchanged, because eess's kernel has the identical
shape of gap:

- **An empty project outranks every token.** A declaration asserts a fact
  about a loaded corpus; over zero loaded source files it asserts nothing,
  and the expiry property that justifies `.expectEmpty()` never engages. Zero
  loaded source files is a configuration finding under any declaration —
  this is instrument-level precedence, distinct from and outranking
  selection-level precedence (`.notExist()` over a loaded project with zero
  matching subjects is still legitimate satisfaction).
- **Presets must thread the declaration.** A preset user does not hold the
  builder; if a preset option cannot carry the user's empty-declaration to the
  mint, their only reachable remedy is disabling the option — deleting
  coverage permanently (ADR-009 rule 1's trained-suppression dynamic,
  reproduced by this ADR's own gate if unaddressed). Every eess-ts preset that
  survives the fold (`recommended`, `agentGuardrails`) must expose a
  declaration carrier reaching every check it constructs.

`@nielspeter/eess`'s kernel has no `correspondence().allowEmpty()` today
(verified — that conversion was `ts-archunit`-internal pre-fork), so this part
introduces a **new** `expectEmpty`/`expectNonEmpty` capability the siblings may
adopt later, not a conversion they are forced through — the same distinction
plan 0088's family-boundary note already draws.

### 4. The finding names its cause's remedy

The configuration finding fires for at least three causes with three different
remedies, and [ADR-009](./009-agent-first-failure-surfaces.md) rule 2 forbids
naming one as universal: an **empty project** points at the tsconfig; a
**dead selector** names the glob; **filters excluding everything in a loaded
project** is the one judgment call — declare `.expectEmpty()` if the corpus is
legitimately below threshold, otherwise fix the filters. Each remedy is
verified to remediate (ADR-009 rule 2's behavioural corollary).

### Enforcement methodology

Two layers, differently derived (ADR-009 rule 5 applied to this ADR's own
claim). **The compiler** enforces the construction: no evidence, no build.
**The vacuity matrix** (plan 0088 Phase 4a) enforces the behaviour of the
shipped artifact — every published check-constructor, probed bare on
`.check()` and `.warn()` over a zero-file project, must fail. Enumerated from
the `package.json` exports map, imported from `dist`, recursing into
namespace-object exports — the one list a published surface cannot avoid
joining, per Phase 4a's own design. A `KNOWN_FAIL_OPEN` ratchet that may only
shrink names any constructor not yet closed as a declared, tracked debt —
never a silent green.

**Blast radius ([ADR-009](./009-agent-first-failure-surfaces.md) rule 6):
published API.** Every `@nielspeter/eess*` export is a published entry point
strangers depend on — guard the guard: adversarial review of the matrix,
mutation of the seam.

## Consequences

### Positive

- Fail-open becomes unwritable, not just unwritten, for every current and
  future eess rule family.
- The manifesto's Tier/Status honesty gets a structural backstop: a `gated`
  clause whose mechanism silently examines nothing can no longer read as
  proof.

### Negative

- **A retype breaking change**, ridden through plan 0088's own breaking-release
  authoring (Phase 7) rather than shipped ad hoc.
- **Authoring friction is the mechanism, so it is budgeted, not apologised
  for.** A new rule family must thread evidence from its examining seam to the
  verdict; that thread is the guarantee, not overhead to trim.
- **The declaration has churn and granularity costs.** A sometimes-empty
  corpus goes red twice — once undeclared, once when `.expectEmpty()` expires
  on the first qualifying match — and the token is per-rule while emptiness is
  per-project, a real cost a monorepo with many rule files pays.
- The matrix depends on a fresh build and a hand-maintained classification —
  mitigated, not removed, by its own completeness check (an unclassified
  export fails).

## Alternatives Considered

### Dogfood it — an eess-ts rule that every terminal routes through the guard

Rejected as the primary, for the reason `ts-archunit`'s own bug 0066 measured:
"every terminal calls X" guards the wrong layer. A family can share the base
class and still fail open behind a precondition inside it. The compiler
enforcing a required seam type is strictly stronger than a lint asserting a
call exists. Worth keeping as a belt-and-braces check once the seam exists;
not a substitute for it.

### Runtime assertion only — throw when a verdict is built without evidence

Rejected as the primary, for the same reason [ADR-005](./005-no-any-no-type-assertions.md)
exists: the compiler is available, and evidence the compiler checks does not
rot. Acceptable as a fallback only at boundaries the type shape genuinely
cannot reach.

### A third state — permanent "empty is fine", `allowEmpty` generalised

Rejected. It is the silent-green hatch by another name: a check carrying it
can never fail on its corpus going quietly unmeasured, which is the exact
shape this ADR exists to make unrepresentable.

## Notes

Ported from `ts-archunit` ADR-009 rather than independently re-derived — see
Context. The source ADR's wave history (four recurrences of the vacuous-pass
class, specific bugs and plans on that project) is not reproduced here for the
same reason [ADR-009](./009-agent-first-failure-surfaces.md)'s Notes give:
it is not eess's history, and citing it as if it were would misattribute the
discovery. What is reproduced is the structural decision — evidence
constructed at the seam, empty as declaration, instrument-level precedence —
which is the transferable part.

The honest limits, named rather than silently exceeded: **adequacy** — a
family can examine 500 subjects and still assert nothing worth knowing;
[ADR-009](./009-agent-first-failure-surfaces.md)'s rules own that, this ADR
does not. **Provenance** — the compiler checks evidence is present and the
matrix checks the zero-file cell; evidence wired from the wrong layer
(counting files loaded instead of subjects examined) satisfies the letter over
a fiction, and only review catches that, family by family, with ADR-009 rule
5's question. **User conditions** — a `defineCondition`/`definePredicate` body
that internally skips every subject is invisible to a seam that counts what
was handed to it. Unrepresentable vacuity is the floor, not the ceiling.

## Enforcement

| Clause                                                                                | Tier                                                                     | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status                                                                                           |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Terminal seam requires `{ violations, examined }` evidence to construct a pass        | 1                                                                        | compiler-checked return type: `CollectResult` (`packages/core/src/terminal-builder.ts:28`) is the abstract `collectViolations()`'s return type (`terminal-builder.ts:466`) — every subclass across every dialect must construct it, or the build does not compile                                                                                                                                                                                                                 | `gated`                                                                                          |
| Every published check-constructor fails over a zero-file project (the vacuity matrix) | 2 (behavioral — the harness _executes_ constructors, not a static claim) | `scripts/vacuity-matrix.mjs`, wired as `check:vacuity` in `package.json` and into `npm run validate`; its own non-vacuity proof is `scripts/nonvacuity/bad-vacuity-matrix.mjs` (a mutated copy with `KNOWN_FAIL_OPEN` stripped, asserted to redden). The ratchet (4 dated entries as of 2026-08-16, expiring 2026-11-15) is the honest record of known debt, not a silent exception                                                                                               | `gated`                                                                                          |
| Zero loaded source files outranks any `.expectEmpty()` declaration                    | 2                                                                        | `TerminalBuilder.evidencedViolations()`'s `sourceEmpty === true` precedence branch (`packages/core/src/terminal-builder.ts:252`), checked _before_ `.expectEmpty()`/`assertsCardinality()`; `packages/ts/tests/builders/class-rule-builder.test.ts` · `it('.expectEmpty() cannot rescue it either')`                                                                                                                                                                              | `gated`                                                                                          |
| Every surviving eess-ts preset threads an empty-declaration carrier                   | 2                                                                        | same vacuity matrix as the row above — it probes every published preset's bare, minimal type-correct call and classifies `fail-open`/`other-throw`/`config-finding`; a preset not threading the carrier shows as `fail-open` and either fails the build or must carry its own dated `KNOWN_FAIL_OPEN` entry, the same honest-debt discipline as above                                                                                                                             | `gated`                                                                                          |
| The configuration finding names its cause's remedy, verified to remediate             | 2                                                                        | Partial. Remedy _message_ correctness and cause-specificity are tested — `packages/ts/tests/builders/class-rule-builder.test.ts`'s dead-glob-diagnosis case (message names the specific dead glob, not the generic fallback) and `packages/ts/tests/cli/doctor.test.ts` · `it('prints the dead glob and its rule file to stderr')`. Not yet built: a fixture that applies a named remedy and asserts the finding actually clears — the "verified to remediate" half of the clause | `pending` (mechanism partially built; the apply-and-confirm-clears fixture is the remaining gap) |
