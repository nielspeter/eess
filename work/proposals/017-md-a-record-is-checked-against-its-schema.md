# Proposal 017 — md: a record is checked against its type's schema

**State:** Draft — filed 2026-10-16 at the maintainer's request; revised the same day with a third
adopter's evidence; not reviewed.
**Priority:** Medium — every corpus that follows the working method needs it, and no eess package
provides it, so each adopter writes it by hand and this repository does without it. No shipped rule
claims to check a record's fields, so nothing over-claims today; the gap is that the method's
records have no schema anyone enforces.
**Origin:** inbound · three adopter monorepos, verified here. The maintainer asked whether
adopters' hand-written record tools duplicated eess; reading them showed they fill a gap in eess
instead. The adopters are named here only as adopter 1, 2 and 3.
**Affects:** `@nielspeter/eess-md` (a field element, conditions on documents, the ledger), the
working-method kit (`kit/`), and this repository's own `work/` gates.

## Problem

The working method ([docs/working-method.md](../../docs/working-method.md), the `kit/`) keeps work
as Markdown records: a plan, a bug, a proposal, each with a header of labelled fields
(`**State:** Draft — …`, `**Severity:** Medium`) and named sections (`## Problem`, `## Fix`). A
record type has a shape: which fields it carries, which values each may take, which sections it
needs, sometimes depending on a field (a fixed bug needs a Verification section). eess-md checks
the parts of a record that link to something: links, code pointers, ADR tables, and with
`honestyAtClose` whether a closed record hides an open box. It does not check the shape. A record
missing its Severity, or carrying `State: Open` in a lane whose vocabulary is `Status: open`, is
green.

## Measured

Three adopters built record checks on eess-md. Each finding below that names eess-md was re-checked
against `main`; what is only the adopter's measurement says so.

**Adopter 1 built a declarative schema** (done 2026-08-30, five review rounds, on eess-md 0.3.0):
about 450 lines of schema plus about 1,400 of checkers around it. Each lane's schema names the
folder it classifies and the files it exempts; a pattern for the H1, or for the filename; required
fields, each an allowed-value set or a pattern, with a value extractor; required sections as groups
of synonymous names written as patterns; sections required only when a field has certain values;
and one section that must hold a live `file:line` pointer. Its first run on its own corpus found
136 violations where about 10 were expected, fixed one record at a time.

**Adopter 2 ported a thinner copy**: a regex field reader, hand-built `ArchViolation`s and its own
non-vacuity count.

**Adopter 3 writes every check as an eess rule** (an ADR of its own requires it; eess 0.6.0,
eess-md 0.8.0): about 9,500 lines in all, with `docs()`, `links()` and `taskItems()` builders, but
almost every judgement inside them a hand-written condition. It probes its own rules with a port of
this repository's sabotage harness (31 probes).

**The gaps they measured, each re-checked here:**

1. **No per-document field reader.** `terms()` and `vocabulary()`
   (`packages/md/src/builders/vocabulary.ts:87`) read a label across the whole corpus and test set
   membership only; there is no pattern condition and no live/frozen scope. Adopter 1 called it a
   scoping trap and wrote a regex per field; adopter 3 tried `terms()` first and measured 240
   findings on its bugs alone, 205 of them in frozen folders, before writing its own. Their value
   extraction then broke in the same places: adopter 1's extractor emptied an emoji-only value, a
   value opening with a delimiter and a parenthesised one; adopter 3 needed three normalisers,
   because one rule (the first word) turns `P1` into `P` and reads `6` as empty.
2. **The field forms are wider than eess-md's label grammar.** eess-md has one grammar,
   `packages/md/src/model/label.ts:45` (`**Label:**`, `**Label**:`, `__Label__:`, `Label:`).
   Adopter 3's dominant form is a heading used as a field, `## Status: open`: by its measurement,
   1,066 of its 1,249 bug records write `## Status:`, and the grammar reads 162 of them. One record
   mixes forms (`## Status:` beside `**Found:**`). It also needs aliases (`Status` or `State`) and
   fields that are required in one lane and checked only when present in another. 44 of its records
   carry their first Status line past line 20, so a reader limited to the header's first lines
   misses them.
