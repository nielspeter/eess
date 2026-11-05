# Proposal 027 — a finding says whose it is, and a run reports it once

**State:** Draft — filed 2026-11-05 from an adopter's question, at the maintainer's request; not yet
reviewed.
**Priority:** Medium — no false green: every finding is true and fails closed. But a caller that runs
several rules over one corpus outside `eess-ts check` gets each corpus finding once per rule, and
can tell a rule's own findings from eess's only by parsing eess's English text.
**Origin:** inbound · consuming project, 2026-11-05, on eess-md 0.13.0, measured here on 0.14.0.
**Affects:** `@nielspeter/eess` (the kernel), `@nielspeter/eess-md`.

## Problem

An adopter replaced hand-written checks ("no open box under a named section in a closed record")
with eess-md rules of this shape, one per section group:

```ts
taskItems(c, { marks })
  .that()
  .areOpen()
  .and()
  .satisfy(inDocuments(resideInFolder('work/plans/completed/**')))
  .and()
  .satisfy(inSections(sectionsNamed(/^Acceptance$/)))
  .should()
  .notExist()
  .rule({ id, because })
```

It runs them beside `honestyAtClose` in its test runner, and reports each finding with the rule's
`because` (written in the corpus's own language) as the message. Two things cost it most of its
extra code:

1. **A corpus finding is reported once per rule that reaches it.** An undeclared box mark comes back
   from every rule whose predicates reach the box, and from `honestyAtClose`. A heading the
   section-name scan notices (one inside a blockquote, a near miss, the wrong depth) comes back from
   every rule that declares the name. The adopter de-duplicates by `(file, line, message)` across
   rules, and reasons about which rule "owns" each finding.
2. **A rule's own findings cannot be told from eess's without reading the text.** To show its
   `because` as the message, the adopter matches eess's text (`` `${element} should not exist` ``),
   which broke when [plan 0503](../plans/completed/0503-in-sections-boxes-by-section.md)
   added `(under "Acceptance", line 5)` to it.

The adopter asked whether a rule could declare that another rule owns such findings. This proposal
argues no (see Out of scope) and asks for the two things that make ownership unnecessary.

## Measured

On `main` at 046afd0c (v0.17.0: eess 0.10.0, eess-md 0.14.0), built packages, one closed record
`work/plans/completed/0001-p.md`:

```markdown
# P

- **State:** Done

## Acceptance

- [?] deferred→BUG-1
- [x] ok

> ## Acceptance

Deferred: none
```

Two rules of the shape above (ids `p/a` and `p/b`, `because: 'the reason'`, marks `{ '~': 'open' }`) and
`honestyAtClose(c, { report: 'return', marks })`:

| source                                   | findings | what                                                                                                                                                             |
| ---------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rule `p/a`                               | 2        | `[md/undeclared-box-mark]` at line 7, `bypassFilters: true`; `[p/a] … → section "Acceptance" (in a blockquote)` at line 10, `bypassFilters` unset                |
| rule `p/b`                               | 2        | the same two, the scan finding under `p/b`                                                                                                                       |
| `honestyAtClose`                         | 1        | the same `[md/undeclared-box-mark]` at line 7                                                                                                                    |
| all five, through `dedupeConfigFindings` | 3        | one box-mark finding (with a false note, [bug 0621](../bugs/0621-the-run-level-collapse-says-every-rule-it-merged-enforces-nothing.md)); both scan findings kept |

Also measured: every finding from the two rules carries `because: 'the reason'`, their
`md/undeclared-box-mark` findings included; `honestyAtClose`'s carries none. A caller that shows `because` as the message for every finding under its
rule prints its own reason on eess's box-mark finding.

## Existing code survey

| ask                                       | finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Report a corpus finding once across rules | **Exists, internal.** `dedupeConfigFindings` (`packages/core/src/dedupe-config-findings.ts:69`) collapses configuration findings by `(file, id, element)`. It is exported only from `@nielspeter/eess/internal` (`packages/core/src/internal.ts:28`), which [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) reserves for family plumbing, and its one caller is `eess-ts check` (`packages/ts/src/cli/commands/check.ts:238`). A caller running rules in a test runner has no public way to it.   |
| Repetition per rule                       | **By design.** [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5: "one per cause per rule", deliberately not across rules, because whether a verdict depends on a cause is decided per rule. [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) rule 3 does collapse across rules, and its C3 row places the collapse after the CLI's dedupe. Both put the run-level view with the caller ([ADR-008](../../adr/008-caller-owns-reporting.md)). |
| Tell a rule's own findings from eess's    | **Partly exists.** `ruleId` separates eess's own findings (`md/*`, `emitter/*`) from the rule's, and `bypassFilters` (`packages/core/src/violation.ts:132`) marks a configuration finding. The section-name scan's findings (`packages/md/src/builders/section-declarations.ts:37`) carry neither: they are ordinary violations under the rule's id, so only their element text (`→ section "…" (in a blockquote)`) tells them from the rule's `notExist()` findings, and the collapse never sees them.          |
| The reason as the message                 | **Exists.** `because` is a field on every finding (`packages/core/src/violation.ts:114`); no caller needs the message text to recover it. What is missing is knowing which findings it belongs on (the row above).                                                                                                                                                                                                                                                                                               |
| `honestyAtClose`'s done folders           | **Exists as an option.** `honestyAtClose({ doneFolders })` takes them; the default (`packages/md/src/rules/ledger.ts:144`) is private. A caller that passes its own list shares one constant with its other rules. Exporting the default is not asked: [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) keeps a document's shape out of eess-md's root.                                                                                                                                        |

## Asks

1. **A public run-level collapse.** The collapse `eess-ts check` applies, available to a caller that
   gathers findings itself (a test runner, a script): one configuration finding per
   `(file, id, element)` across the rules given, the count of rules that reported it kept on the
   surviving finding. Whether that is `dedupeConfigFindings` promoted to the kernel root or a
   reporter-level option is the review's to decide.
2. **A finding says what it is about.** A structured field that separates a finding judging an
   element the rule selected from one about something the rule declared or could not read (the
   section-name scan, an unread box, an undecided subject). With it:
   - a caller replaces the message, or attaches its `because`, on its rule's own findings only,
     without parsing text;
   - the section-name scan's findings can join the collapse of ask 1, since a heading in a
     blockquote is one edit however many rules declare its name.

## Acceptance criteria

- **Break class (repetition):** the measured corpus above, gathered from the two rules and
  `honestyAtClose` by a caller through the public collapse, yields one `md/undeclared-box-mark`
  finding and one scan finding for line 10, each saying how many rules reported it.
- **Break class (ownership by text):** each finding in that run says, by a field and not by its
  text, whether it judges a selected element; the two `notExist()` findings a planted open box
  produces say so, and the box-mark and scan findings say they do not.
- **Break class (false collapse):** an ordinary violation is never collapsed: two rules that each
  select the same open box report it twice.
- **Non-vacuity:** a collapse that keeps every finding, and a field that always says "judges an
  element", each fail a row (`scripts/check-nonvacuity.mjs` or a sabotage test).

## Dogfooding

This repository's own `check:corpus` (`scripts/check-corpus.mjs`) runs several eess-md rules over one
corpus and prints them together; it would use the public collapse in place of reporting each rule
alone.

## Open questions

- Is ask 2 one field (what the finding is about) or does `bypassFilters` already answer it for
  every class but the scan, so that the scan's findings should simply become configuration
  findings? The second is smaller, but it makes the scan unsuppressable, which today it is not.
- Should a finding about something the rule declared carry the rule's `because`? It is the rule's
  reason for its verdict, not for the finding.

## Out of scope

- **A rule declaring that another rule owns a finding.** The owned rule's verdict would then depend
  on the owner running, and an owner removed, excluded or scoped differently would drop the finding
  with nothing red: the shape [ADR-009](../../adr/009-agent-first-failure-surfaces.md) exists to
  refuse.
- **Exporting `honestyAtClose`'s default done folders** (see the survey).
- **The note the collapse appends**, which is [bug 0621](../bugs/0621-the-run-level-collapse-says-every-rule-it-merged-enforces-nothing.md).
- `inSections` under `notExist()` passing over nothing: documented, and the adopter guards it with
  its own `examined` counts.
