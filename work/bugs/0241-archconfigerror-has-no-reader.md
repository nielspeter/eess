# Bug 0241: `ArchConfigError` was minted and nothing branches on it, so the surface it exists to fix is unchanged

## Status

- **State:** Draft — measured against the merged source; no red test yet.
- **Severity:** Medium — not a false green. Nothing is suppressed and nothing
  reports wrongly; a misconfigured rule still fails loudly. What is false is the
  **claim**: the type shipped to make a misconfiguration distinguishable from a
  crash, and at every reader it still is not. An exported symbol with no
  consumer that reads as coverage — bug 0190's shape, and bug 0178's.
- **Origin:** self-found · enforcement review of the guardrails arc after it
  merged (PR #91, 2026-09-03).
- **Reported:** 2026-09-03

## Symptom

`e82c27d` added `ArchConfigError` and `isArchConfigError`
(`packages/core/src/errors.ts:116`), and moved 17 sites from a bare `Error` to
it. That half shipped and is right.

`isArchConfigError` has **no consumer**. Every reference is a definition or a
barrel re-export: `packages/ts/src/index.ts:36`, the kernel's own export, and one
entry in the vacuity census. Nothing imports it to branch on.

The reader it was written for is unchanged.
`packages/ts/src/cli/rule-file-findings.ts:108`:

```ts
return isArchRuleError(error) ? error.violations : [ruleFileFailure(file, error, rule)]
```

So an `ArchConfigError` still falls into the same `else` as an unhandled crash,
which is verbatim what `.changeset/dogfood-agent-guardrails.md` says the type
fixes:

> a rule author who mistyped an argument saw the same surface as an unhandled
> crash

They still do. The changeset describes an outcome the diff does not produce.

## Why it matters, stated precisely

The audience is an AI coding agent reading a failure and deciding what to do
next. "Your rule file is misconfigured — fix the argument" and "eess crashed" ask
for opposite actions, and today they render identically. ADR-009 rule 2 is about
exactly this: the message must state what to do, and a message whose stated fix
is wrong for the path that produced it is worse than none.

## Fix

Branch on it where the two cases diverge — at minimum
`packages/ts/src/cli/rule-file-findings.ts:108`, so a config error renders with
its `subject` and its own remedy rather than the generic rule-file failure. Then
assert it: a rule file that throws `ArchConfigError` produces a finding naming
the subject, and one that throws anything else does not.

Worth deciding at the same time, and the reason this is one record rather than
two: **the general question is whether an exported symbol may ship with no call
site at all.** Three records now describe that shape — 0178, 0190 and this one.
`check:surface` verifies export-to-doc, not export-to-use. Either that is a gate
worth having or the answer is "no, and review catches it"; a third instance is
enough evidence to decide rather than keep filing.

## Verification

- [ ] Red first: a rule file throwing `ArchConfigError` renders a finding that
      names its `subject`. Today it renders the generic rule-file failure.
- [ ] A rule file throwing a plain `Error` still renders the generic failure —
      the discrimination, asserted in both directions.
- [ ] `isArchConfigError` has at least one consumer that a test exercises.
- [ ] Record the decision on exported-symbol-with-no-call-site, or file it.

## Related

- [0190](./0190-the-preset-constructs-nothing-finding-cannot-fire.md) — a
  finding constructor with no call site; the same shape, already High.
- [0178](./0178-the-kernels-dead-glob-finding-cannot-fire.md) — the same shape
  again, in the kernel.
