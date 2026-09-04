# Bug 0252: the exported working method names "the reviewer" and ships no reviewer

## Status

- **State:** Draft — measured, not fixed. The fix is a kit-surface decision, not a
  defect to patch, and it wants its own review.
- **Severity:** Low — nothing in this repo is wrong. What is wrong is what
  `kit/` promises an adopter: a method whose stated division of labour has a
  participant the package does not contain.
- **Origin:** self-found · architecture review of
  [0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md), which
  asked whether the new persona belonged in the kit and found the question had
  never been put.
- **Reported:** 2026-09-04

## Symptom

`kit/` ships this repo's working method to other projects: seven authoring
skills, templates, the number allocator, `bootstrap.mjs`. It ships **zero**
reviewer personas and no `/review` skill.

That would be unremarkable if the exported method did not depend on one. It does,
in the sentence that defines the split between gate and human:

> `kit/README.md` — "Necessary-not-sufficient: the reviewer enforces whether a
> disposition is _truthful_; the gate catches the _silent_ case."

> `kit/templates/work/README.md` — "the `check:ledger` gate catches the _silent_
> case; the reviewer enforces the rest."

The same doctrine sits in `docs/working-method.md`. **"The reviewer" is precisely
the working-method lens** — closability, ledger honesty, whether a disposition is
truthful rather than merely present. In this repo that noun now has a file
(`.claude/agents/reviewer-method.md`, bug 0250). In the kit it stays undefined,
so an adopter is told a mechanism is necessary-but-not-sufficient and is handed
only the mechanism.

## Why this persona in particular

Of the seven, six are eess-specific by construction: kernel-vs-dialect placement,
six packages, ts-morph, changesets, the manifesto tier model, `eess-ts init`. They
would mean nothing in a bootstrapped project.

`reviewer-method` is the exception. Its vocabulary — `State:` tokens,
`deferred→<home>`, freeze discipline, closability, "was that number measured or
asserted" — **is the kit's vocabulary**, because both were written from the same
working method. Architecture review measured it at roughly 90% project-neutral
once its eess-specific bullet is narrowed (done in 0250).

So the asymmetry is not "the kit omits the review harness". It is that the kit
omits the one piece of the review harness that is portable, while quoting its job.

## Why it reads unexamined rather than decided

`docs/working-method.md` splits the method into "skills (the guidelines half)"
and "the harness (the mechanical gates)". Reviewer personas are a third thing that
taxonomy has no slot for, so nothing ever forced the question. `kit/README.md`'s
"What's in it" table does not declare the review harness out of scope — it simply
does not mention it.

## Fix (not built)

Three defensible outcomes, and the point of this record is that one should be
chosen rather than inherited:

1. **Ship `reviewer-method` in the kit**, with a minimal `/review` skill or
   instructions for wiring it into whatever harness the adopter has. Highest
   fidelity, largest surface.
2. **Ship the persona's brief as guidance, not as an agent** — a section in the
   kit's own README naming what a method reviewer looks for. Portable without
   assuming the adopter runs subagents at all.
3. **Declare the review harness out of scope**, and change the two sentences so
   the exported method does not name an actor it does not provide.

Option 3 is the cheapest and may be right; it is still a decision, and the
sentences must change either way.

## Verification

- [ ] Whichever outcome: `kit/README.md`'s "What's in it" says what the kit does
      and does not carry about review.
- [ ] No sentence in `kit/` names an actor the kit does not ship or define.
- [ ] If a persona ships, `bootstrap.mjs` places it and the kit's own docs say
      where.

## Related

- [0250](./fixed/0250-the-review-roster-has-no-working-method-lens.md) — added the
  persona to this repo; its review is where this question surfaced.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) —
  the other place the kit's copy of a method document is wrong, and a reminder
  that `kit/` drifts from the repo it was extracted from without anything
  noticing.
