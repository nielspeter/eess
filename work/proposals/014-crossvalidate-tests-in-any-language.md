# Proposal 014 — crossvalidate: the scenario presets take a test side from any language

**State:** Draft — filed 2026-10-09 after an inbound question; not reviewed.
**Priority:** Medium — no shipped rule is falsely green on this. A project whose tests are not
TypeScript cannot use the scenario presets at all, and the composition it must write instead is
green on an empty binding unless the author remembers a declaration.
**Origin:** inbound · consuming project (Python, pytest). Verified here: the composition below was
measured on a fixture in this repo; the consumer's own test suite was not run here.
**Affects:** `@nielspeter/eess-crossvalidate` (the scenario presets); possibly
`@nielspeter/eess-gherkin` (where the presets live, see Open questions).

## Problem

Gherkin is language-neutral; the presets that bind it to tests are not. A consuming project whose
tests are pytest functions wants what a TypeScript project gets from the scenario presets: every
scenario in `features/*.feature` cited by a test, every citing test pointing at a real scenario,
`@wip` exempt, and a pass that is built from evidence (ADR-010).

It cannot have them. Its citations live where its tests live — a `@pytest.mark.scenario("…")`
marker, a docstring, a test id — and nothing in eess reads those. Each of the four presets reads its
test side from a TypeScript project and from nothing else.

## Existing code survey

- **The presets read TypeScript only.** `@nielspeter/eess-crossvalidate/gherkin-ts`
  (`packages/crossvalidate/package.json:27`) exports `scenarioTestsResolve`
  (`packages/crossvalidate/src/gherkin-ts.ts:130`), `scenariosCovered` (`:246`),
  `scenarioExemptionsCurrent` (`:305`) and `scenarioTestStats` (`:339`). Each takes an eess-ts
  project; `itTitles` (`:85`) walks it with `calls()` for `it`/`test` call titles. The module imports
  `@nielspeter/eess-ts` at runtime (`:9`), so importing a preset requires it.
- **The only hook parses a title.** `extract?: TestCitationExtractor` (`:35`, `:40`, `:286`) turns a
  TypeScript test title into a citation. It cannot supply a different test side.
- **The kernel can already join any two string lists.** `correspondence()` is public
  (`packages/core/src/index.ts:68`); a side is a plain `{ label, elements, identify }`, so a list of
  citation strings is a valid side, and eess-gherkin's `features().scenarios()` is the other. eess-gherkin
  does not re-export `correspondence`, so a consumer adds `@nielspeter/eess` directly.
- **The presets carry evidence the raw composition does not.** The presets end in `finishPreset`,
  whose evidence gate reports a binding that examined nothing. A `correspondence().beComplete()` is
  exempt from that by design: it is an absence assertion (ADR-010;
  `packages/core/src/correspondence.ts:157`), so an empty binding is green unless the author adds
  `.expectNonEmpty()`.

## Measured: the composition with released parts

A fixture of one feature with three scenarios, one tagged `@wip` (tags are stored without `@`), and
a hand-built citation list on the right — the shape a pytest hook would dump to JSON. Run against
this repo's built kernel and eess-gherkin, `correspondence({ left: scenarios without @wip, right:
citations, keyBy: relPath › title }).should().beComplete({ direction: 'both' })`:

| Case                                         | Result                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| every live scenario cited                    | green, `examined` 4                                             |
| one scenario uncited                         | 1 finding: the scenario "has no matching test citation"         |
| a citation to a scenario that does not exist | 1 finding: the citation "has no matching scenario"              |
| a citation to the `@wip` scenario            | 1 finding, read as a citation to nothing                        |
| no citations at all                          | 1 finding per scenario                                          |
| both sides empty                             | **green, `examined` 0**                                         |
| both sides empty, with `.expectNonEmpty()`   | 1 finding: "declared .expectNonEmpty() but examined zero units" |

So the composition works, and its one hole — an empty binding — closes only if the author knows to
declare it. With a one-way direction even that declaration does not close it: an empty checked side
is not reported (bug [0400](../bugs/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md)).
A `@wip` exemption is also hand-made: filtered off the left, a test citing a `@wip` scenario becomes
a dangling citation, where `scenarioExemptionsCurrent` would say what is wrong.

## Asks

- **A — the scenario presets take a test side that is not a TypeScript project.** The same checks —
  every citation resolves, every scenario is covered, exemptions are current, counts — over a list of
  citations the caller supplies (a citation string, and where it came from: file, line, test name),
  with the presets' evidence gate and their exemption handling unchanged. Importing this form must
  not require eess-ts.
- **B — document the composition until A ships.** `docs/crossvalidate.md` shows the measured
  composition for a non-TypeScript suite, with `direction: 'both'` and `.expectNonEmpty()`, and says
  why both are required.

## Acceptance criteria

**A — the presets over a supplied test side.**

- **Break class:** a scenario no citation names is reported, with the scenario's file and line.
- **Break class:** a citation naming no scenario is reported, at the citation's own file and line
  when the caller supplied them.
- **Break class:** an exempt (`@wip`) scenario that a citation names is reported by the exemption
  check, not as a citation to nothing.
- **Break class:** an empty binding — no scenarios, no citations, or both — is not green: the
  presets' existing evidence gate reports it, with no declaration needed.
- **Non-vacuity:** a fixture row for each break class, plus a row proving the supplied-side form and
  the TypeScript form report the same findings for the same citations.

**B — the documentation.**

- **Break class:** a documented fence that does not compile or no longer reports. The fence runs
  under `check:docs-code`.

## Open questions

1. **Where the citations come from.** eess extracts from source it parses (ADR-002, ADR-007); it does
   not parse Python. The likely shape is that the consumer's own test runner produces the list
   (a pytest `conftest.py` hook over `--collect-only`, writing JSON) and eess reads a declared file
   or takes the list in code. Reading `.py` files with a pattern instead is a text grep — the shape
   bug [0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md) found cannot go red.
2. **Where the presets live.** They sit in `/gherkin-ts` because their test side is eess-ts. A
   supplied-side form needs no eess-ts; it could be a sibling sub-path of eess-crossvalidate, or
   belong in eess-gherkin itself, which already owns the scenario side.
3. **A list that is itself stale.** A citations file the build does not regenerate can be green on
   last week's tests. Whether the presets should check its freshness, or document that the caller's
   build owns it, is undecided.

## Out of scope

- Reading Python, or any other language, inside eess.
- Any change to the TypeScript form of the presets.
- Bug 0400's one-way count, which has its own record.

## Origin note

Asked on 2026-10-09 by an agent working in a consuming project with pytest tests, who already uses
eess-ts and eess-md for its corpus gates and wants the scenario binding in both directions with
`@wip` exempt. It was given the composition above as the supported route, corrected the same day
from a hand-written count guard to `.expectNonEmpty()` once that was measured, and will send the
citation format it settles on.
