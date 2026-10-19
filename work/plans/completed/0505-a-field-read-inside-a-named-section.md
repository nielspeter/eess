# Plan 0505: a field read inside a named section

## Status

- **State:** Draft — written 2026-10-19 in PR #247, from
  [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s consumer follow-up
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

## Progress ledger

- [ ] Phase 1: the section region and its two causes
- [ ] Phase 2: dogfood, non-vacuity row, example, docs, changeset
- [ ] Sabotage rows, each red on its named test; durations reported
- [ ] `check:corpus`, `check:nonvacuity`, `check:examples`, `check:release` and `npm run validate`
      green; durations reported
- [ ] Close: this plan → `completed/`; ROADMAP and proposal 017's row

Deferred: none
