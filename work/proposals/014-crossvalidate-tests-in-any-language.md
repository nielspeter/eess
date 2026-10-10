# Proposal 014 — crossvalidate: the scenario presets take a test side from any language

**State:** Draft — filed 2026-10-09 after an inbound question; not reviewed.
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
exempt tags honoured and reported when stale, and a pass that is built from evidence (ADR-010).

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
  exported by plan 0145 "so a consumer can report a citation's own location". What is private is
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
  that gate by design — it is an absence assertion (ADR-010;
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
  [0400](../bugs/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)).
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
  empty list (ADR-009). How it is supplied is open question 1.
- **Not a finding:** two tests citing one scenario.
- **Non-vacuity:** a fixture row for each break class, plus a row proving the supplied-side form and
  the TypeScript form report the same findings for the same citations.

**B — the documentation.**

- **Break class:** the documented composition stops reporting what it says it reports. The fence
  type-checks under `check:docs-code`, which runs nothing (`scripts/check-docs-code.mjs:27`), so the
  composition also runs as an example test under `check:examples` (`examples/`, run by vitest),
  asserting that an empty binding is red and that two tests citing one scenario are not.

## Open questions

1. **Where the citations come from.** eess extracts from source it parses (ADR-002, ADR-007); it does
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
- Bug 0400's one-way count, which has its own record.

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
  grep bug 0135 warns about.
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
