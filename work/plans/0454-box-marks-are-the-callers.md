# Plan 0454: box marks are the caller's

## Status

- **State:** Draft — written 2026-10-17 at the maintainer's request ("plans in one pr"), as the
  plan that owns [proposal 017](../proposals/017-md-blocks-to-check-a-documents-shape.md)'s block
  17, which the maintainer accepted on 2026-10-16. Reviewed 2026-10-17 (architect · product ·
  enforcement · method · testing) and reworked 2026-10-18; see "Review response" below.
- **Implements:** proposal 017
- **Fixes:** [bug 0445](../bugs/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md)
- **Priority:** Medium, bug 0445's severity: a closed record whose boxes are all `[~]` passes the
  closing check, and this repository carries four such boxes today.
- **Effort:** Medium — one model function, one builder, one preset option, two repository scripts,
  fixtures. eess-md only, no kernel change; a minor with a flagged break.
- **Created:** 2026-10-17
- **Builds after:** plan 0458 (the examples gate) and plan 0456 (`taskItems().notExist()`, which
  this plan's example uses). Build order: 0458 → 0456 → **0454** → 0457 → 0455 → 0459.

## Problem

GFM reads three box marks, `[ ]`, `[x]` and `[X]`. Anything else in that position is an ordinary
list item. `collectTaskItems` keeps a list item only when mdast gives it a boolean `checked`
(`packages/md/src/model/task-items.ts:37`), so `- [~] half done` is never an element, and nothing
says it was skipped. `taskItems()` (`packages/md/src/builders/task-items.ts:26`) and both of
`honestyAtClose`'s box readers (`packages/md/src/rules/ledger.ts:380` and `:683`) read through it, as
does this repository's finished-but-not-closed gate (`scripts/lib/finished-not-closed.mjs:116`).

Measured in this repository: four list items carry a non-GFM mark outside fenced code, all `[~]`,
all in closed records, and `check:ledger` reads none of them:
`work/bugs/fixed/0249-most-of-work-is-outside-every-corpus-root.md:160`, `:167` and `:201`, and
`work/bugs/fixed/0256-the-spike-lane-is-run-but-never-declared.md:130`. (Measured with
`git grep -nE '^ *[-*+] \[[^] xX]\] ' -- '*.md'`: five lines, the fifth inside a fence in bug 0226.
That grep misses ordered lists; Phase 1 re-measures on the parsed tree, which is the number that
counts.) Adopters report more, as reported in proposal 017's consumer feedback, not measured here:
adopter 3 carries 1,699 `[?]`, 10 `[~]` and 7 `[→]`; adopter 1 one `[~]` in an open record.

A near-GFM spelling is invisible the same way. Measured with this repository's mdast/GFM stack by
the testing review: `- [ x ] done`, `- [x]done`, and an empty `- [ ]` or `- [x]` with no text after
the box are all plain list items (`checked: null`). An author who wrote any of them meant a box.

## Design

Proposal 017's decision 5, made concrete. Each point says where it narrows or extends the decision.

**A mark is read on the parsed tree.** A list item (bulleted or ordered) outside a blockquote whose
first child is a paragraph, whose paragraph's first inline is a `text` node (not a link, not a link
reference, not inline code), whose source does not begin with a backslash before the `[`, and whose
text starts with `[`, exactly one grapheme, `]`, then a space. The grapheme is counted with
`Intl.Segmenter`, so `[→]` and `[✅]` are one mark each. The backslash is read from the source at the
paragraph's start offset, because mdast resolves `\[` to `[` in the text node.

- **An undeclared letter or digit is not a mark.** Decision 5 lists `[1]` as "not a mark", but `1`
  is one grapheme, so the decision's own definition contradicts its acceptance row. Resolved for the
  row: an undeclared grapheme matching `/^[\p{L}\p{N}]$/u` is not a mark, so `- [1] x`, `- [a] x`
  and `- [WIP] x` stay plain list items. **A declared letter or digit is a mark**: a caller with
  `[n]`, `[i]` or `[b]` declares them (any grapheme but space, `x` and `X`). The undeclared-letter
  case is a documented blind spot: an undeclared `[o]` stays a plain list item, pinned by a test.
- **A link or reference is never a mark.** `- [link](u)` and `- [ref]` with a definition parse as a
  `link` and a `linkReference`, so their first inline is not text. `- [ref]` without a definition
  is text, and three graphemes, so not a mark either. `- [~] a` beside a definition `[~]: url` is a
  `linkReference` and is not read: a documented limit, pinned by a fixture.
