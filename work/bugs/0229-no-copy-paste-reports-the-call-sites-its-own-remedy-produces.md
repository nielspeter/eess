# Bug 0229: `no-copy-paste` reports the call sites its own remedy produces

## Status

- **State:** Draft — measured on this repo across a full extraction pass; no fix
  attempted.
- **Severity:** High — the remedy the finding prints (`extract the shared logic
into one function`) creates a new finding of the same rule. An agent following
  the tool's own instruction cannot reach a fixed point, and the natural
  conclusion — "the guidance is wrong" — is the one that gets the detector
  switched off. That is the failure mode
  [0228](./0228-ignoretests-does-not-match-tsx-so-react-tests-are-never-ignored.md) records for a different
  cause.
- **Origin:** self-found · dogfooding `agentGuardrails` over this repo
  (`check:guardrails`) and working the findings down from 84 to 38.
- **Reported:** 2026-09-02

## Symptom

Extract the shared body of a cluster into one function, exactly as the `Fix:`
line says, and the rule reports the **call sites** instead.

Measured, in this repo, on two clusters extracted this week.

`rules/metrics-function.ts` and `rules/metrics.ts` carried six copies of the
same walk. They now share `functionCeiling` / `memberCeiling`, and each public
condition is only its own configuration:

```ts
// packages/ts/src/rules/metrics-function.ts:78
export function maxFunctionComplexity(threshold: number): Condition<ArchFunction> {
  return functionCeiling(threshold, {
    description: `have cyclomatic complexity <= ${String(threshold)}`,
    metric: 'complexity',
    measure: (fn) => cyclomaticComplexity(fn.getBody()),
    message: (name, cc) =>
      `${name} has cyclomatic complexity ${String(cc)} (max: ${String(threshold)})`,
  })
}
```

Six of those, and the rule still reports them:

```
maxFunctionComplexity (packages/ts/src/rules/metrics-function.ts:78) is up to
100% similar to 5 other bodies: maxFunctionLines, maxFunctionParameters,
maxCyclomaticComplexity, +2 more — 5 varying axes: cc -> loc,
'complexity' -> 'code-lines', cyclomaticComplexity -> linesOfCode, +2 more
  Fix: extract the shared logic into one function
```

There is no shared logic left. It was extracted; that is what `functionCeiling`
is. What the six bodies now have in common is **the call**, and the five varying
axes the finding itself prints are the arguments — the differing data the
extraction was supposed to isolate.

`helpers/matchers.ts` reproduces it independently: `call`, `access` and `newExpr`
were folded onto `textMatcher` and are now reported at 94% with **six** varying
axes, every one an argument.

## Root cause

`findSimilarPairs` compares normalized token streams and has no notion of a
**call to a shared helper**. After an extraction, the remaining bodies are

```
return <sharedHelper>(<arg>, { <k>: <v>, <k>: <v>, ... })
```

which normalizes to the same stream for every caller, with the arguments landing
in `variationBetween` as varying axes. The more faithfully the extraction
isolates the differences, the more the call sites look alike — so **the rule's
score rises as the duplication is actually removed.**

The axis count is the signal the detector already computes and does not use.
A cluster reported at 100% with **one** varying axis is copy-paste. The same
cluster at 100% with **five or six** axes, where every axis is an argument to a
shared callee, is a call table. The report prints both identically.

This is distinct from the containment guard
([0169](./0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md)'s
`containsOther`): those pairs were unactionable because one body held the other.
These are unactionable because the action was already taken.

## Break class

A fix must fail when:

1. Two bodies that call the **same** helper differing only in their arguments are
   reported as duplicates.
2. And it must still report a genuine cluster — two bodies that share a walk and
   call no common helper — otherwise the fix is a blanket suppression, which is
   the fail-open this rule exists to prevent. Sabotaging the new guard must red
   a fixture built from real copy-paste, not merely leave the count lower.

Both halves are needed. Raising `minDistinctVocabulary`, lowering `similarity`,
or filtering on axis count alone would satisfy (1) by suppressing (2).

## Notes for whoever fixes this

- `variationBetween` already produces the axes; the callee identity is available
  from the token stream 0169 taught `computeSimilarity` to read.
- The honest shape is probably _"bodies whose only non-argument content is one
  call to the same function are not a cluster"_, which is narrow enough to state
  as a break class and does not need a threshold.
- Check whether the guard belongs beside `containsOther` in
  `packages/ts/src/smells/similar-pairs.ts`, which is where the other
  "unactionable in principle" rejection lives.
- The count on this repo would move from 38 to roughly 36 — small here, but the
  shape scales with how much extraction a codebase has already done, so a
  well-factored consumer sees proportionally more of it.

## Verification

- [ ] A red test: two functions differing only in the arguments they pass to one
      shared helper are not reported.
- [ ] A red test the fix must NOT turn green: two functions that share a body and
      call no common helper are still reported.
- [ ] `check:guardrails` on this repo drops the `functionCeiling` and
      `textMatcher` call-site clusters and keeps the rest.
- [ ] Sabotage: deleting the new guard reds the first test.
