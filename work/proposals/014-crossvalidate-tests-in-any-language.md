# Proposal 014 — crossvalidate: the scenario presets take a test side from any language

**State:** Draft — filed 2026-10-09 after an inbound question; reviewed 2026-11-01 (architect ·
product · enforcement), ruling `Ship with changes`; see `## Review — 2026-11-01` below.
**Priority:** Medium — no shipped preset is falsely green on this. A project whose tests are not
TypeScript cannot use the scenario presets at all, and the composition it must write instead is
green on an empty binding unless the author declares otherwise, and red on an ordinary suite where
two tests cite one scenario.
**Origin:** inbound · consuming project (Python, pytest, plus TypeScript browser tests). Verified
here: the composition below was measured against this repo's build at `47236ee`, on the fixture
shown inline, run from a session scratchpad; the consumer's own suite was not run here.
**Affects:** `@nielspeter/eess-crossvalidate` (the scenario presets); possibly
`@nielspeter/eess-gherkin` (where the presets live, see Open questions).

## Problem

Gherkin is language-neutral; the presets that bind it to tests are not. A consuming project whose
tests are pytest functions wants what a TypeScript project gets from the scenario presets: every
scenario in `features/*.feature` cited by a test, every citing test pointing at a real scenario,
exempt tags honoured and reported when stale, and a pass that is built from evidence ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)).

It cannot have them. Its citations live where its tests live — a `@pytest.mark.scenario("…")`
marker, a docstring, a test id — and nothing in eess reads those. The presets read their test side
from a TypeScript project and from nothing else.

## Existing code survey

- **The presets read TypeScript only.** `@nielspeter/eess-crossvalidate/gherkin-ts`
  (`packages/crossvalidate/package.json:27`) exports three presets — `scenarioTestsResolve`
  (`packages/crossvalidate/src/gherkin-ts.ts:130`), `scenariosCovered` (`:246`),
  `scenarioExemptionsCurrent` (`:305`) — a stats helper, `scenarioTestStats` (`:339`), and
  `citedScenarioSites` (`:204`). Each takes an eess-ts project; the private `itTitles` (`:85`) walks
  it with `calls()` for `it`/`test` call titles. The module imports `@nielspeter/eess-ts` at runtime
  (`:9`), so importing it requires eess-ts.
- **The citation's shape is already public.** `TestCitationSite { title, file, line }` (`:58`) was
  exported by [plan 0145](../plans/completed/0145-crossvalidate-stale-wip-detection.md) "so a consumer can report a citation's own location". What is private is
  the code that fills it — `itTitles` — so the gap is a seam over an existing type, not a new input
  shape.
- **The only test-side hook parses a title.** `extract?: TestCitationExtractor` (`:35`, `:40`,
  `:286`) turns a TypeScript test title into a citation; it cannot supply a different test side.
  `include` and `isExempt` are hooks on the scenario side.
- **The presets allow several tests per scenario.** `scenariosCovered` checks membership in a set of
  cited keys (`:246`–`:267`), and `citedScenarioSites` keeps one site per scenario when two tests
  cite it (`:200`–`:203`).
- **Stale exemptions are already a decided check.** `scenarioExemptionsCurrent` is what
  [proposal 005](./promoted/005-crossvalidate-stale-wip-detection.md) asked for: a scenario still
  tagged exempt once a test cites it is a finding. A supplied-side form inherits it rather than
  re-deciding it.
- **The kernel can already join any two lists.** `correspondence()` is public
  (`packages/core/src/index.ts:68`); a side is a plain `{ label, elements, identify }`, so a list of
  citations is a valid side, and eess-gherkin's `features().scenarios()` is the other. eess-gherkin
  does not re-export `correspondence`, so a consumer adds `@nielspeter/eess` directly.
- **The three presets carry evidence the raw composition does not.** They end in `finishPreset`
  (`:184`, `:267`, `:335`), whose evidence gate reports a binding that examined nothing;
  `scenarioTestStats` returns counts with no gate. A `correspondence().beComplete()` is exempt from
  that gate by design — it is an absence assertion ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md);
  `packages/core/src/correspondence.ts:157`) — so an empty binding is green unless the author adds
  `.expectNonEmpty()`.

## Measured: the composition with released parts

