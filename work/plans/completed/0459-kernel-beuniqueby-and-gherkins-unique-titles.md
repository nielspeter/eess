# Plan 0459: the kernel's `beUniqueBy`, and eess-gherkin's unique titles rebuilt on it

## Status

- **State:** Done — built 2026-10-19 from the reviewed Draft, as plans 0456 and 0486 were; split
  from [plan 0456](./0456-kernel-notexist-and-dead-glob.md) after PR #235's review (method, B2: one
  plan held two independent kernel conditions, a break in a third package and a dogfood rule).
- **Implements:** proposal 017
- **Priority:** Medium. Two of the three adopters want block 13 (017, "Consumer feedback"), and
  this repository adopts it for record numbers (017, second Review's conditions).
- **Effort:** Medium. One kernel condition, one eess-md builder method, one eess-gherkin condition
  rebuilt (a break), one rule in `check:corpus` with its non-vacuity row. One pull request.
- **Created:** 2026-10-18
- **Builds after:** [plan 0456](./0456-kernel-notexist-and-dead-glob.md) (it uses 0456's `/internal`
  shape and md's root exports) and [plan 0458](./0458-the-examples-gate-a-document-shape-from-public-blocks-only.md)
  (the examples gate). Build order (maintainer, 2026-10-18): 0458 → 0456 → 0454 → 0457 → 0455 →
  **0459**.

## Problem

**"No two elements carry the same value"** (017 block 13: a record's number, a page's slug)
cannot be written in eess-md. eess-gherkin has one, `haveUniqueTitles`
(`packages/gherkin/src/builder.ts:20`), private to gherkin. Two dialects now ask, so 017's
decision 4 makes it a kernel condition with gherkin's rebuilt on it.

Gherkin's today (`packages/gherkin/src/builder.ts:20-44`) reports the second and later occurrences
of a title within one feature file, each naming the first, with the reason "ambiguous for
citation resolution" (`builder.ts:35`). It builds its violation inline, the third copy of the
context-to-violation spread (md's `mdViolation`, `packages/md/src/model/violation.ts:13`, and
`packages/md/src/builders/vocabulary.ts:146` are the others).

This repository's record numbers are checked today by `check:numbers`
(`kit/scripts/next-number.mjs --check`), the portable kit's script, which may not depend on eess.
017's condition is that this repository's own gate states block 13 in eess-md.

## Design

### Kernel: `uniqueByCondition`, behind `/internal`

Placed by the same rule as plan 0456's `notExistCondition`: it is a factory a dialect writes, and
an adopter writes `docs(c).…should().beUniqueBy(…)`. So it is family plumbing (ADR-011), exported
from `packages/core/src/internal.ts`, and it takes the dialect's own violation constructor so a
code frame survives.

```ts
// packages/core/src/unique-by.ts (new)
export interface UniqueByOptions<T> {
  /** The value compared. Exact string equality; normalisation is the caller's. */
  readonly key: (element: T) => string
  /** How a message names an element and where it is: `guides/a.md:1`. */
  readonly locate: (element: T) => { readonly name: string; readonly at: string }
  /** What the key is, for the message: "record number", "title within its feature file". */
  readonly what: string
  /** Optional: why a duplicate matters, appended to the message. */
  readonly why?: string
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

export function uniqueByCondition<T>(opts: UniqueByOptions<T>): Condition<T> {
  return Object.freeze({
    description: `be unique by ${opts.what}`,
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] => {
      const groups = new Map<string, T[]>()
      for (const e of elements) {
        const k = opts.key(e)
        const group = groups.get(k)
        if (group) group.push(e)
        else groups.set(k, [e])
      }
      const out: ArchViolation[] = []
      for (const group of groups.values()) {
        if (group.length < 2) continue
        for (const [i, e] of group.entries()) {
          const others = group.filter((_, j) => j !== i).map((o) => opts.locate(o).at)
          const tail = opts.why === undefined ? '' : `; ${opts.why}`
          // At most LISTED locations, then "+N more": a group of k members gives k findings,
          // and listing all k-1 others in each would be k² text for a large group.
          const listed = others.slice(0, LISTED).join(', ')
          const more = others.length > LISTED ? ` and ${String(others.length - LISTED)} more` : ''
          const msg = `${opts.locate(e).name} has the same ${opts.what} as ${String(others.length)} other${others.length === 1 ? '' : 's'}: ${listed}${more}${tail}`
          out.push(opts.toViolation(e, msg, ctx))
        }
      }
      return out
    },
  })
}
```

Decisions, each overrulable:

- **Exact keys. Narrowed from 017's block-13 condition.** The condition says values compare
  "through block 1's normaliser", so `066` and `0066` collide. Block 1 is not built; here the
  caller's `key` is the normaliser, and the kernel compares strings exactly. When block 1 ships,
  its normalised value is what a caller passes as `key`. This is a narrowing, stated as one
  (enforcement M1).
- **Every member is a finding, at its own line, naming all the others.** 017's condition ("every
  member of a group is named"). An exclusion or a baseline entry for one member cannot hide the
  group.
- **The denominator is values, not documents.** One element yields one key, so `examined` is the
  number of values compared.
- **At most ten other locations per message** (`LISTED = 10`), then "and N more". Every member is
  still a finding at its own line; only the list inside each message is capped (architect, round
  two, 0459 minor).
- **A key is a string, never `undefined`.** An element without a value is removed with `.that()`
  first; a key function that may return nothing would let a broken key shrink the comparison.
- **Not cardinality-exempt.** Zero elements is the kernel's ordinary zero-examined finding. One
  element is evidence: green, `examined` 1. That settles 017's carried question, "a selection of
  one under block 13".
- **A key that throws** propagates: the rule fails as a thrown error, not as a pass.
- **Messages name `relPath`, not the absolute file** (enforcement M4, testing 0456-M3), so a
  message is the same on every machine.
- **Frozen** like every kernel condition factory, though it carries no exemption, so mutating it
  can only make a rule wrong, not silently exempt. One test pins it; no sabotage row claims more.

### eess-md: `docs().beUniqueBy(key, what)`

```ts
// packages/md/src/builders/docs.ts
/** No two matched documents share `key`'s value. Exact match: normalise in `key`. */
beUniqueBy(key: (d: MdDocument) => string, what: string): this {
  return this.addCondition(
    uniqueByCondition({
      key,
      what,
      locate: (d) => ({ name: d.relPath, at: `${d.relPath}:1` }),
      toViolation: (d, message, context) =>
        mdViolation({ element: d.relPath, file: d.file, line: 1, message, context }),
    }),
  )
}
```

`what` rather than `label`: in eess-md "label" already means a field's label (`**Label:**`,
`links().areLabelled(label)`), and one word should mean one thing (product, minor; ADR-017).
Only `docs()` gains it; a value-level `beUniqueBy` waits for block 1's field elements.

### eess-gherkin: `haveUniqueTitles` rebuilt

```ts
const haveUniqueTitles = (): Condition<GherkinScenario> =>
  uniqueByCondition({
    key: (s) => `${s.relPath}\0${s.title}`,
    locate: (s) => ({ name: `${s.relPath} › ${s.title}`, at: `${s.relPath}:${String(s.line)}` }),
    what: 'title',
    why: 'titles must be unique within a feature file, or a citation of one is ambiguous',
    toViolation: scenarioViolation,
  })
```

`scenarioViolation` replaces the inline spread at `builder.ts:29-39`, so gherkin's conditions keep
one constructor. Its `element` becomes `<relPath>:<line> › <title>`: with the line in it, every
member of a group has its own element, so one `.excluding('a.feature › Login')` no longer hides the
whole group (enforcement, round two m14). That is a visible change, listed in the break below.

**A break for eess-gherkin, accepted by the maintainer 2026-10-18.** What changes:

- the first occurrence is now reported too, so a duplicate pair gives two findings, not one;
- the message changes from `duplicate scenario title "X" (first at line N) — ambiguous for
citation resolution` to `<relPath> › X has the same title as 1 other: <relPath>:N; titles must be
unique within a feature file, or a citation of one is ambiguous`;
- the finding's `element` gains the line (`<relPath>:<line> › <title>`), so an `.excluding()`
  pattern or a baseline entry written against the old element no longer matches;
- a waiver on the second occurrence used to hide the pair entirely; now the first occurrence still
  reds (product, Important 5).

Migration line, in the changeset: "`haveUniqueTitles` now reports every member of a duplicate
group, each naming the others, and its element carries the line. Update tests, baselines and
`.excluding()` patterns keyed on the old message, count or element. A waiver on one occurrence no
longer hides the pair: rename the scenario." Measured: no workspace
package lists eess-gherkin in `dependencies` (eess-crossvalidate has it as a peer), so
`release/break-names-dependents` names nobody.

### Dogfood: this repository's record numbers

`scripts/check-corpus.mjs` gains one rule over `work/**`, with a per-check count line like its
other checks:

```js
// scripts/check-corpus.mjs (.mjs, so fenced as js)
const recordNumber = (d) => /(?:^|\/)(\d{3,4})-[^/]*(?:\/README)?\.md$/.exec(d.relPath)?.[1] ?? ''

const records = docs(c)
  .that()
  .resideInFolder('work/**')
  .and()
  .satisfy({ description: 'are numbered records', test: (d) => recordNumber(d) !== '' })

records
  .should()
  .beUniqueBy(recordNumber, 'record number')
  .rule({ id: 'corpus/record-number-unique' })
// prints: "record numbers  N values across N documents · ✓ no number claimed twice"
```

- The key reads the digits as written, so `066` and `0066` stay distinct: the corpus's own rule,
  one sequence per number width (`/plan`, step 2).
- Directory-form records (`work/spikes/0001-eess-over-ts-archunit/README.md`) are keyed by their
  folder, so they are in the denominator (testing, 0456-I3). Measured 2026-10-18 with
  `git ls-files` on main: 409 numbered record files and 1 directory-form record, no number
  claimed twice, so the rule lands green.
- The key cannot throw: the predicate guarantees a match, and the key falls back to `''`
  (architect M8). A hand-built predicate is fine here: `scripts/` is not under plan 0458's gate.
- The rule is not filtered by `isProbeArtifact` (`scripts/check-corpus.mjs:517`), or its
  non-vacuity probe would be invisible to it.
- `check:numbers` stays. It is the kit's script; this is the dialect's own statement of the same
  judgement, which 017's condition asks for. Double-gating is deliberate; if the two disagree, that
  is a finding about one of them.

## Phases

All in one pull request.

### Phase 1: the kernel

- `packages/core/src/unique-by.ts`; export `uniqueByCondition` and `UniqueByOptions` from
  `internal.ts`.

### Phase 2: eess-md

- `DocsRuleBuilder.beUniqueBy(key, what)`.
- `packages/md/README.md`: a uniqueness example, compiled by `check:docs-code`.
- The example under plan 0458's gate, `examples/md/unique-slugs.test.ts`: "no two pages under
  `guides/` share a slug". Fixture folders `clean/` and `violating-shared-slug/`, one per judgement
  the example states, under 0458's contract; test titles start with the folder's name and a colon
  (`clean: …`, `violating-shared-slug: …`), as 0458 lines 101 and 300 say. `beUniqueBy` is not a
  cardinality condition, so the clean test's `examined > 0` holds without a wider selection.

### Phase 3: eess-gherkin

- Rebuild `haveUniqueTitles` on `uniqueByCondition`; `scenarioViolation` replaces the inline
  spread.
- Update `packages/gherkin/tests/builder.test.ts` and `waiver-in-doc-string.test.ts`.

### Phase 4: dogfood

- `corpus/record-number-unique` in `scripts/check-corpus.mjs`, with its count line.
- Its non-vacuity row (Test inventory).

## Files changed

| file                                          | change                                        |
| --------------------------------------------- | --------------------------------------------- |
| `packages/core/src/unique-by.ts`              | new                                           |
| `packages/core/src/internal.ts`               | export `uniqueByCondition`, `UniqueByOptions` |
| `packages/core/tests/unique-by.test.ts`       | new                                           |
| `packages/md/src/builders/docs.ts`            | `beUniqueBy()`                                |
| `packages/md/tests/docs-unique-by.test.ts`    | new                                           |
| `packages/md/README.md`                       | one example                                   |
| `examples/md/unique-slugs.test.ts` + fixtures | new (plan 0458's gate)                        |
| `packages/gherkin/src/builder.ts`             | `haveUniqueTitles` on `uniqueByCondition`     |
| `packages/gherkin/tests/*.test.ts`            | new count, message and rows                   |
| `scripts/check-corpus.mjs`                    | `corpus/record-number-unique`, count line     |
| `scripts/check-nonvacuity.mjs`                | `gateCorpusProbeDir`; two rows                |
| `.changeset/*.md`                             | kernel minor, md minor, gherkin minor (break) |

## Test inventory

Every test drives the public entry point and the terminal (`.violations()`/`.check()`).

**Kernel** (`unique-by.test.ts`), through a minimal `RuleBuilder` subclass:

- a group of three gives three findings, each naming the other two by `relPath:line`;
- two distinct groups are reported separately;
- all-distinct keys are green;
- exact keys: `'066'`/`'0066'` distinct; `'A'`/`'a'` distinct; `'7'`/`'7 '` distinct (testing,
  0456-I2);
- one element is green, with `examined` 1;
- zero elements is the kernel's zero-examined finding, asserted by its message prefix and
  `bypassFilters`, not by a count (testing, 0456-M2);
- a throwing key propagates;
- `why` is appended when given and absent when not;
- a group of twelve lists ten other locations and "and 1 more" in each of its twelve findings;
- the condition is frozen (assigning `evaluate` throws).

**eess-md** (`docs-unique-by.test.ts`), over `corpus()` on a fixture directory: a duplicate names
both documents by `relPath`; distinct values are green.

**eess-gherkin**:

- a duplicate pair in one feature file gives two findings, each at its own line;
- the same title in two different feature files is green (pins the per-file key; testing,
  0456-I5);
- `.excluding('<relPath>:<line> › <title>')` for one member hides that member only; the other
  member of the pair still reds;
- `waiver-in-doc-string.test.ts` keeps its original point: a waiver inside a doc string does not
  suppress, asserted on the line of the member it targets.

**Sabotage rows**, run in a worktree. Each must turn its named test red:

1. `uniqueByCondition` returns `[]`: the duplicate test reds.
2. It reports only `group[1..]`: the three-member test reds.
3. It lowercases keys: the `'A'`/`'a'` test reds.
4. It trims keys: the `'7'`/`'7 '` test reds.
5. gherkin's key drops `relPath`: the two-files test reds.
6. `recordNumber` returns the same value for every record: `check:corpus` reds on this repository.
7. `uniqueByCondition` is wrapped in `marksAssertsCardinality`: the zero-elements test reds, because
   the rule would pass on an empty selection (testing, round two M10).
8. The location list is not capped: the twelve-member test's length assertion reds.

**Non-vacuity**: two rows in `scripts/check-nonvacuity.mjs`, each running the real
`scripts/check-corpus.mjs` in json and terminal modes, as `gateCorpusProbe`
(`scripts/check-nonvacuity.mjs:1260`) does. `gateCorpusProbe` writes its probe with `withProbe`,
which does not create a directory (`:537-543`), so the rows use a `gateCorpusProbeDir` variant over
`withProbeDir` (`:554`), which creates and removes the probe folder (testing, round two M8):

- `work/__nonvacuity_probe_dup__/0001-dup.md` reuses the directory-form record's number
  (`work/spikes/0001-eess-over-ts-archunit/README.md`);
- `work/__nonvacuity_probe_dup__/0439-dup.md` reuses a flat record's number
  (`work/bugs/fixed/0439-the-family-fails-to-load-under-bun-from-eess-0-5-1.md`).

Each requires exit 1 in both modes and `firedOn` the rule id at both members' paths, the probe and
the real record, so a key that collides the probe only with itself cannot pass (enforcement, round
two m15; testing, round two M9).

## Release

- `@nielspeter/eess`: minor (new `/internal` export).
- `@nielspeter/eess-md`: minor (`docs().beUniqueBy()`).
- `@nielspeter/eess-gherkin`: minor, marked **Breaking (@nielspeter/eess-gherkin)**, with the
  migration line above. No package names it in `dependencies`.

## Out of scope

- `beUniqueBy` on md builders other than `docs()`; a value-level form waits for block 1.
- Normalising keys in the kernel (block 1's normaliser).
- Retiring `check:numbers`.

## Review response — 2026-10-18

These findings were made against plan 0456 before the split; they apply here.

- **method B2** (0456 too big): split into this plan.
- **method B3** (gherkin break settled in a Draft): put to the maintainer, accepted 2026-10-18.
- **product I5** (no migration line; the waived-second-occurrence change missing): both added.
- **enforcement I2 / testing 0456-I3** (dogfood probe unnamed, must drive the real gate, directory
  records): `gateCorpusProbe` on the real script, both modes; directory-form records keyed.
- **enforcement I3** (denominator not printed): the rule prints its count line.
- **enforcement M1** (`066`/`0066` reads as compliance): stated as a narrowing.
- **enforcement M3 / product minor** (gherkin drops its reason): carried as `why`.
- **enforcement M4 / testing 0456-M3** (absolute paths in messages): `relPath`.
- **testing 0456-I2** (case-only row missing): case and whitespace pairs, with sabotage rows.
- **testing 0456-I5** (gherkin key and waiver rows): added.
- **testing 0456-M1, M2** (freeze row decoration; zero-elements assertion): the freeze is one test
  with no sabotage row claiming more; zero elements asserts the finding.
- **product minor** (`label` means something else in md): renamed `what`.
- **architect I4 / product I2** (root name collision): `uniqueByCondition` behind `/internal`,
  by the same rule as 0456.
- **architect M5** (fourth copy of the violation spread): gherkin gets `scenarioViolation`; the
  kernel builds no violation.
- **architect M8 / method minor** (a key that throws; `ts` fence on `.mjs`): a non-throwing key;
  fenced `js`.

### Round two

- **architect 0459 minor** (quadratic location lists): capped at ten per message, with a test and a
  sabotage row.
- **product 0459 minor 1** (`what` reads awkwardly in gherkin's message): `what: 'title'`, with the
  scope in `why`.
- **enforcement m14** (one `.excluding()` hides a whole gherkin group): the element carries the
  line; a test pins that an exclusion hides one member only; the change is listed in the break and
  its migration line.
- **enforcement m15 / testing M9** (`firedOn` names only the probe; the only `0001` is
  directory-form): two probes, a directory-form and a flat collision, each asserting both paths.
- **testing M8** (`withProbe` cannot create the probe's folder): a `gateCorpusProbeDir` over
  `withProbeDir`.
- **testing M10** (no sabotage for "not cardinality-exempt"): row 7.
- **method m10** (the Close box repeats 017's row, already `Accepted`): dropped.
- **coordinator decision 3** (freeze at marking): unchanged here; `uniqueByCondition` is not marked,
  so it freezes itself, as before.

### Round three

- **method N7 / coordinator decision 1** (the example still read "a clean and a violating
  fixture"): `clean/` and `violating-shared-slug/` under 0458's contract, with titles that start
  with the folder name and a colon.

### Round five

- **method R5-5 / coordinator decision 5** (a stale line saying the board row was someone else's):
  deleted; the board's `Blocked on` for this plan reads "plans 0456, 0458".

## Build notes — 2026-10-19

Built as written, at commit 76ca7ba on `main` 9675402. What differs from the text above, each
decided from the ADRs and overrulable:

- **eess-gherkin re-exports the `ConditionContext` type.** `scenarioViolation` names it, and
  `check:family` (plan 0089) requires a dialect to re-export every kernel symbol its own source
  imports; the first run red on exactly that. Additive, and named in gherkin's changeset.
- **gherkin's `load.test.ts` denominator is 8 feature files, not 6.** The per-file-key test needs two
  fixtures, `same-title-a.feature` and `same-title-b.feature`; that test counts every fixture under
  `**/*.feature` on purpose, so it was updated rather than the fixtures hidden.
- **`scenarioViolation` keeps gherkin's conditional spread** (`ruleId`, `because`, `suggestion` and
  `docs` omitted when undefined) rather than md's explicit-`undefined` shape, so gherkin's findings
  serialise as before apart from the listed break.
- **The dogfood rule carries a `because` and a `suggestion`** (`npm run next-number`); the plan's
  sketch had neither, and every other rule in `check:corpus` has both.
- **The count line** reads `numbers   N record number(s), one per numbered record under work/ · ✓ no
number claimed twice`, not "N values across N documents": one document yields one value, so the
  two counts are the same number. On this tree N is 445 (the plan measured 409 + 1 on 2026-10-18);
  `git ls-files 'work/**/*.md'` filtered by the same pattern also gives 445, the directory-form record
  among them.
- **`gateCorpusProbeDir` also requires the terminal run to print the rule's own message**
  (`has the same record number as 1 other`). A probe directory under `work/` can red another rule
  (the Lanes table reads `work/`'s directories), so exit 1 alone could be borrowed. The plan's
  `gateCorpusProbe` asserts exit 1 only, as its precedent `gateCorpusWorkPointer` does.
- **Each row takes a list of fragments** and asserts `firedOn` for every one: the probe and the real
  record it collides with.
- **The freeze test asserts `Object.isFrozen`**, as plan 0456's `notExist` test does, rather than
  assigning to `evaluate`; no sabotage row claims it.
- **Both READMEs**: eess-md gains the section the plan names; eess-gherkin gains one sentence under
  its example saying every member is reported and what the element is, since its example is where an
  adopter meets the changed behaviour.

**Red first, on base 9675402.** `packages/core/tests/unique-by.test.ts`: 12 of 12 failed
(`uniqueByCondition` not exported). `packages/md/tests/docs-unique-by.test.ts`: 2 of 2 failed
(`beUniqueBy is not a function`). eess-gherkin's three changed tests (every member, the exclusion,
the waiver) failed; the two-files test passed on base, as a pin of a key the rebuild could lose
(sabotage row 5 proves it holds). The example was not run on base: it calls the method md's test
showed missing.

**Sabotage matrix, 2026-10-19, at 76ca7ba.** Each row: the mutant applied, the kernel rebuilt where
it changed, the named test run with `-t`, the file restored by `git checkout`, the tree clean after.
Rows 1–5, 7 and 8 took 0.8–1.8 s each; row 6 took 6.7 s (a full `check:corpus`).

| Row | Mutant                                                | Named test                                                                            | Result |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| 1   | `uniqueByCondition`'s `evaluate` returns `[]`         | a group of three gives three findings, each naming the other two                      | red    |
| 2   | it skips the first member of each group               | a group of three gives three findings, each naming the other two                      | red    |
| 3   | it lowercases keys                                    | compares keys exactly: A and a are distinct                                           | red    |
| 4   | it trims keys                                         | compares keys exactly: 7 and 7-space are distinct                                     | red    |
| 5   | gherkin's key is the title alone                      | passes the same title in two different feature files                                  | red    |
| 6   | `check:corpus` keys every numbered record by `'1'`    | `node scripts/check-corpus.mjs`: exit 1, `✗ 445 finding(s)`                           | red    |
| 7   | `Object.freeze` replaced by `marksAssertsCardinality` | zero elements is the kernel zero-examined finding, not a pass                         | red    |
| 8   | `LISTED = Infinity`                                   | a group of twelve lists ten other locations and 1 more in each of its twelve findings | red    |

Row 6's first mutant mixed `||` with `??`, a syntax error, so the script died before judging
anything; it was rewritten as a key function the rule is handed instead, and run again.

**Non-vacuity**, run alone with `QA_ONLY`: `corpus/record-number-unique` and
`corpus/record-number-unique/directory-form` OK (json exit 1 naming both paths, terminal exit 1
with the rule's message; 24 s for both). `examples/md-fixtures-are-load-bearing` OK: 6 examples, 9 of
9 judgements load-bearing both ways (14 s).

**Gates, each once on this tree:** `check:family` 1 rule, 0 failing (0.8 s; red once on
`ConditionContext`, above); `check:arch` 33 rules, 0 failing (10 s); `check:release` 3 changed
packages, 0 findings, no declared break has a workspace dependent (0.4 s); `check:docs-code` (2 s);
`check:examples` (1.1 s); `check:corpus` 0 violations (6 s); `check:surface` (0.1 s).

## Progress ledger

- [x] Phase 1: `uniqueByCondition` with its kernel tests
- [x] Phase 2: `docs().beUniqueBy()`, README, the example
- [x] Phase 3: gherkin rebuilt, break declared with its migration line
- [x] Phase 4: `corpus/record-number-unique` with its count line and non-vacuity row
- [x] Sabotage rows 1–8, each red on its named test; durations reported
- [x] `check:family`, `check:release`, `check:docs-code`, `check:examples` green; durations reported
- [ ] validation-owed: `npm run validate` green; duration reported (it runs after this record is
      written, at the branch's head; its result goes with the pull request, and CI is the gate)
- [x] Close: this plan → `completed/`; boards

Deferred: none

## Addendum — 2026-10-19: block 13 at value level

The batch's product review (I3) found that this plan delivered block 13 for keys derived from the
document (a slug, a number in the file name) but not proposal 017's ask itself: "no two documents
carry the same value under this label". This plan's Out of scope deferred that form to block 1's
field elements, and block 1 has shipped (`fields()`). The coordinator decided the ask on 2026-10-19,
and it was built at e24c9b55 on `release/batch-builds` d1ed1fe:

- **`beUniqueBy(key, what)` on `TermRuleBuilder`**, so on `fields()` and `terms()`, on the same
  kernel `uniqueByCondition`. Each element is one occurrence of the value, reported at its own line
  (`relPath:line`, as `resolveAgainst` reports). `fields(c, { label: 'Id', forms: ['bold'] })
.should().beUniqueBy((f) => f.value, 'Id')` states the ask with no hand-written reader.
- **The normaliser is the caller's `key`**, as decided for `docs().beUniqueBy()`. 017 asks for block
  1's normaliser; block 1 cuts a value (`value`, `split`), and what counts as "the same" (leading
  zeros, case) is a corpus's own rule. The test shows both: as written, `066` and `0066` differ; with
  a key that drops leading zeros, they collide.
- **A value the rule cannot read is reported, never grouped.** `readFields` yields an empty value so
  that "a check reports it rather than skipping it" (`packages/md/src/model/fields.ts`). Keyed, two
  unreadable values would be reported as "the same Id", which is false; dropped, they would leave the
  rule's denominator silently. So each is a finding with `resolveAgainst`'s message (`(Id, line 3)
has no value this rule can read in '✅'`) and stays out of the grouping. Decided here.
- An example, `examples/md/unique-ids.test.ts` (`clean/`, `violating-shared-id/`), keys on Id through
  a leading-zero normaliser. `docs/markdown.md` gains "Unique values: `beUniqueBy`" beside
  `agreeWithFolder`, covering the document-keyed and value-keyed forms (product M1). Proposal 017's
  block-13 row records delivery at value level. Changeset: eess-md minor.

**Red first.** `packages/md/tests/builders/fields-unique-by.test.ts` failed 6 of 6 on d1ed1fe
(`beUniqueBy is not a function`).

**Sabotage matrix, at e24c9b55**, each mutant in `packages/md/src/builders/vocabulary.ts`, its named
test run with `-t`, restored by `git checkout`, tree clean after; 0.8 s per row:

| Row | Mutant                                                 | Named test                                                           | Result |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------- | ------ |
| 1   | unreadable values are grouped like any other           | a value the rule cannot read is reported, not grouped with another   | red    |
| 2   | the caller's `key` is replaced by the value as written | 066 and 0066 collide when the caller normalises leading zeros away   | red    |
| 3   | a location names the document, not the line            | two documents with one value are both reported, each at its own line | red    |
| 4   | the finding's element names the document, not the line | two documents with one value are both reported, each at its own line | red    |
| 5   | the uniqueness half returns nothing                    | two documents with one value are both reported, each at its own line | red    |

**Gates on this tree:** md's suite 39 files green (3 s); `check:docs-code` 89 fences (3 s);
`check:examples` 47 tests (2 s); `check:family` (4 s); `check:arch` 37 rules (9 s); `check:release` 0
findings (1 s); `examples/md-fixtures-are-load-bearing` OK, 9 examples, 17 of 17 judgements (24 s).
The full `npm run validate` was not run for this addendum, by the coordinator's instruction.

Deferred: none.
