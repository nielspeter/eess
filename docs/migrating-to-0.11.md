# Migrating to 0.11

> Written for the release tagged `v0.11.0`. Only `@nielspeter/eess-ts` moves. Check what you
> have with `npm ls @nielspeter/eess-ts`.

| package               | from   | to     |
| --------------------- | ------ | ------ |
| `@nielspeter/eess-ts` | 0.10.1 | 0.11.0 |

**One breaking change, and it is the same kind as 0.7's through 0.10's: a check that matched
nothing — and therefore passed — now matches.** No export is removed or renamed, and one
optional member is added to a published interface.

## If you only read one thing

**A `parent-dir` glob naming a path that holds no TypeScript was silent, and now reports.**
`resideInFolder` reads the _directory_ portion of each path, so a glob pointed at a file — or at
a path with nothing a TypeScript project would load — can never match. On a `.notExist()` rule
that meant a ratchet enforcing nothing while exiting 0.

```ts
import { modules, notExist } from '@nielspeter/eess-ts'

// Silent before 0.11. Reports now — the glob names a file, and `resideInFolder` reads folders.
modules(p).that().resideInFolder('**/docs/readme**').should().satisfy(notExist())
```

Measured: **0 findings before, 1 unsuppressable finding now.** The finding is correct, but it is
new red on a tree you did not change, and it cannot be suppressed by `.warn()`, `.excluding()`,
an `eess-exclude` comment, a baseline or `--changed`. The only exit is editing the glob — which
is the point: a rule that cannot match anything is not a rule, and
[ADR-009](../adr/009-agent-first-failure-surfaces.md) rule 1 is why that cannot be made
suppressible.

## What to do

1. Upgrade, run your gates, and **read the new findings before you regenerate a baseline.**
2. For any rule that now reports, the finding tells you which of three cases you are in, and the
   `Fix:` line names the edit rather than the direction:
   - _"Correct the selector to name the DIRECTORY you mean, or use `resideInFile()` if you meant
     the file"_ — the glob names a file. `resideInFile()` is the predicate for that.
   - _"Widen the tsconfig include to cover this path, or correct the selector"_ — the code you
     assert is gone is on disk and your project never loaded it. Here the tsconfig **is** the
     lever, and the rule found a real gap.
   - _"Correct the selector — this rule has not been enforcing anything"_ — the glob is broken in
     this project and in every other one. A leading `./` is the usual cause.
3. **Do not delete the rule.** None of the three remedies offers that, deliberately: the finding
   cannot be suppressed, so deletion would be the only achievable exit, and the rule is the thing
   that noticed.

## 1. A walk that gives up now says so

Separately, and not breaking: the filesystem walk behind these findings had a 50,000-entry
budget, and on exhaustion it answered "could not determine" for **every** glob at once — which
meant green. One repository over the threshold silenced every `.notExist()` rule in the run, for
a reason unrelated to any of their paths, and nothing said so.

Now it reports, once per run, naming the directories that consumed the walk largest-first. And
the budget is **500,000** with the default prune list grown from 14 names to 30 — `.wrangler`,
`.svelte-kit`, `.nuxt`, `.output`, `.vite`, `.turbo`'s neighbours and the rest. Measured: pruning
removes **88.9%** of entries in a repository with no generated output at all, and one adopter's
`.wrangler` alone was **58%** of theirs. If your gates are green today this changes nothing you
can observe; if you were above the old budget you were getting a false green and had no way to
know.

The remedy names directories you can delete or relocate. It does **not** say "your repository is
too large", because that is not something you can act on — and if the directories it names are
not disposable, say so on
[bug 0369](https://github.com/nielspeter/eess/blob/main/work/bugs/0369-the-prune-list-has-no-extension-point.md),
which holds the question of whether the prune list should be configurable at all.

## 2. `doctor` now states the remedy, not only the cause

`eess-ts doctor` is the tool you reach for first, and it had been printing why a glob was dead
without saying what to do about it. Three rounds of work on what that sentence must say had
reached only `check`. Both tools now read one table, so they cannot drift.

## 3. Two output shapes changed, in case you parse them

- **`doctor --format json`**: for a glob naming a file, `fault` now reports `'file-not-folder'`
  where it reported `'no-match'`, and `onDisk` is absent where it carried `'holds-typescript'`.
  `DiagnosticFinding` is published, so this is structured output you may be reading. No type
  changed; the values are more accurate and they are different.
- **Message text**: the scope clause reads "can never match anything in **any** project" for a
  glob broken everywhere (a `./` segment), and "in this project" otherwise. In 0.10 the first case
  said "in this project" for non-cardinality rules too, which understated it.

## 4. One optional member on a published interface

`DiskSet` gains `matchesOnlyFiles?(glob)` — the kind-aware question `classify` cannot answer.
It is **optional**, so a hand-built `DiskSet` keeps compiling. Nothing public accepts a `DiskSet`
today, which is its own open question
([bug 0365](https://github.com/nielspeter/eess/blob/main/work/bugs/0365-the-kernels-ondisk-union-has-no-consumers.md)).

## What this release does not fix

- **Above 500,000 entries the walk still gives up**, and the finding it emits is unsuppressable
  with a remedy of "delete these directories". If they are not disposable you have hit a wall.
  [ADR-016](../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) decides that
  a bound may cost knowledge and may never decide the verdict — a reported limit, not a solved
  one, and it says so.
- **A ratchet whose selector is not a path glob** — by name, decorator, or `satisfy()` predicate
  — is still as unexamined as before. The check keys on globs.
