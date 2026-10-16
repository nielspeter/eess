# Proposal 017 — md: a record is checked against its type's schema

**State:** Draft — filed 2026-10-16 at the maintainer's request; not reviewed.
**Priority:** Medium — every corpus that follows the working method needs it, and no eess package
provides it, so each adopter writes it by hand and this repository does without it. No shipped rule
claims to check a record's fields, so nothing over-claims today; the gap is that the method's
records have no schema anyone enforces.
**Origin:** inbound · two adopter monorepos, verified here. The maintainer asked whether an
adopter's hand-written record tools duplicated eess; reading them, and the plan the first adopter
built them from, showed they fill a gap in eess instead.
**Affects:** `@nielspeter/eess-md` (a field element, conditions on documents, the ledger's label),
the working-method kit (`kit/`), and this repository's own `work/` gates.

## Problem

The working method ([docs/working-method.md](../../docs/working-method.md), the `kit/`) keeps work
as Markdown records: a plan, a bug, a proposal, each with a header of labelled fields
(`**State:** Draft — …`, `**Severity:** Medium`) and named sections (`## Problem`, `## Fix`). A
record type has a shape: which fields it carries, which values each may take, which sections it
needs, sometimes depending on a field (a fixed bug needs a Verification section). eess-md checks
the parts of a record that link to something: links, code pointers, ADR tables, and with
`honestyAtClose` whether a closed record hides an open box. It does not check the shape. A record
missing its Severity, or carrying `State: Open — Åben` where the vocabulary is `Status: åben`, is
green.

## Measured

**An adopter built the schema on eess-md, and recorded what it could not use.** Its plan (done
2026-08-30, five review rounds, against eess-md 0.3.0) is a declarative record schema, one per lane,
about 450 lines in `tools/corpus-schema.ts` plus about 1,400 more in checkers around it. Each schema
names: the folder it classifies and files it exempts; a pattern for the H1, or for the filename;
required fields, each either an allowed-value set or a pattern, with a value extractor; required
sections as groups of synonymous names written as patterns; sections required only when a field has
certain values; and one section that must hold at least one live `file:line` pointer. Its first run
against its own live corpus found **136 violations** where about 10 were expected, fixed one record
at a time. The gaps it measured in eess-md, each re-checked here against `main`:

1. **No per-document field reader.** `terms()` and `vocabulary()`
   (`packages/md/src/builders/vocabulary.ts:87`) read a label across the whole corpus and test set
   membership only; there is no pattern condition, and a check scoped to one document has to
   reassemble the corpus-wide result. The adopter called it a scoping trap, the class it had also
   hit with `rows()`, and wrote a regex per field instead. Its value extractor then grew three bugs
   of its own (an emoji-only value emptied, a value opening with a delimiter emptied, a parenthesised
   value half-stripped), found by its tests and review.
2. **`haveSection` has no depth and cannot test the title.** `haveSection(name)`
   (`packages/md/src/conditions/structure.ts:7`) matches a heading at any level; "the H1 matches
   this pattern" is not expressible. `MdSection` carries `depth` (`packages/md/src/model/document.ts:10`),
   so the data is there. The adopter's first draft also wrote its section patterns with `##` in
   them, which `MdSection.name` never contains: run as drafted it would have reported every record.
3. **The ledger's label is fixed.** `honestyAtClose` reads `State:` only
   (`packages/md/src/rules/ledger.ts:151`). Three of that adopter's four lanes use `Status:`, so the
   ledger's state checks never ran on them, and it rebuilt the two-way state↔folder check that
   `honestyAtClose` already has for `State:`. Its default closed folders
   (`packages/md/src/rules/ledger.ts:96`) and `corpus()`'s default frozen globs are two lists that
   nothing keeps in agreement.
4. **No public way to build a document from text.** `buildDocument()` is not exported, so its tests
   build `MdDocument` literals by hand, which works only while the code under test never reads
   `.root` or `.tables`.

**A second adopter ported a thinner copy**, a regex field reader, hand-built `ArchViolation`s, its
own non-vacuity count, and `Status:` again, which is how this proposal came up.

**This repository has the same gap.** CLAUDE.md prescribes a plan format ("Status/Priority/Effort
header, Problem section, … Test inventory, Out of Scope section"), and no gate checks it. Measured
2026-10-16 over `work/plans/**` and `work/bugs/**`, with these exact names: of 304 bug records, 45
carry no `**Severity:**` line, 54 no `**Origin:**` line and 72 no section named "Root cause"; of 58
plans, 31 carry no section named "Test inventory". Some of those use another name for the same
thing, which is itself what a schema would surface. And this repository hand-reads two header
fields in a script of its own: `scripts/lib/proposal-ruling.mjs` matches `**Ruling:**` and
`**Implements:**` with its own label prefix (`scripts/lib/proposal-ruling.mjs:169`), beside eess-md's
label grammar.

## Existing code survey

- **The label grammar exists, in one place.** `packages/md/src/model/label.ts` (plan 0405) is the
  one reader of `**Label:**`, `**Label**:`, `__Label__:` and `Label:`, shared by the ledger's
  `State:` reader and `links().areLabelled()`. A field element should be built on it, not beside it.
- **Fence-aware prose exists.** `proseText(…, 'closed-fences', …)`, used by `terms()`, keeps a
  label inside a fenced example from being read (bug 0287). The ledger's state reader skips code
  too (`ledger/state-in-code`).
- **Sections exist with depth.** `MdDocument.sections` (`{ name, depth, line }`) and
  `docs().that().resideInFolder(…).should().haveSection(…)`, which already takes a `RegExp`, so a
  synonym group is a regex alternation today.
- **Placement exists.** `honestyAtClose` checks both directions of state↔folder (a terminal state
  outside a done folder, a done-folder record whose state is not terminal), for `State:` only.
- **Value normalisation exists twice.** The ledger strips emphasis and a leading symbol from a
  state value (`WRAP`, `packages/md/src/rules/ledger.ts:154`), and `terms()` has its own default
  (`packages/md/src/builders/vocabulary.ts:97`). Neither is the other.
- **Links by section exist; pointers by section do not.** `links().areInSection()` exists;
  `pointers()` has `areLive()` and `areFrozen()` only.
- **Not in eess:** a field element; a field-value predicate on documents; a title or filename
  condition; a section requirement conditional on a field; a configurable ledger label.

## Asks

**A. A record's header fields are elements.** `fields(corpus)` selects every labelled field of
every document, read with the one label grammar, outside fenced code. Each element carries its
document, label, raw text, normalised value and line, and reports its own line. Conditions:
`beOneOf(values)`, `match(pattern)`. A document-level condition `haveField(label)` reports a missing
field once per document, so a required field is one rule. One value normaliser, shared with the
ledger, with a caller hook.

**B. A document's structure can be conditioned on its fields.** A predicate
`docs().that().haveFieldValue(label, valuesOrPattern)`, so "a fixed bug has a Verification section"
is `docs().that().resideInFolder('work/bugs/**').and().haveFieldValue('State', ['Fixed'])
.should().haveSection(/^Verification/)`; `haveSection` gains an optional depth, and a `haveTitle`
condition tests the H1; `pointers()` gains `areInSection()`, so "this section holds a live pointer"
composes from existing pieces.

**C. The ledger reads the lane's own label.** `honestyAtClose` takes the state label (`State` by
default), so a `Status:` lane gets the placement and box checks without a hand-built copy. Whether
one lane declaration should also be the single source of `frozen` and the closed folders is an
open question below.

**D. A public way to build a document from text**, for adopters' tests, so a fixture is never a
hand-written literal that silently lacks fields.

**E. The kit ships a record-schema preset, and this repository uses it first.** Built from A–C, it
checks `work/plans` and `work/bugs` against the format CLAUDE.md prescribes. Its first run is in
report mode and its findings are fixed or the schema corrected one by one, never widened to go
green; the adopter's plan records exactly that discipline, and the maintainer's correction of an
early drift towards widening.

## Acceptance criteria

- [ ] Each new condition has a non-vacuity row: a missing field, a value outside the set, a value
      failing the pattern, a missing conditional section, a wrong H1 and a section without a live
      pointer each red a fixture, and a rule that examines no field fails.
- [ ] A field inside a fenced example is never read, proven by a fixture.
- [ ] The value normaliser has one owner, with the three value shapes that broke the adopter's
      extractor (emoji-only, delimiter-first, parenthesised) as tests.
- [ ] `honestyAtClose` with `label: 'Status'` reports a `Status:` lane's misplaced record, in both
      directions.
- [ ] This repository's plans and bugs pass the kit preset, and the run that got them there is
      recorded with every finding's disposition.
- [ ] `scripts/lib/proposal-ruling.mjs` reads `Ruling` and `Implements` through `fields()`, or the
      record says why it cannot.

## Open questions

- **Where does a header end?** The ledger reads its `State:` from the preamble and first section; a
  field element could read the same span, or the whole document with the label at the start of a
  line. The first is stricter and matches the method; the second finds fields a record grew lower
  down.
- **Bold labels or YAML frontmatter, or both?** The method uses bold labels. Frontmatter is the
  common alternative elsewhere, and eess-md already parses it (and stopped reading it as a section,
  bug 0087).
- **Is one lane declaration the single source** of a lane's folder, closed folders, state label,
  states and frozen globs, read by `corpus()`, `honestyAtClose` and the schema alike? It would end
  the two unsynchronised lists, and it is a larger change than C.
- **Synonym groups as data or as regex?** A regex alternation works today; a list of names gives a
  better message ("missing one of: Symptom, Problem, Repro").
- **Kernel or dialect?** Fields are Markdown records, so eess-md. Whether a record schema is a
  concept another dialect would want (a Gherkin feature's tags, a YAML document's keys) is the
  architect's question.

## Out of scope

- **A temporal drift check** (a bug's cited files changed after its "last updated" date). The first
  adopter built one, run weekly in report mode; it is a separate capability with its own design
  (git history in CI needs full depth) and would be its own proposal.
- **`corpus()`'s cost.** The second adopter measured `corpus()` at about 1.4 s for 363 files, almost
  all of it the syntax-tree parse, and `ignore` does not skip the walk its documentation says it
  does. That is a bug and a performance question of their own, recorded separately.
- **The kit shipping runnable gate scripts** for what exists today (`check:ledger`,
  `check:corpus`). Independent of this proposal and useful before it; its own plan.
- **The first adopter's future ideas** (an impact oracle over a diff, a corpus query tool, a check
  tying each PR to a record, an MCP server). Product input, not asks here.
