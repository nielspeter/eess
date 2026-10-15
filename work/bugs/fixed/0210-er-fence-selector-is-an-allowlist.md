# Bug 0210: `md-mermaid-er`'s fence selector is an allowlist, so a themed ER diagram is dropped silently

## Status

- **State:** Fixed — 2026-10-15 by [plan 0214](../../plans/completed/0214-extract-the-diagram-kind-predicate.md),
  in the same PR that closes both: `md-mermaid-er` now tests the declared kind (`diagramKind()`,
  moved into eess-mermaid) instead of the raw fence body. Filed because "needs its own record" with
  no record is how a measured finding evaporates.
- **Found:** 2026-08-22, six-persona review of
  [bug 0209](./0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)'s fix.

## Symptom

`tableErAgree()` selects fences with

```ts
const ER_HEADER = /^\s*erDiagram\b/
```

anchored at the start of the fence body. Mermaid's grammar treats `%%` lines as
hidden terminals and permits a `---` frontmatter block, so an ER diagram opening
with a theme directive —

````
```mermaid
%%{init: {'theme':'neutral'}}%%
erDiagram
USER { uuid id PK }
```
````

— parses fine and is **silently not selected**. No violation, no warning, and
`tableErStats` agrees there was nothing to compare.

## Root cause

An allowlist selector is fail-open: it drops whatever it fails to recognise. _(Narrowed by plan 0214,
which fixed this: the defect was that the allowlist was anchored to the raw fence body, not to the
declared kind. The allowlist itself stays; plan 0214 explains why a denylist would be unsound
here.)_
This is the identical defect [bug 0209](./0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md)
found and fixed in the sibling binding, which now selects by **excluding** the
kinds known to be something else, so an unrecognised header still reaches the
parser and produces an attributed finding rather than vanishing.

0209's own record names this hole and scopes it out, deliberately: fixing two
bindings inside one bug fix would have made that change unreviewable. This record
is the home it was deferred to.

## Fix

Test the **declared kind** rather than the raw fence body — `ER_HEADER` against
`diagramKind(b.value)`, allowlist intact. Measured: that selects a themed and a
frontmatter'd `erDiagram` while still rejecting foreign and untagged fences.

**Deliberately not a denylist.** A fail-closed flip was proposed and falsified: it would
route unknown kinds into _both_ parsers (two contradictory findings for one fence), and this
binding accepts `lang === null`, so exclusion would send every untagged fence — 789 in this
corpus — at `parseErDiagram`. The allowlist/denylist asymmetry from
[bug 0209](./0209-md-mermaid-crashes-on-a-non-classdiagram-fence.md) does not transfer,
because this selector asks a positive one-token question ("is this an `erDiagram`?") where
its sibling asks a negative open-ended one. See
[plan 0214](../../plans/completed/0214-extract-the-diagram-kind-predicate.md), "Why this does not make
`md-mermaid-er` fail-closed".

**Owner: [plan 0214](../../plans/completed/0214-extract-the-diagram-kind-predicate.md)** ships this fix and
carries the verification boxes below; this record closes `done-otherwise → 0214`.

## Verification

- [x] Red first: a themed `erDiagram` fixture was not selected
      (`packages/crossvalidate/tests/md-mermaid-er.test.ts`, red before plan 0214's change).
- [x] After the fix it is selected and compared, and `tableErStats` counts it.
- [x] A `---` frontmatter'd ER diagram likewise. done-otherwise: it is now selected, so it is no
      longer skipped in silence, but eess-mermaid's ER parser rejects the frontmatter, so it is
      reported as not parsing instead of being compared. That gap, and the message blaming the
      author for it, are recorded in [bug 0409](../0409-md-mermaid-blames-the-author-for-a-grammar-gap.md).
- [x] A non-ER fence is still skipped, and the document is not skipped with it.
- [x] The selector has a break class in `scripts/nonvacuity/`: `bad-md-mermaid-er.mjs`, registered as
      `crossval/md-mermaid-er`. It reports with the fix and goes vacuous (exit 0) with the raw-body
      selector restored.

Deferred: none

## Out of scope

- **Any kind registry or lockstep gate.** Proposal 006's open question 4 owns that, and
  [plan 0214](../../plans/completed/0214-extract-the-diagram-kind-predicate.md) records four falsified
  attempts as the floor for a fifth. Moving `declaredKind()` into `eess-mermaid` — which
  0214 does — is placement, not a registry.