3. **`haveSection` has no depth and cannot test the title.** `haveSection(name)`
   (`packages/md/src/conditions/structure.ts:7`) matches a heading at any level, though `MdSection`
   carries `depth` (`packages/md/src/model/document.ts:10`). All three adopters test the H1 by hand.
   Adopter 1's first draft also wrote its section patterns with `##` in them, which `MdSection.name`
   never contains; run as drafted it would have reported every record.
4. **The ledger is all or nothing.** `honestyAtClose` reads `State:` only
   (`packages/md/src/rules/ledger.ts:151`); its options (`ledger.ts:48`) offer no other label, no way
   to run its state, box and placement halves apart, and no live-only scope. Adopters 1 and 3 use
   `Status:` in most lanes, so the state half never ran on them, and both rebuilt the two-way
   state↔folder check `honestyAtClose` already has. Adopter 3 also has a folder that is neither live
   nor closed (`parked/`: kept, but bound to one state) and found that requiring a positive done
   marker flagged 10 correctly closed records, so it judges only the unambiguous contradiction.
5. **Lane facts live in several lists that disagree.** Adopter 3 keeps four lists of closed folders
   (between two and five folders each) and two of exempt index files; adopter 1 kept two. In eess,
   `honestyAtClose`'s default done folders (`ledger.ts:96`) and `corpus()`'s default frozen globs are
   two lists nothing keeps in agreement.
6. **No public way to build a document from text.** `buildDocument()` is not exported, so adopter 1
   builds `MdDocument` literals by hand, which works only while the code under test never reads
   `.root` or `.tables`. Adopter 3 writes fixtures to a temporary directory and calls
   `corpus({ cwd })` instead, and pays for it in time: its corpus rules take 6 min 39 s in CI.

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

- **One label grammar exists** in `packages/md/src/model/label.ts` (plan 0405), shared by the
  ledger's `State:` reader and `links().areLabelled()`. A field reader extends it rather than sits
  beside it; it does not read a heading as a field today.
- **Fence-aware prose exists.** `proseText(…, 'closed-fences', …)`, used by `terms()`, keeps a label
  inside a fenced example from being read (bug 0287), and the ledger's state reader skips code
  (`ledger/state-in-code`). Adopter 3's own reader does not skip fences, and is right on its corpus
  only because its one fenced `## Status:` sits in an excluded board file.
- **Sections exist with depth**, and `haveSection` already takes a `RegExp`, so a synonym group is
  a regex alternation today. Adopter 3 uses `haveSection` as shipped.
- **Placement exists**, in both directions, for `State:` only, inside `honestyAtClose`.
- **Value normalisation exists twice**, in the ledger (`WRAP`, `packages/md/src/rules/ledger.ts:154`)
  and in `terms()` (`packages/md/src/builders/vocabulary.ts:97`). Neither is the other, and neither
  is per field.
- **Links by section exist; pointers by section do not.**
- **Not in eess:** a field element; a field-value predicate on documents; a title condition; a
  requirement conditional on a field; a configurable or separable ledger; one lane declaration.

## Asks

**A. A record's fields are elements, read in every form a record uses.** `fields(corpus)` selects
every field of every document: the label grammar's forms, widened to a heading used as a field
(`## Label: value`), read outside fenced code, over the whole document. Each element carries its
document, label, raw text, normalised value and line, and reports its own line. A field spec is
data: `{ name, aliases, required, accepts, says }`, where `accepts` is a value set or a pattern,
`required` may differ by lane, and `says` is the remedy text a finding carries. The normaliser is
one tested owner, shared with the ledger, chosen per field (a word, a token, an integer, a date).
The reader is exported as a plain function as well, so a tool that only renders a board reads
fields the same way as the rule that checks them.

**B. Structure can be conditioned on fields.** A predicate `docs().that().haveFieldValue(label,
valuesOrPattern)`, so "a fixed bug has a Verification section" and "a record in one programme
carries another field" are each one rule; `haveSection` gains an optional depth, and `haveTitle`
tests the H1; `pointers()` gains `areInSection()`, so "this section holds a live pointer" composes.

**C. The ledger reads the lane's own label, and its halves can run apart.** `honestyAtClose` takes
the state label, a list of them, or the heading form; its state, box and placement checks can each
be run alone; its vocabulary check can be scoped to live records; and a lane can declare a folder
that is kept but bound to one state.

**D. One lane declaration.** A lane's folder, closed folders, bound folders (C), exempt files, state
label and states are declared once, and `corpus()`'s frozen globs, `honestyAtClose` and the schema
all read that declaration, so no two lists can disagree.

