# Bug 0348: a glob naming segments above the tsconfig root still dies under a dot-directory, and 0.8.0 shipped it as a false green

## Status

- **State:** Draft — reported by an adopter with measurements, the mechanism
  reproduced here, and the one unexplained case since explained by the reporter.
- **Severity:** High — **a false green in shipped code.** In the reporter's
  upgrade run a rule that caught a planted violation in a plain checkout **passed**
  in a dot-directory checkout on 0.8.0, and 61 selectors reported themselves dead
  in the dot run against 0 in the plain one.
  [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
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

## Fix

Not decided. The shape is a **third view**, and the cost of adding one is the
subject.

- **A repo-relative view.** eess already has a notion of the repository root:
  `discoverIdentityRoot` in the kernel, which `core/disk-set.ts` walks from. So the
  root is available; what is unbuilt is offering the view and deciding which globs
  get it.
- **The cost is the reason this is not obvious.** `core/project-relative.ts` spends
  most of its comments on the failure mode of two derivations disagreeing about one
  glob. A third view multiplies the match surface again, and every view added makes
  a glob match _more_, which is the direction that turns an exclusion into a
  silence.
- **`readsRootRelativePath` would need re-deciding.** It currently withholds the
  second view from `./x`, `../x` and `*/x/**`, each for a measured reason recorded
  in 0339. Whether a repo-relative view has the same exclusions is a separate
  question, not an inherited answer.

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

This raises the stakes on the fix. A repo-relative view is not one option among
several for this case — it is the **only** view under which a cross-package import
target is nameable at all, because the repository root is the only root that
contains both the importing file and its target.

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
[0349](./fixed/0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md),
it needs no dot-directory at all, and this bug's fix does not address it.

**A limit of the reporter's measurement, disclosed by them:** both their worktrees
symlinked `node_modules` to a plain checkout, so under the dot-directory those ten
rules resolved to dot-free paths and were **never exercised**. Their 61-dead-selector
figure therefore understates their exposure in a checkout without that symlink.

## Related

- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  — released as the fix for this symptom. It fixed the case where the glob is
  relative to a package root, and its own tables only ever exercised that case.
- [0345](../spikes/0345-what-it-costs-to-load-a-monorepo.md) — the same adopter,
  the same suite, measured for a different reason.

## Verification

- [x] the reporter's diagnosis reproduced: the four-view table above, measured with
      the pinned picomatch.
- [x] the silently-vacuous rule explained, by the reporter, with the violation text
      — the same defect, and its sharper form: a cross-package import target has no
      tsconfig-relative view at all.
- [ ] a ruling on whether a third view is offered, and to which globs
- [ ] a red-first test from a constructed dot-directory path with a glob naming
      segments above the tsconfig root — 0339's fixture only exercised globs
      relative to the package root, which is why its suite is green while this is
      broken
- [ ] a changeset — a rule that selects more is breaking for a baseline
- [ ] `npm run validate` green.

Deferred: none.
