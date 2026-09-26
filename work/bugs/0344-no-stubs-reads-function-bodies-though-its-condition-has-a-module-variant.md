# Bug 0344: `no-stubs` reads function bodies, though its condition has a module variant and its own `because` is not function-scoped

## Status

- **State:** Draft — measured by the enforcement review of PR #151, which proved the module variant
  works and counted what it would find here.
- **Severity:** Low — **a disclosed gap, not a silent one.** A stub comment outside any function —
  `// TODO: implement this module` at file scope, `// FIXME` above a class — is unreported under a
  rule the adopter enabled called `no-stubs`. This repo has **0** such comments in `packages/*/src`
  today, so there is no live false green; the severity is about the next one.
- **Origin:** the enforcement review of PR #151, 2026-09-26 (Minor 1), reviewing
  [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md).
- **Reported:** 2026-09-26

## Symptom

Measured on this branch: a `// TODO: implement` inside a function is reported; the same comment at
the end of a file, or above a class with no function after it, is not.

`agentGuardrails`' own control test pins that behaviour deliberately
(`packages/ts/tests/presets/agent-guardrails-reads-module-scope.test.ts` ·
`CONTROL: no-stubs stays function-scoped, because its own imperative is`).

## Root cause

0337's ruling is _each rule reads the broadest subject its condition has a variant for_. Applied
literally, `no-stubs` selects **module**: `noStubComments()` is
`functionNotContain(comment(pattern))` (`packages/ts/src/rules/hygiene.ts:55`), and
`moduleNotContain(comment(STUB_PATTERNS))` is the same one-line substitution that produced
`moduleNoGenericErrors`. Review ran it over this repo's six build projects and it returned findings,
including file-level docstrings — **the variant exists and works.**

What overrode the ruling was the rule's own `imperative`: "Do NOT leave stub comments (TODO/FIXME/
'not implemented') **in a function body**". 0337 used that wording as the tiebreak, consistently, for
both the rule it widened and this one.

**Review's objection is that the criterion is circular**, and it is a fair one: the `imperative` is a
string authored in the same file by whoever is deciding the subject, so a Tier-5 artefact is being
used to fix the scope of a Tier-1 mechanism. It is also not unanimous within this rule — its
`because` reads "stub comments (TODO/FIXME/'not implemented') ship unfinished work", which is not
function-scoped at all.

## Fix

Not decided; the decision is what the tiebreak should be when the ruling and the wording disagree.

- **Widen the rule and the wording together** — add `moduleNoStubComments()`, move the rule to
  `modules()`, and rewrite the `imperative` to drop "in a function body". Measured cost: this repo's
  own `check:guardrails` already runs `noStubs: true`, so it would immediately carry a real
  denominator — and review's run suggests file-level docstrings would need to be either fixed or
  distinguished from stubs first. **That is the work, and it is why this is not a one-liner.**
- **Keep the rule narrow and fix the ruling's wording**, so "the broadest subject its condition has a
  variant for" stops being stated as an unconditional rule when a second criterion is in play.
- **Keep both and say the criterion is deliberate**, with an argument for why the author's stated
  scope should win over the mechanism's reach.

## Related

- [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md) — where the tiebreak was
  applied and disclosed.
- [0343](./0343-two-presets-carry-one-subject-ruling-in-two-tables.md) — whether the ruling binds
  anything by construction; this record is the first test of whether it binds at all.

## Verification

- [x] measured by review: the module variant is a one-line substitution, it works, and this repo has
      0 module-scope stub comments in `packages/*/src` today.
- [ ] a ruling on the tiebreak
- [ ] the rule widened, or the ruling's wording narrowed
- [ ] a changeset, if a rule's population changes
- [ ] `npm run validate` green.

Deferred: none.
