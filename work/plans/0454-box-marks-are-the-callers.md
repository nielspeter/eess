# Plan 0454: box marks are the caller's

## Status

- **State:** Draft — written 2026-10-17 at the maintainer's request ("plans in one pr"), as the
  plan that owns [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s block
  17, which the maintainer accepted on 2026-10-16. Reviewed as a Draft before any build.
- **Implements:** proposal 017
- **Fixes:** [bug 0445](../bugs/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md)
- **Priority:** Medium, bug 0445's severity: a closed record whose boxes are all `[~]` passes the
  closing check, and this repository carries four such boxes today.
- **Effort:** Medium — one model function, one builder, one preset option, this repository's ledger
  wiring, fixtures. eess-md only; a minor with a flagged break.
- **Created:** 2026-10-17
- **Builds after:** plan 0458 (the examples gate, which this plan's example needs).

## Problem

GFM reads three box marks, `[ ]`, `[x]` and `[X]`. Anything else in that position is an ordinary
list item. `collectTaskItems` keeps a list item only when mdast gives it a boolean `checked`
(`packages/md/src/model/task-items.ts:37`), so `- [~] half done` is never an element, and nothing
says it was skipped. `taskItems()` (`packages/md/src/builders/task-items.ts:26`) and both of
`honestyAtClose`'s box readers (`packages/md/src/rules/ledger.ts:380` and `:683`) read through it.

Measured in this repository: four list items carry a non-GFM mark outside fenced code, all `[~]`,
all in closed records, and `check:ledger` reads none of them:
`work/bugs/fixed/0249-most-of-work-is-outside-every-corpus-root.md:160`, `:167` and `:201`, and
`work/bugs/fixed/0256-the-spike-lane-is-run-but-never-declared.md:130`. (Measured with
`git grep -nE '^ *[-*+] \[[^] xX]\] ' -- '*.md'`: five lines, the fifth inside a fence in bug 0226.
Phase 1 re-measures it on the parsed tree, which is the number that counts.) Adopters report more,
as reported in proposal 017's consumer feedback, not measured here: adopter 3 carries 1,699 `[?]`,
10 `[~]` and 7 `[→]`; adopter 1 one `[~]` in an open record.

A near-GFM spelling is invisible the same way. `- [ x ] done` and `- [x]done` are not GFM boxes;
both are plain list items today, and an author who wrote either meant a box.

## Design

Proposal 017's decision 5, made concrete. Each point says where it narrows or extends the decision.

**A mark is read on the parsed tree.** A list item outside a blockquote whose first child is a
paragraph, whose paragraph's first inline is a `text` node (not a link, not a link reference), and
whose text starts with `[`, exactly one grapheme, `]`, then a space or the end of the text. The
grapheme is counted with `Intl.Segmenter`, so `[→]` and `[✅]` are one mark each.

- **Letters and digits are not marks.** Decision 5 lists `[1]` as "not a mark", but `1` is one
  grapheme, so the decision's own definition contradicts its acceptance row. The plan resolves it
  for the row: a grapheme matching `/^[\p{L}\p{N}]$/u` is not a mark, so `- [1] x`, `- [a] x` and
  `- [WIP] x` stay plain list items. GFM's own `x`/`X` never reach this reader, because mdast has
  already made those boxes. Reported here so the review can overrule it.
- **A link or reference is never a mark.** `- [link](u)` and `- [ref]` with a definition parse as a
  `link` and a `linkReference`, so their first inline is not text. `- [ref]` without a definition
  is text, and three graphemes, so not a mark either.
- **Near-GFM spacing is its own finding, never a mark and never silent.** The carried condition asks
  for "a decided reading for near-GFM spacings such as `[ x ]`". Decided: a list item whose text
  starts with `[`, optional spaces, one of `x`, `X`, a declared mark or nothing, optional spaces,
  `]`, and that is not exactly a mark as defined above (padding inside the brackets, or no space
  after `]`), is reported as `md/malformed-box`, with the canonical spelling in the remedy. It
  cannot be declared away: the remedy is to write the box GFM reads.

**The caller declares each extra mark, open or done.** No mark beyond GFM's has a default
(proposal 017's principle).

```ts
export type BoxMarkState = 'open' | 'done'

export interface TaskItemOptions {
  /** Box marks beyond GFM's `[ ]` and `[x]`, each declared open (it blocks a close) or done. */
  readonly marks?: Readonly<Record<string, BoxMarkState>>
}
```

A declaration is validated when the builder is constructed and refused with an `ArchConfigError`
(ADR-009, refuse and say so) when a key is not one grapheme, is a letter or digit, is a space, `x`
or `X`, or when a value is neither `'open'` nor `'done'`. Each refusal names the key.

**Elements carry the mark and its state beside `checked`.** `MdTaskItemRef` widens:

```ts
export interface MdTaskItemRef {
  /** `true` only for a box whose state is `done`. Unchanged for every GFM box. */
  readonly checked: boolean
  /** The mark as written: `' '`, `'x'`, `'X'`, or the extra mark. */
  readonly mark: string
  /** GFM's `[ ]` is open and `[x]` done; an extra mark has its declared state. */
  readonly state: BoxMarkState | 'undeclared' | 'malformed'
  readonly text: string
  readonly line: number
}
```

For an extra mark, `text` is what follows the mark, trimmed, as it is for a GFM box today.

**An undeclared or malformed box is still an element, and is read as open by anyone who reads only
`checked`.** `collectTaskItems(root, options)` yields it with `checked: false`. A caller who
hand-rolls a closing check over `collectTaskItems`, as `ledger.ts` does today, then sees it as an
open box rather than not seeing it, so no consumer of the model stays blind (fail-closed by
default, ADR-009). The builder is stricter: `areOpen()` and `areChecked()` select on `state`
(`'open'` and `'done'`), so an undeclared box is not also reported as a silent open box. It gets one
finding with one remedy, below, rather than two with different remedies.

**The finding comes from the `taskItems()` builder, once per box, whatever the rule selects.**
`TaskItemRuleBuilder` overrides `collectViolations()` as `CodeBlockRuleBuilder` already does for its
instrument finding (`packages/md/src/builders/code-blocks.ts:114`): the kernel's verdict, plus one
configuration finding (`bypassFilters: true`) per undeclared or malformed box in the corpus.

```ts
protected override collectViolations(): CollectResult {
  const base = super.collectViolations()
  const unread = this.unreadBoxes() // every element whose state is 'undeclared' or 'malformed'
  if (unread.length === 0) return base
  return collectResult([...base, ...unread.map(boxFinding)], base)
}
```

```text
work/bugs/fixed/x.md:12 — md/undeclared-box-mark
  `[?]` is not a box mark this rule was told about, so the item is neither open nor done and no
  rule can judge it.
  Fix: declare it — taskItems(corpus, { marks: { '?': 'open' } }) (or 'done') — or rewrite the box
  as `[ ]` or `[x]`.
```

Every rule over `taskItems()` therefore reports the corpus's undeclared marks, including a rule
whose selection would not have reached that box, which is decision 5's "no existing rule stays
blind". The finding's identity is `(file, 'md/undeclared-box-mark', '<relPath>:<line>')`, so when
several rules in one rule file report the same box, the kernel's `dedupeConfigFindings`
(`packages/core/src/dedupe-config-findings.ts:69`, applied by eess-ts's CLI and `checkAll`)
collapses them to one. See the open question about the wording it appends.

**`honestyAtClose` takes `marks`** and passes it to both of its box readers, the `taskItems()` rule
(`ledger.ts:697`) and `hasDeferredDisposedBox` (`ledger.ts:380`). A declared open mark is an open
box and needs a disposition token like `[ ]`; a declared done mark is a closed box. An undeclared
mark in any document of the lane is a finding, which is the acceptance row "a done document
holding an undeclared `[~]` reds".

**This repository declares `[~]`.** `scripts/check-ledger.mjs`'s bugs lane passes
`marks: { '~': 'open' }`. Each of the four boxes then needs a disposition, and each already has one
(`done-otherwise` once, `deferred→` three times, which `DISPOSITION_RE` at `ledger.ts:204` reads
through the inline code), so they pass as disposed. Measured in the build, not assumed here.

## Phases

All in one pull request.

### Phase 1 — the model

- `readBoxMark(listItem, marks)` in `packages/md/src/model/task-items.ts`: the tree definition
  above, returning `{ mark, state, text } | null`.
- `collectTaskItems(root, options?)`: unchanged for GFM boxes; yields extra, undeclared and
  malformed boxes as described. The second parameter is optional, so existing callers compile.
- `validateMarks(marks, caller)`: the refusals, shared by the builder and the preset.
- Re-measure this repository's non-GFM boxes on the parsed tree and record the count here.

### Phase 2 — the builder

- `taskItems(corpus, options?)`; `areOpen()` and `areChecked()` select on `state`.
- The `collectViolations()` override and its two finding ids, `md/undeclared-box-mark` and
  `md/malformed-box`, exported as constants beside the builder.

### Phase 3 — the preset and this repository

- `HonestyAtCloseOptions.marks`, passed to both readers; `hasDeferredDisposedBox` and the
  `openTaskItems` peek (`ledger.ts:683`) select on `state`, so the peek stays independent of the
  predicate it protects (the reasoning at `ledger.ts:608`) and an undeclared box is not counted as an
  open one there either.
- `scripts/check-ledger.mjs` declares `'~': 'open'` on the bugs lane only, the one lane that carries
  the mark.

### Phase 4 — fixtures, release, docs

- Non-vacuity, changeset, `packages/md/README.md` (the task-item section gains `marks`).
- An example under plan 0458's gate, `examples/md/box-marks.test.ts`: "a declared `[~]` counts as
  open in a closed document", from public blocks only, with a clean and a violating fixture.

## Files changed

- `packages/md/src/model/task-items.ts` — `readBoxMark`, `collectTaskItems(root, options)`,
  `MdTaskItemRef` fields, `validateMarks`.
- `packages/md/src/builders/task-items.ts` — options, `state`-based filters, `collectViolations`.
- `packages/md/src/rules/ledger.ts` — the `marks` option, threaded to both readers.
- `packages/md/src/index.ts` — export `BoxMarkState`, `TaskItemOptions` and the two finding ids.
- `packages/md/tests/builders/task-items-marks.test.ts` (new); `packages/md/tests/rules/ledger.test.ts`.
- `scripts/check-ledger.mjs` — the bugs lane's declaration.
- `scripts/nonvacuity/bad-ledger/…` — two fixture records (below); `scripts/check-nonvacuity.mjs` —
  their rows.
- `packages/md/README.md`; `.changeset/box-marks-are-the-callers.md`.
- `examples/md/box-marks.test.ts` and its fixtures (new).
- `work/bugs/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md` → `work/bugs/fixed/`, `BUGS.md`, `ROADMAP.md`, proposal 017's block-17 row.

## Test inventory

Proposal 017's acceptance rows for block 17, each a test through the public entry points
(`taskItems()` and `honestyAtClose()`), never a hand-built stand-in:

- A done document holding an undeclared `[~]` reds, with `md/undeclared-box-mark` at its line.
- `- [WIP] x`, `- [1] x`, `- [link](u)` and a defined `- [ref]` stay green and yield no element.
- Declaring a mark clears its finding: the same corpus with `marks: { '~': 'open' }` has none.
- This repository's four `[~]` lines pass once `check:ledger` declares the mark: `npm run
check:ledger` green, and its done-item count rises by the boxes now read.

From bug 0445's Verification and the design:

- Red first: bug 0445's three-item record (`[~]`, `[?]`, `[ ]` in a `completed/` record with
  `State: Done`) through `honestyAtClose` gets one finding today; after the fix, three:
  `[~]` and `[?]` undeclared, `[ ]` a silent open box.
- A declared open `[~]` without a disposition is `ledger/silent-open-box`; with one it is green.
- A declared done `[→]` is a closed box: no finding, counted by `areChecked()`.
- `- [ x ] a` and `- [x]a` are `md/malformed-box`; `marks` cannot clear them.
- `[→]` and `[✅]` are each one grapheme (a test with a combining sequence too).
- An undeclared box in a document the rule does not select is still reported.
- `collectTaskItems` alone yields an undeclared box with `checked: false`.
- Each refusal of `validateMarks` throws `ArchConfigError` naming the key.
- Two rules over one corpus in one rule file, through `checkAll`, report one finding per box.
- GFM behaviour unchanged: the existing task-item and ledger suites pass unedited.

**Sabotage**, each red in the matching test and green when reverted, run in a worktree:
`readBoxMark` returns `null` (the undeclared rows red); the letter-and-digit exclusion removed (the
`[1]` row reds); `collectViolations` returns `base` (the undeclared rows red, the `check:nonvacuity`
row too); `areOpen` back to `!t.checked` (the "not also a silent open box" row reds); the preset
drops `marks` (the declared-mark rows red).

**`check:nonvacuity`:** two fixture records in `scripts/nonvacuity/bad-ledger/`, a `completed/`
record with an undeclared `[?]` and one with `[ x ]`, and two rows,
`corpus/ledger/undeclared-mark` and `corpus/ledger/malformed-box`, each `gateNode('bad-ledger.mjs',
…)` with the finding id as its sentinel.

## Release

eess-md minor, a **flagged break** (`**Breaking (@nielspeter/eess-md)**`): a corpus that carries a
non-GFM mark, or a near-GFM box, and passes today goes red; `MdTaskItemRef` gains two required
fields, which breaks a caller who constructs one; `areOpen()` no longer selects what is not open.
Migration line: "declare each mark with `marks: { '<mark>': 'open' | 'done' }`, or rewrite the box
as `[ ]` or `[x]`; a `[ x ]` is rewritten."

Dependants (bug 0185): measured, eess-crossvalidate lists eess-md as a peer dependency and no
package lists it in `dependencies`; eess-crossvalidate uses no task-item API (grep of
`packages/crossvalidate/src`, nothing). `check:release`'s `release/break-names-dependents` decides
which packages the changeset must name; if it asks for eess-crossvalidate, it is named.

## Out of scope

- **A declared mark that no box uses.** Not reported: a declaration that matches nothing can only
  make a finding appear, never hide one. Recorded here, not decided against.
- **Boxes by section** (block 18, `inSections`), which the maintainer did not accept.
- **A mark in a blockquote**: skipped, as GFM boxes there are today.
- **`honestyAtClose`'s fixed `State:` label** (bug 0444) and its rebuild from public blocks (017's
  decision 1).
- **Counting declared marks in `ledgerStats`.** It counts documents, not boxes.

## Open questions for the review

- **The dedupe note.** `dedupeConfigFindings` appends "This one option generated N rules that cannot
  enforce anything" (`dedupe-config-findings.ts:56`), which is written for a preset's fan-out and
  misdescribes N rules reporting one box. Either the finding is not a configuration finding (no
  `bypassFilters`, and it then obeys `.excluding()`, which 017's "always a finding" forbids), or the
  note learns a second wording keyed on the finding id (a kernel change, and this plan would move the
  kernel). The plan's lean is the second, but it widens the plan to two packages.
- **Letters as marks.** Excluding `\p{L}` and `\p{N}` is what makes `[1]` green; it also makes a
  corpus's `[o]` or `[v]` a plain list item. No adopter reported a letter mark.

## Progress ledger

- [ ] Phase 1 — the model, and the parsed-tree count of this repository's non-GFM boxes
- [ ] Phase 2 — the builder and its findings
- [ ] Phase 3 — `honestyAtClose`'s `marks`, and `check:ledger` declaring `[~]`
- [ ] Phase 4 — non-vacuity rows, changeset, README, the example under plan 0458's gate
- [ ] Every acceptance row above green through the public entry points; the sabotage rows red
- [ ] Close: bug 0445 → `fixed/`, this plan → `completed/`, proposal 017's block-17 row, boards

Deferred: none
