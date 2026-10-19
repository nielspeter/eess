# Plan 0505: a field read inside a named section

## Status

- **State:** Done — built on maintainer order 2026-10-19 (`680dcf0`), in the pull request that
  builds plans 0496 and 0503 (see "Build notes"). Written 2026-10-19 in PR #247, from
  [proposal 017](../../proposals/017-md-blocks-to-check-a-documents-shape.md)'s consumer follow-up
  (adopter 3's 51 records) and PR #247's method review (I2: the need had no home).
- **Implements:** proposal 017
- **Priority:** Medium — adopter 3's one concrete need from the section work: 51 of its records hold
  `- **State:**` under a `## Status` heading with no colon, and `haveField` reports each as "no
  field" today. Its place in this release batch is the coordinator's call (2026-10-19), made from
  PR #247's method review; the maintainer's question offered adopter 3 its section-scoped box rule,
  not this region, so it can be overruled.
- **Effort:** Small. One more value of `FieldOptions.region`, read through the same three places the
  header region is (the reader, the resolver, the unnamed-form scan), and one cause.
- **Created:** 2026-10-19
- **Builds after:** [plan 0496](./0496-sections-as-elements.md) (the section extents, `sectionsOf`).

## Problem

Plan 0468's `region: 'header'` (`packages/md/src/model/fields.ts:50`) reads a field only before the
first section. A record whose field lives **in** a section, such as `- **State:** open` under
`## Status`, has no way to say so: read over the whole document, a later `- **Status:** open` in a
feedback register is a conflict; read in the header, the field is absent. Plan 0469 deferred "any
region other than the header (a named section, for example)" to block 11, which plan 0496 builds.

## Design

```ts
fields(c, { label: 'State', forms: ['bold'], region: { section: 'Status' } })
docs(c)
  .should()
  .haveField({ label: 'State', forms: ['bold'], region: { section: 'Status', depth: 2 } })
```

- **`region: 'header' | { section: string | RegExp; depth?: number }`.** The section is matched as
  `haveSection` matches it (plan 0496's matcher, `g`/`y` stripped). The field is read in the body of
  every matching section: from the line after its heading to its `endLine`, subsections included.
- **The same three places** as the header region, so one region bounds them all: `fieldLines`
  (`packages/md/src/model/fields.ts:168-178`) cuts the lines, the resolver reads only those
  occurrences, and the unnamed-form scan is bounded the same way (plan 0469's adopter-3 lesson: 67
  per-phase status lines would each be a finding otherwise).
- **Two matching sections** are two places the field may be: their occurrences go to the resolver as
  they are, so two structured values are a conflict at both lines, as anywhere.
- **Causes, one each:**
  - **no such section:** `work/bugs/0001.md: no section "Status" to read State from (region)`, its
    own cause, never "no field"; with `depth`, a section of the name at another depth is named;
  - **outside the region:** a structured occurrence of the label outside every matching section is
    reported as plan 0469's "outside the header" is, worded for the section;
  - a heading of the name inside a container: the region records its section name in plan 0496's
    section-name registry, so 0496's scan names it, in the documents the rule can see.
- **Bug 0471** (the header read past a label-shaped heading) is the header region's; a section region
  ends where the section ends, so it does not have that limit.

## Dogfood

`check:corpus`'s `corpus/state-present` (plan 0469) reads the whole record. Measured 2026-10-19 with
eess-md's own `fields()` over the live plans and bugs (`work/plans/*.md`, `work/bugs/*.md`, the
boards excluded), on PR #247's tree after `aec17fc`: 227 records, every one with each of its
bold `State` values inside `## Status`, none outside, none without one (PR #247's method review
counted 226 at `aec17fc`, before bug 0507 was filed). The command:

```sh
node --input-type=module -e "
import { corpus, fields } from '@nielspeter/eess-md'
const c = corpus({ roots: ['work/plans/*.md', 'work/bugs/*.md'] })
const recs = c.documents().filter((d) => !/ROADMAP|BUGS/.test(d.relPath))
const sel = fields(c, { label: 'State', forms: ['bold'] }).select({ label: 's', identify: (t) => ({ key: t.doc.relPath + ':' + t.line }) }).elements
let inside = 0, outside = 0, none = 0
for (const d of recs) {
  const hits = sel.filter((t) => t.doc === d)
  if (hits.length === 0) { none++; continue }
  const lines = d.text.split('\n'), hs = d.sections, i = hs.findIndex((h) => h.name === 'Status')
  let end = lines.length; if (i >= 0) for (let j = i + 1; j < hs.length; j++) if (hs[j].depth <= hs[i].depth) { end = hs[j].line - 1; break }
  if (i >= 0 && hits.every((t) => t.line > hs[i].line && t.line <= end)) inside++; else outside++
}
console.log({ records: recs.length, stateInsideStatus: inside, outside, noState: none })"
```

The rule gains `region: { section: 'Status' }`, so a State written outside the Status section reds,
with a non-vacuity row moving one bug's State line below `## Symptom`.

## Phases

1. The region option through the reader, the resolver and the scan; the two causes.
2. The dogfood rule, its non-vacuity row, an example (`examples/md/a-record-states-its-status-in-a-section.test.ts`
   with a clean and a violating fixture per cause), docs, a changeset.

## Files changed

- `packages/md/src/model/fields.ts`, `packages/md/src/model/field-resolve.ts`,
  `packages/md/src/model/field-unread.ts`, `packages/md/src/builders/field-findings.ts`
- `packages/md/tests/builders/have-field.test.ts`, `packages/md/tests/fields.test.ts`
- `examples/md/a-record-states-its-status-in-a-section.test.ts` and its fixtures (new)
- `scripts/check-corpus.mjs`, `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`, `docs/markdown.md`
- `.changeset/md-field-section-region.md` (new)

## Test inventory

- adopter 3's shape: `## Status` with `- **State:** open`, then a feedback register of
  `- **Status:** open` items under `## Feedback`: resolves to `open` with `region: { section: 'Status' }`,
  conflicts without a region;
- no `## Status` section: the "no such section" cause, not "no field";
- `## Status` at depth 3 under `depth: 2`: the cause names the depth;
- a State under `## Symptom`, outside the region: reported;
- two `## Status` sections with different values: a conflict at both lines;
- the unnamed-form scan bounded: `## State: open` outside the section is not a finding under the
  region;
- a `g`-flagged section name reads every record.

**Sabotage rows**, each red on its named test: the region ignored (the register row reds); the
"no such section" cause folded into "no field" (its row reds); the scan left unbounded (the scan row
reds).

## Release

`@nielspeter/eess-md` minor, additive: `FieldOptions.region` accepts `{ section, depth? }`.

## Out of scope

- A region by label (a field inside a labelled block): no adopter has asked.
- The header region's bug 0471.

## Build notes — 2026-10-19

Built on maintainer order 2026-10-19. Decisions taken against the record, each so it can be
overruled:

- **The region is a type, `FieldRegion`.** A section region keeps the document's line numbers: the
  reader blanks every line outside the matching sections' bodies (`fieldLines`,
  `packages/md/src/model/fields.ts`), so a value cannot continue past a section's end and every
  finding keeps its real line.
