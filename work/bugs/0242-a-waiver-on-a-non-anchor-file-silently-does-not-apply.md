# Bug 0242: an exclusion comment placed on a file a finding merely concerns does not apply, and nothing says so

## Status

- **State:** Draft — found by review, verified against source; no red test yet.
- **Severity:** Low — **fails in the safe direction.** The finding keeps firing,
  so the build stays red and nothing is hidden. What the author loses is an
  hour: they wrote a waiver, it did nothing, and no mechanism told them. That is
  a wasted-effort defect, not a false green, and it is filed at Low for exactly
  that reason.
- **Origin:** self-found · enforcement review of the
  [0239](./fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  fix, 2026-09-03. Named there as the same "file-only filter" class and left
  unaddressed, so it is filed rather than noted in passing.
- **Reported:** 2026-09-03

## Symptom

A finding about a relationship — two duplicate bodies, a cluster of them — is
reported at one file and, since 0239, names the others in `relatedFiles`. Comment
suppression does not read that field. `isExcludedByComment`
(`packages/core/src/exclusion-comments.ts:481-492`) matches strictly:

```ts
comment.ruleId === ruleId && comment.file === violation.file && commentCoversViolation(...)
```

So a developer reading `b.ts`, who sees the duplicate reported there and writes
`// eess-exclude smells/duplicate-bodies: intentional, mirrors a.ts` above the
body in `b.ts`, gets nothing — if the finding is anchored at `a.ts`. Which file
is the anchor is source walk order, so whether their waiver works is decided by
how the filesystem enumerated a directory. That is the same arbitrariness 0239
removed from `--changed`, surviving in the suppression path.

## Why nothing catches it

`orphanExclusions` looks like the guard and is not.
`packages/ts/src/core/orphan-exclusions.ts:226` skips a comment as soon as its
rule id is declared anywhere in the run:

```ts
if (declared.has(comment.ruleId)) continue
```

The id **is** declared — the rule is running, that is why the finding exists —
so the comment is treated as live and never reported as orphaned. The check
answers "does this rule exist", not "did this comment suppress anything".

## Break class

A fix must fail when:

1. A duplicate finding anchored at `a.ts` is waived by a comment in `b.ts`,
   where `b.ts` is in `relatedFiles`, and the finding still fires.
2. And it must **not** fire when the comment names a rule that produced nothing
   — that is the stale-exclusion case `silent-exclusion.ts` already owns — nor
   turn an unrelated file's comment into a suppression for a finding that merely
   shares a rule id.

## Fix, and the decision it needs first

Two directions, and they are not equivalent:

- **Widen the match**: a comment on any file in `file` + `relatedFiles`
  suppresses. Simple, and it makes the waiver work where the author wrote it.
  The cost is real: a comment in one member's file now silences a finding about
  several, and the other members' authors have no local sign of it.
- **Report the near-miss**: keep the match as it is, and make a comment naming a
  live rule that matched no violation _in its own file_ a finding — the
  "you wrote a waiver that did nothing" disclosure. Strictly more honest and
  strictly more noise.

The second is more in keeping with ADR-009 rule 3's corollary, that a
suppression should cost something visible. The first is what a user expects.
**This wants a decision, not a patch**, which is why the record stops here.

## Verification

- [ ] Red test: a duplicate spanning two files, waived from the non-anchor file,
      is suppressed (or reported as a no-op waiver, per the decision).
- [ ] A waiver naming a rule that produced nothing is still the stale-exclusion
      case, not this one.
- [ ] Whichever direction lands, the behaviour no longer depends on which member
      the source walk reached first.

## Related

- [0239](./fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md)
  — the same class in the `--changed` filter, where the direction was fail-open
  and therefore High. This one is Low because it fails closed.
- [0233](./0233-an-exclusion-that-suppresses-every-violation-is-silent.md) — the
  other open record about exclusions disclosing what they did.