**Fixture** — one feature file, `features/credits.feature`: two live scenarios, `A credit is booked`
and `A credit is reversed`; `A credit is split` tagged `@pending` and `A credit is merged` tagged
`@untested` (exempt; tags are stored without `@`). The right side is a hand-built list of
`{ id, file, line }` citations, the shape a pytest hook would write as JSON.

**Composition:**

```ts
const key = (s) => `${s.relPath} › ${s.title}`
const live = set.scenarios().filter((s) => !exemptTag(s))
correspondence({
  left: {
    label: 'scenario',
    elements: live,
    identify: (s) => ({ name: key(s), file: s.file, line: s.line }),
  },
  right: {
    label: 'test citation',
    elements: citations,
    identify: (c) => ({ name: c.id, file: c.file, line: c.line }),
  },
  keyBy: { left: key, right: (c) => c.id },
  suggest: {
    right: (info) =>
      exempt.has(info.name)
        ? 'the scenario is tagged @…, so its exemption is stale — remove the tag'
        : '…',
  },
})
  .should()
  .beComplete({ direction: 'both' })
```

| Case                                         | Result                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| every live scenario cited                    | green, `examined` 4 (2 scenarios + 2 citations)                                                 |
| one scenario uncited                         | 1 finding: `scenario "…" has no matching test citation`                                         |
| a citation to a scenario that does not exist | 1 finding: `test citation "…" has no matching scenario`, at the citation's file and line        |
| a citation to an exempt scenario             | 1 finding, the same wording; `suggest` adds "its exemption is stale — remove the tag"           |
| no citations at all                          | 1 finding per live scenario                                                                     |
| **two tests citing one scenario**            | **1 finding: `scenario "…" matches multiple test citations — the correspondence is ambiguous`** |
| both sides empty                             | **green, `examined` 0**                                                                         |
| both sides empty, with `.expectNonEmpty()`   | 1 finding: "declared .expectNonEmpty() but examined zero units"                                 |

So the composition works, with three costs the presets do not have:

- **An empty binding** closes only if the author declares `.expectNonEmpty()`; with a one-way
  direction even that does not close it (bug
  [0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)).
- **Several tests per scenario is a false red.** `correspondence()` is a one-to-one join; the author
  must collapse citations to one element per key first. The presets have no such limit.
- **Exemptions are hand-made.** A citation to an exempt scenario reads as a citation to nothing;
  only a `suggest` closure over the exempt set names the cause.

## Asks

- **A — the scenario presets take a supplied test side.** The same three presets, over citations the
  caller supplies as `TestCitationSite`s instead of an eess-ts project, with their evidence gate,
  their several-tests-per-scenario semantics and their exemption handling unchanged. Importing this
  form must not require eess-ts.
- **B — document the composition until A ships.** `docs/crossvalidate.md` shows the measured
  composition for a non-TypeScript suite — `direction: 'both'`, `.expectNonEmpty()`, citations
  collapsed per key, and the exemption `suggest` — and says why each is required.

## Acceptance criteria

**A — the presets over a supplied test side.**

- **Break class:** a scenario no citation names is reported, with the scenario's file and line.
- **Break class:** a citation naming no scenario is reported, at the citation's own file and line.
- **Break class:** an exempt scenario that a citation names is reported by the exemption check, not
  as a citation to nothing.
- **Break class:** an empty binding — no scenarios, no citations, or both — is not green: the
  presets' existing evidence gate reports it, with no declaration needed.
- **Break class:** a citation source that is missing or unreadable is a finding, never read as an
  empty list ([ADR-009](../../adr/009-agent-first-failure-surfaces.md)). How it is supplied is open question 1.
- **Not a finding:** two tests citing one scenario.
- **Non-vacuity:** a fixture row for each break class, plus a row proving the supplied-side form and
  the TypeScript form report the same findings for the same citations.

**B — the documentation.**

- **Break class:** the documented composition stops reporting what it says it reports. The fence
  type-checks under `check:docs-code`, which runs nothing (`scripts/check-docs-code.mjs:27`), so the
  composition also runs as an example test under `check:examples` (`examples/`, run by vitest),
  asserting that an empty binding is red and that two tests citing one scenario are not.

## Open questions

