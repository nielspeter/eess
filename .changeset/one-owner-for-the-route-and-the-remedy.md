---
'@nielspeter/eess-ts': minor
---

A dead-glob finding's remedy is now right on every route, and `doctor` carries it

Fixes [bug 0363](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)
and [bug 0364](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md).

**Breaking (@nielspeter/eess-ts):** a project that was green can now report. A `.notExist()`
rule whose selector is a `parent-dir` glob — what `resideInFolder` reads — naming a path that
holds **no TypeScript** on disk was silent before and reports now. The commonest shape is a
glob pointed at a non-source file:

```ts
import { modules, notExist } from '@nielspeter/eess-ts'

modules(p).that().resideInFolder('**/docs/readme**').should().satisfy(notExist())
```

Measured: **0 findings before, 1 unsuppressable finding now.** The finding is correct — that
glob can never match anything, so the rule was enforcing nothing — but it is new red on a tree
you did not change, it cannot be suppressed by `.warn()`, `.excluding()`, an `eess-exclude`
comment, a baseline or `--changed`, and the only exit is editing the glob. That is why this is
a **minor** and not a patch.

_No sibling package is bumped with it._ `eess-crossvalidate` names `eess-ts` as a
**peerDependency** at `>=0.9.0`, and with `onlyUpdatePeerDependentsWhenOutOfRange` a minor
stays in range — so it does not re-ship this break, its consumers bring their own `eess-ts`.
A first draft bumped it anyway, which is the padding `RELEASING.md` warns against: the
dependent-naming rule exists for a break travelling through `dependencies`, and the release
gate weighed this edge at zero.

## Why it changed

**An impossible `Fix:` line.** A `.notExist()` whose selector names a **file** outside your
project — `'**/apps/legacy/src/old**'` rather than `'**/apps/legacy/**'` — was told to _"widen
the tsconfig include"_. No `include` can make that glob match: `resideInFolder` reads the
directory portion. The finding was right and the instruction beside it could not be carried
out.

The cause was two derivations of one fact. The gate that admitted the finding asked the disk
"is there TypeScript at this path"; the message asked "did the disk decide this". Those
disagree for a glob naming a file, so a finding was admitted for one reason and explained with
another. There is now one owner — the route — read by the admission gate, the message and
`doctor` alike.

## What you will see change

- a glob naming a file: `Correct the selector to name the DIRECTORY you mean, or use
`resideInFile()` if you meant the file — this rule has not been enforcing anything. Do not
delete it.`
- **`eess-ts doctor` now states the remedy**, not only the cause. It is the tool you reach for
  first, and the remedy had only ever reached `check`.
- **`doctor --format json` changes shape for this case**: `fault` reports `'file-not-folder'`
  where it previously reported `'no-match'`, and `onDisk` is absent where it previously carried
  `'holds-typescript'`. `DiagnosticFinding` is published, so this is structured output you may
  be parsing — the values are more accurate, and they are different.
- unchanged: a glob naming a **folder** on disk outside your project still says `Widen the
tsconfig include…`, because there the tsconfig really is the lever.

## If you do not want the new red

Fix the glob — that is the whole remedy, and the finding names which of the three cases you
are in. There is no flag to turn it off: a rule that cannot match anything is not enforcing
anything, and
[ADR-009](https://github.com/nielspeter/eess/blob/main/adr/009-agent-first-failure-surfaces.md)
rule 1 is why that cannot be made suppressible.

## One addition to the published surface, deliberately optional

`DiskSet` — exported from the dialect root — gains `matchesOnlyFiles?(glob)`, the kind-aware
question `classify` cannot answer. It is **optional** so that a hand-built `DiskSet` value keeps
compiling. A required member would have been a second, silent break: `check:release` reads the
`**Breaking**` marker rather than prose, and `check:surface` tracks export _names_ rather than
interface members, so neither would have caught it.
