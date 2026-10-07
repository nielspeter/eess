# Bug 0398: `explain --format agent` prints a rule with no subject

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `b1335f5`. No red test yet.
- **Severity:** Medium — the agent block is meant to be committed into an agent's instructions.
  For every kernel-dialect rule, and for any eess-ts rule without exactly one condition, it prints
  a fragment such as "that are internal should
  resolve to an existing file", which never says what "that" is. An agent reading it cannot tell
  what the rule is about.
- **Origin:** self-found 2026-10-07, checking an inbound report whose own claim did not hold. The
  report said the block "drops `because` and `suggestion`". That is by design, and applies to eess-ts rules too:
  the block carries one imperative per rule and leaves `because`/`suggestion` to
  `check --format json` (`packages/ts/src/cli/commands/explain.ts:104-105`).
- **Reported:** 2026-10-07

## Symptom

In this repo, `node packages/ts/dist/cli/bin.js explain spec.rules.ts --format agent` prints
`- that are internal and point into adr/ should resolve to an existing file`. Over bug 0396's
inbound rule file it prints:

```
### Corpus

- that are internal should resolve to an existing file
- that are live (not in a frozen folder) should resolve to a real file and line
```

An eess-ts rule with one condition prints a whole sentence:
`- Do NOT import from "**/x/**" (in code that reside in folder matching "**/src/**")`. The same
rule with a second condition (`.andShould().notImportFrom('**/y/**')`) prints
`- that reside in folder matching "**/src/**" should not import from "**/x/**" and not import from "**/y/**"`.
Declaring `imperative` in `.rule({ … })` prints that text instead, which is the workaround today.

## Reproduction

`node packages/ts/dist/cli/bin.js explain spec.rules.ts --format agent` in this repo.

## Root cause

The bullet is `d.imperative ?? (d.rule || 'Follow the architecture rule.')`
(`packages/ts/src/cli/commands/explain.ts:106`). Two paths reach a description that starts at the
selector, not at the subject:

- **eess-ts rules.** `buildImperative` makes a "Do NOT / MUST" sentence only for exactly one
  condition; otherwise it returns the plain description
  (`packages/ts/src/core/rule-declaration.ts:69-77`).
- **Kernel rules.** The kernel sets no `imperative`, so the renderer falls through to `d.rule`.

The kernel's own comment rules this out as a concern: "`imperative` is read only by `eess-ts`'s
`explain --format agent` … The kernel has no consumer to be wrong for"
(`packages/core/src/rule-description.ts:66-72`). That premise is false: `eess-ts explain` loads
and renders kernel-dialect rules, so it is that consumer.

## Fix

Not designed. Whatever produces the bullet names the subject, for every dialect and condition
count. The kernel comment is corrected in the same change.

## Verification

- [ ] Red test written first: `explain --format agent` over an eess-md rule with no declared
      `imperative` prints a bullet that names what the rule is about
- [ ] the same for an eess-ts rule with two conditions
- [ ] the kernel comment at `rule-description.ts` no longer says the kernel has no consumer
- [ ] `npm run validate` green.

Deferred: none.
