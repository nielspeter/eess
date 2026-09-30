# Bug 0355: a cardinality rule cannot tell "none exist" from "my selector broke", so a silently-emptied selector stays green

## Status

- **State:** Fixed — the disk discriminator, with a red-first test through the real
  `project()` and a four-row sabotage matrix.
- **Severity:** High — **a true false green.** A rule asserting CARDINALITY
  (`.notExist()` and friends) whose selector silently stops matching produces
  **zero findings** and exit 0. Every other rule shape has something beneath it —
  the dead-selector diagnosis, or the ADR-010 evidence floor. This one is exempt
  from **both**, by design, and the design cannot tell "none exist" from "my
  selector broke".
- **Scope — narrowed after measurement, and this record twice said otherwise.**
  `.expectEmpty()` is **not** this bug. `deadSelectorFindings` guards on
  `assertsCardinality()` only (`ts/src/core/vacuity-diagnosis.ts:476`) and has no
  `declaresEmpty()` guard, and `.expectEmpty()` sets the latter, not the former —
  so a declared-empty rule IS reachable by the dead-selector diagnosis and already
  reported. Measured while fixing
  [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md),
  where it is the row that goes red to green.
  **The correction was written once and never landed** — a `str.replace` without an
  assert, silently a no-op — so the Severity and Symptom above carried the wrong
  claim while the Verification below carried the right one, and only method review
  caught the contradiction. That asymmetry is the reason this note is a bullet
  rather than a quiet edit.