1. **Where the citations come from.** eess extracts from source it parses ([ADR-002](../../adr/002-ts-morph-ast-engine.md), [ADR-007](../../adr/007-isolate-ast-engine-boundary.md)); it does
   not parse Python. The likely shape is that the consumer's own test runner produces the list (a
   pytest `conftest.py` hook over `--collect-only`, writing JSON) and eess takes it in code or reads
   a declared file. Reading `.py` files with a pattern instead is a text grep — the shape bug
   [0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md) found cannot go red.
2. **Where the presets live.** They sit in `/gherkin-ts` because their test side is eess-ts. A
   supplied-side form needs no eess-ts; it could be a sibling sub-path of eess-crossvalidate, or
   belong in eess-gherkin, which already owns the scenario side.
3. **A list that is itself stale.** A citations file the build does not regenerate can be green on
   last week's tests. Whether the presets check its freshness, or document that the caller's build
   owns it, is undecided.

## Alternatives considered

- **Widen `extract`.** It parses one title at a time from an eess-ts walk; widening it still needs
  eess-ts and a TypeScript project, so it does not reach a Python suite.
- **Let the existing functions take `TestCitationSite[]` in place of a project.** The smallest change,
  and close to Ask A; it keeps the eess-ts import, though, unless the module is split.
- **Document the composition only (Ask B alone).** Leaves the three costs above to every consumer.

## Out of scope

- Reading Python, or any other language, inside eess.
- Any change to the TypeScript form of the presets.
- [Bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)'s one-way count, which has its own record.

## Consumer evidence — 2026-10-10

The consuming project sent the citation format it shipped (reported by its agent; its suite was not
run here). Recorded as evidence for the review, not as a decision.

- **The marker.** One string literal on a pytest marker, `"<file>.feature › <Scenario title>"`:
  `<file>` is the name inside the project's one, flat `features/` folder, the separator is `›`
  (U+203A) with a space each side, and the title is exact. That is the TypeScript presets' own
  citation form (`packages/crossvalidate/src/gherkin-ts.ts:65`, `:190`), not a new one.
