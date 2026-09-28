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

| where                                      | what                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ts/src/core/project-relative.ts` | `readsIdentityRelativePath`, `relativeToIdentityRoot`, `identityRootOf`; `PathGlobMatcher` gains `readsIdentityRelative` and `matchesPath` a third branch. Every runtime path-glob site routes through `matchesPath`/`anyMatchesPath`, so this is one change, not ten. |
| `packages/ts/src/core/path-universe.ts`    | materializes `identityRelativeFilePaths` / `identityRelativeParentDirs` from the **same** function the matcher uses.                                                                                                                                                   |
| `packages/core/src/path-universe.ts`       | `PathUniverse` gains the two views as **required** fields; `viewsFor` takes `readsIdentityRelative` and returns them only when the matcher reads them.                                                                                                                 |

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

## What this fix nearly shipped

Adding the views to `PathUniverse` made them part of `viewsFor`'s union, and
deadness is taken against that union. Measured on the fixture, before the gate
existed:

| glob                                                           | subjects | dead-selector findings |
| -------------------------------------------------------------- | -------- | ---------------------- |
| `apps/identity/**` (project-relative, names a sibling package) | **0**    | **0**                  |
| `apps/billing/**` (names nothing at all)                       | 0        | 1                      |

A glob selecting nothing, reported as fine — **a silently vacuous selector
introduced by the fix for a silently vacuous rule**, and the exact class this
project exists to eliminate. So `viewsFor` takes `readsIdentityRelative` as a
required argument and the dialect passes its own gate: deadness is decided
against the views the MATCHER reads, not every view the universe holds. Pinned in
both packages, and both sabotage rows fire.

The tsconfig view needs no such gate, and that too was measured rather than
assumed: the globs the matcher withholds it from (`'*/x/**'`, anything with a
`'./'` segment) are caught by `syntacticFault` before any view is consulted, so
each still reports dead. A draft of the kernel comment cited a bug for that case;
there is none, and the citation was removed.

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

The last row is the one that matters: the dot segment is **below** the root
(`node_modules/.pnpm/…`), so a repo-relative view carries it too. That case is
[0349](./0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md),
it needs no dot-directory at all, and this bug's fix does not address it.

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
      controls.
- [x] a sabotage matrix, 6 rows + a clean control, all firing — including a
      **reverse** row that breaks the tsconfig view this fix left alone and reds
      0339's own tests, so the second view is still independently load-bearing and
      the third does not mask it. One row (R4) first fired nothing and was a
      **no-op edit** (`false ? A : (B ? C : D)` collapses to the original), not a
      missing guard; rewritten, it reds three tests.
- [x] a changeset — a rule that selects more is breaking for a baseline, and
      `PathUniverse` gains two required fields. `**Breaking**`-marked, `minor` on
      both `@nielspeter/eess` and `@nielspeter/eess-ts`.
- [x] `npm run validate` green.

Deferred: none.
