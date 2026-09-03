# Bug 0229: a call site whose arguments carry logic is reported as copy-paste

## Status

- **State:** Draft — measured on this repo across a full extraction pass.
  **This record was rewritten after investigation reversed its central claim**
  (see [Correction](#correction) — the first version was filed on a hypothesis
  that measurement did not support).
- **Severity:** Low — narrower than first filed. `minDistinctVocabulary`
  (plan 0103) already rejects the common case; what remains is a small residue
  where the extracted call site's arguments are themselves logic.
- **Origin:** self-found · dogfooding `agentGuardrails` over this repo
  (`check:guardrails`) and working the findings from 84 down to 34.
- **Reported:** 2026-09-02

## Symptom

Extract a cluster into one shared helper, exactly as the `Fix:` line says, and
**sometimes** the rule reports the resulting call sites instead. Measured on
three extractions done this week:

| extraction                         | call-site `distinctVocabulary` | still reported? |
| ---------------------------------- | ------------------------------ | --------------- |
| `mermaid` class conditions (×4)    | 5–6                            | no              |
| `exports` default-export pair (×2) | 6                              | no              |
| `matchers` `call`/`newExpr`        | 13–14                          | **yes**, 92%    |
| `metrics` ceilings (×6)            | 13–15                          | **yes**, 100%   |

The floor is `minDistinctVocabulary: 8`. The first two fall under it and clear;
the last two do not.

## Root cause

`findSimilarPairs` compares normalized token streams and has no notion of a
call to a shared helper. After an extraction the bodies are

```
return <sharedHelper>(<arg>, { <key>: <value>, ... })
```

which normalizes to the same stream for every caller, with the arguments
landing in `variationBetween` as varying axes.

**Plan 0103's vocabulary floor already handles most of this**, and does so on a
principle rather than by accident: a body whose only content is configuration
carries few distinct identifiers, and "neither body has enough distinct
vocabulary for a match to be evidence of anything" is exactly the right reason
to reject it. That is why the mermaid and exports extractions cleared.

What it does not handle is a call site whose **arguments are themselves logic**:

```ts
// packages/ts/src/rules/metrics-function.ts — distinctVocabulary 13
return functionCeiling(threshold, {
  description: `have cyclomatic complexity <= ${String(threshold)}`,
  metric: 'complexity',
  measure: (fn) => cyclomaticComplexity(fn.getBody()),
  message: (name, cc) =>
    `${name} has cyclomatic complexity ${String(cc)} (max: ${String(threshold)})`,
})
```

Nine of its vocabulary items are shared (`functionCeiling`, `threshold`,
`description`, `String`, `metric`, `measure`, `fn`, `message`, `name`) — every
one of them a **parameter name of the shared helper**, identical across all six
callers by construction. Ten differ, and those ten are the real content. The
floor counts the helper's own API as evidence of duplication.

That is the defect, and it is narrow: **the shared vocabulary of a call to a
common helper is that helper's parameter names, which say nothing about whether
the callers duplicate each other.**

## What is NOT the defect

The first version of this record claimed the rule's remedy reproduces the rule,
and that the finding was therefore unactionable in principle. Measurement did
not support it:

- On `helpers/matchers.ts` the finding was **correct**. `call`, `access` and
  `newExpr` each passed a `Node.isCallExpression(node) ? … : undefined` guard as
  the `textOf` argument — restating the `kind` the same spec already declared.
  Narrowing with `node.asKind(spec.kind)` inside the helper removed the guard
  from every call site, and the cluster fell from three bodies at six varying
  axes to two at three. The detector was pointing at real remaining redundancy
  that the first extraction had missed.
- The `metrics` case genuinely has nothing left: `measure: (fn) =>
cyclomaticComplexity(fn.getBody())` against `linesOfCode(fn.getNode())` is two
  different measurements, and the message templates put the value on different
  sides of the noun, so no further parameterization is honest.

So the residue is one case, not a class, and the finding is a **prompt to look
again** that is right about as often as it is wrong.

## Break class

A fix must fail when:

1. Two bodies whose entire shared vocabulary is the parameter names of one
   common callee are reported as duplicates.
2. And it must still report `call` vs `access` **before** the `asKind` fix —
   i.e. a call site that duplicates logic in its arguments. Sabotaging the new
   guard must red a fixture built from that, not merely leave the count lower.

Both halves are needed, and (2) is what makes this hard: the honest signal is
_shared vocabulary minus the callee's parameter names_, not axis count. Raising
`minDistinctVocabulary`, lowering `similarity`, or filtering on axis count alone
would satisfy (1) by suppressing (2).

## Notes for whoever fixes this

- The callee identity is already in `Fingerprint.calls`.
- The measurable shape is: when both bodies are a single `return <callee>(…)`
  with the same `callee`, subtract that callee's parameter/property names from
  the shared vocabulary before applying the floor. On this repo that takes the
  metrics cluster from 9 shared to ~0 and drops it; it leaves the pre-fix
  `matchers` cluster reporting, because its shared vocabulary included
  `normalizeText` and `getText`, which are not parameter names.
- Consider whether the honest remedy is to fix the **message** rather than the
  detection: `extract the shared logic into one function` is wrong advice for a
  cluster of call sites. `these call one function already — check whether the
arguments still duplicate logic` is actionable and needs no new detection.
  That is cheaper and it is what a reader actually has to do.
- The count on this repo would move from 34 to about 32.

## Verification

- [ ] A red test: six bodies that differ only in the arguments they pass to one
      shared helper, sharing nothing but its parameter names, are not reported.
- [ ] A red test the fix must NOT turn green: two bodies that call the same
      helper but duplicate a guard in their arguments are still reported.
- [ ] `check:guardrails` on this repo drops the `functionCeiling` cluster and
      keeps the rest.
- [ ] Sabotage: deleting the new guard reds the first test.

## Correction

Filed 2026-09-02 claiming the rule's own remedy reproduces the rule, with
severity High and the conclusion that the remaining `no-copy-paste` findings
were largely unactionable. Rewritten the same day after measuring.

Two claims were wrong. The first — "the axis count is the signal the detector
already computes and does not use" — proposed a threshold on varying axes; the
`matchers` case has six axes and was a **true** finding, so that threshold would
have suppressed a real defect. The second — that following the remedy always
reproduces the finding — was falsified by two of the four extractions measured,
both of which cleared through the vocabulary floor that already exists.

The error was filing from two examples without checking why the others behaved
differently. The `distinctVocabulary` numbers in the table above took one
command to obtain and would have prevented the record being written at High.