**E. A public way to build a document from text**, for tests, so a fixture is neither a hand-written
literal that silently lacks fields nor a temporary directory that makes a suite slow.

**F. The kit ships a record-schema preset, and this repository uses it first.** Built from A–D, it
checks `work/plans` and `work/bugs` against the format CLAUDE.md prescribes. Its first run is in
report mode, and its findings are fixed or the schema corrected one by one, never widened to go
green.

## Acceptance criteria

- [ ] Each new condition has a non-vacuity row: a missing field, a value outside the set, a value
      failing the pattern, a field in the heading form, a missing conditional section, a wrong H1
      and a section without a live pointer each red a fixture, and a rule that examines no field
      fails.
- [ ] A field inside a fenced example is never read, in either form, proven by a fixture.
- [ ] The normaliser has one owner, with every value shape that broke an adopter's extractor
      (emoji-only, delimiter-first, parenthesised, `P1`, a bare integer) as tests.
- [ ] `honestyAtClose` with a `Status` label reports a misplaced record in both directions, and each
      of its halves runs alone.
- [ ] One lane declaration feeds `corpus()`, `honestyAtClose` and the schema, and a fixture with a
      closed folder in one list but not another cannot be built.
- [ ] This repository's plans and bugs pass the kit preset, and the run that got them there is
      recorded with every finding's disposition.
- [ ] `scripts/lib/proposal-ruling.mjs` reads `Ruling` and `Implements` through the field reader,
      or the record says why it cannot.

## Open questions

- **Bold labels, heading fields, YAML frontmatter, or all three?** The method uses bold labels;
  adopter 3 uses headings; frontmatter is common elsewhere and eess-md already parses it (and stopped
  reading it as a section, bug 0087). Reading all forms through one grammar is A's proposal; whether
  the kit should then prescribe one form is the question.
- **Where does a field's span end?** A reads the whole document. Adopter 3 reads its structured forms
  anywhere and its inline forms only in the first 20 lines; the ledger reads the preamble and first
  section. Which reading a schema uses decides what "missing" means.
- **Synonym groups as data or as regex?** A regex alternation works today; a list of names gives a
  better message ("missing one of: Symptom, Problem, Repro").
- **Kernel or dialect?** Fields are Markdown records, so eess-md. Whether a record schema is a
  concept another dialect would want (a Gherkin feature's tags, a YAML document's keys) is the
  architect's question.
- **Split and sequence?** A–F are six asks; A and B are the schema, C and D are the ledger and the
  lane, E and F stand alone. The review decides whether this ships as one plan or several.

## Out of scope

Each of these is its own record, written after this proposal's review, and none is a precondition
of it:

- **A drift check** (a bug's cited files changed after its "checked" date). Adopters 1 and 3 both
  built one; adopter 3 now reports drift as a nudge and blocks only on its reader's faults (a shallow
  clone, a missing date).
- **A branch gate**: a pull request closes a record or says why not, ticks no box on a record it
  leaves open, and a closed record's `Deferred:` count equals its `deferred→` boxes. Adopter 3 built
  it as honesty-at-close applied to a diff, and had to select a stand-in document as its subject,
  which makes its `examined` always 1: eess has no subject for a check over a set of facts.
- **Ledger checks adopter 3 added**: a deferral names a record that exists and is live; a checklist
  box still open cites a live record; record ids are unique across lanes (the kit's `next-number
--check` covers numbers, not ids).
- **Defects adopter 3 reports in eess-md, to be reproduced here before they are recorded**:
  `taskItems()` misses nested boxes and `[~]`; `adrEnforcement` does not check its Status vocabulary,
  that a `gated` row cites a mechanism, or that the table has a row; `verifyCitations` reads a dotted
  name such as `it.skip` as a path; `fileIndex` includes untracked files.
- **`corpus()`'s cost.** Adopter 2 measured about 1.4 s for 363 files, almost all of it the syntax-tree
  parse, and `ignore` does not skip the walk its documentation says it does; adopter 3 measured
  5.7 s to build its corpus against 273 ms for its rules.
- **The kit shipping runnable gate scripts** for what exists today (`check:ledger`, `check:corpus`).
- **Adopter 1's future ideas** (an impact oracle over a diff, a corpus query tool, a check tying
  each PR to a record, an MCP server). Product input, not asks here.