- **Where it may sit.** A `test_*` function, a `test_*` method of a `Test*` class, a `Test*` class
  (decorator or the class's own `pytestmark`), or a module's `pytestmark`. Several markers per test.
  Only the files pytest would collect are read, and pytest runs with strict markers, so a misspelt
  marker fails the test run instead of silently dropping a citation.
- **The extractor.** The project's own, on Python's standard `ast`, run on every check, writing JSON
  to stdout: `files`, `citations` (`key`, `file`, `line`) and `errors` (`file`, `line`, `message`).
  No citations file is kept. A marker anywhere else, a non-literal argument, a citing test that is
  skipped or expected to fail (on itself, its class or its module, including through a module-level
  name or `pytest.param(marks=…)`), a citing test defined twice, and a file that does not parse are
  each an **error**, never zero citations.
- **The gate.** Citations collapsed by key, sites kept for messages, then one `correspondence()` with
  `direction: 'both'` and `.expectNonEmpty()`; exempt scenarios (two tags) filtered off the left,
  with a `suggest.right` that names a cited exempt scenario's tag as stale.
- **At landing:** 122 scenarios, 59 cited by 72 citations in 18 files, 63 tagged untested. The
  figures are consistent with a green gate: 59 + 63 = 122, so no live scenario is uncited and none
  carries only the other exempt tag.

What it bears on, for the review to weigh:

- **Open question 1** (where citations come from): the consumer's own extractor, re-run every
  check — eess parsed no Python. It is a static parse of the files pytest would collect, not
  pytest's own collection, which differs from the hook this question guessed at: it cannot see a
  test made by parametrization or a mark applied at runtime, and it is a real parse, not the text
  grep [bug 0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md) warns about.
- **Open question 3** (a stale list): no list is kept, so freshness is the caller's by
  construction. One consumer's choice, not yet evidence that every caller would make it.
- **The missing-source break class** in Ask A: the extractor reports an unreadable or misplaced
  citation in `errors`, never as zero citations; how the consumer's gate uses that list was not
  reported. Whether a supplied-side form takes those errors, or the caller must fail first, is the
  review's question.
- **The key.** The consumer keys a scenario by its path inside `features/`, not its repo path; the
  TypeScript presets accept a unique path suffix (`gherkin-ts.ts:107`), so a supplied-side form
  needs the same.
- **Several tests per scenario** was not hypothetical: 72 citations for 59 scenarios, and the
  collapse was needed at once.

## Origin note

Asked on 2026-10-09 by an agent working in a consuming project with pytest and TypeScript browser
tests, which already uses eess-ts and eess-md for its corpus gates and wants the scenario binding in
both directions, with two exempt tags (not built yet; built but not yet tested) reported when stale.
It was given the composition above as the supported route — corrected the same day from a
hand-written count guard to `.expectNonEmpty()` once that was measured, and told about the
many-to-one false red once that was — and will send the citation format it settles on. Sent
2026-10-10; see Consumer evidence.

## Review — 2026-11-01

**Ruling: Ship with changes**

Reviewed by the architect, product and enforcement lenses, each on its own reading of the code at
`bd78b962`, and each reached this verdict on its own. Enforcement put it as "not shippable as
written; ships with changes once open question 1 is decided". Ask A is the right seam: a seam over an
already-public type, with no pytest vocabulary in the API and no new builder
([ADR-006](../../adr/006-framework-rules-architecture.md)). Its input shape and three of its break
classes change before it is built. Ask B stops being a separate deliverable. The owning record is
[plan 0579](../plans/0579-crossvalidate-tests-in-any-language.md).

### Decided here, overrulable

Each is the review's call, stated so the maintainer can overrule it:

- **Open question 1: the citations come from code only.** All three lenses lean this way. The caller
  hands the presets a typed value; eess neither reads a declared file nor runs the supplier. Reading a
  file would publish a schema for good, need [ADR-005](../../adr/005-no-any-no-type-assertions.md)
  narrowing over `JSON.parse`, and make freshness eess's problem. Running the supplier would put eess
  in charge of execution, which [ADR-008](../../adr/008-caller-owns-reporting.md) and
  [ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md) lean against. Open
  question 3 then answers itself: freshness is the caller's by construction, said in one line of the
  docs.
- **The input is a source value, not a bare array.** It carries the sites, the supplier's errors
  (file, line, message) and a count of files read (Critical 1). The exact type is the plan's.
- **Ask B folds into A's docs**, as a section on what a producer must emit (Important 7).
- **The sub-path is not named `gherkin-tests`**, which a reader cannot tell apart from `gherkin-ts`.
  Product's candidate is `gherkin-citations`. The function names stay as they are, with no
  `…FromSites` family: the source varies, not the rules (in the spirit of
  [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md), and the
  `corpusFromText` precedent).

### Existing code survey, corrected

The proposal's citations into `packages/crossvalidate/src/gherkin-ts.ts` still hold; the file has
not changed since `47236ee`. Four things have changed since the proposal was written:

- [Bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) is fixed, so
  the one-way clause of the first cost bullet is history.
- The suffix resolution moved to `featurePaths()` (`packages/crossvalidate/src/shared.ts:54`, the
  kernel's `pathSuffixIndex`,
  [bug 0257](../bugs/fixed/0257-path-suffix-resolution-is-implemented-twice.md)). The proposal's
  `:107` now points at an orphaned comment.
- eess-gherkin now re-exports the receipt seam, but still not `correspondence`.
- [Proposal 016](./016-eess-py-a-python-dialect.md)'s Ask D is `Held` on this ruling.

What the survey found per part:

- **The input type already exists**: `TestCitationSite { title, file, line }`
  (`packages/crossvalidate/src/gherkin-ts.ts:58`), exported by
  [plan 0145](../plans/completed/0145-crossvalidate-stale-wip-detection.md).
- **The citation grammar and path resolution already exist.** The consumer's marker is exactly the
  default extractor's grammar, and a key relative to `features/` resolves through the unique-suffix
  index.
- **The evidence gate, several tests per scenario and stale exemptions already exist** in the three
  presets.
- **The only TypeScript-specific part is `itTitles(project)`**
  (`packages/crossvalidate/src/gherkin-ts.ts:85`). Everything after it reads sites, so Ask A is
  mechanically a refactor: lift the bodies onto sites, and let the TypeScript form call `itTitles`
  and then the shared core.
- **An entry point that does not import eess-ts is new.** The module imports eess-ts at runtime
  (`packages/crossvalidate/src/gherkin-ts.ts:9`). Measured: 0.28 s cold import against 0.04 s for
  eess-gherkin, plus about 36 MB of typescript and ts-morph for an adopter with no TypeScript.
- **Supplied input instead of a loader has a precedent:** eess-md's `corpusFromText`
  (`packages/md/src/corpus.ts:233`, [plan 0455](../plans/completed/0455-a-corpus-built-from-text.md))
  swaps the source, keeps the engine, and refuses with `ArchConfigError` whatever cannot behave the
  same.
- **A channel for "the source could not read" is new**, and the family shape for it exists:
  [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) and
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md).
  [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s `sourceEmpty` does not fit
  two of the three presets (Critical 1).
- **B's composition already exists as kernel parts** but is undocumented outside TypeScript, and it
  is a second mechanism for the presets' job.

### Placement

- **Nothing goes in `packages/core`.** "Scenario" and "test citation" are Gherkin and test words, and
  the kernel parts involved already exist. If the plan finds the error channel needs a new kernel
  finding kind, the kernel moves (a minor) under an
  [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) review; flag it at plan time.
- **Ask A is an eess-crossvalidate sub-path over a shared internal module.** This is all three lenses'
  lean on open question 2, which stays the maintainer's. `gherkin-ts.ts` becomes `itTitles` plus a
  call into the shared module, so the citation grammar and the presets' meaning keep one owner, and
  eess-gherkin's optional-peer floor stays where it is. eess-gherkin is workable, but its header gives
  pairings to crossvalidate, and the public types would have to move or exist twice.
- **Only `@nielspeter/eess-crossvalidate` moves**, as an additive minor. The `/gherkin-ts`
  signatures and verdicts do not change.

### Critical (must be settled before a plan is frozen)

1. **The missing-source break class has no carrier.** All three lenses found this. A bare
   `TestCitationSite[]` cannot tell "the extractor failed" from "the suite cites nothing". Measured by
   enforcement, about 1 s a run: `scenarioTestsResolve` gives `emitter/pass-without-evidence`, whose
   remedy ("declare it empty") turns the build green; `scenariosCovered` gives one "no test cites this
   scenario" per scenario in scope, sending the author to write tests that already exist
   ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2); `scenarioExemptionsCurrent` is
   green; and one unparsable test file whose citations are missing from the array leaves a stale
   exemption green. `sourceEmpty` beside `examined > 0` becomes `emitter/contradictory-evidence`
   (`packages/core/src/report.ts:148`, measured), so it fits `scenarioTestsResolve` only. **The
   change:** the supplied form takes a source value carrying sites, the supplier's errors and a count
   of files read. The consumer's own extractor already emits `{ files, citations, errors }`, so the
   shape is general, not one adopter's taste. Each error becomes a finding at that error's location.
   Zero files read is its own finding, cannot be suppressed and outranks `expectEmpty`. "The caller
   must fail first" is a convention, not a gate
   ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s "a required field,
   not a registry"). That the errors travel inside the input is the design.
