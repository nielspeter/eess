# Proposal 020 — a fix dry run a reader can review

**State:** Draft — filed 2026-10-25 from adopter feedback on [proposal 019](./019-md-a-mention-is-a-link-built-from-blocks.md)'s
fix; reviewed 2026-11-01 (architect · product · enforcement), ruling `Split and sequence`; see
`## Review — 2026-11-01` below.
**Priority:** Medium — [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
fix proposes thousands of edits in one run, and its safety rests on a reader checking them before
`--apply`.
**Origin:** inbound · adopter feedback, 2026-10-25. Every adopter asked would run the mention fix only
after reading a dry-run list grouped by target, and sampling it.
**Affects:** `@nielspeter/eess-ts` (the `check --fix` output) for A; `@nielspeter/eess` for B
(`ArchFix` and the JSON report, `packages/core/src/format-json.ts`, which is the agent contract).

## Problem

`eess-ts check --fix` without `--apply` prints a dry run: one `would fix: <describe>` line per fix,
listed per file and by offset within a file (`packages/core/src/apply-fixes.ts`), then a count (`packages/ts/src/cli/commands/check.ts:457-469`). That
serves `movedLinkFix`, which proposes a handful of edits. The mention fix proposes one edit per plain
mention, about 3,000 to 4,700 in each corpus measured, and the one error a reader can catch is many
mentions sent to the same wrong target. A flat list hides it.

## Existing code survey

- **`ArchFix` carries no structured target** (`packages/core/src/violation.ts:15-26`): a file, a span,
  the replacement text and a one-line `describe`. Grouping by target would mean parsing `describe`
  or the replacement.
- **The JSON report omits the fix** (`packages/core/src/format-json.ts:199`, `suggestion` is there,
  `fix` is not), so an adopter cannot sample the dry run with a script of their own.
- **The dry run and `--apply` share one path**, `applyFixes` (`packages/core/src/apply-fixes.ts`),
  with `write: false` for the preview.

## Asks

- **A — group the dry run by target.** Fixes that write the same target are listed together, with a
  count per target, largest first.
- **B — the fix in the JSON report.** `--format json` carries each finding's fix (file, span,
  replacement, target), so a reader can draw a sample.

## Acceptance criteria

- **Break class:** a dry run of two fixes to one target and one to another lists the pair under one
  target, with its count, before the single.
- **Break class:** `--format json` of a finding with a fix carries the fix; without one, no fix field.
- **Break class (no change):** `--apply` writes exactly what the dry run listed.
- **Non-vacuity:** a fixture row per break class.

## Dogfooding, 2026-10-27

[Plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s dry run over this repository (eess's own records only, 3,907 fixes over 419 files)
showed the stopgap pipeline does not group by record. A fix's `describe` names its target as the
link destination it writes, relative to the mentioning document, so one record cited from different
folders lands in different groups: the same [plan 0456](../plans/completed/0456-kernel-notexist-and-dead-glob.md) counted once as `0456-kernel-…` and once as
`plans/completed/0456-kernel-…`. A reader looking for many mentions sent to one wrong record would
miss it. Ask A needs the target as a repository path. Until then the docs' pipeline groups by the
target's file name, which is one record only where a corpus's record file names are unique, and
says so.

## Open questions

1. **Where the target lives.** An optional `target` on `ArchFix` (a kernel change, additive), or a
   grouping key each fix states, or grouping by replacement text in eess-ts alone. A `target` on
   `ArchFix` together with a `fix` on the JSON wire changes the agent contract, and likely needs an
   ADR row rather than only a plan. Until then, [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)
   fixes its `describe` with the target last, so a shell pipeline can group the dry run.
2. **Grouped by what for `movedLinkFix`.** Its target is the moved file; the same field would serve.

## Out of scope

- The mention fix itself: [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md).
- An interactive per-fix accept or reject.

## Review — 2026-11-01

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, each on its own reading of the code. Their
leans were architect "ship with changes", product "ship with changes, split", and enforcement
"changes needed". The review lands on the split because all three find that A and B are separate
decisions with different blockers, and that B is not ready. A, the grouped dry run, is one plan once
its shape is settled; it spans a kernel field, the internal `ApplyResult`, the three eess-md
producers and the eess-ts renderer. B, the fix on the JSON wire, is a separate decision about the
agent contract. As drafted it would put edits on the wire that the `--fix` door refuses, so it waits
until it is settled which document it extends. The measurements were throwaway scripts against
`packages/*/dist`, 0.05 s to 1.5 s in all per lens, and no tracked file was touched.

### Existing code survey, corrected

- **A is new.** No structured target exists: `ArchFix` is a file, a span, a replacement and a
  `describe` (`packages/core/src/violation.ts:15`). `ApplyResult` returns only `descriptions` in file
  and offset order (`packages/core/src/apply-fixes.ts:82`), so eess-ts cannot group even if the field
  existed. The stopgap is the shell pipeline in `docs/markdown.md`, keyed on the target's file name.
- **B is new on the wire.** The field exists in memory (`ArchViolation.fix`,
  `packages/core/src/violation.ts:122`), and `formatViolationsJson` leaves it out
  (`packages/core/src/format-json.ts:199` has `suggestion` and no `fix`). The shape precedent is
  `relatedFiles` from
  [bug 0239](../bugs/fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md):
  optional in memory, `null` on the wire (`packages/core/src/format-json.ts:213`).
- **The dry run has no JSON form, and that is a defect today.** `runFix` receives `{ format }` and
  never reads it (`packages/ts/src/cli/commands/check.ts:62`). Product measured that
  `check --fix --format json` prints the plain-text dry run. This is a defect whatever B's ruling, and
  it is recorded on its own as
  [bug 0592](../bugs/0592-check-fix-ignores-format-and-the-docs-omit-a-fix-producer.md), together
  with the docs gap that `docs/cli.md` omits the mention fix from the `--fix` producers.
- **Open question 1: the values already exist at all three producers, all in eess-md.**
  `movedLinkFix` has `matches[0]` (`packages/md/src/model/resolve-link.ts:282`), the pointer rewrite
  has `match.file` (`packages/md/src/conditions/pointer-resolve.ts:226-233`), and the mention fix has
  `fix.target(record)` (`packages/md/src/conditions/be-linked.ts:273`). No other dialect, and not the
  kernel, produces a fix. Grouping by replacement text in eess-ts alone fails: the mention fix's
  replacement is relative to each document (`packages/md/src/conditions/be-linked.ts:119`), which is
  the dogfooding defect, and recovering a record from it would put Markdown link parsing in eess-ts,
  against the `eess/md-one-link-resolver` rule.
- **Open question 2 is answered by the survey.** The same field serves `movedLinkFix` and the pointer
  rewrite, the third producer the question leaves out. It does not block.
- **No gate falsifies the dry run's text.** The only falsifier of the `--fix` door is the nonvacuity
  row `emitter/bare-builder-reds-the-cli`, which uses one fix, so it cannot tell a dry-run listing
  from an applied one, or see order, grouping or skips. No `packages/ts` test drives `--fix` or
  asserts the `would fix:` text.

### Placement

- **Kernel (`packages/core`):** an optional `target?: string` on the root `ArchFix`, additive under
  [ADR-011](../../adr/011-the-kernels-public-api-is-explicit.md) like `relatedFiles`, `measured` and
  `kind`; a richer internal `ApplyResult` that hands back an outcome per violation (applied edits with
  the violations they cure, folded copies, skipped fixes); and the pure grouping helper beside
  `applyFixes`, also internal. The helper is not in eess-ts because the mention fix is an eess-md
  feature, and [bug 0537](../bugs/0537-eess-md-alone-has-no-run-level-services.md) records that
  eess-md has no door of its own yet; a helper in eess-ts would be rebuilt at that door. If B gets a
  JSON dry-run document, its type and formatter sit beside `ArchJsonReport` in `format-json.ts`, a
  root addition the plan names.
- **eess-md:** the three producers set `target`, resolved to its concrete form here because eess-md
  owns `corpus.root`. Writing the destination, making it relative and the `<…>`/`|` rules stay here.
- **eess-ts:** only the terminal rendering in `runFix`, and honouring `--format`.
- **Not in the kernel:** any reading of `target` (no root, no URL parsing, no path normalising; the
  kernel compares by string equality only), Markdown destination syntax, and the terminal layout.
- **The release footprint** goes in the plan's bump table: core minor; every dialect pins
  `^0.9.0`, so all five dependents release at least a patch; eess-md minor (a new field a consumer
  can see); eess-ts minor while A stays additive (Critical 3), a flagged break otherwise. Under B,
  eess-mermaid's JSON changes too, because it emits through `formatViolationsJson`.

### Critical (must be settled before a plan)

1. **B on the `check` report hands out edits the `--fix` door refuses.** The architect measured it;
   enforcement and product agree. Adding `fix: v.fix ?? null` beside
   `packages/core/src/format-json.ts:199` serialises edits from a builder whose receipt was refused:
   `check --format json` carried the fixable violation next to `emitter/no-receipt`, while
   `check --fix` refused it and left the file byte-identical. That breaks
   the rule stated in [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s
   Enforcement table (`adr/014-the-emitter-refuses-a-verdict-without-evidence.md:494`), "a refused
   verdict refuses every edit computed from it", which is a row there, not a Decision clause. It also serialises edits from before the fold of
   [bug 0564](../bugs/fixed/0564-two-identical-fixes-cancel-each-other.md) and the overlap skips:
   enforcement measured 5 fixes on the wire against 2 edits written. Every consumer would have to
   rebuild `applyFixes`, and one that applies the edits in report order corrupts any file with two
   fixes. All three reviewers point to the `--fix` dry run's own JSON, built from `ApplyResult` after
   the gate, the fold and the skips. A `fix` on the `check` report as well extends
   [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s clause to a new door
   and needs an Enforcement row there.
2. **The grouping key is a claim the written bytes are not checked against.** Under open question
   1's leading option, the producer states `target` and separately derives `replacement`. A broken
   destination writer still prints perfect groups.
   [Bug 0567](../bugs/0567-a-moved-link-fix-can-write-a-destination-that-is-not-a-link.md) is a
   measured case: the target was right, the written text was not a link, and the run went green.
   [Plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
   Decision 3 names this dry run as the only guard for an accepted residual. So a break class is
   missing: a fix whose replacement, read back from `fix.file`, does not resolve to its stated
   `target` is red, with one test per producer, including [bug 0567](../bugs/0567-a-moved-link-fix-can-write-a-destination-that-is-not-a-link.md)'s space, `(` and `|` cases. Any
   answer to open question 1 has to meet it.
3. **The Problem names the wrong error class for the view it proposes, and the reshape is
   additive.** [Plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
   Phase 0 residual was seven wrong fixes in one source file, each to a different record. Grouping by
   target, largest first, scatters them; today's per-file order is the view that shows them together.
   Grouping by target catches a different, real class: a `key` or `target` callback that sends many
   mentions to one record. The proposal states which class each view guards. The reshape that serves
   both keeps every `would fix:` line byte-identical, in file order, and adds a per-target summary
   (count and target, largest first, ties broken by target) on lines that do not contain
   `would fix`. That keeps the documented pipeline working and makes A an additive eess-ts minor.
   Rewriting the lines would silently break scripts that copy that pipeline.
4. **The target's form is unspecified, and "a repository path" repeats the dogfooding defect one
   level up.** eess-md's `relPath` is relative to each corpus's own `cwd`
   (`packages/md/src/corpus.ts:47`), and `runFix` merges every rule file, so one record can carry two
   keys in one run. A "repository path" in a kernel type implies a project root, which
   [ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) forbids. The field is
   defined as an opaque identity: equal strings mean the same referent, in the form the producer
   chooses, and each producer resolves to that form. The options argued are an absolute path or URL
   (the architect's lean) or a path relative to the corpus root, stated in eess-md. URL fragments and
   spellings need a stated rule: `movedLinkFix` strips the fragment into the replacement, and the
   mention fix passes a URL's fragment through. The form is the author's decision. It blocks the plan,
   because changing it later changes the agent contract.

### Important

1. **`ApplyResult` returns outcomes, designed once against A and
   [bug 0569](../bugs/0569-fix-apply-exits-0-when-a-fix-was-skipped.md).** A skipped fix vanishes
   from its group today: enforcement measured a fix aimed at `y.md` appearing nowhere, and the skips
   are an anonymous count (`packages/ts/src/cli/commands/check.ts:465-467`). The grouped output lists
   skipped fixes with file, line and target, and its totals reconcile: applied + folded + skipped +
   no-fix = the findings handed to `runFix`. Counts are distinct edits after the fold, not
   violations. [Bug 0569](../bugs/0569-fix-apply-exits-0-when-a-fix-was-skipped.md) is a sequencing dependency; whether to bundle its fix is the plan's call,
   since they share a root, `ApplyResult` returning too little.
2. **Break class 1 as drafted passes on the defect the dogfooding found.** The fixture needs four
   cases: one record mentioned from two folders gives one group; two records sharing a file name give
   two groups; two rules proposing one identical edit count 1; and a fixed tie-break. Sabotage rows,
   each measured red once in the PR: key on `describe`, key on the file name, count violations.
3. **"`--apply` writes exactly what the dry run listed" has no falsifier and holds only on an
   unchanged tree.** Compare the `(file, start, end, replacement)` sets of the dry run and the apply,
   not the rendered lines; sabotage by filtering something only when writing. State the unchanged-tree
   condition. [Bug 0568](../bugs/0568-an-insertion-escapes-the-fix-overlap-check.md) makes equal
   edit lists give order-dependent writes once an insertion producer exists; name it as the claim's
   limit. The grouping reads `ApplyResult`, never `fixable`
   (`packages/ts/src/cli/commands/check.ts:456`).
4. **The wire idiom is `null`, never omitted.** All three reviewers. "Without one, no fix field"
   contradicts the report's own idiom (`packages/core/src/format-json.ts:175-177`) and the
   `relatedFiles` precedent. Use `fix: null`, and `target: null` inside a fix that has none.
5. **The span's unit is UTF-16 code units, and nothing says so.** Enforcement measured it: a reader
   counting bytes or code points slices the wrong text. The contract states the unit, or the fix
   carries the text it covers so a sample checks itself. It also states that offsets hold only
   against the file as the run read it, and that `fix.file` is absolute.
6. **A JSON dry run carries the refusal.** Blocked findings go to stderr as prose today
   (`packages/ts/src/cli/commands/check.ts:438`). A JSON document on stdout carrying edits but not the
   refusal recreates the gap `summary.reason` closed.
7. **Non-vacuity goes in suite tests plus a sabotage matrix, not a `check:nonvacuity` row.** Neither
   ask reds a build, and the `--fix` row already spawns about six binary runs on a CI shard that has
   hit its time limit. The tests drive `eess-ts check --fix` through the CLI's own loader over a real
   rule file and corpus, not `applyFixes` alone, because the grouping lives in `runFix`.
8. **Tier honesty.** The grouping is Tier 2, behavioural. The guard it serves, a person catching a
   wrong target, is Tier 5 and `manual`, never `gated`. The docs do not let "grouped by target" read
   as making [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
   residual checked.
9. **The Affects line understates A** (see Corrections).

### Minor

- **The fold and `target`.** `sameEdit` ignores `describe` and would ignore `target`
  (`packages/core/src/apply-fixes.ts:26-30`). Do not add `target` to it: two equal edits would then
  be skipped as an overlap, and
  [bug 0564](../bugs/fixed/0564-two-identical-fixes-cancel-each-other.md) comes back. State that the
  first wins, or treat disagreeing targets as a producer defect.
- **Fixes without a target.** A third-party producer can emit an `ArchFix` from the root with no
  target. The grouped output has an explicit "no target" bucket, never a silent drop.
- **Location in the listing.** Two producers' `describe` strings name no file, so each grouped entry
  carries its own file and line, from the violation.
- **The same grouping on the `fixed:` lines under `--apply`**, so a reader can diff the dry run
  against the apply.
- **Sampling is a docs gap today.** `… --fix | grep 'would fix' | shuf -n 150` already samples.
  Document it now, and give B a consumer that needs spans.
- **When A ships**, retire the docs pipeline and
  [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s
  "target last" `describe` convention, so a reader is not left with two counts that disagree.
- **Dogfooding is in the past tense.** This repository's consumer was
  [plan 0542](../plans/completed/0542-this-repositorys-record-mentions-are-migrated.md)'s finished
  migration, so nothing here runs a grouped dry run again. The CLI-level tests are the only regular
  guard.
- **Field naming.** Next to `file`, `target` reads as "the file edited". Its doc comment says what
  the rewritten reference points at, and the wire says which of `suggestion` (the rendered `Fix:`)
  and `fix` is the edit.
- **Sequencing with
  [bug 0567](../bugs/0567-a-moved-link-fix-can-write-a-destination-that-is-not-a-link.md).** It
  reshapes `movedLinkFix`'s destination writer. Set `target` where it leaves that writer, so the two
  PRs do not collide.

### Corrections to the submission

Recorded here, not fixed in the text above:

- **"Without one, no fix field"** contradicts the JSON report's own idiom, which writes `null` for
  an absent field (Important 4).
- **Affects names eess-ts alone for A.** A also touches core (the field, `ApplyResult`, the helper)
  and the three eess-md producers.
- **Open question 2 omits the third producer**, the pointer rewrite.
- **The Problem's error class is not the one
  [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)
  measured.** Its residual was many wrong fixes in one file, which the per-file order shows and a
  grouping by target scatters (Critical 3).

### Disposition

A is accepted in substance and reshaped, but no plan owns it yet.
[PROPOSALS.md](./PROPOSALS.md)'s vocabulary has an `Accepted` row name the plan that owns it, and
calls an `Accepted` row whose owner does not resolve a defect. So A is recorded as `Held`, with the
reshape stated and a filed plan as the condition.

| Ask                             | Disposition | What would unhold it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — group the dry run by target | `Held`      | A plan is filed for A as reshaped by this review, and the row then becomes `Accepted, reshaped` naming it. The reshape: every `would fix:` line stays byte-identical and in file order, and a per-target summary is added on lines without `would fix`, an additive eess-ts minor (Critical 3). `target` is an opaque identity each producer resolves, in a form the author picks (Critical 4). `ApplyResult` returns outcomes with skips listed and counts that reconcile (Important 1). The plan carries the replacement-matches-target break class (Critical 2), the four grouping cases, the dry-run-equals-apply check, and names [bug 0569](../bugs/0569-fix-apply-exits-0-when-a-fix-was-skipped.md) (dependency), [bug 0567](../bugs/0567-a-moved-link-fix-can-write-a-destination-that-is-not-a-link.md) (collision) and [bug 0568](../bugs/0568-an-insertion-escapes-the-fix-overlap-check.md) (limit) |
| B — the fix in the JSON report  | `Held`      | The proposal answers four contract questions: which document carries the fix (the `--fix` dry run's own JSON, or the `check` report with an Enforcement row in [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)); `fix: null` for a finding without one; the offset unit (UTF-16 code units) and that offsets hold only against the file as read; and that blocked findings are carried in the document, not only on stderr. It also names a consumer the text dry run plus `shuf` does not already serve. Sequenced after A, since it serialises A's `ApplyResult`                                                                                                                                                                                                                                                                                                                    |

### Recorded outside this proposal

- [Bug 0592](../bugs/0592-check-fix-ignores-format-and-the-docs-omit-a-fix-producer.md):
  `eess-ts check --fix` ignores `--format`, and `docs/cli.md` omits the mention fix from the `--fix`
  producers.

**Recommended next step:** revise Ask A against this review (the error class each view guards, the
additive summary, the opaque `target` and its form, outcomes from `ApplyResult`, the missing break
classes, the corrected Affects), then `/plan` it as a Draft and turn A's row to `Accepted, reshaped`
naming that plan. The author decides the form of `target`, and whether an additive field needs more
than a plan; the lenses argue it is plan-level, with an [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) Enforcement row only if `fix` goes on
the `check` report. Hold B until its four answers and a consumer are written, and sequence it after A.
