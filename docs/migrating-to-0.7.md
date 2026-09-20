# Migrating to 0.7

> Written for the release tagged `v0.7.0`. **Two dialects move to 0.7.0 and one to 0.6.0** — the
> kernel keeps its version, so this tag carries the dialects' number, not the kernel's. Check what
> you have with `npm ls @nielspeter/eess-ts @nielspeter/eess-md`.

| package                          | from  | to    |
| -------------------------------- | ----- | ----- |
| `@nielspeter/eess-ts`            | 0.6.0 | 0.7.0 |
| `@nielspeter/eess-md`            | 0.6.1 | 0.7.0 |
| `@nielspeter/eess-crossvalidate` | 0.5.1 | 0.6.0 |
| `@nielspeter/eess`               | 0.5.1 | 0.5.1 |
| `@nielspeter/eess-mermaid`       | 0.4.1 | 0.4.1 |
| `@nielspeter/eess-gherkin`       | 0.4.0 | 0.4.0 |

All six of this release's changes are breaking, and they are one kind: **a check that passed code it
should have read now reads it.** No export is removed or renamed — the published surface was diffed
subpath by subpath against npm, and nothing left it. What you are likely to see is a build that was
green reporting findings with your source untouched.

That is the upgrade doing its job. **Read the new findings before you regenerate a baseline** —
regenerating accepts all of them, and each is a place a check you already configured was not looking.

## What to do

1. **Upgrade `eess-ts` and `eess-md` together.** `eess-crossvalidate` 0.6.0 raises its optional peer
   floors to `>=0.7.0` on both, because it imports `@nielspeter/eess-md/internal` at run time. If you
   use crossvalidate, moving one dialect without the other will not resolve.
2. Run your gates and read what is new.
3. If you pass `expectEmpty` for a floor rule, see section 1 — three of them now reject it.
4. If you keep a baseline, read "Baselines" before regenerating.

## Changes you may have to make

### 1. `expectEmpty` no longer applies to three floor rules

`recommended`'s `no-eval`, `no-function-constructor` and `no-silent-catch` now read the whole file
rather than each function, so they always have a subject and can never be empty. A declaration on one
of them fails as the assertion it is:

```ts
import { recommended } from '@nielspeter/eess-ts/presets'

// was: recommended(p, { expectEmpty: ['preset/recommended/no-eval'] })
recommended(p)
```

The failure names the exact declaration to delete. `no-empty-bodies` still reads functions and still
accepts the declaration.

### 2. Exclusions keyed on a name the finding no longer uses

For those three rules a finding now names the declaration containing the match — `handler`,
`Cache.warm`, `Service.url` — and the file only when nothing does. Two consequences:

- `.excluding('CatchClause')`, which worked when every module-scope silent catch was reported under
  that syntax-kind name, stops matching. The run reports it as an unused exclusion rather than
  dropping it silently.
- An `// eess-exclude` comment placed on a **declaration** line may no longer cover the finding: the
  reported line is now the match's line, not the enclosing declaration's. Move the comment to the
  line the finding names.

### 3. `eess-md`'s family plumbing moved behind `/internal`

`proseText`, `unclosedFences` and `unterminatedFence` are exported from
`@nielspeter/eess-md/internal`. They are family plumbing, not public API, and the root barrel does not
re-export them — the same arrangement the kernel uses. Nothing an adopter imports moved.

## Builds that can go red on their own

Nothing here needs a code change from you.

### The floor reads code outside functions (eess-ts)

Every rule `recommended` built read a function body, so a bare `eval('x')` at the top of a file passed
a rule named `no-eval`. Measured over eleven positions, ten were silent. Now `no-eval`,
`no-function-constructor` and `no-silent-catch` read the whole file: top-level statements and
initializers, class static blocks, field initializers, and callbacks handed to a call.

### A global is read through its binding (eess-ts)

`const ev = eval; ev('1')`, `const { log } = console`, `const { env } = process` and
`import { env } from 'node:process'` are reported — they were not before. In the other direction, a
local that merely keeps a global's name — `function Function(…) {}`, a parameter called `process` — is
no longer reported as the global. If a baseline accepted one of those false reds, its entry is now
unmatched.

### More positions are functions (eess-ts)

`functions()` reads a namespace as it reads a file, a class expression held by a variable as it reads
a class, and an object literal's accessors as it reads its methods. New subjects mean new findings,
named `N.Inner.m`, `Expr.m` and `o["get x"]`.

### Callbacks and comments are read where they are written (eess-ts)

`haveCallbackContaining` / `notHaveCallbackContaining` read every callback the call passes — an
options-object handler, a method shorthand, one behind parentheses or a cast — not only a callback that
IS the argument. A class comment rule reads the comments in a member's parameter list. Function rules
read what a parameter's default runs.

### Markdown is read through the CommonMark parser (eess-md)

`honestyAtClose`, `terms()` and the scenario-citation preset pair fences with the parser instead of a
regex, so a four-backtick example no longer hides the real line below it, and a line written inside an
example is no longer read as a claim. A green ledger may now report a `State:` line it could not see;
a red one may lose a finding that was only an example.

## Baselines

A baseline entry carries the subject a rule reads. Three floor rules changed subject, so their
existing entries no longer match and their findings return as new — including findings you had
accepted. `eess-md`'s ledger and `eess-ts`'s callback and class-comment rules report in positions they
did not read before, which is new entries rather than moved ones.

The order that matters: **run, read, fix, and regenerate last.** Regenerating first accepts
everything — measured on an upgraded project, `eess-ts baseline` prints `+7, −1`, goes green, and
silently accepts the top-level `eval` this release exists to report.

## Known limits in this release

Two things the tooling does not yet do, recorded so you are not surprised by them:

- **A returning finding is not explained.** When a rule changes subject, an accepted finding comes back
  as a fresh error and no diagnostic says why — the rule's wording is unchanged and most entries still
  match, so neither existing baseline diagnostic fires.
- **A match with no enclosing declaration is identified by position.** Baseline two top-level `eval`
  calls in one file, fix the first and add a different one below it, and the new one is accepted
  silently. Cross-file, each entry carries its file and this does not happen.
