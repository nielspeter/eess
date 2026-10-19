# Plan 0495: a value agrees with its folder

## Status

- **State:** Done — built on maintainer order 2026-10-19, from Draft (see Build notes). Written
  2026-10-19 from proposal 017's block 5, after
  [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md), which the second Review's
  decision 1 required first. Reviewed the same day in PR #246 (architect · enforcement · method ·
  product) and revised: "Review — 2026-10-19" lists what changed.
- **Implements:** proposal 017
- **Priority:** Medium. Adopters 1 and 2 want it, and adopter 3 runs the check by hand, one way
  (proposal 017, "Consumer feedback" and "Consumer follow-up"). Adopter 1 said it "alone removes a
  whole file", built because `honestyAtClose` read only `State:`. **Note 2026-10-19:** that label
  half is served since bug 0444's fix (`label`/`aliases` and `ledger/no-readable-state`, PR #236), so
  what remains is the closed set, a done folder's missing value, and adopter 2's defect (a closed
  bug left live, an open one filed closed).
- **Effort:** Medium. One condition on `docs()`, built on plan 0469's resolver with one field added
  to its verdict, its findings, an example, and this repository's done folders as its first user.
- **Created:** 2026-10-19
- **Builds after:** [plan 0469](./0469-havefield-a-document-has-a-value.md) (built), whose
  per-document resolver it reads values through. It does not need
  [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md) (merged in PR #245):
  its subjects are documents, so nothing is lifted.
- **Decided by:** [ADR-022](../../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (no default
  shape: every group, folder and label comes from the caller),
  [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (a document whose value
  cannot be read is reported, never dropped), [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md)
  (the denominator is what the verdict rests on).

## Problem

A record's state and the folder it sits in say the same thing twice, and they drift: a closed bug
left in the live folder, an open one moved to `fixed/`. Every adopter checks this by hand, and this
repository checks it twice, in two halves:

- `honestyAtClose`'s `ledger/state-folder-mismatch` (`packages/md/src/rules/ledger.ts:489` and
  `packages/md/src/rules/ledger.ts:498`; pointers in this plan are to the tree that files it, and sit
  ten lines earlier at `9675402`).
- `corpus/closed-records-sit-in-done-folders` in `scripts/check-corpus.mjs`, composed from
  `haveField`, a folder test and `notExist()`: closing values in live folders only.

The composition is what any caller can write today, and it has three gaps:

1. **An open set.** A rule per state says "a `Done` record is in `completed/`". A value that is in
   no rule (`Shipped`, a misspelt `Fxied`) passes. Adopter 3's frozen records spell "done" about
   twenty ways; a one-way check over an open set is what hid them (proposal 017, decision 4).
2. **No value at all.** A record in a done folder with no readable state matches neither side of
   any rule: "a lane with no readable state is a finding", scoped to the lanes the caller declares
   (bug 0444, "Lanes are the caller's").
3. **2N rules for N states,** and no message that names the folder a value belongs in.

## Measured

Commands are run from the repository root at `9675402`, with eess-md's built root.

- **Lanes and documents per folder.** `find work/plans work/bugs work/proposals -type d`, and per
  folder `find "$d" -maxdepth 1 -name '*.md'`, board files (`ROADMAP.md`, `BUGS.md`,
  `PROPOSALS.md`, `README.md`) left out. Three lanes, seven folders, 423 records:

  | folder                     | records | `State` values read |
  | -------------------------- | ------- | ------------------- |
  | `work/plans/`              | 25      | Draft 22, Ready 3   |
  | `work/plans/completed/`    | 47      | Done 47             |
  | `work/bugs/`               | 196     | Draft 193, Parked 3 |
  | `work/bugs/fixed/`         | 136     | Fixed 136           |
  | `work/bugs/rejected/`      | 2       | Rejected 2          |
  | `work/proposals/`          | 13      | Draft 13            |
  | `work/proposals/promoted/` | 4       | Promoted 4          |

- **How the values were read.** `fields(c, { label: 'State', forms: ['bold'], value: longestOf(words) })`
  over `corpus({ roots: ['work/plans/**', 'work/bugs/**', 'work/proposals/**'], frozen: [] })`,
  `words` the union of `scripts/lib/ledger-lanes.mjs`'s vocabularies. Seven distinct values are in
  use; the lanes declare nine (`Open` and `Won't-do` are declared and unused). Every record carries
  one; none is outside its lane's words.
- **Two proposals carry two.** Proposals 010 (lines 3 and 313) and 016 (lines 3 and 508) keep their
  original submission's `**State:**` below the current one. With `region: 'header'` every proposal
  resolves to one value; plans and bugs keep `State` under a `## Status` section, so the header
  region reads none of their 406 records. One field spec per lane.
- **Folders the lanes name that do not exist:** `work/plans/wont-do/`, `work/plans/archived/` and
  `work/proposals/rejected/` (`scripts/lib/ledger-lanes.mjs` lists them as done folders).

## Design

**A condition on `docs()`:**

```typescript
import { corpus, docs, longestOf } from '@nielspeter/eess-md'

const c = corpus({ roots: ['work/bugs/**'], frozen: [] })
const words = ['Draft', 'Ready', 'Parked', 'Fixed', 'Rejected']

docs(c)
  .that()
  .resideInFolder('work/bugs/**')
  .should()
  .agreeWithFolder({
    field: { label: 'State', forms: ['bold'], value: longestOf(words) },
    groups: [
      { values: ['Draft', 'Ready', 'Parked'], folders: 'rest' },
      { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
      { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
    ],
    direction: 'both', // value → folder and folder → value
  })
  .rule({ id: 'bugs/state-agrees-with-folder' })
```

```typescript
/** One group: the values that belong in its folders (plan 0495). */
export interface FolderGroup {
  /** Compared with the document's value after `normalize`. */
  readonly values: readonly string[]
  /**
   * Globs relative to the corpus's `cwd`, as `resideInFolder` takes them; or `'rest'`: every
   * selected document that is in no other group's folders. At most one group per rule is `'rest'`.
   */
  readonly folders: readonly string[] | 'rest'
}

export interface AgreeWithFolderOptions {
  /** Read as `fields()` reads it and resolved as `haveField` resolves it. One value per document. */
  readonly field: Omit<FieldOptions, 'split'>
  readonly groups: readonly FolderGroup[]
  /**
   * The kernel's `Direction`. Left is the value, right is the folder:
   * - `'left-to-right'` (value → folder): a document whose value is in a group sits in one of that
   *   group's folders;
   * - `'right-to-left'` (folder → value): a document in a group's folders carries one of that
   *   group's values;
   * - `'both'`.
   */
  readonly direction: Direction
  /** Applied to the value read and to every declared value before they are compared. Default: none. */
  readonly normalize?: (value: string) => string
}
```

**Options.** Every option but `normalize` is required. `direction` has no default because the
adopters split on it (two want one direction and one wants both, proposal 017, "Consumer
follow-up"), so it is the caller's to name; the README says why, since elsewhere in the family
(`RelationSpec.direction?`) a direction is optional. `normalize` defaults to none (exact strings),
unlike `vocabulary()`, which trims: the field's own `value` already cuts the value, and a second
silent change to it would be hidden. `field` is nested rather than spread as `haveField`'s options
are, because it sits beside `groups` and `direction`, which are not field options; a flat object
would mix three concerns. The option is `groups`, not `classes`, which is the entry point of eess-ts
and eess-mermaid.

**Why the kernel's `Direction`, and how it is kept readable.** One word for one idea across the
family: `correspondence()` and `completeness()` read `'left-to-right'` as "each left element has its
right counterpart", and here it is "each value has its folder", the same relation with the value on
the left. The cost is that left and right are not positional here (PR #246's product review). So
every README and example call carries the arrow as a trailing comment (`// value → folder`), and the
condition's description prints it: the summary line and every finding's rule text read `agree with
their folder (State, value → folder)`. ADR-017's drift is a word whose meaning changes; this keeps
the relation and names its sides.

**Why string values, not `Allowed`.** `haveField` takes `oneOf: Allowed` (a vocabulary or a regular
expression). A group's values must be a finite set: two groups may not share a value, which can be
refused when the rule runs only for strings, and F2 needs to name the group a value belongs to. A
regular expression group would turn the refusal into a finding per document. The prefix and
case-insensitive matching the adopters asked for are the field's `value` cut and `normalize`.
Adopter 3's twenty spellings of "done" are not a group's to accept: they sit in frozen folders its
rule does not select (D7 below).

**Why a condition on `docs()`, and not a predicate pair.** A predicate pair composed with
`and()`/`not()` and `notExist()` exists in effect: `haveField({ oneOf })`, `resideInFolder()` and
`notExist()` are public, and `corpus/closed-records-sit-in-done-folders` is built from them. That
composition is the three gaps above. A closed set needs the complement of every group, which a
selection cannot state without the caller listing it; "no value in a bound folder" is a third rule
per folder; and a selection answers membership, not which folder a value belongs in. Block 5 is a
judgement over a document with a cause per finding, which is what an md condition is (`haveField`
and `haveTable` after `.should()`), and the subjects are documents, so `inDocuments` (plan 0457) is
not needed. It reads as ADR-003 asks: "docs that reside in `work/bugs/**` should agree with their
folder". It is not dual-use: as a selector it would be "documents whose value agrees", which
`haveField` and `resideInFolder` already select, and ADR-021's `undecided` does not arise, since no
predicate is added. The condition reports every unreadable value itself.

**Values are read once, by plan 0469's resolver.** `fieldVerdict`
(`packages/md/src/model/field-verdict.ts`) gains the resolved occurrence: `FieldVerdict` adds
`occurrence?: FieldOccurrence`, set exactly when `resolved` is true, so block 5 takes the value from
the verdict and never calls `resolveField` a second time. Structured forms beat prose, two
structured values conflict, `region: 'header'` bounds the read. The condition passes no allowed set;
the groups judge the value.

- **A value is unreadable** when the verdict is not `resolved` and carries an `unreadable` cause
  (given twice, empty, a label in a form the rule does not read, past an unclosed fence, outside the
  header). That document is withheld, and is F5.
- **A value is absent** when the verdict is not `resolved` and its one cause is `absent`. That
  document is F4 where it is reported, with the resolver's `absent` message verbatim, its hint
  included ("line N has `State: x`, a plain line this rule does not read…", or the wrapped labels
  the document carries).
- **A resolved value's side causes** (prose that disagrees with it, a label elsewhere in a form the
  rule does not read) are reported alongside the judgement, wherever the document is judged, with
  the resolver's messages. A document that agrees with its folder can still carry them. Every rule
  that reads the field reports them, so in this repository a disagreeing prose `State:` is reported
  by `corpus/state-present` (`haveField`), by the new `done-folders-*` rule, and after plan 0498 by
  the ledger, each under its own id. The README says so; plan 0498's "one placement check" step
  decides which rule keeps them (PR #246's verification, architect N3).

**What each document gets.** A document's _bound group_ is the group whose folders contain it (a
`'rest'` group binds every selected document no other group binds); its _value group_ is the group
whose values contain its value. For each selected document:

| the document                         | `left-to-right` | `right-to-left` | `both`     |
| ------------------------------------ | --------------- | --------------- | ---------- |
| bound to K, value in K               | —               | —               | —          |
| bound to K, value in J (J ≠ K)       | F2              | F2              | F2         |
| bound to no group, value in K        | F1              | —               | F1         |
| bound to K, value in no group        | F3              | F3              | F3         |
| bound to no group, value in no group | —               | —               | —          |
| bound to K, no value                 | —               | F4              | F4         |
| bound to no group, no value          | —               | —               | —          |
| bound to K, value unreadable         | F5              | F5              | F5         |
| bound to no group, value unreadable  | F5              | —               | F5         |
| resolved value with side causes      | each cause      | each cause      | each cause |

and, once per rule, F6 (a document under the folders of two groups), F7 (a dead folder glob) and F8
(an empty group).

Messages, each at the value's line (the document's first line where there is no value):

- **F1 unplaced.** `` `Fixed` (State, line 3) belongs in work/bugs/fixed/**; work/bugs/0123-x.md is
in none of its folders. Move it or change the value. ``
- **F2 wrong folder.** ``wrong folder: `Draft` (State, line 3) belongs outside work/bugs/fixed/**,
work/bugs/rejected/**; work/bugs/fixed/0123-x.md is in Fixed's folders. Move it or change the
value.`` For a value whose group has globs, "belongs in <its globs>".
- **F3 unknown value.** `` `Shipped` at line 3 is none of the declared values (Draft, Ready, Parked,
Fixed, Rejected) `` (proposal 017, decision 4, word for word), with "fix the spelling, or add it to
  a group".
- **F4 no value.** `work/bugs/fixed/0123-x.md is in Fixed's folders and has` followed by the
  resolver's `absent` message (`no State field (read as bold); its labels: Status`).
- **F5 withheld.** The resolver's message (`State is given twice (line 3 'Draft', line 9 'Fixed');
keep one`).
- **F6 two groups.** One finding per overlapping pair of groups: `work/bugs/** (Draft, Ready) and
work/bugs/fixed/** (Fixed) both bind 136 documents, first work/bugs/fixed/0001-a.md,
work/bugs/fixed/0002-b.md; bind each folder to one group, or make one group 'rest'`.
- **F7 dead glob.** `Fixed's folder work/bugs/fxed/** matches no path in the corpus; if it is a
typo, correct it; if the folder has no record yet, file the first one there, or leave the group
out`, one per group and glob, in every direction. A mistyped glob would otherwise read, under
  `left-to-right` and `both`, as N records "belonging in" the typo (PR #246's enforcement review).
  F7 reads the corpus's file index, which spans the repository: a glob that names a real folder
  elsewhere in the repository is not F7, even if no document of the rule's lane sits there. F8
  covers that under `right-to-left` (no corpus document in the group's folders), and a preset that
  binds folders per lane judges F7 within the lane (plan 0498).
  - **Only for globs the caller wrote** (PR #246's verification, decision E3). A glob a preset
    supplies as its own default (plan 0498 binds `honestyAtClose`'s five default done folders) is
    not the caller's typo, and most lanes have two of the five. For such a group, F7 fires once,
    only when every one of its globs matches nothing. The mechanism is internal: the preset builds
    each default glob through an `/internal` helper that marks it in a module-private `WeakSet` (or
    tags the group the same way), and the condition reads that mark. No public option exists, so an
    adopter cannot switch F7 off for globs they wrote.
  - **Why this departs from md's selector policy.** md's selector diagnostics rule that "a glob that
    names nothing in the repository is never a fault" (bug 0355's ruling,
    `packages/md/src/model/selector-fault.ts:20`). That holds for a selection, which may
    legitimately be empty. A group's folder is different: it is where a value is required to sit, so
    a dead one turns every record carrying the value into a false F1/F2. Its text faults (a leading
    `/`, `../`, a backslash) are judged by the same `mdSelectorFault`, not a second copy.
  - **Which glob position F7's globs are, and why** (batch review, architect M2). A group's folder
    globs are not on the rule's glob tree: they are neither a `selector` (they select nothing; the
    rule's `.that()` does) nor a `condition` glob in the kernel's sense (`isFaultPosition`, bug
    0014: a dead condition glob is a satisfied assertion). They are closest to `discovery`: they
    define the population a value is required to sit in, so a dead one judges nothing, and the
    kernel calls a dead discovery glob a fault. To reuse md's text diagnosis, each is stamped as a
    positive `selector` site for `mdSelectorFault` only; that label is a means of reaching the
    diagnosis, not a claim about the glob. md now holds three stances on an empty glob, each argued
    where it lives: a selector's is never a fault (bug 0355), a group folder's is F7 (here), and
    `corpus({ frozen })` refuses a dead frozen glob ([bug 0499](../../bugs/fixed/0499-corpus-does-not-check-its-frozen-globs.md)).
    One record for all three belongs to ADR-018 once it is accepted; until then, kernel glob tooling
    (`doctor`, the path universe) does not see a group's folders.
- **F8 empty group.** Under `right-to-left`, `Fixed's folders hold no document in the corpus; the
group judges nothing`. Computed over the corpus, not the selection, so a caller can narrow with
  `.that().resideInFolder(...)` and still declare every group (D2). A `'rest'` group has no globs,
  so F7 and F8 do not apply to it.

F1 and F2 now part on one question: does the value belong to a declared group. A value of a declared
group in another group's folder is F2, a placement fault with "move it or change the value"; only a
value in no group is F3, a spelling fault (PR #246, decision D3). A document in no bound folder with
a value in no group is not this rule's: no group claims it, no folder binds it. The README says so,
with the remedy: bind the folder, add a `'rest'` group, or pair the rule with
`fields(...).resolveAgainst(vocabulary(...))`. F4 is scoped to bound folders only, never to every
folder under a root (bug 0444, "Lanes are the caller's").

**The unchosen direction is not reported.** `left-to-right` never reports F4; `right-to-left`
never reports F1, nor F5 outside a bound folder. A value in J sitting in K's folder violates both
directions with one fact, so it is one F2 in every direction.

**With a `'rest'` group, direction matters only for F4 and F5.** `'rest'` binds every selected
document, so F1 cannot occur and every placement fault is F2 in every direction. A one-way rule ("a
closed folder must not hold a live value") is then made by the **selection**, as all three worked
examples below do, not by `direction`. The README's direction table says so, so a reader reaches for
the selection (PR #246's verification, product N1).

**The complement group.** One group may say `folders: 'rest'` (PR #246, decision D4). It is opt-in,
at most one per rule, and binds the selected documents in no other group's folders. With it, a lane
whose done folder is nested (`work/bugs/fixed/**`) declares its live side without enumerating
folders or writing extglobs: live = `'rest'`, done = `work/bugs/fixed/**`. It is also what plan
0498 needs, since `honestyAtClose`'s live side is "not a done folder". F6 stays for explicit globs:
`work/bugs/**` and `work/bugs/fixed/**` in two groups still overlap. An identical glob in two groups
is refused when the rule runs; overlapping different globs surface as F6 only when a document lands
in both, which fails closed.

**Configuration, refused when the rule runs** (an `ArchConfigError` naming the option, ADR-009): no
groups; a group with no values or with an empty folder list; an empty value; a value, after
`normalize`, in two groups; one glob in two groups; two `'rest'` groups. `split` is excluded by the
type: one value per document.

**Superseded 2026-10-19 (batch review):** the paragraph below is the design first built. The
`examined` override it describes was deleted: `examined` is the kernel's (the documents selected),
and an agreement that judged none is its own unsuppressable finding, naming its cause. See Build
notes, "Decision D1, rebuilt after the batch review".

**Evidence: `examined` counts the documents judged** (PR #246, decision D1). Under `left-to-right`,
the selected documents whose value was read (resolved); under `right-to-left`, the selected
documents in a bound folder (a `'rest'` group binds); under `both`, the union. Zero judged is the
kernel's zero-examined finding, so a `left-to-right` rule with a misspelt label (`Sate`), the wrong
`forms`, or `region: 'header'` over records whose `State` sits under `## Status` reads no value and
is red, not green over N. Withheld documents are not counted as agreeing: each has its F5. Under
`left-to-right` a document is judged only when its value is in a group or the document is bound: a
document in no bound folder whose value is in no group gets no verdict ("—" above), so it is not
counted, and a rule whose groups name only misspelt values (`Fixd`) over unbound documents is red,
not green over N (PR #246's verification, enforcement N3).

**Suppression.** F1 to F5 are findings about a document's content and are suppressible like
`haveField`'s condition findings (`.excluding()`, a comment, a baseline). F6, F7, F8 and the
configuration refusals are about the declaration, carry `bypassFilters`, and are not.

**Frozen documents.** The condition skips nothing by itself (proposal 017, "Decisions this
settles", 3): a done folder is usually frozen, and it is the folder block 5 most needs to read. A
caller who wants frozen documents out selects with `areLive()` (plan 0457) or a folder glob.

### One worked example per adopter

Each is an acceptance row (Test inventory) and a fixture pair under the example. The paths are
generic; the shapes are the ones the adopters described. Which adopter asked for which direction is
inferred: proposal 017's "Consumer follow-up" says "one adopter" wants one direction and "the other"
both, without numbering them, and adopter 2's own defect (a closed bug left live, an open one filed
closed) fits "both". So the first two examples are named by shape, and only adopter 3, whose answer
the proposal records by number, is named (PR #246's verification, method N2).

Every example reads the field with `region: 'header'`. The adopters said they need it: one carries a
register of `- **Status:** open.` items below its real Status, and adopter 3 has per-phase status
lines and chains `## Status:` into `## Severity:` and `## Priority:` headings (proposal 017,
"Consumer follow-up"). Without the region, the register is a conflict (F5) and the per-phase lines
are side causes, so a fixture without those lines would pass while the adopter's real records went
red. Each fixture carries the shape its adopter described (decision E4).

- **One direction: a closed folder must not hold a live value.** Select the done folders, declare
  every group, `right-to-left`:

  ```typescript
  docs(c)
    .that()
    .resideInFolder('issues/closed/**')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['bold'], region: 'header' },
      groups: [
        { values: ['open', 'in progress'], folders: 'rest' },
        { values: ['closed', "won't fix"], folders: ['issues/closed/**'] },
      ],
      direction: 'right-to-left', // folder → value
    })
  ```

  `issues/closed/12.md` with `open` prints F2: ``wrong folder: `open` (Status, line 3) belongs
outside issues/closed/**; issues/closed/12.md is in closed's folders. Move it or change the value.``
  A closed issue in `issues/` is not selected and not reported, which is the one direction asked
  for. An issue in `issues/closed/` with no `Status` prints F4. The fixture's closed issue carries a
  register of `- **Status:** open.` feedback items below its header and stays green: the region
  does not read them.

- **Both directions.** Select the lane, live = `'rest'`, `both`:

  ```typescript
  docs(c)
    .that()
    .resideInFolder('bugs/**')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['bold'], region: 'header' },
      groups: [
        { values: ['open', 'in progress'], folders: 'rest' },
        { values: ['fixed'], folders: ['bugs/fixed/**'] },
      ],
      direction: 'both', // value → folder and folder → value
    })
  ```

  A closed bug in `bugs/`: ``wrong folder: `fixed` (Status, line 3) belongs in bugs/fixed/**; …``.
  An open bug in `bugs/fixed/`: ``wrong folder: `open` (Status, line 3) belongs outside
bugs/fixed/**; …``. Both are adopter 2's reported defect, one F2 each. A fixed bug whose register
  below the header says `- **Status:** open.` is not F5: the region bounds the read.

- **Adopter 3: one way, green over its frozen spellings.** Select the live folders, `left-to-right`:

  ```typescript
  docs(c)
    .that()
    .resideInFolder('records/*.md')
    .should()
    .agreeWithFolder({
      field: { label: 'Status', forms: ['heading', 'bold'], region: 'header' },
      groups: [
        { values: ['Open', 'In progress'], folders: 'rest' },
        { values: ['Done'], folders: ['records/done/**'] },
      ],
      direction: 'left-to-right', // value → folder
    })
  ```

  A live record whose Status is `Done` prints F2: ``wrong folder: `Done` (Status, line 2) belongs
in records/done/**; …``. The frozen records under `records/done/`, with their twenty spellings,
  are not selected, so the rule stays green over them; the fixture holds three of those spellings
  to prove it. The live fixtures open with `## Status: Open` followed by `## Severity:` and
  `## Priority:` headings, and carry per-phase status lines further down; the region reads the
  first and not the second, so both stay green. A live record with a misspelt `Opne` prints F3,
  since `'rest'` binds it; a caller who does not want that leaves the live group out, and a live
  misspelling then goes unjudged. When the example ships, it is sent to adopter 3, who answered
  "not adopted: 5 as specified", with the question whether it would adopt this shape (product N3).

All three are expressible after D1 to D6.

### Dogfooding: this repository's done folders

`check:corpus` gains one rule per lane, `right-to-left`, selecting the lane's done folders and
declaring the live group as `'rest'`, so an open state in a done folder is F2, not F3:

| rule id                                          | selection                       | field                                    | groups                                                                                                      |
| ------------------------------------------------ | ------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `corpus/done-folders-hold-done-values-plans`     | `work/plans/completed/**`       | `State`, `bold`, `longestOf(plan words)` | `Draft`, `Ready`, `Open` → `'rest'`; `Done` → `work/plans/completed/**`                                     |
| `corpus/done-folders-hold-done-values-bugs`      | `work/bugs/{fixed,rejected}/**` | `State`, `bold`, `longestOf(bug words)`  | `Draft`, `Ready`, `Parked` → `'rest'`; `Fixed` → `work/bugs/fixed/**`; `Rejected` → `work/bugs/rejected/**` |
| `corpus/done-folders-hold-done-values-proposals` | `work/proposals/promoted/**`    | `State`, `bold`, `region: 'header'`, …   | `Draft` → `'rest'`; `Promoted` → `work/proposals/promoted/**`                                               |

Measured above: 189 records in these four folders, each with one value and each its folder's, so
the rules land green with no exclusion. The three done folders that do not exist get no group (F7
would refuse a glob that matches nothing), so `Won't-do` and a proposal's `Rejected` are values in
no group: such a record in a done folder these rules select (`completed/`, `fixed/`, `rejected/`,
`promoted/`) is F3, and a lane adds the group when it first files there. A record filed in
`work/plans/wont-do/` itself is outside every selection here and not judged by these rules;
`ledger/state-folder-mismatch` covers it today, and plan 0498 keeps that coverage (PR #246's
verification, enforcement N2).

**What covers a misspelt state in a live folder here** (PR #246, decision D8): not these rules, which
select only done folders. `corpus/state-in-vocabulary-plans` and `-bugs` (`check:corpus`) and
`ledger/unknown-state` (`check:ledger`, `packages/md/src/rules/ledger.ts:477`) do. Plan 0498 keeps
`ledger/unknown-state` when it rebuilds the placement half.

**Why `corpus/closed-records-sit-in-done-folders` stays, and the two do not overlap.** The partition
is by selection. The existing rule judges the live folders, value → folder, for closing values; the
new rules select only the done folders. A closed record in a live folder is the old rule's; an open,
unknown or missing state in a done folder is the new rules'. Neither reports the other's fact. The
old rule also stays because it is ADR-021's selector-position witness in this repository: its clause
7 row cites it and two `check:nonvacuity` rows plant records under it. Replacing it would change that
ADR's evidence, which is not this plan's.

`check:ledger`'s `ledger/state-folder-mismatch` still reports both halves for all three lanes, so
until plan 0498 a misplaced record reds two gates. That duplication exists today between
`check:ledger` and `corpus/closed-records-sit-in-done-folders`; plan 0498 rebuilds the ledger's
placement half on this block and decides which rule stays.

## Phases

1. **The verdict and the condition.** `FieldVerdict.occurrence`; `agreeWithFolder` over it, the
   group index (normalised values, globs, `'rest'`), the configuration refusals, and F1 to F5 with
   the direction table and the side causes.
2. **The declaration's findings and the evidence.** F6 per group pair, F7 against the corpus's file
   index, F8 over the corpus's documents, `examined` as judged documents, and the description
   carrying the direction.
3. **Dogfood, example, docs, release.** The three `check:corpus` rules and their `check:nonvacuity`
   rows; an example under `examples/md/` with a clean and a violating fixture per judgement it
   states, the three adopter shapes among them (plan 0458's gate); the eess-md README (the boundary
   and its remedy, the direction table, why `direction` is required); `docs/markdown.md`;
   `examples/public-surface.test.ts`; a changeset.

## Files changed

- `packages/md/src/model/field-verdict.ts` (`occurrence` on a resolved verdict)
- `packages/md/src/conditions/agree-with-folder.ts` (new; md's conditions live in `conditions/`)
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts` (`AgreeWithFolderOptions`, `FolderGroup`; `Direction` re-exported from
  the kernel, as `check:family` requires)
- `packages/md/tests/conditions/agree-with-folder.test.ts` (new)
- `examples/md/a-record-sits-in-its-states-folder.test.ts` (new) and its fixtures
- `examples/public-surface.test.ts`
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `docs/markdown.md`
- `.changeset/md-agree-with-folder.md`

## Test inventory

Each finding has rows in the directions it can and cannot appear in. The break class names what goes
silent if the finding is removed.

| finding          | rows                                                                                                                                                                                                                                            | break class                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| F1 unplaced      | a `Fixed` bug in an unbound folder, `left-to-right`: red; `right-to-left`: not reported                                                                                                                                                         | a closed record outside every bound folder passes                  |
| F2 wrong folder  | a `Draft` bug in `fixed/` and a `Fixed` bug in `work/bugs/`, each direction: one F2, its text pinned, "belongs outside" for a `'rest'` value and "belongs in" otherwise                                                                         | a misplaced record passes, or is told to fix its spelling          |
| F3 unknown value | `Shipped` in `fixed/`, each direction: red with the decision-4 text; `Shipped` in an unbound folder: not reported; `Draft` in `fixed/`: F2, never F3                                                                                            | an unknown spelling passes, the gap adopter 3 measured             |
| F4 no value      | a `fixed/` bug with no `State` and a `**Status:**` label, `right-to-left`: red with the resolver's message verbatim; a plain `State: Fixed` line: the plain-line hint; `left-to-right`: not reported; unbound: not reported                     | a done folder of stateless records passes (bug 0444)               |
| F5 withheld      | two `State` lines, empty `State`, `## State: Fixed` under `forms: ['bold']`: one finding each, the resolver's message, not counted in `examined`                                                                                                | a conflicted record is read by its first value, or dropped         |
| side causes      | `**State:** Fixed` in `fixed/` with prose saying `State: Draft`: agrees, and the prose cause is reported, under `right-to-left` and `both`; under `left-to-right` too, the document's value being read                                          | a resolved record's contradiction is dropped                       |
| F6 two groups    | `work/bugs/**` and `work/bugs/fixed/**` in two groups: one finding for the pair, naming the count and the first documents; `.excluding()` does not remove it                                                                                    | the first group wins silently                                      |
| F7 dead glob     | a group over `work/bugs/fxed/**`, each direction: one finding naming the group and glob and the empty-folder remedy, and no F1 per record; a group of preset-default globs (marked internally) with one live glob: no F7, and with none: one F7 | a mistyped folder is reported as N misplaced records               |
| F8 empty group   | `right-to-left`, a group whose glob matches only non-Markdown files: red; a live group outside a done-folder selection: not reported (computed over the corpus)                                                                                 | a group that judges nothing is silent                              |
| `'rest'`         | live = `'rest'`, done = `work/bugs/fixed/**` over a nested lane: no F6, and a live value in `fixed/` is F2; two `'rest'` groups: refused                                                                                                        | a nested lane needs extglobs, or overlaps                          |
| configuration    | each refusal above throws, naming the option                                                                                                                                                                                                    | a malformed declaration judges nothing                             |
| normaliser       | `normalize: (v) => v.toLowerCase()` agrees `fixed` with `Fixed`; without it, F3                                                                                                                                                                 | a normaliser applied to one side only                              |
| frozen           | a frozen document in a bound folder is judged                                                                                                                                                                                                   | the done folders, frozen by default, go unread                     |
| evidence         | superseded 2026-10-19, see Build notes' D1: `left-to-right` with label `Sate`: zero judged, the zero-examined finding; `right-to-left` counts only documents in bound folders; the description names the direction                              | a rule that judged nothing is green over N                         |
| one direction    | the first worked example: F2 for `open` in `issues/closed/`, nothing for `closed` in `issues/`, green over a register below the header                                                                                                          | the one-way rule reports the direction its adopter did not ask for |
| both directions  | the second: one F2 each way, a register below the header not F5                                                                                                                                                                                 | one of adopter 2's two defects passes                              |
| adopter 3        | the third: F2 for a live `Done`, green over three frozen spellings in `records/done/`, over a `## Severity:` chain and over per-phase status lines                                                                                              | adopter 3's frozen records go red                                  |

**Sabotage matrix,** each row red on the test named in its break class, run in a worktree and
recorded in the Progress ledger below: (1) the direction ignored, always `both`; (2) the closed set
dropped; (3) F4 reported outside the bound folders; (4) F4 dropped; (5) values read by a
first-occurrence reader, not the resolver; (6) `normalize` applied to declared values only; (7) the
first matching group taken on overlap; (8) `both` reporting a J ≠ K document twice; (9) F8 dropped;
(10) a withheld document counted as agreeing; (11) `examined` counting selected documents, not
judged ones (red on the `Sate` row); (12) F7 dropped, so a dead glob is reported as F1s; (13) F6 made
suppressible (`bypassFilters` dropped, so `.excluding()` silences it); (14) the two-groups refusal
removed, so the first group wins; (15) frozen documents skipped; (16) F2 folded back into F3 for a
value of a declared group; (17) the side causes dropped.

**`check:nonvacuity` rows,** one per new rule id (rule-id coverage reads them from
`scripts/check-corpus.mjs`), each planting a probe and requiring the finding by id, file and message:
a `Draft` plan in `work/plans/completed/` (F2, "belongs outside"); a bug with no `State` in
`work/bugs/fixed/` (F4); a proposal in `work/proposals/promoted/` whose header says `Draft` (F2).

## Release

`@nielspeter/eess-md` minor, additive: one method, two types, one kernel type re-exported, and one
optional field on an internal verdict.

## Out of scope

- **`honestyAtClose`'s placement half rebuilt on this block** and its `model/label.ts` edge:
  [plan 0498](../0498-honestyatclose-places-a-record-with-block-5.md). Its other two edges:
  [plan 0504](../0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md).
- **`corpus()`'s default frozen folders:** [bug 0497](../../bugs/0497-corpus-freezes-two-folder-names-by-default.md).
- **Replacing `corpus/closed-records-sit-in-done-folders`:** see "Why … stays" above.
- **A selector form** ("documents whose value agrees with their folder"): `haveField` and
  `resideInFolder` select that today; no consumer asked for it.
- **A value agreeing with the document's own path** (a number in the filename): block 16, not
  accepted.
- **A value under a named section, not a labelled line:** block 11.
- **Close dates and merge state from git:** adopter 2 keeps them (proposal 017, "What stays
  theirs").

## Review — 2026-10-19

PR #246 was reviewed by four lenses (architect, enforcement, method, product). The coordinator's
decisions, each overrulable, and where they landed above:

- **D1** `examined` counts judged documents, with the misspelt-label sabotage row (enforcement C1,
  architect M6). Superseded 2026-10-19 by the batch review: see Build notes.
- **D2** a group's emptiness is computed over the corpus (architect I1).
- **D3** F3 split: a value of a declared group in another group's folder is F2; the dogfood declares
  its live group (architect I1, enforcement I5, product I1).
- **D4** the `'rest'` group (product I2, architect I3).
- **D5** a dead glob is one configuration finding, F7 (enforcement I4).
- **D6** `FieldVerdict` exposes the resolved occurrence; F5 is "not resolved, with an unreadable
  cause"; side causes are reported; F4 carries the `absent` message verbatim (architect I2,
  enforcement I6).
- **D7** one worked example and acceptance row per adopter (product I1).
- **D8** the gates covering a live misspelling, kept by plan 0498 (enforcement I5).
- Also taken: F6 once per group pair (architect M7, enforcement M1); string values over `Allowed`,
  and `normalize`'s default, explained (architect M8, product I5); the file in `conditions/`
  (architect M9); the kernel's `Direction` kept with the arrow on every call (product I4); `groups`
  for `classes` (product M1); the nested `field` explained (product M2); `direction` required for the
  adopters' split, not ADR-022 (product M5); suppression stated, and the sabotage rows enforcement M6
  listed; the bug 0444 note (method M4); this Progress ledger (method M3).

**Verification round, 2026-10-19.** PR #246's four verification reviews; the coordinator's
decisions: **E3** F7 per glob only for globs the caller wrote, a preset's default globs marked
internally and reported only when all of a group's are dead; **E4** `region: 'header'` in every
worked example, with the register, `## Severity:` chain and per-phase lines in the fixtures. Also
taken: F7's message names the empty-folder case (enforcement N1) and the departure from md's
selector policy, reusing `mdSelectorFault` (architect N2); `wont-do/` outside every selection here,
covered by the ledger (enforcement N2); `left-to-right` counts a document only when it gets a
verdict (enforcement N3, architect M6 residue); side causes reported by every rule that reads the
field (architect N3); with `'rest'`, a one-way rule is made by the selection (product N1); the
examples named by shape where the record does not number the adopter (method N2); adopter 3 asked
again when the example ships (product N3).

## Build notes

Where the build departed from the text above, or decided what it left open, each overrulable:

- **Built from Draft, on maintainer order 2026-10-19.** The `plan-build` ritual refuses a Draft; the
  order came with the plan's two review rounds settled, and the decisions below are the ones the
  code met.
- **Decision D1, rebuilt after the batch review (2026-10-19).** The first build overrode
  `examined` in `DocsRuleBuilder.collectViolations`: when every condition was an `agreeWithFolder`,
  `examined` became the documents one of them judged, so a misspelt label read as zero examined.
  The enforcement review measured three greens that design made or kept: with `.expectEmpty()`, a
  rule that selected three documents and judged none read as "empty, as declared" and never
  expired (C1); beside any other condition the kernel's count stood, so a broken agreement passed
  (I1); and beside a second agreement the union hid the broken one (I1). The override is deleted:
  the kernel's `examined` (the documents selected) stands, so a declaration expires as the kernel
  decides. Instead each agreement that ran over a non-empty selection and gave no document a
  verdict reports `selected N documents, judged none: the field read no value (check its label,
forms or region)`, unsuppressable, whatever conditions sit beside it. A judged document is still
  one that gets a verdict in the table above (agrees, F1 to F4); a withheld one (F5), one under two
  groups (F6) and one whose value's group has a dead folder (F7) are not. The redundant `copy()`
  override went with it (architect M5): `agreeWithFolder` always assigns a fresh array.
- **F6 is computed over the selection,** the documents the rule would judge, and such a document gets
  no per-document verdict: the group pair is its one finding, at the first shared document (its file,
  line 1). F7 and F8 are about no document (file `''`, line 0), as `codeBlocks()`' instrument finding
  is. All three carry `bypassFilters`.
- **A dead folder withholds its values' placement findings in every direction,** not only under
  `left-to-right`: with a `'rest'` group, a mistyped done folder leaves the real one bound to `'rest'`,
  and each record there would be F2 "belongs in <the typo>" under `right-to-left` too. For a
  caller's group, one dead glob marks the group dead; for a preset-default group, all of them must be.
- **F7 names a selector fault when md's diagnosis finds one.** `mdSelectorFault` judges each glob as a
  positive selector site; a text fault (a leading `/`), Markdown under the glob that the corpus did
  not load, or a backslash separator gives its own cause and remedy (`Fixed's folder
/work/bugs/fixed/**: a leading `/`can never match …. Write the glob as`work/bugs/fixed/\*\*`.`).
  Otherwise a glob that matches no path in the corpus's file index gets the plan's message.
- **Refusals run in `collectViolations`, before the kernel's,** so a malformed declaration throws
  over an empty selection too. One refusal the plan did not list: a `direction` outside the three,
  for callers in plain JavaScript (`scripts/check-corpus.mjs` is one), since the type alone requires
  it.
- **A `'rest'` group is named with its marker** in F2 and F4: `bugs/8.md is in open's folders
('rest')`, since a `'rest'` group has no globs to name.
- **The default mark has no home yet.** The first build exported `markDefaultFolders(group)` on
  `@nielspeter/eess-md/internal`. The batch review removed it (architect I1, enforcement I2): its
  only planned caller, `honestyAtClose` under `packages/md/src/rules/`, may import only the md root
  and the kernel root (ADR-022 clause 3, `md/rules-import-only-the-root`), and any adopter could
  import `/internal` and turn F7 off for globs they wrote. The verify round then deleted the
  writerless `WeakSet` and its F7 branch too (architect N2, testing N1): untested code whose only
  job was to soften a fail-closed finding. Every glob is judged as the caller's. Plan 0498 adds the
  mark, with its test, when it adds a writer; recorded there.
- **Judged none names its cause** (verify round, enforcement N1). A selection whose values were
  read but whose every document sits in no group's folders, with a value no group names, is not a
  misspelt label: the live values are undeclared, or the selection misses the bound folders. That
  case says `N selected documents carry values no group names (Draft, Open) and sit in no group's
folders: declare them in a 'rest' group, or select a folder a group binds`; only when no value
  was read does it say `the field read no value`. Both stay unsuppressable. Sabotage row C1 below.
- **The values are a closed set within the bound folders,** not "in every direction" as the first
  JSDoc, README and docs said (enforcement I3): a document in no group's folders whose value is in no
  group gets no verdict. A `'rest'` group closes the set everywhere. The claim is narrowed; the code
  is unchanged.
- **`mdSelectorFault` and `repoRelativeTextProblem` moved to `packages/md/src/model/selector-fault.ts`**
  (architect M1), so `conditions/` and `corpus.ts` no longer import from `builders/`.
- **The example is one file with five judgements,** each `violating-*` folder a copy of `clean/`
  with one defect, so swapping any of them into `clean/` reds that shape's clean test. Removing
  `region: 'header'` from the three rules reds all eight tests (measured): the register, the
  `## Severity:` chain and the per-phase lines are load-bearing.
- **The dogfood measured 190 records,** not 189: 48 plans, 138 bugs and 4 proposals in done folders
  at this branch's base, each with its folder's value. The three rules land green with no exclusion;
  `check:corpus` prints them on a `done` line.
- **Measured:** the md suite is 566 tests in about 3 s, 30 of them in
  `tests/conditions/agree-with-folder.test.ts`; `check:corpus` about 6.5 s.
- **Red first:** the test file was written before the condition and run against the code without it:
  30 of 30 red (`agreeWithFolder` is not a function), which proves the file drives the public entry
  but nothing per row. The per-row evidence is the matrix below.

### Sabotage matrix

Run at `af6a6cc4` (pre-rebase), each mutant applied to `packages/md/src/conditions/agree-with-folder.ts` (row 11:
`packages/md/src/builders/docs.ts`), `tests/conditions/agree-with-folder.test.ts` run, and the file
restored with `git checkout`. Every row red; the test named is the one its break class names.

| row | mutant                                         | red on                                                                                          |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | the direction ignored, always `both`           | F1 (not reported under `right-to-left`), F4 (not under `left-to-right`), `Sate`, the counts (4) |
| 2   | the closed set dropped                         | F3 in a bound folder; the normaliser row (2)                                                    |
| 3   | F4 reported outside the bound folders          | "F4: an unbound record with no value is not reported"                                           |
| 4   | F4 dropped                                     | both F4 rows (2)                                                                                |
| 5   | values read by a first-occurrence reader       | F5 (given twice); the side-causes row (2)                                                       |
| 6   | `normalize` applied to declared values only    | the normaliser row                                                                              |
| 7   | the first matching group taken on overlap      | F6                                                                                              |
| 8   | `both` reporting a J ≠ K document twice        | both F2 rows; the `'rest'` row (3)                                                              |
| 9   | F8 dropped                                     | F8                                                                                              |
| 10  | a withheld document counted as agreeing        | F5 (`examined` 3); re-run on the rebuilt D1: the F5 row's withheld-only selection               |
| 11  | `examined` counting selected documents         | retired: since the batch review this is the design (see D1 above)                               |
| 12  | F7 dropped, so a dead glob is reported as F1s  | both F7 rows (2)                                                                                |
| 13  | F6 made suppressible (`bypassFilters` dropped) | F6 (`.excluding()` removed it)                                                                  |
| 14  | the two-groups refusal removed                 | both value-in-two-groups refusals (2)                                                           |
| 15  | frozen documents skipped                       | the frozen row                                                                                  |
| 16  | F2 folded back into F3                         | both F2 rows; the `'rest'` row (3)                                                              |
| 17  | the side causes dropped                        | the side-causes row                                                                             |
| 18  | the preset-default mark ignored (not listed)   | retired with the mark's export and its test (batch review A2)                                   |
| 19  | F1 dropped (not listed)                        | F1; the folder-to-value count row (2)                                                           |

**Batch review fix pass, 2026-10-19,** on branch `batchfix/afw`, after the code commit. Same method;
row 10 above was re-run here.

| row | mutant                                                                   | red on                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1a | the judged-none finding dropped                                          | all four judged-none shapes; the F5 withheld-only selection; the unbound `Fixd` selection (6)                                                                                           |
| A1b | the first design back: `examined` 0 when an agreement judged none        | "declared empty: the declaration expires, and the finding stands"; alone; beside `beUniqueBy`; F5; `Fixd` (5)                                                                           |
| A1c | judged none reported only when every condition is an agreement           | "a misspelt label beside another condition is red, and examined is the selection"                                                                                                       |
| A1d | judged none over the union of agreements                                 | "a misspelt label beside a good agreement is red on its own"                                                                                                                            |
| A4  | an unbound unreadable value silent under value → folder (testing I1)     | "F5: an unbound value that cannot be read is reported value to folder, not folder to value"                                                                                             |
| A5  | the `direction` refusal removed (testing I2)                             | "refuses an unknown direction when the rule runs, as a JavaScript caller can write one"                                                                                                 |
| A6  | a dead group's value reported in a bound folder (testing M1)             | the F7 dead-glob row, now with a `Fixed` record in a live folder                                                                                                                        |
| A14 | a no-value record not judged (testing M2)                                | "F4: a record with no value is judged, so a selection of only such records is not judged none"                                                                                          |
| M3  | a frozen record told it is misspelt (testing M3, the identity assertion) | "a frozen record in a bound folder is judged"                                                                                                                                           |
| C1  | judged none always says "the field read no value" (verify round)         | "a selection whose values no group names, outside every bound folder, is judged none"; "a live folder whose values no group names reads as undeclared values, not a misspelt label" (2) |

Testing I3's mutant (`onlyAgreements` forced true) no longer has code to apply to; its rule,
`examined` beside another condition is the selection, is pinned by the `beUniqueBy` row, red under
A1b.

The three `check:nonvacuity` rows were each run by hand before the gate: a `Draft` plan probe in
`work/plans/completed/`, a stateless bug probe in `work/bugs/fixed/` and a `Draft` proposal probe in
`work/proposals/promoted/`, each exit 1 with the finding on its rule id, file and message.

## Progress ledger

- [x] Phase 1: the verdict's `occurrence`, the condition, F1 to F5, the side causes (`80fac1ef`, pre-rebase)
- [x] Phase 2: F6, F7, F8, `examined`, the description (`80fac1ef`, pre-rebase)
- [x] Phase 3: dogfood rules and nonvacuity rows, the example with the three adopter shapes, docs,
      changeset (`a8d1144c`, `af6a6cc4`, both pre-rebase)
- [x] Sabotage matrix, rows 1 to 17, each recorded red here with the commit it ran on (and rows 18
      and 19, which the plan did not list)
- [x] `deferred→proposal 017` sending the third worked example to adopter 3, with the question
      whether it would adopt this shape (product N3): adopter contact is the maintainer's, not this
      branch's; recorded in proposal 017's "Consumer follow-up"
- [ ] validation-owed: `npm run validate` green, and CI green, on PR #251 at its final head;
      duration reported. The verify-round fixes ran targeted tests and gates only, by the
      coordinator's instruction.
- [x] Close: this plan → `completed/`; ROADMAP row; links in ADR-022, plan 0498 and proposal 017

Deferred: proposal 017
