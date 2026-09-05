# Bug 0258: the "declares no id" diagnostic cannot tell two rules apart

## Status

- **State:** Draft — measured, not built.
- **Severity:** Low — nothing is wrong, and the advice is correct. It is filed
  because the diagnostic's whole purpose is to end a silence, and in the shape it
  most often appears it substitutes a different confusion for it.
- **Origin:** self-found · adopter and product review of
  [0255](./fixed/0255-an-exclusion-comment-that-cannot-apply-is-inert.md), which
  built the diagnostic. Both lenses hit it independently, from an installed
  package rather than from the source.
- **Reported:** 2026-09-05

## Symptom

A rule with no `.rule({ id })` cannot honour an exclusion comment, and eess now
says so. The message names the file and the directive's line — but **nothing
about the rule it is speaking for**, because an id-less rule has no id to name.

So several id-less chains over the same file produce byte-identical lines.
**Measured 2026-09-05**, three chains against one file with one directive:

```
3 × [eess] This rule declares no id, so no exclusion comment can apply to it —
    a comment matches a violation by rule id. <file> has a directive at line 1.
    If one was meant for this rule, give the rule an id with
    .rule({ id: '<your-id>' }); directives naming other rules are not this
    rule's to honour.
```

Three lines, one problem to a reader, and no way to tell which of the three
chains is the one they care about without re-reading the rule file and counting.

This is the early-adopter shape exactly: a `arch.rules.ts` with several chains
that have not been given ids yet is the situation the diagnostic exists for.

## Why it is Low, and why it is still worth filing

The advice is correct and each line is true. Nobody is misled, and the remedy
(give the rule an id) is the same for all three.

It is filed because the diagnostic replaced a silence with a repetition, and a
repetition that carries no discriminator is a weaker fix than it looks. The
message is right; the _identity_ is missing.

## Fix (not built)

**`.because()` is available on an id-less rule** — the kernel's own comment in
`packages/core/src/execute-rule.ts` says so, and the reason is stamped onto
violations before the exclusion scan runs. So a chain that has a reason can be
named by it:

> `This rule ("no eval in handlers") declares no id, so no exclusion comment can
apply to it…`

That gives the reader a discriminator without inventing one, and it costs
nothing when absent. A chain with neither an id nor a reason is genuinely
anonymous and the message stays as it is.

Deduplication is the other half and is separable: identical lines could collapse
per `(file, line)` within one process. `writeStderr` has no cache today
(deliberately — it is a bare guarded write), so that is a real decision rather
than a tweak, and it belongs with whoever takes this.

**Both copies.** `applyFilters` exists twice
([plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)), and
`engine/applyfilters-parity` will fail the build if only one changes — which is
what that gate is for.

## Verification

- [ ] Two id-less chains with different `.because()` reasons over one file
      produce two distinguishable lines.
- [ ] A chain with neither id nor reason still gets the current message, and it
      is asserted rather than assumed.
- [ ] Both copies change together — `engine/applyfilters-parity` stays green,
      which is the evidence, not a separate claim.
- [ ] Asserted on the emitted string, not on a paraphrase of it. Four assertions
      on 0255's branch were written against text the implementation never
      printed; that record has the tally.

## Related

- [0255](./fixed/0255-an-exclusion-comment-that-cannot-apply-is-inert.md) — built
  the diagnostic this narrows.
- [0188](../plans/0188-unify-the-duplicated-engine-modules.md) — why any fix here
  is two edits, and what will catch it if it is only one.
