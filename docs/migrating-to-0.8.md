# Migrating to 0.8

> Written for the release tagged `v0.8.0`. Only `@nielspeter/eess-ts` moves. Check what you have with
> `npm ls @nielspeter/eess-ts`.

| package               | from  | to    |
| --------------------- | ----- | ----- |
| `@nielspeter/eess-ts` | 0.7.0 | 0.8.0 |

Both of this release's changes are breaking, and they are the same kind as 0.7's: **a check that
passed code it should have read now reads it.** No export is removed or renamed; one is added
(`moduleNoGenericErrors`). What you are likely to see is a build that was green reporting findings
with your source untouched.

**If you did the 0.7 migration, this is the same procedure a second time** — [§1](/migrating-to-0.7)
and §2 of that page applied to a different preset. That is not a coincidence and it is worth saying
plainly: 0.7 fixed `recommended`, 0.8 fixes `agentGuardrails`, and nothing yet binds the two presets
to one ruling.

## What to do

1. Upgrade, run your gates, and **read the new findings before you regenerate a baseline**.
2. Fix any `// eess-exclude` comments the run names — **before** regenerating (see below; a stale
   exclusion does not fail the build, so regenerating first leaves them permanently dead).
3. If you pass `expectEmpty` for a rule named below, delete that declaration.

## 1. A path glob now reads the project root too

`'**/…'` globs were matched against the absolute file path only. Under a project path containing a
dot-segment — a git-worktree manager's layout, a cache directory, some CI workspaces — picomatch's
default stops `**` crossing it, so **every `'**/…'` glob matched nothing\*\* and correct rules reported
that they enforce nothing.

Every path glob now also reads the path named from your tsconfig's directory. Three spellings are
deliberately excluded and still report as faults: `'./x/**'`, `'../x/**'` and `'*/x/**'`.

If your project does not sit under a dot-directory, the most likely effects are:

- **Exclusions widen.** `inconsistentSiblings().ignorePaths('src/generated/**')` previously ignored
  nothing and now ignores. A build that was red can go green — check anything you relied on.
- **`resideInFile`/`resideInFolder` as conditions** stop reporting every subject as a violation.
- **Two surfaces narrow**: `onlyBeImportedVia` and `duplicateBodies`' path filters used to try the
  root-relative path for every glob, and now follow the same rule as everything else. If you spell a
  glob `'./x'`, `'../x'` or `'*/x/**'` there, it stops matching. All three fail closed.

## 2. `agentGuardrails` reads the whole file

Two of its rules read each function body and now read the module:

| rule                                 | now reads  |
| ------------------------------------ | ---------- |
| `preset/agent/no-inline-logic/<api>` | the file   |
| `preset/agent/no-generic-errors`     | the file   |
| `preset/agent/no-stubs`              | a function |
| `preset/agent/no-empty-bodies`       | a function |

So a bare top-level `eval`, one in a class's static block or a field initializer, and a
`throw new Error()` outside any function are reported where they were silent.

### `expectEmpty` no longer applies to the two that moved

A module subject exists whenever the glob matches, so the declaration fails as the assertion it is:

```ts
import { agentGuardrails } from '@nielspeter/eess-ts/presets'

// was: agentGuardrails(p, { src, noInlineLogic: ['eval'], expectEmpty: ['preset/agent/no-inline-logic/eval'] })
agentGuardrails(p, { src: '**/src/**', noInlineLogic: ['eval'] })
```

The failure names the exact declaration to delete.

### Move `// eess-exclude` comments to the line the finding names

**This is the one that bites a project with a long tail of accepted exceptions.** A single-line
directive covers the next line only, and for the two moved rules the reported line is now the
**match's** line rather than the enclosing declaration's — so an exclusion slides out from under its
finding even when the element name is unchanged:

```ts
// eess-exclude preset/agent/no-generic-errors: legacy, TICKET-2
export function namedHandler(): void {
  throw new Error('named boom') // <- the finding is HERE now
}
```

The run names each one, with the file and line it found: `Exclusion comment for '<id>' at <file> suppressed nothing`. Move the
comment down, or wrap the region with `eess-exclude-start` / `eess-exclude-end`.

**Order matters.** A stale exclusion prints as a warning and the run still exits 0. Regenerate the
baseline first and you end up green with exclusion comments that will never suppress anything again.

### An element name can be the file

A match with nothing named enclosing it is reported against the file. So is a match inside an
object-literal handler — `const routes = { objectHandler: () => … }` was `routes.objectHandler` and is
now the file's name. The finding is still reported and its baseline identity is no weaker than before;
what changed is the name you read and `.excluding()` matches on.

## Baselines

Every accepted finding for the two moved rules **unmatches and returns as new**, because a baseline
identity carries the subject kind. You will see findings you have already reviewed, with nothing in
the output saying so — that is a known gap, not your project getting worse overnight.

The order that matters: **run, read, fix exclusions, then regenerate.**

## Known limits in this release

- **A returning finding is not explained.** When a rule changes subject, accepted findings come back
  as fresh errors and no diagnostic says why. If _every_ entry unmatches you get a four-cause
  diagnostic; in the common mixed case you get nothing.
- **Two weakly-named findings in one file are told apart by position.** Accept two top-level `eval`
  calls, fix the first, add a different one, and the new one matches the freed entry and is accepted
  **silently**. Findings inside named functions are unaffected, and so is the cross-file direction.
  Prefer reviewing a `baseline --diff` over trusting a green run for these two rules.
- **A dot-directory _inside_ your project still cannot be crossed by `**`.** `'**/\*.ts'`does not
reach`.storybook/main.ts`in either spelling. Name the segment literally —`'.storybook/**'` works.
