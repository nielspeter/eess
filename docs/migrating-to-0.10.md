# Migrating to 0.10

> Written for the release tagged `v0.10.0`. Only `@nielspeter/eess-ts` moves. Check what you
> have with `npm ls @nielspeter/eess-ts`.

| package               | from  | to     |
| --------------------- | ----- | ------ |
| `@nielspeter/eess-ts` | 0.9.0 | 0.10.0 |

**One breaking change, and it is the same kind as 0.7's, 0.8's and 0.9's: a check that
matched nothing — and therefore passed — now matches.** No export is removed or renamed.

## If you only read one thing

**A `.notExist()` rule could pass while enforcing nothing, and you had no way to tell.**
`.notExist()` and friends are satisfied by having no subjects, so eess exempted them from
both of its emptiness guards. Together those exemptions left that one rule shape with nothing
beneath it: a selector that silently stopped matching reported **nothing** and exited 0.

It is the worst shape to lose it on. `.notExist()` is what you write for your strongest
claims — "this package is gone", "nothing imports this any more", "this layer has no direct
database access". Those are ratchets designed never to fire, so a green is unremarkable and
nobody looks.

## What to do

1. Upgrade, run your gates, and **read the new findings before you regenerate a baseline.**
2. For any `.notExist()` rule that now reports: **fix the selector, do not delete the rule.**
   It has not been enforcing anything, and it is the thing that noticed.
3. If a rule reports and you cannot see why, check your tsconfig `include`/`exclude` first —
   that is the commonest cause.

## 1. A cardinality rule now reports when the code it asserts away is on disk

A rule asserting cardinality that examined **zero** subjects now reports when the path its
selector names **holds TypeScript on disk**. The code you are asserting does not exist is
right there, and your rule did not see it.

**A ratchet that is holding stays green**, and that is the difficult half of this change: after
you delete `legacy/`, `.notExist()` over `'**/legacy/**'` matches nothing _because the rule is
working_. A holding ratchet and a broken selector are indistinguishable from the glob alone,
which is why this reads the filesystem:

| what is on disk at that path | verdict                                                  |
| ---------------------------- | -------------------------------------------------------- |
| TypeScript                   | **reports** — the rule did not see it                    |
| nothing                      | green — the ratchet is holding                           |
| no TypeScript                | green — no modules there, which is what the rule asserts |
| the walk could not answer    | green — see the limit below                              |

`.expectEmpty()` is unaffected. It was never exempt from the dead-selector diagnosis and
already reported.

## 2. `doctor` stops calling your healthy ratchets broken

Previously `doctor` reported **every** healthy `.notExist()` rule as a dead glob, because a
rule that matches nothing is what a ratchet looks like. If you have `doctor` in CI or diff its
output between runs, expect those findings to disappear. `check` was already correct; the two
now agree.

## 3. The spelling of your glob decides how much of the repository counts

This surprises people, and 0.9 made it more likely by teaching everyone to reach for `'**/'`.

| in a rule scoped to `apps/api` | what counts as "on disk"                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| `'**/legacy/**'`               | a `legacy/` **anywhere in the repository**, including other packages |
| `'legacy/**'`                  | a `legacy/` **under `apps/api`** only                                |

So a rule written `'**/legacy/**'` in `apps/api`'s rule file will report if `apps/other/legacy/`
exists — because `'**/'` means _anywhere_, and it does. That is not a bug; it is the glob
saying what you wrote.

**If you mean your own package, write the project-relative spelling.** Both reach your own
package's folders; only `'**/'` reaches the rest of the repository.

## What this release does not fix

- **A large repository turns this gate off, silently.** The disk walk stops after 50,000
  directory entries and then answers "could not determine" for _every_ path at once — which
  means green. Nothing reports that it gave up. Tracked; if your repository is in that range,
  treat a green `.notExist()` as unverified.
- **A cardinality rule over a path that genuinely holds no TypeScript** stays green, by
  design. If you assert the absence of something that is not TypeScript, this does not check
  it.