- **"No such section" is an `absent` cause**, like "no field": as a condition it is reported with its
  own message; as a selector (`predicateHaveField`) such a document is not selected, rather than
  undecided. A section name that matches no heading anywhere is caught the way a misspelt label is,
  by the guard rule and by the section-name scan's near miss.
- **The section name is recorded for plan 0496's scan** on the `haveField` predicate and condition
  objects, and on `fields()` through a builder hook (`ownSectionDeclarations`), so a `## Status`
  inside a list item is named. When the condition's own "no section" finding already names that
  heading, the scan does not repeat it.
- **A region that is neither `'header'` nor `{ section }`**, or a section region with a depth outside
  1 to 6, is refused with an `ArchConfigError` at `fields()` and `haveField`: a typo would otherwise
  read the whole document.
- **Tests** are in a new file, `packages/md/tests/builders/field-section-region.test.ts`, not the two
  the plan names. Red first: written before the region existed, 7 of its 9 rows were red; the
  two-sections conflict and the `g`-flag rows passed, because the whole-document read gave the same
  answer. Sabotage row 6 then survived on the `g`-flag row, which was rewritten (`63d6f17`) so its
  headings are read consecutively; it reds now.

Measured with eess-md's own build: `corpus/state-present` over the live plans and bugs examines 229
records and reports 0, without the region and with `region: { section: 'Status' }` (the plan counted
227 at `aec17fc`; records were added since). The new non-vacuity row
(`corpus/state-present-outside-status`) was checked by hand before it was committed: a probe with its
State under `## Symptom` gives exactly `State at line 9 is outside the "Status" section (region); …`.

**Sabotage**, run 2026-10-19 on the pre-rebase originals of `680dcf0` (row 6 again on `63d6f17`'s), each red on its named test in
`field-section-region.test.ts`, 5.4 s:

| row | mutant                                         | red (named test)                                |
| --- | ---------------------------------------------- | ----------------------------------------------- |
| 1   | `fieldLines` ignores a section region          | adopter 3's shape resolves inside the section … |
| 2   | the "no section" cause folded into "no field"  | no such section is its own cause …              |
| 3   | the unnamed-form scan reads the whole document | the unnamed-form scan is bounded by the region  |
| 4   | a value outside the section not reported       | a State outside the section is reported …       |
| 5   | `fields()` records no region name for the scan | a Status heading inside a list item is named …  |
| 6   | the region's matcher keeps `g`/`y`             | a g-flagged section name reads every record     |

## Progress ledger

- [x] Phase 1: the section region and its two causes
- [x] Phase 2: dogfood (229 records, 0 before and after), non-vacuity row, example, docs, changeset
- [x] Sabotage rows, each red on its named test; 5.4 s
- [ ] `check:corpus`, `check:nonvacuity`, `check:examples`, `check:release` and `npm run validate`
      green — validation-owed: validate and CI at the pull request's merging head, recorded in the pull request's description
- [x] Close: this plan → `completed/`; ROADMAP and proposal 017's row

Deferred: none
