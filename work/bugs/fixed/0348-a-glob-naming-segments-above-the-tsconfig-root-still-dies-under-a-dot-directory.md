# Bug 0348: a glob naming segments above the tsconfig root still dies under a dot-directory, and 0.8.0 shipped it as a false green

## Status

- **State:** Fixed — fixed by a third path view, with a red-first test, a
  six-row sabotage matrix, and one fail-open the fix nearly shipped and did not.
- **Severity:** High — **a false green in shipped code.** In the reporter's
  upgrade run a rule that caught a planted violation in a plain checkout **passed**
  in a dot-directory checkout on 0.8.0, and 61 selectors reported themselves dead
  in the dot run against 0 in the plain one.
  [0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  was released as the fix for exactly this symptom and does not cover this layout.
- **Origin:** inbound — an adopter's upgrade worker, verifying 0.8.0 with the
  intent of removing the dot-directory guard 0339 was supposed to make
  unnecessary. They kept the guard.
- **Reported:** 2026-09-28
- **Fixed:** 2026-09-28 (PR #153)

## Symptom

Reported, same commit, guards removed, the same planted violations in a plain and
a dot-directory worktree:

| suite                                                        | plain                  | under a dot-directory                         |
| ------------------------------------------------------------ | ---------------------- | --------------------------------------------- |
| root arch suite                                              | 11 failed / 921 passed | **68 failed** / 864 passed                    |
| selectors logging "can never match anything in this project" | **0**                  | **61** (plus 22 and 18 in two package suites) |

And the one that matters most:

> a rule asserting one app does not import a JWT service **caught a planted import
> in the plain run and PASSED in the dot run.**

A selector reporting itself dead is a loud failure and correct behaviour. A rule
that silently passes is the class this project exists to eliminate.

## Root cause

0339 gave every path glob a second view: the file's path **named from the
tsconfig's directory**. That fixes a glob written relative to a package root. It
does not fix a glob that names path segments **between the repository root and the
tsconfig directory**, which is how a monorepo addresses its own packages.

Measured here with picomatch 4.0.4, for `apps/api/src/thing.ts` in a repository at
`~/.worktrees/repo`:

| glob                 | absolute (dot) | absolute (plain) | tsconfig-relative (`src/thing.ts`) | repo-relative (`apps/api/src/thing.ts`) |
| -------------------- | -------------- | ---------------- | ---------------------------------- | --------------------------------------- |
| `**/apps/api/src/**` | **false**      | true             | **false**                          | **true**                                |

Both views eess offers miss it: the absolute path carries the dot-segment that
`**` will not cross, and the tsconfig-relative path has had `apps/api/` stripped
off the front — the very segments the glob names. **A repo-relative view is the
only one that matches**, and eess does not compute one.

So the reporter's own reading is confirmed: the fallback is relative to the
tsconfig directory, and their globs name repo segments above it.

## Ruling: a third view, offered only to a glob that says "anywhere"

Derived rather than chosen. A glob is matched against what its author wrote
about, and **where the repository happens to sit on this machine is not that** —
it is the same clause [bug 0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
settled for a package manager's layout, one population over. So a path is also
named from the **identity root** — the `.git`/workspace root
`discoverIdentityRoot` already finds — which strips exactly the checkout location
and nothing inside the repository.

**Only a `'**\/'`-led glob gets it, and that exclusion is what keeps the fix from
being a widening.** `'src/\*\*'` MEANS "relative to the project root", and the
project root is the tsconfig's directory; giving it a second root would make one
spelling name two different directories in a monorepo. Project-relative globs
need nothing here anyway — their second view is already free of the checkout
path, which is why 0339 fixed them and left this.

**The cost objection in the draft above — "every view added makes a glob match
more" — does not hold for this view, and that is measured, not argued.** The
identity-relative path is a SUFFIX of the absolute path, and `**` crosses any
dot-free segment, so a globstar-led glob matching the suffix matches the whole —
unless a stripped segment begins with `.`, which is precisely the defect. Under
an ordinary checkout the third view therefore selects **nothing** the first did
not: `it('adds no match under a checkout with no dot-segment')` compares every
file of a fixture against every candidate glob.

`readsRootRelativePath` is **unchanged**. The draft expected it would need
re-deciding; it did not, because the identity view has its own gate
(`readsIdentityRelativePath`) and the two answer different questions.

## The fix

| where                                      | what                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ts/src/core/project-relative.ts` | `readsRepoRelativePath`, `relativeToRepoRoot`, `repoRootOf`, `projectTsConfigRoot`; `PathGlobMatcher` gains `readsRepoRelative` and `matchesPath` a third branch.                                                                                                                                          |
| `packages/ts/src/core/path-universe.ts`    | materializes `repoRelativeFilePaths` / `repoRelativeParentDirs` from the **same** root the matcher derives — `project.tsConfigPath`, which `workspace()` and the ts-morph project agree on.                                                                                                                |
| `packages/core/src/path-universe.ts`       | `PathUniverse` gains the two views as **required** fields; `viewsFor` takes `readsRepoRelative` and returns them only when the matcher reads them.                                                                                                                                                         |
| `docs/core-concepts.md`                    | "How a path glob is matched" rewritten for three views. Its parenthetical said, in the past tense, that a dot-segment in the project's own path "broke every rule … before v0.8.0" — the exact sentence that told a 0.8.0 reader this class was covered. Now it names both releases and what each reached. |

**The view is named `repoRelative*`, not `identityRelative*`.** The root is the one
`discoverIdentityRoot` finds, but "identity root" is baseline-hash vocabulary — it
says what the root is _used for_ when hashing a violation, not what it _is_. As the
name of a path view it needed a gloss every time it appeared, which is the sign it
is the wrong name; this record's own prose reached for "repo-relative" throughout
before the code did.

**It is only as stable as your repository root.** `discoverIdentityRoot` takes the
nearest `.git`, else a workspace marker, else the nearest `package.json`. A Docker
build (`.dockerignore` excludes `.git` in essentially every Node guide), a
`git archive` tarball or a CI source artifact of a repo declaring no workspaces
therefore resolves the _package_, and the third view collapses onto the second. Not
a regression — in a dot-free container path the absolute view already matches, so
this view is only ever additive — but it is the one way a rule can select
differently in CI than locally, and it is stated here rather than discovered.

**The single-funnel claim was verified, not asserted.** `matchesPath`/`anyMatchesPath`
is the one door for every rule-facing path glob — 15 call sites across
`predicates/identity.ts`, `builders/cross-layer-builder.ts`, `models/slice.ts`,
`conditions/{function,structural,reverse-dependency}.ts`, `smells/`, and
`presets/boundaries.ts` — enumerated in review rather than taken from the docstring,
because [0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
made the equivalent claim and its own sabotage matrix proved it false. Two
path-matching sites deliberately sit outside it: `disk-set.ts` (which is what makes
the disagreement test above a real assertion) and the graphql schema-discovery pair,
which is not a rule glob.

`discoverIdentityRoot` is memoized per tsconfig directory — it walks the
filesystem — and guarded on the INPUT exactly as `disk-set.ts` guards it: a
relative `tsConfigPath` (this suite's `'in-memory'` double, a hand-built
`ArchProject`) would otherwise resolve against the current working directory and
answer with _this_ repository's root, which is a plausible-looking wrong answer
rather than a missing one.

### It was already computing this view, in the one place that states a fact

`disk-set.ts` has named each candidate from **both** the identity root and the
tsconfig root since 0339's review. So under the reporter's checkout the
filesystem producer answered `holds-typescript` for `'**/apps/api/src/**'` while
the runtime matcher selected nothing — two derivations disagreeing about one
glob, which is the failure `core/project-relative.ts` spends most of its guards
on. The fix is therefore **not** "invent a third view"; it is "let the matcher
read the view the diagnosis already had". Pinned by
`it('does not disagree with the filesystem fact the diagnosis states')`.

## What this fix nearly shipped, and what review corrected about it

Adding the views to `PathUniverse` made them part of `viewsFor`'s union, and
deadness is taken against that union. Measured on the fixture, before the gate
existed:

| glob                                                           | subjects | dead-selector findings | findings in total |
| -------------------------------------------------------------- | -------- | ---------------------- | ----------------- |
| `apps/identity/**` (project-relative, names a sibling package) | **0**    | **0**                  | **1**             |
| `apps/billing/**` (names nothing at all)                       | 0        | 1                      | 1                 |

So `viewsFor` takes `readsRepoRelative` as a required argument and the dialect
passes its own gate: deadness is decided against the views the MATCHER reads, not
every view the universe holds. Pinned in both packages, and both sabotage rows
fire.

**The last column is a correction, and this section has been corrected twice.**

The first version of this record, the first commit message and the first PR body
all said this glob produced **0 findings** — "a silently vacuous selector". That was
measured with a probe that counted only the dead-selector class and then
generalised. Re-measured against the whole `violations()` list, ADR-010's evidence
floor fires, `bypassFilters: true` and unsuppressable:

> This rule examined 0 subjects (the project loaded 2 files), so it enforces
> nothing as written today.

**Then enforcement review asked the next question, and that correction was itself
too broad.** Whether it was a false green depends on the rule's shape. Measured
through the real `project()`, gate forced on and off:

| the rule                          | gate ON (shipped)                                | gate OFF                       |
| --------------------------------- | ------------------------------------------------ | ------------------------------ |
| `…notImportFrom(x)`               | the dead-selector finding, which names the cause | ADR-010's floor — **degraded** |
| `…notImportFrom(x).expectEmpty()` | the dead-selector finding                        | **nothing — green**            |
| `…satisfy(notExist())`            | nothing                                          | nothing                        |

So **the gate does close a false green**, on the declared-empty shape, and this
record's "it was never a false green" was wrong for it. The justification is
ADR-009 **rule 1 and rule 2**, not rule 2 alone: rule 2 for the common shape, where
the gate names the true cause rather than a generic one, and rule 1 for the
declaration, where without the gate the check cannot fail at all.

Why the declaration is the shape that breaks: a declaration is an assertion that
**expires**, and expiry needs `examined > 0`. When a checkout path empties the
selector rather than the code, expiry can never engage, so the declaration silently
outlives the thing it was declared about. Pinned by `it('a declared-empty rule whose
selector went dead still fails')` — **the only assertion in this file that goes red
to green.** Review measured that every other one moves a finding from precise to
degraded, so the suite proved the gate improved attribution and never proved it
prevented a pass. That gap was real and is closed.

The third row is a different defect and not this gate's to fix: `deadSelectorFindings`
exempts cardinality rules as well as the floor (`vacuity-diagnosis.ts:253-255`, so
`doctor` and `check` cannot disagree), so `.notExist()` is green in both states.
Filed as [0355](../0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md).
Enforcement's first reading had the gate rescuing that shape too; measurement said
otherwise, the reviewer accepted it and sharpened its finding onto the declaration —
which is where it was right and this record was wrong.

The tsconfig view needs no such gate, and that too was measured rather than
assumed: the globs the matcher withholds it from (`'*/x/**'`, anything with a
`'./'` segment) are caught by `syntacticFault` before any view is consulted, so
each still reports dead. A draft of the kernel comment cited a bug for that case;
there is none, and the citation was removed.

## What review found that the first fix did not

Seven reviewer lenses ran against the first commit. Two findings changed the code.

**1. The fix was incomplete for a cross-package file.** `relativeToRepoRoot`
derived the repository root via `rootOf(sourceFile)`, which fails CLOSED for any
file outside every registered root — and `project()` calls
`registerProjectRoots`, so that is every file ts-morph pulls in across a package
boundary. Measured through the real `project()` API:

| glob                    | under a dot-directory | beside one       |
| ----------------------- | --------------------- | ---------------- |
| `'**/apps/api/src/**'`  | `thing.ts`            | `thing.ts`       |
| `'**/apps/identity/**'` | **nothing**           | `jwt.service.ts` |

That is this bug's own symptom, surviving its own fix, in its own fixture. It was
invisible because **the fixture hand-built an `ArchProject`** rather than calling
`project()`, so `registerProjectRoots` never ran — and the one assertion that would
have caught it asserted the plain checkout only. Both are fixed: the fixture uses
the real `project()`, and every glob is asserted on both sides.

The repair is `projectTsConfigRoot`: the repository root is derived from the
**project's** tsconfig, not from the package root containing the file. `rootOf`'s
fail-closed exit is right for a _package_ root — naming a file from the wrong
package is a plausible-looking wrong answer — and does not transfer to a
_repository_ root, which every file in the repository shares.

**2. The universe and the matcher read different inputs.** The materializer derived
the root from `project.tsConfigPath` and the matcher from `rootOf(sourceFile)`, so
`path-universe.ts`'s claim of "the SAME derivation … not a second walk" was true of
the function and not of its input. They diverge wherever a package has a nearer
identity marker than the primary config does — a git submodule, a nested
`pnpm-workspace.yaml`. The same repair closes it: `workspace()` sets both
`ArchProject.tsConfigPath` and the ts-morph project's `configFilePath` to the
primary config, so the two now read one input and the comment is true.

## The sabotage matrix

Eight rows and a clean control, each a literal edit to the shipped source,
restored from a byte-for-byte backup verified by sha256. A row that fires nothing
is an unfalsifiable guard — pin it or delete it.

| row        | the edit                                                                          | what reddened                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0 CONTROL | none                                                                              | nothing — green, as a control must be                                                                                                                                        |
| R1         | `matchesPath` never consults the third view                                       | `selects the same files…`, `does not disagree with the filesystem fact…`                                                                                                     |
| R2         | `readsRepoRelativePath` returns `true` for every glob                             | `CONTROL: a project-relative glob does not reach above the tsconfig root`                                                                                                    |
| R3         | the repository root is never discovered                                           | 4 tests                                                                                                                                                                      |
| R4         | `viewsFor` never returns the repo views                                           | `does not report the selector as one that can never match`, plus both kernel view tests                                                                                      |
| R5 REVERSE | break the TSCONFIG view this fix leaves alone                                     | 0339's `keeps a project-relative glob working…` and this file's package-root CONTROL — so the second view is still independently load-bearing and the third does not mask it |
| R6         | `viewsFor` ignores the gate and always returns the repo views                     | `CONTROL: a project-relative glob…`, `withholds the identity view from a glob whose matcher does not read it`                                                                |
| R7         | derive the repository root via `rootOf` again (the pre-review code)               | `CONTROL: a project-relative glob…`, `adds no match under a checkout with no dot-segment`                                                                                    |
| R8         | `viewsFor` ignores the gate (the pre-review code), against the declared-empty row | `a declared-empty rule whose selector went dead still fails` — the one row that goes RED to GREEN — plus the project-relative CONTROL                                        |

**A second, independent matrix found two holes this one did not.** Test review ran
12 rows of its own in an isolated worktree and reported three survivors:

- the `path.isAbsolute` guard in `repoRootOfDir` could be deleted with the whole
  suite green — a documented fail-closed guard whose own docstring names the
  confidently-wrong answer it prevents, and no falsifier anywhere. Now pinned by
  `it('answers no repository root for a relative tsconfig path, rather than the wrong one')`.
- the property test's denominator, `expect(compared).toBe(4 * files.length)`, was an
  ITERATION counter — true by construction however dead the view was. It now counts
  how often the repo view actually matched, so a view that matched nothing, or that
  was silently the absolute path, no longer satisfies the property trivially.
- `hasRelativeSegment` in `readsRepoRelativePath` genuinely changes no verdict —
  every glob it could exclude is already excluded by `isGlobstarLed`. Kept, and now
  marked "defence in depth, not independently observable", the way
  `registerProjectRoots` marks the same thing, so nobody hunts for a missing test.

**R4 first fired nothing, and it was the EDIT that was wrong, not a missing guard.**
The sabotage read `return false ? [threeViews] : readsRepoRelative ? … : …`, which
collapses to the original expression. Rewritten to force the parameter, it reds
three tests. Recorded because "a row that fires nothing" has two causes and only
one of them is a hole in the suite.

## The silently-vacuous rule, explained — and it makes the case worse

The reporter supplied the planted import and the plain run's violation text, and
the case is the **same** defect rather than a second one. It is also the sharper
form of it.

The planted import is a **relative** specifier:

```ts
import { JwtService } from '../../identity-gateway/src/services/jwt.service.js'
```

`candidatesFor` offers the raw specifier only when it is non-relative, so this one
is not offered. eess resolves it instead, and the plain run's message shows what
matched: the **absolute target path**, against the rule's `**/services/jwt*`
spelling. The `../**/services/jwt*` spellings in the same rule matched nothing in
either run — they were already dead, which is its own small finding for the
reporter.

Under the dot-directory checkout:

| view of the import target | why it fails                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| absolute path             | carries the dot-segment, which `**` will not cross                                                                                              |
| tsconfig-relative         | **does not exist** — the target is in a _different package_, and `relativeToRoot` returns `undefined` for any path above the root, deliberately |

**So for a cross-package import target there is no second view at all.** 0339's
fix is not merely insufficient here, it is inapplicable: the mechanism it added
cannot produce a value. The rule passes silently, and nothing in the run says so.

### And this half was already closed — by 0349, three days later

Measured on the reporter's own shape, with picomatch 4.0.4:

| matcher                                               | `'**/apps/identity/src/services/jwt*'` vs `…/.worktrees/repo/apps/identity/src/services/jwt.service.ts` |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `dot: false` (every release through 0.8.0)            | **false**                                                                                               |
| `dot: true` (`importTargetMatcher`, shipped for 0349) | **true**                                                                                                |

0349 gave every import-glob site `{ dot: true }` because a package manager's
layout is not the author's to write. A checkout path is not the author's either,
so the same matcher answers this case — and `it('reports a cross-package import
ban under a dot-directory as it does beside one')` was **green on its first run**,
before any of this bug's own code existed. It is kept as a pin, not as a fix.

What remains of this bug is therefore the **path-glob selector** — which is the
reporter's 61 dead selectors and their silently-passing rule's SELECTOR, and is
what the ruling below addresses.

## What a repo-relative view would NOT reach

Sized with the reporter, who has ten rules matching a resolved `node_modules`
target. Measured against `**/node_modules/knex/**`:

| layout                                             | absolute  | repo-relative                            |
| -------------------------------------------------- | --------- | ---------------------------------------- |
| hoisted `node_modules`, plain checkout             | true      | true                                     |
| hoisted `node_modules`, **dot-directory checkout** | **false** | **true** — fixed by this bug's candidate |
| `node_modules` symlinked to a plain tree           | true      | n/a (outside the repo)                   |
| pnpm store under `~/.local/…`                      | **false** | n/a (outside the repo)                   |
| **pnpm virtual store inside the repo**             | **false** | **false**                                |

**This table measures the PATH-glob matcher, and the ten rules it was sized for do
not use it.** A rule matching a resolved `node_modules` target goes through
`importTargetMatcher`, which since
[0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
— shipping in this same release — is `{ dot: true }`. For those ten rules every
row above except the last is already true at the release boundary, whatever this
bug's fix does. Corrected in review, because an adopter reading the table to decide
whether to drop their guard would have concluded they were still exposed.

Two rows still deserve their red, for different reasons. The **pnpm virtual store
inside the repo** carries its dot segment _below_ the root, so a repo-relative view
carries it too — that is 0349's case and needs no dot-directory at all. The **pnpm
store under `~/.local/…`** is not a dot-segment problem in the first place: that
path has no `node_modules` segment, so `'**/node_modules/knex/**'` cannot match it
on any setting. It is a spelling mismatch, not a gap this family might close later.

**A limit of the reporter's measurement, disclosed by them:** both their worktrees
symlinked `node_modules` to a plain checkout, so under the dot-directory those ten
rules resolved to dot-free paths and were **never exercised**. Their 61-dead-selector
figure therefore understates their exposure in a checkout without that symlink.

## Related

- [0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  — released as the fix for this symptom. It fixed the case where the glob is
  relative to a package root, and its own tables only ever exercised that case.
- [0345](../../spikes/0345-what-it-costs-to-load-a-monorepo.md) — the same adopter,
  the same suite, measured for a different reason.

## Verification

- [x] the reporter's diagnosis reproduced: the four-view table above, measured with
      the pinned picomatch.
- [x] the silently-vacuous rule explained, by the reporter, with the violation text
      — the same defect, and its sharper form: a cross-package import target has no
      tsconfig-relative view at all. **And measured to be already closed by 0349**,
      whose `{ dot: true }` import matcher answers it; the test for it was green on
      its first run and is kept as a pin.
- [x] a ruling on whether a third view is offered, and to which globs — derived
      above from the authorship clause 0349 settled, and narrowed to globstar-led
      globs by the one property that makes it not a widening.
- [x] a red-first test from a constructed dot-directory path with a glob naming
      segments above the tsconfig root:
      `packages/ts/tests/core/a-glob-above-the-tsconfig-root.test.ts`, confirmed
      red on the selector and on the disagreement with `disk-set`, green on the
      controls. Rewritten after review to drive the real `project()`.
- [x] a sabotage matrix — 8 rows and a clean control, published in full above
      rather than asserted, as 0339's and 0349's records publish theirs. R8 is the
      only row that takes an assertion from red to green; enforcement review measured
      that its absence meant the suite proved attribution and never proved
      pass-prevention.
- [x] the public docs corrected: `docs/core-concepts.md`'s "How a path glob is
      matched" taught two views and dated this defect class to before v0.8.0.
- [x] a changeset — a rule that selects more is breaking for a baseline, and
      `PathUniverse` gains two required fields while `viewsFor` gains a required
      parameter. `**Breaking**`-marked, `minor` on the kernel and `eess-ts`, and on
      the four dialects that ship the kernel onward.
- [x] seven reviewer lenses run; two findings changed the code, both recorded above.
- [x] `npm run validate` green.
- [ ] `docs/migrating-to-0.9.md` — **deferred→the release PR.** The convention is
      one migration page per breaking release, and this PR opens the release; the
      page has to describe every break in it, and the others are not written yet.
      Named here rather than carried by nobody.

Deferred: the 0.9 migration page, to the release PR.

## Found in review, filed rather than fixed here

Three findings were verified and filed as their own records, per scope discipline —
this bug keeps the scope it started with:

- [0352](../0352-disk-set-offers-the-repo-root-naming-to-a-glob-the-matcher-refuses.md)
  — `disk-set.ts` gates both of its prefixes on `readsRootRelativePath`, so a
  project-relative glob naming a sibling package classifies `holds-typescript` and
  the author is told "your tsconfig include/exclude keeps it out of the project".
  False, and ADR-009 rule 2's confidently-wrong cause. Pre-existing; this ruling is
  what makes it a designed outcome rather than an accident.
- [0353](../0353-pathuniverse-and-viewsfor-are-one-dialects-vocabulary-in-the-kernel.md)
  — `PathUniverse` and `viewsFor` are a kernel public type with one materializer and
  one caller, whose field names are eess-ts vocabulary. 0339 added a view for one
  package bump; this added a view for six. That difference is the measurement.
- [0354](../0354-the-glob-view-doctrine-is-settled-in-three-bug-records-and-no-adr.md)
  — "a verdict must not be decided by where things sit on disk" now decides three
  bugs (0339, 0348, 0349) and lives in no ADR.
- [0355](../0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
  — a `.notExist()` / `.expectEmpty()` rule is exempt from both the dead-selector
  diagnosis and the evidence floor, so a silently-emptied selector is green with or
  without this fix. A true false green, and the shape most likely to host one: a
  ratchet nobody looks at.