- **Origin:** enforcement review of
  [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
  The reviewer's own framing was that 0348's gate rescues this shape; measurement
  says the gate makes no difference to it, which is what makes it a separate defect
  rather than a correction to that record.
- **Reported:** 2026-09-28

## Symptom

Measured on a two-package monorepo through `project()`, with `'apps/identity/**'` —
a project-relative glob naming a sibling package, which correctly selects nothing
from `apps/api`'s root:

| rule shape                              | findings | exit  |
| --------------------------------------- | -------- | ----- |
| `…should().notImportFrom('**/nope/**')` | **1**    | red   |
| `…should().satisfy(notExist())`         | **0**    | green |

Both rules have the same selector, selecting the same nothing. One reports; the
other is silent. A third shape, `…notImportFrom(x).expectEmpty()`, **also reports** —
see the scope note in Status.

## Root cause

Two exemptions, each correct on its own, with no mechanism between them.

1. **The dead-selector diagnosis exempts cardinality rules.**
   `packages/ts/src/core/vacuity-diagnosis.ts:336-338`: "`.notExist()` and friends
   examine zero BECAUSE that is what they assert. Exempt since 0.34.0, and
   `diagnose()` exempts it too — the two must agree or `doctor` and `check`
   disagree about a working rule."
2. **The evidence floor exempts them too**, one line later —
   `if (facts.assertsCardinality()) return violations` (an empty array), and
   `if (!facts.declaresEmpty())` gates the zero-subjects violation, so an
   `.expectEmpty()` rule takes the `undefined` exit.

So for these shapes `examined === 0` is indistinguishable from the assertion being
satisfied — which is exactly right when the author means "none of these exist", and
exactly wrong when the selector broke. **Nothing in the stack asks whether the
selector could have matched anything**, and that is the question that separates the
two readings.

**0348's fix does not touch this.** Measured with the gate on and off: both states
give the `.notExist()` rule zero findings. The gate changes the _other_ shapes from
a generic floor finding to a precise dead-selector one.

## Why it matters more than it looks

`.notExist()` is what an adopter writes for the strongest claims they make — "this
package is gone", "no one calls this any more", "this layer has no direct database
access". Those rules are ratchets: they are supposed to stay green forever, so a
green is unremarkable and nobody looks. A rule that was _designed_ never to fire is
the worst possible host for a selector that silently stopped matching.

And the 0339 / 0348 / 0349 defect class is precisely a selector silently emptying:
a dot-directory checkout, a glob naming segments above the tsconfig root, a package
manager's layout. An adopter on any of those had every `.notExist()` rule pass
vacuously with nothing to read.

## Ruling: ask the filesystem, not the glob

**The `## Fix` this record first carried was wrong, and wrong in the direction that
would have broken every healthy ratchet.** It said "a cardinality rule over an
**unsatisfiable** selector is a configuration finding, whatever it asserts", and
proposed using `isDeadSite`. That does not work, and the reason is the whole
difficulty of this bug:

> `modules(p).that().resideInFolder('**/legacy/**').should().notExist()` — after you
> delete `legacy/`, the glob matches nothing **because the rule is working**.

A holding ratchet and a broken selector are _identical_ from the glob and the path
universe: both match zero. Reporting on unsatisfiability would fire on every
`.notExist()` rule that is doing its job, which is the loudest possible false
positive and would have the exemption reinstated within a release.

**What separates them is the filesystem, and eess already asks it.** `diskSet` walks
the repository and classifies a glob as `holds-typescript`, `no-typescript`,
`absent` or `not-determined` — a fact about disk, independent of what the project
loaded. Measured, on a fixture where `apps/legacy/` exists on disk but sits outside
`apps/api`'s tsconfig `include`:

| case                                                       | subjects | findings today | `diskSet.classify` |
| ---------------------------------------------------------- | -------- | -------------- | ------------------ |
| files **exist on disk**, rule examined 0 — broken selector | 0        | **0**          | `holds-typescript` |
| path **genuinely absent** — the ratchet holding            | 0        | 0              | `absent`           |

So the ruling:

**A cardinality rule that examined zero is a finding only when the path it names
holds TypeScript on disk.** The code you are asserting does not exist is right
there, and your rule did not see it. That is not the assertion holding; it is the
selector failing to reach the thing the assertion is about.

`absent` stays green — that is the ratchet working, and it is the common case.
`no-typescript` stays green: no TypeScript there means no modules there, which is
what the rule asserts. `not-determined` stays green, because blaming the author for
a walk we could not complete is the confidently-wrong remedy `disk-set.ts` exists
not to give.

**The limit that policy hides, named because enforcement review found it in the
comment that licensed it.** `not-determined` is not only a per-path answer. The
walk has an entry budget — 50,000 dirents — and on exhaustion `buildDiskSet`
returns a single `UNDETERMINED` whose `classify` answers `not-determined` for
**every** glob, memoized per project. So one repository above that threshold
silences this gate for _every_ cardinality rule in the run at once, for a reason
that has nothing to do with any of their paths, and nothing reports that the walk
gave up.

This repository sits at roughly 7% of the budget, so the threshold is about
fourteen repositories this size — large, but exactly the population that writes
ratchets, because it is large enough to have deleted things.

**It is not a regression:** before this fix those rules were silent everywhere.
It is an undisclosed limit on a fix, and disclosing it is the minimum. Surfacing
exhaustion so a run says "I could not answer" is
[0359](./0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
and it carries the harder question this ruling does not settle: whether a verdict
may depend on a bounded walk at all.

### What this costs, stated before it is built

The check is **not free**: it needs the disk walk, which `deadSelectorFindings`
reaches only when a rule is already suspect. Ordering matters — ask only after
`examined === 0`, never on the common path.

And it **inherits [0352](../0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)**:
`disk-set` gates both of its prefixes on `readsRootRelativePath`, so a
project-relative glob naming a sibling package classifies `holds-typescript` when
the matcher refuses it the repo-root naming. For this rule that produces a finding
whose _message_ names the wrong cause. The finding itself is still correct — the
selector genuinely did not reach files that are there — so 0355 does not wait on
0352, but the two should land near each other.

## The sabotage matrix

Four rows and a clean control, each a literal edit to the shipped source, restored
from a sha256-verified backup.

| row        | the edit                                                | what reddened                                                                  |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| R0 CONTROL | none                                                    | nothing — green, as a control must be                                          |
| R1         | the exemption is total again (the pre-fix code)         | `reports when the path it asserts about holds TypeScript on disk`              |
| R2         | drop the disk gate: every dead selector reports         | `CONTROL: stays green when the path is genuinely absent — the ratchet holding` |
| R3         | accept any on-disk answer except `not-determined`       | `CONTROL: stays green when the path is genuinely absent`                       |
| R4 REVERSE | break the POSITIVE-assertion path this fix leaves alone | `CONTROL: a positive-assertion condition still reports, as it always did`      |

**R1 is the pass-prevention row.** With the fix removed the rule reports _nothing_ and
the build is green, so the test catches a false green rather than a degraded message.
0348's review measured that a matrix whose every row moves a finding from precise to
degraded proves attribution and never proves the guard stops a bad pass; this one has
the row that does.

**R2 and R3 are the rows that matter most for a fix of this shape**, because the
obvious over-reach — report whenever a cardinality rule examines zero — passes the
defect test and breaks every healthy ratchet. Both red the control that pins it.

**A disclosure this record was missing, and 0357's record pointed at.** 0357 notes its
R4 correction was "the second one, for the second time in this pair of bugs" — naming a
prior row-fires-nothing incident here, which this section did not admit. It is this:
**an earlier run of R2 and R3 reported ALL GREEN meaninglessly**, because the shell
quoting in the re-run broke and the sabotage edits never applied. It was caught only
because Python printed a `SyntaxError`, and the rows were re-run with per-row assertions
that the edit had changed the file. A row reporting `ALL GREEN` looks identical whether
the guard is unfalsifiable or the sabotage never ran — which is exactly why this belongs
in the record rather than in the author's memory.

## Confirmed by an adopter on two more shapes

Reported while this fix was in flight, on eess-ts 0.8.0, and measured here against the
branch. Both are the same defect authored the way it actually happens — nobody deletes
a folder, somebody edits `include`:

| shape                                                    | files loaded | findings on the fix | reported via                                                          |
| -------------------------------------------------------- | ------------ | ------------------- | --------------------------------------------------------------------- |
| `include` drops the path, project still loads something  | 1            | **1**               | the disk check above                                                  |
| `include` drops everything, project loads nothing        | 0            | **1**               | the empty-project branch, which runs BEFORE the cardinality exemption |
| a **JSX** rule, `include: ["tests"]`, planted `<button>` | 1            | **1**               | the disk check                                                        |

The third row closes a limit this record stated rather than glossed: the fix lives in
`evidenceFloor`, which every builder's terminal goes through, but it had been verified
only on `modules()`. The adopter supplied the JSX recipe and could not run it against
an unbuilt branch, so it was measured here. Both `modules()` and `jsxElements()` now
confirmed — **and retained**, by
`it('reaches a JSX rule too, not only modules() — the builder-independence claim')`.
Method review caught that this was the one row carrying the load-bearing claim and the
one row pinned by nothing; it had been measured in a throwaway probe and deleted.

The first two rows take **different paths**, which is worth knowing: an `include` that
loads nothing was already reported before this fix; an `include` that loads _some_ files
and not the asserted path was not.

## What the v0.10 review round found, and what it changed

Six lenses ran on this pair before release. Two Criticals and four Importants changed the
code or the record; the round found more than the change did.

**The remedy told the reader to delete the ratchet.** Found independently by three lenses.
`cardinalitySelectorMissedDisk` reused `deadSelectorViolation` verbatim, so the new finding
read _"so it has no subjects and cannot fail … Correct the glob, or remove the rule"_ — and
for a rule satisfied BY having no subjects, the first clause describes it passing and the
second offers to delete it. On a `bypassFilters` finding, deletion is the only achievable
exit, and the primary consumer is an agent that takes it. The fix for a silently-passing
ratchet shipped an instruction to delete the ratchet, contradicting this release's own
changeset. Now branched on cardinality, with the remedy alone in `suggestion` so the `Fix:`
line exists at all. **No test caught it because no test asserted the message**; two now do,
in both directions.

**The policy was stated four times and enforced nowhere.** Test review sabotaged the
`holds-typescript`-only threshold three ways — accept `not-determined`, accept
`no-typescript`, accept anything but `absent` — and all three reddened **nothing across
3,884 tests**. The narrowing lived in this record, in two docstrings and in the changeset,
and no falsifier. The policy is now a total function on the four-value `OnDisk` union,
pinned exhaustively by `an-absence-claim-is-contradicted-only-on-disk.test.ts`; all three
rows fire. A `Record<OnDisk, boolean>` rather than a list, so a fifth classification stops
it compiling instead of silently leaving a case uncovered.

**The entry budget makes this gate self-disabling**, disclosed in the ruling above and filed
as [0359](./0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md).

**This record contradicted itself about `.expectEmpty()`**, and the correction that should
have fixed it had silently not landed — see the scope note in Status.

**Three of 0357's pointers resolved to the wrong lines.** `check:corpus` proves a cited line
EXISTS, not that it says what the prose claims, which is the drift class the gate
structurally cannot see.

### The one open question, settled by spike rather than argument

Product review found that a ratchet written `'**/legacy/**'` in one package's rule file
reports when a **sibling** package has that folder. The first reading was a false red; the
proposed fix was to narrow the disk evidence to the project's own root. **Both were wrong,
and three spikes say so.**

**Spike 1 — does a cross-package import break the narrowing?** No, and for a reason worth
keeping: when a sibling's file is reachable it IS in the project, so subjects > 0 and the
ordinary failure fires. By construction every file this code decides about is one the
project did not load.

| sibling `legacy/` | loaded | subjects | finding                                              |
| ----------------- | ------ | -------- | ---------------------------------------------------- |
| not imported      | 1      | none     | "can never match anything in this project"           |
| imported          | 2      | `old.ts` | "SourceFile should not exist" — the ordinary failure |

**Spike 2 — does the narrowing keep what this bug was filed for?** **No.** A tsconfig whose
`include` reaches _above_ its own directory (`['src', '../shared/src']`) and then stops
covering it is exactly this bug, and the on-disk match sits outside the project root:

| case                           | subjects | today            | under the proposed narrowing |
| ------------------------------ | -------- | ---------------- | ---------------------------- |
| `../shared` included (healthy) | `old.ts` | ordinary failure | —                            |
| `../shared` **dropped**        | none     | **reports**      | **silent**                   |

So narrowing would have reintroduced the defect for any monorepo whose tsconfig reaches
outside its own directory — the shape
[0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
is entirely about. The recommendation to narrow was made before this was measured, and it
was wrong.

**Spike 3 — is there a signal that separates the two cases?** Yes: the glob's own spelling,
which is 0348's ruling doing its job.

| fixture                                            | `'**/legacy/**'` | `'legacy/**'` |
| -------------------------------------------------- | ---------------- | ------------- |
| a **sibling** package has `legacy/`                | reports          | **silent**    |
| the package's **own** `legacy/`, outside `include` | reports          | reports       |

**So there is no defect and no code change.** `'**/'` says _anywhere_ and means anywhere on
disk; the project-relative spelling says _relative to this project_ and means that. An author
who means their own package writes `'legacy/**'`. What product found is `'**/'` doing what
0348 taught adopters it does, meeting a rule shape where "anywhere" is a larger claim than
they probably intended.

That makes it a **documentation** obligation rather than a code one, and a sharp one, because
0348 spent a release teaching people to reach for `'**/'`. It is in the 0.10 migration page,
and pinned in both directions by
`it('the glob spelling decides how much of the repository counts as evidence')` — so the
documented behaviour is a claim the build can falsify.

## What this does NOT catch

Named because the changeset says "You will now be told", and for three shapes that is
false. Two of them were found by review after the release shipped; an adopter planting
against their ratchets on our advice will hit them and conclude the fix is in.

**1. A ratchet with no path glob at all.** `cardinalitySelectorMissedDisk` opens
`const trees = facts.globs(); if (trees.length === 0) return []`. So a selector that is a
name, a decorator or a `satisfy()` predicate is exactly as vacuous as before. Measured — a
`.notExist()` over `haveNameMatching(/…/)` reports **0**. Both of these shapes are taught
in this project's own docs:

```ts
classes(p).that().haveDecorator('Deprecated').should().notExist().warn()
classes(p).that().satisfy(hasManyMethods(15)).should().notExist().check()
```

The mechanism is scoped to the selector KIND; the changeset's promise reads as scoped to
the rule SHAPE. That gap is the release's, not the reader's.

**2. A well-formed selector that names nothing — a typo, a rename, a moved directory.**
`'**/lgeacy/**'`, or `'**/legacy/**'` after `git mv legacy/ legacy-code/`. Globstar-led, no
syntactic fault, classifies `absent` — and `absent` is silent by this ruling, because it is
indistinguishable from the ratchet holding. That is inherent to the discriminator and is
not a defect in it.

**What IS worth saying is that 0357 closed the only surface that spoke about it.** `doctor`
used to report every dead cardinality selector — unconditional noise with no discriminating
power, which is why 0357 was right to stop. But the trade was noise for silence, and
`packages/ts/src/cli/index.ts` still tells the reader that `doctor` "uniquely catches a dead
glob … `check` exits 0 with no output on such a rule while `doctor` names the site and exits
1". For a cardinality rule that is now false in both tools. Corrected there.

**3. A repository above the disk walk's entry budget**, where the whole classification
degrades to `not-determined` and every cardinality rule loses the floor at once, silently —
[0359](./0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md), with
the budget measured far below what the walk can afford — 3.2M entries to the 5s timeout
against a 50,000 budget is 64× ([spike 0360](../../spikes/0360-what-the-disk-walk-actually-costs.md),
whose own table gives both figures and whose headline rounds it to "about two orders of
magnitude"). **64× is the headroom, not the recommendation**: 0360 rules for 500,000–1,000,000
(10–20×) and deliberately stops short of 3.2M because the cold-cache gap is unmeasured. _This
line read "100× too low" until 2026-09-29; the figure was taken from the headline rounding
rather than divided. Commit `843f90b`'s title carries the old number permanently._

**The changeset for 0.10.0 says none of this, and it has shipped**, so the correction cannot
be made where it was written. It belongs in the next release's changeset and in
`docs/migrating-to-0.10.md`, both of which now carry it.

## Found while fixing, filed rather than widened

- [0357](./0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md) — `doctor` reports
  a _healthy_ `.notExist()` ratchet as a dead glob, where `check` correctly stays
  green. Measured across three globs in both tools. It is **pre-existing**: before
  this fix the two disagreed on two of three rows, and now on one. `diagnose()`
  exempts cardinality in `zeroSubjectsFinding` and not on its dead-glob path, so it
  never reaches the exemption. Not widened into this fix — the same discriminator
  applies, but where the shared derivation should live is a decision, and this pair
  has already grown two hand-maintained copies of one rule once.

## Related

- [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — where this was found, and one of the three ways a selector silently empties.
- [0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md),
  [0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
  — the other two.
- [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) — the floor these
  two shapes are exempt from, and the reason the exemption needs a companion rather
  than removal.

## Verification

- [x] measured in both directions, through the real `project()`: the table in the
      ruling, plus the same two rules with the gate on and off.
- [x] the ruling derived and **corrected** — the first `## Fix` this record carried
      keyed on glob satisfiability and would have fired on every healthy ratchet.
      Recorded rather than rewritten, because the wrong version is the difficulty of
      this bug.
- [x] a red-first test through the real `project()`, not a hand-built `ArchProject`:
      `packages/ts/tests/core/a-cardinality-rule-sees-a-dead-selector.test.ts`.
      Confirmed red on the defect, green on four controls.
- [x] a sabotage matrix — 4 rows and a clean control, published above, including the
      pass-prevention row and a reverse row.
- [x] `.expectEmpty()` confirmed unaffected: it was never exempt from the
      dead-selector diagnosis and already reported.
- [x] the same question asked of `diagnose()` — measured, and the answer is that
      `doctor` and `check` did **not** already agree. This fix takes them from
      disagreeing on two of three cases to one; the remainder is filed as 0357.
- [x] a changeset — rules that were passing will start failing.
- [x] `npm run validate` green.

Deferred: none.