2. **The proposal's own break class 4 is false** (see Corrections). It says an empty binding is never
   green. Measured by the architect (0.87 s) and enforcement: `scenarioExemptionsCurrent` with exempt
   scenarios and no citations is green, because `examined` is the exempt count
   (`packages/crossvalidate/src/gherkin-ts.ts:314-315`). Only the trio as a whole is red, through
   `scenariosCovered`. The class is stated per preset. The existing vacuity probe
   (`scripts/vacuity-matrix.mjs:408-413`) never exercises "exemptions present, citations absent".
   Making the criterion true for the TypeScript form too collides with the out-of-scope line "Any
   change to the TypeScript form", so the proposal says which form it covers.
3. **"Semantics unchanged" keeps a filter that is wrong for declared citations.**
   `if (cite === undefined) continue` (`packages/crossvalidate/src/gherkin-ts.ts:143`) is right for
   arbitrary `it()` titles. In the supplied form every element is an asserted citation. Measured: a
   malformed key citing an exempt scenario is dropped by all three presets, so a stale exemption is
   missed and the build is green; one citing a live scenario becomes a misattributed "no test
   cites". The consumer's JSON field is `key` and the type's is `title`, so passing the JSON straight
   through leaves `title` undefined and drops every citation. **Missing break class:** a supplied site
   that does not parse is a finding at its own `file:line`, and a malformed element is refused with
   `ArchConfigError` (the `corpusFromText` precedent, with
   [ADR-005](../../adr/005-no-any-no-type-assertions.md) type guards at the untyped boundary).
