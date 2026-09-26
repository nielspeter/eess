# Bug 0342: the release gate abstains on the peer edge, and cites a closed record as the open decision

## Status

- **State:** Draft — measured on PR #150, which is the live instance.
- **Severity:** Low — **no false green in the gate's own terms, and a misleading receipt.**
  `check:release` deliberately weighs only regular `dependencies` when deciding who must be named in
  a breaking changeset. It then prints `no declared break has a workspace dependent — rule weighed 0
edges` for a repository in which a workspace package peer-depends on the broken one. The line is
  true about the rule and reads as true about the repository.
- **Origin:** the method review of PR #150, 2026-09-26 (Minor 10).
- **Reported:** 2026-09-26

## Symptom

Measured on PR #150, which ships a **breaking** `@nielspeter/eess-ts` at `minor`:

```
dependents  no declared break has a workspace dependent — rule weighed 0 edges
```

`packages/crossvalidate/package.json:70` peer-depends on `@nielspeter/eess-ts` at `>=0.7.0`, which the
new version satisfies. So a workspace dependent exists, inherits the break's blast radius through a
range its own consumers resolve, and is not named in the changeset — the shape
[0185](./fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md) is about, one edge kind
over.

**The abstention is deliberate and argued** (`scripts/check-release.mjs:332-348`), and the argument is
good: a peer is a range the consumer resolves, so the dependent does not decide what its users get.
Two things are wrong around it, not in it.

1. **The receipt overstates the abstention.** "no declared break has a workspace dependent" is a claim
   about the repository; what the rule established is "no dependent **via `dependencies`**". A reader
   checking whether this PR needed to name `eess-crossvalidate` gets "there is nobody" when the answer
   is "there is somebody and this rule does not weigh them".
2. **The open decision lives in a closed record.** The comment ends "Widening to peers is an OPEN
   decision (bug 0185), not a closed one" — and 0185 is `State: Fixed`, in `work/bugs/fixed/`, which
   `scripts/check-corpus.mjs:159` freezes. The decision it defers to therefore has no live home, which
   is [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md)'s pathology in the release
   lane.

A third, smaller: the same comment states `eess-crossvalidate` peers at `>=0.1.1`. It peers at
`>=0.7.0` — the floor was raised by the 0.7.0 release and the comment's parenthetical did not move.

## Root cause

The rule was scoped to `dependencies` for a reason that is still sound, and the scoping was recorded in
a code comment pointing at a bug record that was later closed. Nothing re-reads a frozen record, so the
deferral quietly became a dead end, and the summary line was written for the rule rather than for the
reader.

## Fix

Not decided; three separable pieces, in increasing size.

- **The receipt** — say what was weighed: `no workspace dependent via dependencies (peer edges are not
weighed — bug 0342)`. Cheapest, and it removes the misreading on its own.
- **The stale `>=0.1.1`** — one word.
- **The decision** — whether a breaking changeset must name a workspace **peer** dependent. This is the
  piece that needs a home that is not a frozen record; see
  [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md).

## Related

- [0185](./fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md) — the rule this abstains
  beside, and the record the comment defers to.
- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — an open decision whose only
  home is frozen.

## Verification

- [x] measured on PR #150: the printed line, the peer range at `packages/crossvalidate/package.json:70`,
      0185's `State: Fixed`, and `FROZEN` in `scripts/check-corpus.mjs`.
- [ ] the receipt reworded, with a test that reds on the old wording
- [ ] a ruling on whether the peer edge is weighed
- [ ] a changeset, or an explicit `none`
- [ ] `npm run validate` green.

Deferred: none.
