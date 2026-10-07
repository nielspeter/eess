# Bug 0399: `explain --format agent` tells the agent to run a command that fails

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `b1335f5`. No red test yet.
- **Severity:** Medium — a remedy that does not remedy (ADR-009). The block's one instruction to
  the agent fails, with exit 1, in any project that names its rule files on the command line
  rather than in a config.
- **Origin:** inbound · the same report as bug 0396, confirmed here.
- **Reported:** 2026-10-07

## Symptom

The agent block says: "after writing or changing code, run `npx eess-ts check --format json`,
read the `violations` array, and fix each one using its `suggestion`."

In a project with no `eess-ts.config.ts`, where `explain` was given the rule file explicitly,
running that command as written gives:

```
Error: No rule files specified. Pass rule files as arguments or set them in eess-ts.config.ts.
```

## Reproduction

This repo has no `eess-ts.config.*`: `node packages/ts/dist/cli/bin.js explain spec.rules.ts
--format agent`, then `node packages/ts/dist/cli/bin.js check --format json`. The second command
exits 1.

## Root cause

The instruction is a fixed string (`packages/ts/src/cli/commands/explain.ts:69-71`). `explain`
knows the rule files it was given, but the instruction never names them, so it is right only when
a config names the rule files.

## Fix

Not designed. The command the block prints runs as written in the project it was generated for.

## Verification

- [ ] Red test written first: the command the agent block prints, run in the fixture it was
      generated from with no config, exits 0 or reports violations, never "No rule files
      specified"
- [ ] `npm run validate` green.

Deferred: none.