4. **A new question that blocks with open question 1: which ADR sets how many findings an error
   produces.** [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md)
   rule 3 gives one finding per instrument failure across rules;
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rules 4 and 5 give one
   per cause per rule, only where the verdict depends on it. Enforcement leans to [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s reading: an
   unreadable file is "cannot judge", and rule 4 replaces the misattributed "no test cites" with exact
   attribution. The choice decides whether one unparsable helper file blocks a coverage gate it cannot
   affect. This is the maintainer's, surfaced and not decided here.

### Important

1. **The polyglot union: export the TypeScript reader as a source.** The origin project has pytest
   and TypeScript tests, and coverage needs the union. Running the two forms separately gives
   `scenariosCovered` a false red on every scenario cited only by the other side. Ask A names two
   pieces: presets over a supplied source, and `itTitles` exported from `/gherkin-ts` as a source
   (for example `testCitationSites(project)`), so a caller passes one combined input. The
   `/gherkin-ts` presets then become sugar over the core.
2. **A buried binding decision: a verdict that rests on a program eess does not own.**
   [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md),
   [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md),
   [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) and
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) all assume eess or a
   family dialect owns the reader. Open: what a supplied side must carry for its pass to count as
   evidence, what eess checks and refuses, and what it cannot check and must say so. A supplier that
   greps text, the [bug 0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md) shape, would be
   accepted. [Proposal 016](./016-eess-py-a-python-dialect.md) inherits the same question. The
   architect recommends an ADR, or an explicit extension of
   [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md), rather than a plan section.
   Whether it is an ADR is the maintainer's call; if it is, the ADR comes before the plan freeze.
3. **The parity row is not a non-vacuity row.** "The supplied-side form and the TypeScript form
   report the same findings" is a tautology if one form calls the other, and it cannot see the skip
   difference: the TypeScript form counts `.skip`, while the consumer's extractor makes it an error.
   After Critical 3 the two forms must differ on a site that does not parse. It is replaced with one
   red fixture per break class against the supplied entry, in the `CLASSES` discipline of
   `scripts/nonvacuity/bad-gherkin-ts.mjs`; negative controls (two tests citing one scenario is green,
   an uncited exempt scenario is silent); sabotage rows (the core emptied, the errors channel dropped,
   the malformed-key refusal reverted to `continue`); and a `SIBLING_PROBES` entry per new export for
   "scenarios present, source empty or failed". The contract reads: every supplied site is a
   citation, and what counts as one is the supplier's decision.
4. **Tier honesty.** The supplied form is Tier 1 over the list it was handed. eess cannot prove the
   list is the suite: the consumer's static parse misses parametrized tests and marks applied at
   runtime. The docs say "binds the citations you supply" and "`examined` counts supplied
   citations", never "every test", and keep "cites, not exercises".
5. **"Must not require eess-ts" has no gate.** In this workspace eess-ts always resolves, so an
   import test cannot fail. The plan needs an arch rule over the new module's import closure, a
   decision on the type-only ts-morph import at `packages/crossvalidate/src/shared.ts:1` (split the
   module, or keep the new one to the neutral half), and the bookkeeping lists in
   `arch.internal.rules.ts` and `family.rules.ts`.
6. **A is written as the refactor, not a third copy.** `gherkin-ts.ts` and `md-gherkin.ts` already
   hold twin resolve loops. Folding md-gherkin in is outside this proposal: recorded, not bundled.
7. **Ask B is not a separate deliverable.** It documents a second mechanism for the presets' job; it
   cannot carry the supplier's errors (a `Selection` has no findings channel,
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) §6); and it needs a
   direct `@nielspeter/eess` install, against
   [plan 0089](../plans/completed/0089-family-standalone-sufficiency.md)'s standalone sufficiency.
   Its text also has measured errors: `.expectNonEmpty()` closes only the both-sides-empty case, and
   with live scenarios and a failed source it gives N misattributed findings; correspondence
   findings carry no `ruleId` unless `.rule({ id })` is set; and an exact-`relPath` key against a
   citation relative to `features/` reds every pair. So B becomes A's docs plus a section on what a
   producer must emit.
8. **A fail-open in today's TypeScript form, found along the way.** Zero citations on a zero-file
   eess-ts project, with `expectEmpty: true`, is green for `scenarioTestsResolve`, and for
   `scenariosCovered` when nothing is in scope. The presets never materialise the test source's
   emptiness fact, against [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) §3.
   Recorded as its own record,
   [bug 0584](../bugs/0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md),
   outside this proposal's scope. The supplied form's acceptance criteria state that it does not
   inherit this.

