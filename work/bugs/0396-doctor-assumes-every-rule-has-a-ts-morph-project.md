# Bug 0396: `doctor` assumes every rule has a ts-morph project

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `b1335f5`, on this repo's
  own `spec.rules.ts`. No red test yet. **A regression of a recorded crash:** plan 0150 found it
  on 2026-08-18 and backed its port out; `orphanExclusions` then shipped in #72 (2026-08-21) without the guard.
- **Severity:** Medium — `eess-ts doctor` crashes, exit 1, on any rule file that exports a kernel
  dialect's builders (eess-md here; eess-mermaid and eess-gherkin build on the same kernel
  `RuleBuilder`; eess-crossvalidate does not). It fails loudly, so it is not a false green, but the pre-flight tool
  cannot be used on those files at all.
- **Origin:** inbound · a Claude session working in an adopter's repo, evaluating eess-md gates
  (eess-ts 0.11.0, eess-md 0.8.0, eess 0.6.0, Node 24.14.0), confirmed here.
- **Reported:** 2026-10-07

## Symptom

A rule file that exports eess-md builders loads and runs under `eess-ts check`, and crashes
`eess-ts doctor`:

```
Error: corpus.rules.ts could not be loaded (project.getSourceFiles is not a function), so none of it could be diagnosed.
…/packages/ts/dist/core/orphan-exclusions.js:152
        for (const sourceFile of project.getSourceFiles()) {
TypeError: project.getSourceFiles is not a function or its return value is not iterable
    at orphanExclusions (…/dist/core/orphan-exclusions.js:152:42)
    at runDoctor (…/dist/cli/commands/doctor.js:190:26)
```

There are two throws: the first is caught and reported as a load failure (bug 0397); the second
is uncaught and ends the process.

## Reproduction

In this repo: `node packages/ts/dist/cli/bin.js doctor spec.rules.ts` crashes with the same
stack. `spec.rules.ts` mixes eess-ts and eess-md rules.

The inbound shape, in an empty directory with `.git`, a `package.json`, `docs/a.md`, and the `@nielspeter` packages
linked from this repo:

```ts
// corpus.rules.ts
import { corpus, links, pointers } from '@nielspeter/eess-md'
const c = corpus({ roots: ['docs/**'] })
export default [
  links(c)
    .that()
    .areInternal()
    .should()
    .resolve()
    .rule({ id: 'corpus/links-resolve', because: 'B', suggestion: 'S' }),
  pointers(c)
    .that()
    .areLive()
    .should()
    .resolve()
    .rule({ id: 'corpus/pointers-resolve', because: 'B', suggestion: 'S' }),
]
```

`node packages/ts/dist/cli/bin.js doctor corpus.rules.ts` exits 1 with the output above.

## Root cause

`doctor` reads each rule's project through `DiagnosableRule.getProject`, typed as returning a
ts-morph `ArchProject` (`packages/ts/src/core/diagnose.ts:53`). The kernel's builder returns its
own generic project `P` (`packages/core/src/rule-builder.ts:276-278`); for eess-md that is the
markdown corpus. Two places then call `getSourceFiles()` on it:

- `diagnose()`, which takes `rule.getProject?.() ?? project` (`packages/ts/src/core/diagnose.ts:290`)
  and throws at `loadedNothing(target)` (`:386`, calling `getSourceFiles()` at
  `packages/ts/src/core/empty-project-advice.ts:75`), inside `doctor`'s per-file `try`, so it is
  caught;
- `orphanExclusions()` (`packages/ts/src/core/orphan-exclusions.ts:155` collects it, `:129` and
  `:197` iterate it), called after that loop (`packages/ts/src/cli/commands/doctor.ts:202`), so
  it is not.

Rule files are loaded at runtime, so nothing at compile time checks that the value is a ts-morph
project.

## Fix

Not designed. Plan 0150 (`work/plans/0150-close-0088s-disclosed-review-findings.md`) named one
direction: a kernel-placed `orphanExclusions` whose signature never mentions `ArchProject`, tested
with a fixture whose `getProject()` returns a foreign object. This record owns the crash; plan
0150's Phase 4 points here. Whatever the fix, a rule whose project is not a ts-morph project must be either
diagnosed by what applies to it or reported as not diagnosable by `doctor`. It must not crash, and
it must not be skipped silently, which would read as a clean bill (bug 0268's class).

## Verification

- [ ] Red test written first: `doctor` over a rule file exporting eess-md builders, through the
      CLI, exits without a `TypeError` and says what it did and did not diagnose
- [ ] the same for a mixed file (one eess-ts rule, one eess-md rule): the eess-ts rule is still
      diagnosed
- [ ] `doctor` runs on every rule file in this repo, which is plan 0150's success criterion
- [ ] `npm run validate` green.

Deferred: none.