- **Two ways to write a list item that is not a box:** escape the bracket (`- \[*] marks
experimental`) or write it in inline code (``- `[*]` marks experimental``). Both are named in
  every remedy below.

**Near-GFM spellings are their own finding, never a mark and never silent.** The carried condition
asks for "a decided reading for near-GFM spacings such as `[ x ]`". Decided: `md/malformed-box` for a
list item whose text starts with `[`, optional spaces, one of space, `x`, `X` or a declared mark,
optional spaces, `]`, and that is not exactly a GFM box or a mark: padding inside the brackets
(`[ x ]`), no space after `]` (`[x]done`), or no text at all after the box (`- [ ]`, `- [x]`). It
cannot be declared away. The empty `[]` (no grapheme) is not in the grammar: GFM never had an empty
box, no adopter reported one, and `- [] is truthy in JS` must stay green.

```text
work/plans/x.md:12 — md/malformed-box
  `[ x ]` reads like a box, but GFM does not read it as one, so it is neither open nor done.
  Fix: write it as `[x]` (or `[ ]`) followed by a space and the item's text. If it is not a box,
  write the bracket escaped (`\[`) or in inline code.
```

**The caller declares each extra mark, open or done.** No mark beyond GFM's has a default
(proposal 017's principle).

```ts
export type BoxMarkState = 'open' | 'done'

export interface TaskItemOptions {
  /** Box marks beyond GFM's `[ ]` and `[x]`, each declared open (it blocks a close) or done. */
  readonly marks?: Readonly<Record<string, BoxMarkState>>
}
```

A declaration is validated when the builder or preset is constructed and refused with an
`ArchConfigError` (ADR-009, refuse and say so) when a key is not one grapheme, is a space, `x` or
`X`, or when a value is neither `'open'` nor `'done'`. Each refusal names the key.

**Where marks are declared: at each call site, decided.** The product review weighed a corpus-level
`corpus({ marks })` as the single owner, since a mark is a corpus-wide convention. This plan keeps
the declaration on `taskItems(corpus, options)` and `honestyAtClose({ marks })`: a mark's state is a
judgement (does `[~]` block a close?), and the corpus carries what a document is, not what a rule
concludes about it (ADR-013's corpus-learns-no-types line, applied by analogy). The cost is that a
caller with several rules passes the same object to each; the README shows one shared constant, so
the migration is one declaration and N references. Recorded so the review can overrule it.

**Elements carry the mark and its state beside `checked`.** `MdTaskItemRef` widens:

```ts
export interface MdTaskItemRef {
  /** `true` only when `state` is `'done'`. Kept for compatibility; derived from `state` in one place. */
  readonly checked: boolean
  /** The mark as written: `' '`, `'x'`, `'X'`, or the extra mark. */
  readonly mark: string
  /** GFM's `[ ]` is open and `[x]` done; an extra mark has its declared state. */
  readonly state: BoxMarkState | 'undeclared' | 'malformed'
  readonly text: string
  readonly line: number
}
```

`readBoxMark` sets `state` and derives `checked` from it, so the two cannot drift. For an extra mark,
`text` is what follows the mark, trimmed, as it is for a GFM box today.

**An undeclared or malformed box is still an element of the model, read as open by anyone who reads
only `checked`.** `collectTaskItems(root, options)` yields it with `checked: false`. That is
fail-closed for "a done record hides an open box". It is not fail-closed in every direction: a gate
asking "are all boxes done?" would read an undeclared mark as not-done. This repository has one such
gate, `scripts/lib/finished-not-closed.mjs:116`, and Phase 3 threads the lane's `marks` into it, so a
declared done mark counts as done there; an undeclared mark there counts as not done, and the record
is not flagged as finished, which is the conservative reading of "unknown".

**The finding comes from the `taskItems()` builder, scoped to the rule.** An undeclared or malformed
box is reported only when the rule could have judged it: when it passes every predicate of the rule
except the two state predicates, which an unread box matches, because it could be either state. A
rule over `work/plans/**` does not red on a `[?]` in `docs/vendor/`; a rule whose selection reaches
the box does. Decision 5's "no existing rule stays blind" holds, because every rule that could have
judged the box reports it.

The kernel never sees an unread box: `getElements()` returns the read boxes, so a condition is never
handed a box it cannot judge, and `examined` counts read boxes only. The builder keeps the unread ones
and adds their findings itself, overriding `collectViolations()` as `CodeBlockRuleBuilder` already
does (`packages/md/src/builders/code-blocks.ts:114`):

```ts
const STATE_PREDICATES = new WeakSet<Predicate<MdTaskItem>>() // areOpen()'s and areChecked()'s

protected override collectViolations(): CollectResult {
  const base = super.collectViolations()
  const inScope = this.unreadBoxes().filter((box) =>
    this._predicates.every((p) => STATE_PREDICATES.has(p) || p.test(box)),
  )
  if (inScope.length === 0) return base
  return collectResult([...base, ...unreadFindings(inScope)], base)
}
```

**One finding per (document, mark), not per box.** An undeclared mark is one missing declaration, so
adopter 3's 1,699 `[?]` would otherwise be 1,699 findings for one line of configuration (ADR-016's
"one per cause"). `md/undeclared-box-mark` is reported once per document per mark, at the first
box's line, with the count and every line in the message. `md/malformed-box` stays per box: each is
its own edit.

```text
work/bugs/fixed/x.md:12 — md/undeclared-box-mark
  `[?]` is not a box mark this rule was told about (3 boxes, lines 12, 18 and 40), so they are
  neither open nor done and no rule can judge them.
  Fix: declare it — taskItems(corpus, { marks: { '?': 'open' } }) (or 'done') — or rewrite each box
  as `[ ]` or `[x]`. If it is not a box, write the bracket escaped (`\[`) or in inline code.
```

Both findings are configuration findings (`bypassFilters: true`): `.excluding()` cannot hide them, and
a `.warn()` rule that carries one fails (`packages/core/src/violation.ts:166`). The finding's identity
is `(file, ruleId, '<relPath> [<mark>]')` for an undeclared mark and `(file, ruleId,
'<relPath>:<line>')` for a malformed box, so the kernel's `dedupeConfigFindings`
(`packages/core/src/dedupe-config-findings.ts:69`) collapses one cause reported by several rules to
one. The note that function appends misdescribes this case, as it already misdescribes the code-block
instrument finding: that wording is [bug 0461](../bugs/0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)'s,
not this plan's, and this plan changes no kernel code.

**`honestyAtClose` takes `marks`** and passes it to both of its box readers, the `taskItems()` rule
(`ledger.ts:697`) and `hasDeferredDisposedBox` (`ledger.ts:380`). A declared open mark is an open
box and needs a disposition token like `[ ]`; a declared done mark is a closed box. An undeclared
mark in a done document is a finding, which is the acceptance row "a done document holding an
undeclared `[~]` reds".

**This repository declares `[~]`.** `scripts/check-ledger.mjs`'s bugs lane passes
`marks: { '~': 'open' }`. That works per lane because each lane builds its own corpus
(`scripts/check-ledger.mjs:89`); a later change that merges the lanes into one corpus must carry the
declaration to every lane. Whether the four boxes then pass as disposed (`DISPOSITION_RE` at
`ledger.ts:204`) is measured in the build, not assumed here.

## Phases

All in one pull request.

### Phase 1 — the model

- Red first, committed before the fix: bug 0445's three-item record (below) through
  `honestyAtClose`, asserting the exact finding set, failing on main.
- `readBoxMark(listItem, source, marks)` in `packages/md/src/model/task-items.ts`: the tree
  definition above (backslash read from `source`), returning `{ mark, state, text } | null`.
- `collectTaskItems(root, options?)`: unchanged for GFM boxes; yields extra, undeclared and
  malformed boxes. The second parameter is optional, so existing callers compile.
- `validateMarks(marks, caller)`: the refusals, shared by the builder and the preset.
- Re-measure this repository's non-GFM boxes, bulleted and ordered, on the parsed tree, and record
  the count here.

### Phase 2 — the builder

- `taskItems(corpus, options?)`; `getElements()` returns read boxes; `areOpen()` and `areChecked()`
  select on `state` and are registered in `STATE_PREDICATES`.
- The `collectViolations()` override and its two finding ids, `md/undeclared-box-mark` and
  `md/malformed-box`, exported as constants beside the builder.

### Phase 3 — the preset and this repository

- `HonestyAtCloseOptions.marks`, passed to both readers; `hasDeferredDisposedBox` and the
  `openTaskItems` peek (`ledger.ts:683`) select on `state`, so the peek stays independent of the
  predicate it protects (the reasoning at `ledger.ts:608`).
- `scripts/check-ledger.mjs` declares `'~': 'open'` on the bugs lane only, the one lane that carries
  the mark.
- `scripts/lib/finished-not-closed.mjs` takes each lane's `marks` and counts a declared done mark as
  done.

### Phase 4 — fixtures, release, docs, the example

- Non-vacuity rows, changeset, `packages/md/README.md` (the task-item section gains `marks`, with one
  shared constant passed to several rules).
- An example under plan 0458's gate, `examples/md/box-marks.test.ts`: "in a closed folder, a
  declared `[~]` counts as open". Built from public blocks only: `corpus()` rooted at the fixture's
  closed folder, `taskItems(c, { marks: { '~': 'open' } }).that().areOpen().should().notExist()`
  (plan 0456's `notExist()`), with a clean fixture and a violating fixture under
  `examples/md/fixtures/box-marks/`. It needs no document predicate, so it does not wait for plan 0457.

## Files changed

- `packages/md/src/model/task-items.ts` — `readBoxMark`, `collectTaskItems(root, options)`,
  `MdTaskItemRef` fields, `validateMarks`.
- `packages/md/src/builders/task-items.ts` — options, `state`-based filters, `STATE_PREDICATES`,
  `collectViolations`.
- `packages/md/src/rules/ledger.ts` — the `marks` option, threaded to both readers.
- `packages/md/src/index.ts` — export `BoxMarkState`, `TaskItemOptions` and the two finding ids.
- `packages/md/tests/builders/task-items-marks.test.ts` (new); `packages/md/tests/rules/ledger.test.ts`.
- `scripts/check-ledger.mjs` — the bugs lane's declaration.
- `scripts/lib/finished-not-closed.mjs` — the lane's `marks`.
- `scripts/nonvacuity/bad-ledger.mjs` — its document count (`docs !== 6` at `:61`) and its `RULES`
  list grow with the two new fixture records; the fixture records themselves under
  `scripts/nonvacuity/bad-ledger/`; `scripts/check-nonvacuity.mjs` — the rows below.
- `packages/md/README.md`; `.changeset/box-marks-are-the-callers.md`.
- `examples/md/box-marks.test.ts` and `examples/md/fixtures/box-marks/` (new).
- `work/bugs/0445-a-checkbox-state-other-than-space-or-x-is-invisible.md` → `work/bugs/fixed/`,
  `BUGS.md`, `ROADMAP.md`.

## Test inventory

Proposal 017's acceptance rows for block 17, each a test through the public entry points
(`taskItems()` and `honestyAtClose()`), never a hand-built stand-in, each asserting finding ids and
lines, not counts:

- A done document holding an undeclared `[~]` reds, with `md/undeclared-box-mark` at its line.
- `- [WIP] x`, `- [1] x`, `- [link](u)` and a defined `- [ref]` stay green and yield no element.
- Declaring a mark clears its finding: the same corpus with `marks: { '~': 'open' }` has none.
- This repository's four `[~]` lines are read once declared: a test over the real tree,
  `taskItems(corpus({ roots: ['work/bugs/**'] }), { marks: { '~': 'open' } }).that().areOpen()
.select()` contains exactly `0249…:160`, `:167`, `:201` and `0256…:130` among its `[~]` boxes. (The
  first draft's "the done-item count rises" could not hold: `doneItems` counts documents,
  `ledger.ts:748`.)

From bug 0445's Verification and the design:

- **Red first:** bug 0445's three-item record (`[~]`, `[?]`, `[ ]` in a `completed/` record with
  `State: Done`) through `honestyAtClose`. Today: exactly `{(ledger/silent-open-box, L3)}`. After:
  exactly `{(md/undeclared-box-mark, L1), (md/undeclared-box-mark, L2), (ledger/silent-open-box,
L3)}`.
- **Not also a silent open box:** the same record with `[~]` and `[?]` undisposed yields no
  `ledger/silent-open-box` at L1 or L2 (the unread box gets one finding with one remedy).
- A declared open `[~]` without a disposition is `ledger/silent-open-box`; with one it is green.
- A declared done `[→]` is a closed box: no finding, counted by `areChecked()`.
- A declared letter mark `[n]` is read; an undeclared `- [o] x` and `- [v] x` are plain list items.
- `- [ x ] a`, `- [x]a`, an empty `- [ ]` and an empty `- [x]` are each `md/malformed-box`; `marks`
  cannot clear them. `- [] is truthy` stays green.
- `- \[*] a` and ``- `[*]` a`` are not marks and yield no finding.
- `- [~] a` beside a definition `[~]: url` yields no element (the documented limit).
- `- […] quoted`: an undeclared mark, reported, and cleared by the escape (pinned, since it is the
  likeliest first false red an adopter meets).
- A `[~]` nested under a GFM box, nested under a plain item, and in an ordered list `1. [~] a`: each
  read.
- `[→]` and `[✅]` are each one grapheme (a test with a combining sequence too).
- **Scope:** an undeclared box in a document the rule's predicates exclude is not reported by that
  rule; a rule whose predicates reach it reports it; a rule with `areOpen()` and one with
  `areChecked()` both report it.
- **Volume:** a document with three undeclared `[?]` yields one finding naming three lines.
- **Cannot be excluded:** `taskItems(c).excluding(<the finding's element>)` still reports
  `md/undeclared-box-mark`.
- **Dedupe:** two rules over one corpus, their violations passed to `dedupeConfigFindings` (from
  `@nielspeter/eess/internal`, which eess-md already depends on), give one finding per cause.
  The appended wording is bug 0461's to pin, not this plan's.
- `collectTaskItems` alone yields an undeclared box with `checked: false`, and `checked` equals
  `state === 'done'` for every element.
- Each refusal of `validateMarks` throws `ArchConfigError` naming the key.
- GFM behaviour unchanged: the existing task-item and ledger suites pass unedited (the testing review
  checked: no fixture under `packages/md/tests/fixtures` carries a non-GFM mark).

**Sabotage**, each red in the named test and green when reverted, run in a worktree:

| change                                               | goes red                                     |
| ---------------------------------------------------- | -------------------------------------------- |
| `readBoxMark` returns `null`                         | the undeclared rows, and the non-vacuity row |
| the undeclared-letter exclusion removed              | the `[1]` and `[o]` rows                     |
| `Intl.Segmenter` replaced by `.length`               | the combining-sequence row                   |
| the malformed-box detection removed                  | the `[ x ]` and empty-box rows               |
| one `validateMarks` refusal removed                  | that refusal's row                           |
| `collectViolations` returns `base`                   | the undeclared rows, the non-vacuity row     |
| the scope filter dropped (every unread box reported) | the scope row                                |
| grouping dropped (one finding per box)               | the volume row                               |
| `bypassFilters` dropped                              | the cannot-be-excluded row                   |
| `areOpen` back to `!t.checked`                       | the not-also-a-silent-open-box row           |
| the preset drops `marks`                             | the declared-mark rows                       |

**`check:nonvacuity`:**

- Two fixture records in `scripts/nonvacuity/bad-ledger/`, a `completed/` record with an undeclared
  `[?]` and one with `[ x ]`, and two rows, `corpus/ledger/undeclared-mark` and
  `corpus/ledger/malformed-box`, each `gateNode('bad-ledger.mjs', …)` with the finding id and line as
  its `mustSay`.
- **This repository's declaration, both ways.** Removing `'~': 'open'` from
  `scripts/check-ledger.mjs` must red `check:ledger` with four `md/undeclared-box-mark` findings at
  `0249…:160/167/201` and `0256…:130` (run in a worktree as a sabotage row, since it edits a tracked
  script). And a probe, `work/bugs/fixed/__nonvacuity_probe_tilde.md` (State `Fixed`, one undisposed
  `- [~] x`), written and removed by `withProbe` (`scripts/check-nonvacuity.mjs:537`), must red
  `check:ledger` with `ledger/silent-open-box`: flipping the declaration to `'done'` turns that row
  green, so the row pins the state, not only the presence.

## Release

eess-md minor, a **flagged break** (`**Breaking (@nielspeter/eess-md)**`):

- a corpus that carries a non-GFM mark, a near-GFM box or an empty box, and passes today, goes red;
- a `.warn()` rule over `taskItems()` that carries one of these findings now fails, because
  configuration findings bypass severity (`packages/core/src/violation.ts:166`);
- `MdTaskItemRef` gains two required fields, `mark` and `state`, which breaks a caller who
  constructs one;
- `areOpen()` no longer selects what is not open, and `areChecked()` selects `state === 'done'`
  (the same set as before for GFM boxes; "checked" and "done" name one state).

Migration line: "declare each mark once, as a shared `marks` constant passed to `taskItems()` and
`honestyAtClose()` — `{ '<mark>': 'open' | 'done' }` — or rewrite the box as `[ ]` or `[x]`; rewrite a
`[ x ]` or an empty box; escape or code-span a bracket that is not a box; add `mark` and `state` to any
`MdTaskItemRef` you construct."

Dependants (bug 0185): measured, eess-crossvalidate lists eess-md as a peer dependency and no
package lists it in `dependencies`; eess-crossvalidate uses no task-item API (grep of
`packages/crossvalidate/src`, nothing). `check:release`'s `release/break-names-dependents` decides
which packages the changeset must name; if it asks for eess-crossvalidate, it is named.

## Out of scope

- **A declared mark that no box uses.** Not reported: a declaration that matches nothing can only
  make a finding appear, never hide one. Recorded here, not decided against.
- **An undeclared letter or digit mark** (`[o]`): a plain list item, a documented blind spot, pinned
  by a test so changing it later is a decision.
- **A mark shadowed by a link definition** (`[~]: url`): not read, pinned by a fixture.
- **Boxes by section** (block 18, `inSections`), which the maintainer did not accept.
- **A mark or box in a blockquote**: neither read nor reported, as GFM boxes there are today.
- **The dedupe note's wording**: [bug 0461](../bugs/0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md).
- **`honestyAtClose`'s fixed `State:` label** (bug 0444) and its rebuild from public blocks (017's
  decision 1).
- **Counting declared marks in `ledgerStats`.** It counts documents, not boxes.

## Review response — 2026-10-18

Each Critical and Important finding of the 2026-10-17 reviews, and what changed:

- **Testing C1, product I3, enforcement I11, method A2 — the example could not be built.** It now uses
  `corpus()` roots and `taskItems().notExist()` from plan 0456, which builds first; no document
  predicate is needed.
- **Architect I1, product I2 — corpus-wide findings broke locality; declaration scope mismatched.**
  Findings are scoped to boxes the rule's non-state predicates reach. Declaration stays per call site,
  decided and reasoned in Design.
- **Architect I2, product I4, method A1 — the dedupe note.** No kernel change; recorded as bug 0461.
  Effort and Release say eess-md only, and that is now true.
- **Product I1 — declared letters refused.** A declared letter or digit is a mark; undeclared ones are
  not, a documented blind spot.
- **Enforcement I8, testing I1 — the done-item row could not hold.** Replaced by a test over the real
  tree naming the four lines, and a sabotage row removing the declaration.
- **Enforcement I9 — no remedy for a list item that is not a box.** Backslash escape (read from the
  source) and inline code, both named in every remedy, with rows. The empty `[]` dropped from the
  grammar.
- **Enforcement I10 — one finding per box.** One per (document, mark) for undeclared marks; malformed
  boxes stay per box.
- **Testing I2 — empty `- [ ]` and `- [x]` undecided.** Both are `md/malformed-box`, with rows.
- **Testing I3 — nothing stopped `'~'` flipping to `'done'`.** The `__nonvacuity_probe_tilde.md` row.
- **Testing I4 — counts, not identity.** The red-first and not-also-silent rows assert exact finding
  sets; red first is Phase 1's first step.
- **Testing I5 — nothing pinned `bypassFilters`.** The cannot-be-excluded row and its sabotage.
- **Minors:** `bad-ledger.mjs` added to Files changed (enforcement M9); `finished-not-closed.mjs`
  threaded (M10); `.warn()` in the break line (M11); link definition, space grapheme, letters and
  blockquote stated (M12, M13); nested and ordered rows (testing M1); escape and ellipsis decided (M2);
  dedupe row moved off `checkAll` to `dedupeConfigFindings` (M3); three sabotage rows added (M4);
  `checked` derived from `state` in one place (architect M4); `checked`/`done` vocabulary and the
  `MdTaskItemRef` migration in the release (product minors); the "already disposed" assertion removed
  and the Close box no longer edits the 017 row, which this PR already set (method minors).
- **Not taken:** none. Narrowed: the corpus-level declaration (product I2) is weighed and not taken,
  with the reason in Design. Bug 0445 does not yet link back to this plan (method minor): a record
  edit outside this file, owed by the coordinator in this PR.

## Progress ledger

- [ ] Phase 1 — red-first test committed failing; the model; the parsed-tree count of this
      repository's non-GFM boxes
- [ ] Phase 2 — the builder, its scoped and grouped findings
- [ ] Phase 3 — `honestyAtClose`'s `marks`; `check:ledger` declaring `[~]`; `finished-not-closed`
      threaded
- [ ] Phase 4 — non-vacuity rows, changeset, README, the example under plan 0458's gate
- [ ] Every acceptance row above green through the public entry points; every sabotage row red
- [ ] Close: bug 0445 → `fixed/`, this plan → `completed/`, boards

Deferred: none
