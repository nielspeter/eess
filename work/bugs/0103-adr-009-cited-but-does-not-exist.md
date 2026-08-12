# Bug 0103: `ADR-009` is cited as an existing decision in two shipped scripts — the ADR does not exist

## Status

- **State:** Draft — confirmed against the source and against `adr/`; no red
  test written yet.
- **Severity:** Low
- **Origin:** self-found · review of the inbound
  [proposal 002](../proposals/002-comment-embedded-links.md), while measuring
  how many doc citations in this repo's source comments resolve
- **Reported:** 2026-08-12

## Symptom

Two scripts cite `ADR-009` as settled doctrine:

```
scripts/check-review-harness.mjs:23
 * emptied/violating state — a green that cannot fail is a lie (ADR-009).

scripts/nonvacuity/bad-review-harness.mjs:8
 * FAILS on a drifting state (ADR-009: a green that cannot fail is a lie).
```

`adr/` contains `001`–`008`. There is no `adr/009-*.md`. A reader following
either citation — human or agent — finds nothing, and the parenthetical reads
as an authority that does not exist.

## Reproduction

```bash
ls adr/                                    # 001 … 008, no 009
rg -n "ADR-009" scripts/                   # two citations
```

## Root cause

`ADR-009` is a **forward reference**. Plan
[0088](../plans/0088-fold-ts-archunit-into-eess.md) Phase 2 is what creates it —
it ports ts-archunit's ADR-008 ("Agent-First Failure Surfaces") to this repo as
`adr/009-agent-first-failure-surfaces.md`. The doctrine the two scripts invoke
is real and is the one 0088 will write down; the citation was simply written
before the document.

Both citations shipped in `c9edf6d` (PR #34, the review-harness adoption),
merged 2026-08-12 under a full green `npm run validate`.

Nothing caught it, and nothing could have. `check:corpus` validates cross-links
and `path:line` pointers in `work/`, `adr/` and `docs/`
(`scripts/check-corpus.mjs:22`) — it reads markdown, not source comments, and
`ADR-009` is a bare identifier rather than a link or a pointer. This is the
uncovered reference shape that proposal 002 is about, demonstrated on this
repo's own tree.

## Fix

Two options; the second is preferred because it keeps the claim honest **now**
rather than deferring honesty to 0088's merge.

1. **Cite the plan instead of the unwritten ADR** — `(plan 0088 Phase 2)` in
   both comments, since that is where the doctrine currently lives in this repo.
2. **Mark the reference as forward-looking** — e.g. `(ADR-009, pending —
plan 0088 Phase 2)`, so a reader knows the target does not exist yet.

Either way the two comments must stop asserting an ADR number that `adr/`
does not contain. Plan 0088 owns flipping them to a plain `ADR-009` citation
when it writes the file; that hand-off is recorded here, not in 0088, because
this bug closes with its own PR.

No changeset — comments only, no package surface and no runtime effect.

## Verification

- [ ] Red test written first: a check that every `ADR-NNN` cited in
      `scripts/**` and `packages/*/src/**` names a file present in `adr/`. It
      fails today on these two lines and passes after the fix. (Natural home:
      `scripts/check-workspace-integrity.mjs`, which already walks the
      workspace reading files — see
      [0092](./0092-integrity-gate-misses-three-packages.md) and
      [0099](./0099-nul-bytes-make-md-gherkin-unsearchable.md), which edit the
      same script.)
- [ ] `rg -n "ADR-009" scripts/` shows no bare assertion of a non-existent ADR.
- [ ] `npm run validate` green.

Deferred:

- **The general case — bare identifier citations (`plan NNNN`, `ADR-NNN`,
  `proposal NNN`) in source comments are unchecked repo-wide.** The same spike
  that found this bug counted 130 such citations with 51 unresolved; 49 of those
  are ts-archunit ancestor numbers awaiting
  [0090](../plans/0090-adopt-ts-archunit-work-corpus.md), not rot. The red test
  above deliberately covers only `ADR-NNN`, which is fully resolvable today, so
  this bug closes in one PR. The general capability is re-homed to proposal
  [002](../proposals/002-comment-embedded-links.md), deferred behind 0090.
