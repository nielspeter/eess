# Bug 0397: `doctor` calls a diagnosis failure a load failure

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `b1335f5`, with bug 0396's
  rule file. No red test yet.
- **Severity:** Medium — a false cause (ADR-009 rule 2). `doctor` says a rule file "could not be
  loaded" when it loaded and `check` ran it. The reader goes looking for an import or module-format
  problem that does not exist.
- **Origin:** inbound · the same report as bug 0396, confirmed here.
- **Reported:** 2026-10-07

## Symptom

```
Error: corpus.rules.ts could not be loaded (project.getSourceFiles is not a function), so none of it could be diagnosed.
```

`eess-ts check corpus.rules.ts` loads and runs the same file.

## Reproduction

Bug 0396's rule file and command.

## Root cause

`doctor`'s per-file `try` wraps both loading the file and diagnosing it
(`packages/ts/src/cli/commands/doctor.ts:127-131`):

```ts
const loaded = await loadRuleFiles([file])
rules.push(...loaded)
findings.push(...diagnose(loaded).map((f) => ({ ...f, ruleFile: file })))
```

The `catch` reports every error as a load failure, including one thrown by `diagnose()` after the
load succeeded. A diagnosis failure is also recorded in `loadFailures`, so a `--format json`
consumer gets the same wrong cause.

## Fix

Not designed. A throw from `diagnose()` is reported as a diagnosis failure of a loaded file, and a
load failure keeps its current message.

## Verification

- [ ] Red test written first: a rule file that loads but whose diagnosis throws is not reported as
      "could not be loaded", in either output format
- [ ] `npm run validate` green.

Deferred: none.
