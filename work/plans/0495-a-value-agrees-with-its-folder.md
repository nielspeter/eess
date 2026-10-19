# Plan 0495: a value agrees with its folder

## Status

- **State:** Draft — written 2026-10-19 from proposal 017's block 5, after
  [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md), which the second Review's
  decision 1 required first. Not reviewed.
- **Implements:** proposal 017
- **Priority:** Medium. Adopters 1 and 2 want it (adopter 1: it "alone removes a whole file", built
  only because `honestyAtClose` reads `State:`, bug 0444); adopter 3 runs the check by hand, one way
  (proposal 017, "Consumer feedback" and "Consumer follow-up").
- **Effort:** Medium. One condition on `docs()`, built on plan 0469's resolver, its findings, an
  example, and this repository's done folders as its first user.
- **Created:** 2026-10-19
- **Builds after:** [plan 0469](./completed/0469-havefield-a-document-has-a-value.md) (built), whose
  per-document resolver it reads values through. It does not need
  [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md) (PR #245, not merged):
  its subjects are documents, so nothing is lifted.
- **Decided by:** [ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md) (no default
  shape: every class, folder, label and the direction come from the caller),
  [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) (a document whose value
  cannot be read is reported, never dropped), [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md).

## Problem

A record's state and the folder it sits in say the same thing twice, and they drift: a closed bug
left in the live folder, an open one moved to `fixed/`. Every adopter checks this by hand, and this
repository checks it twice, in two halves:

- `honestyAtClose`'s `ledger/state-folder-mismatch` (`packages/md/src/rules/ledger.ts:489` and `packages/md/src/rules/ledger.ts:498`),
  over the label `State:` and the plan lane's words unless told otherwise. Adopter 1 wrote a whole
  file around it because its records say `Status:` (bug 0444).
- `corpus/closed-records-sit-in-done-folders` in `scripts/check-corpus.mjs`, composed from
  `haveField`, a folder test and `notExist()`: closing values in live folders only.

The composition is what any caller can write today, and it has three gaps:

1. **An open set.** A rule per class says "a `Done` record is in `completed/`". A value that is in
   no class (`Shipped`, a misspelt `Fxied`) belongs to no rule and passes. Adopter 3's frozen
   records spell "done" about twenty ways; a one-way check over an open set is what hid them
   (proposal 017, decision 4).
2. **No value at all.** A record in a done folder with no readable state matches neither side of
   any rule. Bug 0444's half: "a lane with no readable state is a finding", scoped to the lanes the
   caller declares.
3. **2N rules for N classes,** and no message that names the folder a value belongs in.

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
    classes: [
      { values: ['Draft', 'Ready', 'Parked'], folders: ['work/bugs/*.md'] },
      { values: ['Fixed'], folders: ['work/bugs/fixed/**'] },
      { values: ['Rejected'], folders: ['work/bugs/rejected/**'] },
    ],
    direction: 'both',
  })
  .rule({ id: 'bugs/state-agrees-with-folder' })
```

```typescript
/** One class: the values that belong in its folders (plan 0495). */
export interface FolderClass {
  /** Compared with the document's value after `normalize`. */
  readonly values: readonly string[]
  /** Globs relative to the corpus's `cwd`, as `resideInFolder` takes them. */
  readonly folders: readonly string[]
}