### Minor

- The shared module uses md-gherkin's `\0` key separator
  (`packages/crossvalidate/src/md-gherkin.ts:113`), not the space at
  `packages/crossvalidate/src/gherkin-ts.ts:136`, which can collide in principle.
- `TestCitationSite`'s doc comment is reworded from "one `it('…')` citation" to the citing text. The
  field names stay, since renaming one is a break. It says what a producer that cannot know a line
  passes, so nobody makes one up, and fixes one path form (or a declared root) for `file`: the
  TypeScript form gives absolute paths and a pytest supplier gives repository-relative ones.
- A dangling `.py` citation prints no Fix line today, because `violationsFor` takes no suggestion.
  The supplied form states its remedy: edit the marker at `file:line`, or restore the scenario.
- Break class 1 holds only for scenarios in scope (`include`). Say so, and keep the
  `haveUniqueTitles` pairing.
- The supplied form needs no `scenarioTestStats` twin: the caller holds the array.
- The docs use the generic fixtures already there (`checkout.feature`,
  `examples/cross-dialect.gherkin-ts.test.ts`). eess ships no pytest plugin or `conftest` helper,
  which would be a Python artifact and a runtime claim under
  [ADR-020](../../adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md).
- Dogfooding: this repository has no suite outside TypeScript, so the TypeScript form calling the core
  dogfoods only the shared core. Nothing here runs the errors channel, the zero-files finding or the
  malformed-key refusal live. Say so, and add an end-to-end fixture in the
  `scripts/nonvacuity/bad-crossval-gherkin-e2e.mjs` shape that feeds a JSON source through a real
  script.
- The correspondence many-to-one limit is a possible future proposal, not this one's.

### Corrections to the submission

Recorded here, not fixed in the text above:

- **Break class 4 is false as written.** "An empty binding — no scenarios, no citations, or both — is
  not green: the presets' existing evidence gate reports it." `scenarioExemptionsCurrent` with exempt
  scenarios and no citations is green (Critical 2). The class holds for the trio, not for each preset.
- **"Semantics unchanged" is wrong for supplied citations.** The `continue` that skips a title which
  is not a citation silently drops a malformed supplied citation (Critical 3).
- **The parity row cannot fail** if one form calls the other, and the two forms must differ once a
  malformed site is a finding (Important 3).
- **The Priority line's "no shipped preset is falsely green on this"** does not cover the TypeScript
  form's exemption-alone green or its `expectEmpty` green on a zero-file project (Critical 2,
  [bug 0584](../bugs/0584-scenario-tests-resolve-with-expect-empty-is-green-on-a-zero-file-project.md)).
- **The first cost bullet's one-way clause** is history since
  [bug 0400](../bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md) was fixed,
  and the Consumer evidence's `packages/crossvalidate/src/gherkin-ts.ts:107` citation now points at
  an orphaned comment; the resolution is at `packages/crossvalidate/src/shared.ts:54`.
- **Affects** names eess-gherkin as a possible home; under the placement above only
  eess-crossvalidate moves.

### Effect on [proposal 016](./016-eess-py-a-python-dialect.md)

[Proposal 016](./016-eess-py-a-python-dialect.md)'s Ask D stays `Held`. This ruling keeps 014's
out-of-scope line ("reading Python, or any other language, inside eess"), so its path through 014
does not become "pytest read by eess-py". It becomes "eess-py as one more optional producer for this
seam", with no consumer, because 014's consumer is served by its own extractor. "014 ruled" is
therefore not read as unholding D; D unholds only if the maintainer picks the Mermaid binding. The
trust decision in Important 2 applies to eess-py's subprocess boundary as well.

**Recommended next step:** [plan 0579](../plans/0579-crossvalidate-tests-in-any-language.md) owns
Ask A, with B as its docs. It carries the changes above: the source value with errors and a file
count, the malformed-site break class and refusal, break class 4 per preset, the exported TypeScript
source, per-class red fixtures with controls, sabotage rows and probes in place of the parity row,
and the tier and skip contract. It does not reach Ready until open question 2 and the error-count
question (Critical 4) are settled, and until the maintainer has said whether Important 2 is an ADR.
