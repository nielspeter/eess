# Bug 0358: the "Unused exclusion" warning names the rule id but not the instance, so a live exclusion reads as stale

## Status

- **State:** Draft — inbound, with the adopter's own measurement isolating it.
- **Severity:** Medium — **no wrong verdict; a message that misidentifies its
  subject.** The warning is _true_ of the instance it came from and reads as if it
  were about a different one. It cost an adopter a debugging session and a bug
  report they then had to retract.
- **Origin:** inbound. An adopter reported a false "Unused exclusion" warning, then
  measured it themselves and retracted the claim — the warning was correct, just
  unattributable. **The residue is ours:** the message cannot be acted on because it
  does not say which instance it is about.
- **Reported:** 2026-09-29

## Symptom

An adopter builds the same rule once per package, in a loop, with one id. Re-sourced to
this corpus's vocabulary per `BUGS.md`'s intake rule — the reporter's own file and rule
names were in the first draft, which is the material that rule exists to keep out:

```ts
for (const [name, p] of packages) {
  jsxElements(p)
    .that()
    .areHtmlElements('input')
    .and()
    .resideInFolder('**/src/**')
    .excluding(/LegacyWidget\.tsx$/)
    .should()
    .notExist()
    .rule({ id: 'jsx/no-raw-element', because: '…' })
    .check()
}
```

`LegacyWidget.tsx` exists in one app and not the other. The run prints:

> `[eess] Unused exclusion '/LegacyWidget\.tsx$/' in rule 'jsx/no-raw-element'. It
matched zero violations — it may be stale after a rename.`

Measured by the reporter, one instance at a time:

| instance                  | warnings                                          |
| ------------------------- | ------------------------------------------------- |
| the app that HAS the file | **0**                                             |
| the app that does not     | **1**                                             |
| exclusion removed         | the first app goes red — so the exclusion is live |

So the warning is **true** — of the second instance. The reader sees a rule id they
recognise, an exclusion they can demonstrate is load-bearing, and a message telling
them it is stale. Their first conclusion was that eess was wrong.

## Root cause

`packages/ts/src/core/execute-rule.ts:212-217` composes the message from `pattern`
and `ctx.metadata?.id`. Neither is an identity when one id is built several times
over different projects — which is the documented way to scope a rule per package,
and what `workspace()` versus per-package `project()` handles exist for.

Nothing in the line says which project the instance ran against, so two instances
that differ only in their `ArchProject` produce byte-identical output.

**This is ADR-009 rule 4's concern one level down.** The rule asks for identities
rather than a bare total; here there IS one finding per instance, and the finding
does not carry the identity that distinguishes them.

## Fix

Not decided. The information is available at the warning site — `ctx` reaches the
rule's project — so this is about what to print and how much.

- **Name the project.** The tsconfig path is the natural identity, and
  `rootFromTsConfigPath` already normalises it. Long, but unambiguous.
- **Name it only when ambiguous.** The warning is emitted per `check()`, so a run
  cannot know another instance shares the id without state across calls. That makes
  "only when ambiguous" harder than it sounds and is the reason to decide rather
  than assume.
- **Do nothing and document it.** Rejected in advance as the shape ADR-009 rule 2
  forbids: a message whose remedy ("it may be stale after a rename") is wrong for
  the reader's situation.

**Not in scope: the warning's own severity.** `ts/src/core/execute-rule.ts:224-343` already
records that this advisory-versus-finding asymmetry is real and deliberately left
alone; this record is about attribution only, and re-litigating the other would
bundle two decisions into one change.

## What was NOT the bug

The reporter's first hypothesis, and mine, was that exclusion matching was broken.
It was not, and the record says so because a future reader finding this
symptom should not re-derive the wrong cause. Also checked by the reporter and
excluded: no `// eess-exclude` comments anywhere in either application, and the
exclusion is attached directly with `.excluding()` in the that-phase, not through a
preset's options.

## Related

- [0298](./0298-an-exclusion-that-absorbs-several-subjects-says-nothing.md) — the
  other end of the same surface: an exclusion that silences MORE than the author
  intended says nothing at all, where this one says something unattributable.
- [0233](./0233-an-exclusion-that-suppresses-every-violation-is-silent.md) — the same
  family again, and the reason this one is only Medium: an exclusion that silences
  everything is the fail-OPEN direction, while this warning is fail-closed noise.

## Verification

- [x] the reporter's isolation: one warning from the instance without the file, zero
      from the instance with it, and the rule reds when the exclusion is removed.
- [x] the mechanism confirmed against `ts/src/core/execute-rule.ts:212-217` — the message is
      composed from the pattern and the rule id, and neither distinguishes instances.
- [ ] a ruling on what the line should name
- [ ] a red-first test: two instances of one id over two projects, asserting the two
      warnings are distinguishable
- [ ] a changeset — stderr output changes
- [ ] `npm run validate` green.

Deferred: none.