export interface AgreeWithFolderOptions {
  /** Read as `fields()` reads it and resolved as `haveField` resolves it. One value per document. */
  readonly field: Omit<FieldOptions, 'split'>
  readonly classes: readonly FolderClass[]
  /**
   * The kernel's `Direction`. Left is the value, right is the folder:
   * - `'left-to-right'` (value → folder): a document whose value is in a class sits in one of that
   *   class's folders;
   * - `'right-to-left'` (folder → value): a document in a class's folder carries one of that class's
   *   values;
   * - `'both'`.
   */
  readonly direction: Direction
  /** Applied to the value read and to every declared value before they are compared. */
  readonly normalize?: (value: string) => string
}
```

Every option but `normalize` is required, and none has a default (ADR-022 clause 1): two adopters
want one direction and one wants both (proposal 017, "Consumer follow-up"), so the direction is the
caller's to name, not eess-md's to choose. The condition's description names the direction it was
given, so the summary line and every finding's rule text show it: `agree with their folder (State,
value → folder)`.

**Why a condition on `docs()`, and not a predicate pair.** A predicate pair (`valueIn(class)`,
`inFolderOf(class)`) composed with `and()`/`not()` and `notExist()` already exists in effect:
`haveField({ oneOf })`, `resideInFolder()` and `notExist()` are public, and
`corpus/closed-records-sit-in-done-folders` is built from them. That composition is the three gaps
above. A closed set needs the complement of every class, which a selection cannot state without
the caller listing it; "no value in a bound folder" is a third rule per folder; and a selection
answers membership, not which folder a value belongs in. Block 5 is a judgement over a document
with a cause per finding, which is what an md condition is (`haveField` and `haveTable` after
`.should()`), and the subjects are documents, so `inDocuments` (plan 0457) is not needed. It reads
as ADR-003 asks: "docs that reside in `work/bugs/**` should agree with their folder". It is a
method on `DocsRuleBuilder`, not dual-use: as a selector it would be "documents whose value agrees",
which `haveField` and `resideInFolder` already select. ADR-006: a building block, every value the
caller's; ADR-021's `undecided` does not arise, since no predicate is added, and the condition reports
every unreadable value itself. The name follows md's verbs (`haveField`, `haveSection`,
`resideInFolder`); `agreeWithFolder` names the relation, as the proposal's title does.

**Values are read once, by plan 0469's resolver** (`resolveField` and `fieldVerdict` in
`packages/md/src/model/`), never by a second reader: structured forms beat prose, two structured
values conflict, `region: 'header'` bounds the read. A document whose value cannot be read (given
twice, empty, a label in a form the rule does not read) is withheld: it is not judged, and it gets
one finding, the resolver's own message, wherever the verdict depends on it.

**What each document gets.** A document's _bound class_ is the class whose folders contain it; its
_value class_ is the class whose values contain its value. For each selected document:

| the document                         | `left-to-right`        | `right-to-left` | `both`                 |
| ------------------------------------ | ---------------------- | --------------- | ---------------------- |
| bound to K, value in K               | —                      | —               | —                      |
| bound to K, value in J (J ≠ K)       | F1, misplaced          | F2, wrong value | one finding, F2's text |
| bound to no class, value in K        | F1                     | —               | F1                     |
| bound to K, value in no class        | F3, closed set         | F3              | F3                     |
| bound to no class, value in no class | —                      | —               | —                      |
| bound to K, no field                 | —                      | F4, no value    | F4                     |
| bound to no class, no field          | —                      | —               | —                      |
| bound to K, value unreadable         | F5, withheld           | F5              | F5                     |
| bound to no class, value unreadable  | F5                     | —               | F5                     |
| inside the folders of two classes    | F6, in every direction |                 |                        |

Messages, each at the value's line (the document's first line where there is no value):

- **F1** `'Done' (State, line 3) belongs in work/bugs/fixed/**; work/bugs/0123-x.md is in none of its
folders`
- **F2** `work/bugs/fixed/0123-x.md is in a folder of Fixed, but its State is 'Draft' (line 3), which
belongs in work/bugs/*.md`
- **F3** `` `Shipped` at line 3 is none of the declared values (Draft, Ready, Parked, Fixed,
Rejected) `` (proposal 017, decision 4, word for word)
- **F4** `work/bugs/fixed/0123-x.md is in a folder of Fixed and has no State this rule reads`,
  followed by the wrapped labels the document does carry, as `haveField`'s "no field" finding lists
  them
- **F5** the resolver's message (`State is given twice (line 3 'Draft', line 9 'Fixed'); keep one`)
- **F6** `work/bugs/fixed/0123-x.md is in the folders of two classes (Fixed: work/bugs/**, …); bind
each folder to one class`, unsuppressable (`bypassFilters`): it is about the declaration, not the
  document

The closed set holds in every direction where a class is bound: a value read in a bound folder
belongs to a declared class or it is F3. A document in no bound folder with a value in no class is
not this rule's to judge (no class claims it, no folder binds it). That is the boundary, and the
README says so with the remedy: bind the folder, or pair the rule with
`fields(...).resolveAgainst(vocabulary(...))`. F4 is scoped to the caller's bound folders only, never
to every folder under a root, as adopter 3's ledger over stateless folders needs (bug 0444, "Lanes
are the caller's").

**The unchosen direction is not reported.** `left-to-right` never reports F2 or F4; `right-to-left`
never reports F1. A J ≠ K document violates both directions with one fact, so `both` reports it
once.

**Configuration, refused when the rule runs** (an `ArchConfigError` naming the option, ADR-009):
no classes; a class with no values or no folders; an empty value; a value, after `normalize`, in two
classes; one glob in two classes. `split` is excluded by the type: one value per document.

**A class that judges nothing.** Under `right-to-left` a class whose folders hold no selected
document examines nothing, and a mistyped glob would leave it silent: that is a finding naming the
class and its globs, unsuppressable (ADR-010). Under `left-to-right` and `both` a mistyped glob reds
every document carrying the class's values (F1), so it cannot pass silently, and a class with
neither documents nor values in the selection has nothing to misplace. A caller whose done folder is
legitimately empty today leaves its class out of a `right-to-left` rule until the folder exists.

**Evidence.** `examined` is the selected documents (ADR-010); a selection of none is the kernel's
zero-examined finding. Withheld documents are not counted as agreeing: each has its F5.

**Frozen documents.** The condition skips nothing by itself (proposal 017, "Decisions this
settles", 3): a done folder is usually frozen, and it is the folder block 5 most needs to read. A
caller who wants frozen documents out selects with `areLive()` (plan 0457) or a folder glob.

**Dogfooding: this repository's done folders.** `check:corpus` gains one rule per lane, in
`right-to-left`, over the done folders only:

| rule id                                          | field                                    | classes                                                              |
| ------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| `corpus/done-folders-hold-done-values-plans`     | `State`, `bold`, `longestOf(plan words)` | `Done` → `work/plans/completed/**`                                   |
| `corpus/done-folders-hold-done-values-bugs`      | `State`, `bold`, `longestOf(bug words)`  | `Fixed` → `work/bugs/fixed/**`; `Rejected` → `work/bugs/rejected/**` |
| `corpus/done-folders-hold-done-values-proposals` | `State`, `bold`, `region: 'header'`, …   | `Promoted` → `work/proposals/promoted/**`                            |

Measured above: 189 records in these four folders, each with one value, and each value its
folder's, so the rules land green with no exclusion. The three folders that do not exist get no
class (a class over an empty folder is a finding in `right-to-left`); a lane adds one when it first
files a record there.

**Why `corpus/closed-records-sit-in-done-folders` stays, and the two do not overlap.** The partition
is by folder. The existing rule judges the live folders, value → folder, for closing values; the new
rules judge the done folders, folder → value, with a closed set. A closed record in a live folder
is the old rule's; an open, unknown or missing state in a done folder is the new rules'. Neither
reports the other's fact. The old rule also stays because it is ADR-021's selector-position witness
in this repository: its clause 7 row cites it and two `check:nonvacuity` rows plant records under it.
Replacing it would change that ADR's evidence, which is not this plan's.

`check:ledger`'s `ledger/state-folder-mismatch` still reports both halves for all three lanes, so
until plan 0498 a misplaced record reds two gates. That duplication exists today between
`check:ledger` and `corpus/closed-records-sit-in-done-folders`; plan 0498 rebuilds the ledger's
placement half on this block and removes it.

## Phases

1. **The condition.** `agreeWithFolder` over `resolveField`/`fieldVerdict`, the class index
   (normalised values, globs), the configuration refusals, and F1 to F6 with the direction table.
2. **Evidence and the empty class.** The `right-to-left` empty-class finding, and the description
   carrying the direction.
3. **Dogfood, example, docs, release.** The three `check:corpus` rules and their `check:nonvacuity`
   rows; an example under `examples/md/` with a clean and a violating fixture per judgement it
   states (plan 0458's gate); the eess-md README (the boundary and its remedy, the direction table);
   `docs/markdown.md`; `examples/public-surface.test.ts`; a changeset.

## Files changed

- `packages/md/src/builders/agree-with-folder.ts` (new)
- `packages/md/src/builders/docs.ts`
- `packages/md/src/index.ts` (`AgreeWithFolderOptions`, `FolderClass`; `Direction` re-exported from
  the kernel, as `check:family` requires)
- `packages/md/tests/builders/agree-with-folder.test.ts` (new)
- `examples/md/a-record-sits-in-its-states-folder.test.ts` (new) and its fixtures
- `examples/public-surface.test.ts`
- `scripts/check-corpus.mjs`
- `scripts/check-nonvacuity.mjs`
- `packages/md/README.md`
- `docs/markdown.md`
- `.changeset/md-agree-with-folder.md`

## Test inventory

Each finding has rows in both directions it can and cannot appear in. The break class names what
goes silent if the finding is removed.

| finding        | rows                                                                                                                                                           | break class                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| F1 misplaced   | a `Fixed` bug in `work/bugs/`, `left-to-right`: red; the same under `right-to-left`: not reported; a `Fixed` bug in an unbound folder                          | a closed record in a live folder passes (the orphaned close) |
| F2 wrong value | a `Draft` bug in `fixed/`, `right-to-left`: red; under `left-to-right`: F1 for it, never F2; under `both`: exactly one finding                                 | an open record in a done folder passes                       |
| F3 closed set  | `Shipped` in `fixed/`, each direction: red with the decision-4 text; `Shipped` in an unbound folder: not reported                                              | an unknown spelling passes, the gap adopter 3 measured       |
| F4 no value    | a `fixed/` bug with no `State`, `right-to-left`: red, listing its `**Status:**` label; under `left-to-right`: not reported; in an unbound folder: not reported | a done folder of stateless records passes (bug 0444)         |
| F5 withheld    | two `State` lines, empty `State`, `## State: Fixed` under `forms: ['bold']`: one finding each, the resolver's message, not counted as agreeing                 | a conflicted record is read by its first value, or dropped   |
| F6 two classes | `work/bugs/**` and `work/bugs/fixed/**` in two classes: one unsuppressable finding per document in both; `.excluding()` does not remove it                     | the first class wins silently                                |
| configuration  | each refusal above throws, naming the option                                                                                                                   | a malformed declaration judges nothing                       |
| empty class    | `right-to-left` with a class over `work/bugs/fixd/**`: red naming the class; the same class under `both`: every `Fixed` bug is F1                              | a mistyped done folder is silent                             |
| normaliser     | `normalize: (v) => v.toLowerCase()` agrees `fixed` with `Fixed`; without it, F3                                                                                | a normaliser applied to one side only                        |
| frozen         | a frozen document in a bound folder is judged                                                                                                                  | the done folders, frozen by default, go unread               |
| evidence       | a selection of none: the zero-examined finding; the description names the direction                                                                            | a rule over nothing is green                                 |

**Sabotage matrix,** each row red on the test named in its break class, run in a worktree (per this
repository's practice), recorded in the Progress ledger: (1) the direction ignored, always `both`;
(2) the closed set dropped; (3) F4 reported outside the bound folders; (4) F4 dropped; (5) values
read by a first-occurrence reader, not the resolver; (6) `normalize` applied to declared values only;
(7) the first matching class taken on overlap; (8) `both` reporting a J ≠ K document twice; (9) the
empty-class finding dropped; (10) a withheld document counted as agreeing.

**`check:nonvacuity` rows,** one per new rule id (rule-id coverage reads them from
`scripts/check-corpus.mjs`), each planting a probe and requiring the finding by id and file: a
`Draft` plan in `work/plans/completed/` (F3 under the plans rule, since `Draft` is not in its
class); a bug with no `State` in `work/bugs/fixed/` (F4); a proposal in `work/proposals/promoted/`
whose header says `Draft` (F3).

## Release

`@nielspeter/eess-md` minor, additive: one method, two types, one kernel type re-exported.

## Out of scope

- **`honestyAtClose`'s placement half rebuilt on this block,** and its three ratcheted model edges
  (ADR-022): [plan 0498](./0498-honestyatclose-places-a-record-with-block-5.md).
- **`corpus()`'s default frozen folders:** [bug 0497](../bugs/0497-corpus-freezes-two-folder-names-by-default.md).
- **Replacing `corpus/closed-records-sit-in-done-folders`:** see "Why … stays" above.
- **A selector form** ("documents whose value agrees with their folder"): `haveField` and
  `resideInFolder` select that today; no consumer asked for it.
- **A value agreeing with the document's own path** (a number in the filename): block 16, not
  accepted.
- **A value under a named section, not a labelled line:** block 11.
- **Close dates and merge state from git:** adopter 2 keeps them (proposal 017, "What stays
  theirs").
