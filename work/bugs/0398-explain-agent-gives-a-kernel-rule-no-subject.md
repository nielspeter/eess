# Bug 0398: `explain --format agent` gives a kernel rule no subject

## Status

- **State:** Draft — reproduced 2026-10-07 against this repo's build at `b1335f5`. No red test yet.
- **Severity:** Medium — the agent block is meant to be committed into an agent's instructions.
  For a rule built on a kernel dialect it prints a fragment such as "that are internal should
  resolve to an existing file", which never says what "that" is. An agent reading it cannot tell
  that the rule is about markdown links.
- **Origin:** inbound · the same report as bug 0396, confirmed here. The report said the block
  "drops `because` and `suggestion`". That part is by design, and applies to eess-ts rules too:
  the block carries one imperative per rule and leaves `because`/`suggestion` to
  `check --format json` (`packages/ts/src/cli/commands/explain.ts:104-105`).
- **Reported:** 2026-10-07

## Symptom

`eess-ts explain corpus.rules.ts --format agent` over bug 0396's rule file prints:

```
### Corpus

- that are internal should resolve to an existing file
- that are live (not in a frozen folder) should resolve to a real file and line
```

An eess-ts rule in the same command prints a whole sentence:
`- Do NOT import from "**/x/**" (in code that reside in folder matching "**/src/**")`.
Declaring `imperative` in the eess-md rule's `.rule({ … })` prints that text instead, which is the
workaround today.

## Reproduction

Bug 0396's rule file; `node packages/ts/dist/cli/bin.js explain corpus.rules.ts --format agent`.

## Root cause

The bullet is `d.imperative ?? (d.rule || 'Follow the architecture rule.')`
(`packages/ts/src/cli/commands/explain.ts:106`). eess-ts builders always set `imperative`: they
fall back to the rule's reason (`packages/ts/src/core/terminal-builder.ts:425`). The kernel sets
none, so a kernel rule falls through to `d.rule`, the assembled description, which starts at the
selector, not at the subject.

The kernel's own comment rules this out as a concern: "`imperative` is read only by `eess-ts`'s
`explain --format agent` … The kernel has no consumer to be wrong for"
(`packages/core/src/rule-description.ts:66-72`). That premise is false: `eess-ts explain` loads
and renders kernel-dialect rules, so it is that consumer.

## Fix

Not designed. Either the kernel or each dialect supplies an imperative that names the subject, or
the agent renderer names the subject itself. The kernel comment is corrected in the same change.

## Verification

- [ ] Red test written first: `explain --format agent` over an eess-md rule with no declared
      `imperative` prints a bullet that names what the rule is about
- [ ] the kernel comment at `rule-description.ts` no longer says the kernel has no consumer
- [ ] `npm run validate` green.

Deferred: none.
