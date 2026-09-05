# Bug 0258: the "declares no id" diagnostic cannot tell two rules apart

## Status

- **State:** Fixed — the reason names the rule when there is one; a rule with
  neither id nor reason is genuinely anonymous and says so plainly.
- **Severity:** Low — nothing is wrong, and the advice is correct. It is filed
  because the diagnostic's whole purpose is to end a silence, and in the shape it
  most often appears it substitutes a different confusion for it.
- **Origin:** self-found · adopter and product review of
  [0255](./0255-an-exclusion-comment-that-cannot-apply-is-inert.md), which
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

## Fix

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
than a tweak. **Not taken here, and it is now a smaller problem than it was:**
the lines that used to be identical are distinguishable, so what remains is
repetition an author can read rather than repetition they cannot tell apart.
Whoever wants a cache should want it for its own reasons.

**The first fix took `.because()` alone, on a premise review measured false.**
That paragraph said: _"`.because()` is the only discriminator `applyFilters` can
reach — `ExecuteRuleContext` carries no rule description, and threading one
through would mean a new field in both copies and every dialect's builder, wider
than this earns."_

Wrong on both halves, and the evidence was three files away:

- **Every builder already implements `describeRule()`** (`rule-description.ts`
  defines it as the one owner of a rule's self-description), and `filterContext()`
  — the method that builds `ExecuteRuleContext` — is on the same class. So it is
  `this.describeRule().rule`, not a new field in any dialect's builder. `eess-md`,
  `-mermaid` and `-gherkin` inherit it and needed no plumbing at all.
- **The kernel already names an id-less rule this way**, a couple of hundred lines
  above the change, for its assertion-less finding:
  `this._metadata?.id ?? (this.buildRuleDescription() || 'unnamed')`.

And it mattered, not just as a wrong reason for a right answer. `.because()` is
optional prose, and the chains this diagnostic targets — early-adopter rules
nobody has given an id yet — often have neither an id nor a reason. Measured on a
real id-less chain, `describeRule().rule` is
`"that are live (not in a frozen folder) should resolve to a real file and line"`
— a discriminator that is always there and needs no author action. The first fix
was a weaker floor for the same two-file cost.

So the rule's own sentence is the name, and `.because()` is the fallback when a
builder's own `describeRule()` returns `'unnamed'` — naming a rule "unnamed"
tells a reader nothing, so it counts as absent.

**Both copies.** `applyFilters` exists twice
([plan 0188](../../plans/0188-unify-the-duplicated-engine-modules.md)), and
`engine/applyfilters-parity` will fail the build if only one changes — which is
what that gate is for.

## Verification

- [x] Two id-less chains over one file produce two distinguishable lines —
      asserted by comparing the two outputs to each other, not just by matching
      each one. **Distinguishable without the author having done anything**: the
      rule's own sentence names it, and `.because()` only takes over when a
      builder reports `'unnamed'`.
- [x] A chain with nothing to name it by gets the message unchanged, asserted
      including the absence of an empty `("")` parenthetical. Without that, a
      change that always emitted one would satisfy the tests above. That case is
      now rarer than the first fix assumed — it needs a builder whose own
      `describeRule()` says `'unnamed'` AND no reason.
- [x] `'unnamed'` is treated as absent, asserted on the **parenthetical** rather
      than the whole line: the fixture's own filename contains that word, and a
      bare `/unnamed/` failed for the wrong reason. Over-broad in the opposite
      direction from the four vacuous regexes 0255's record tallies, and the same
      lesson.
- [x] A reason that wraps stays on one line. `.because()` takes prose, and this
      report is one line per file; whitespace is collapsed rather than trusted.
- [x] **Both copies changed together, and the gate proves it rather than the
      record claiming it.** `engine/applyfilters-parity` gained two scenarios for
      the new branch — a fixed scenario list is the whole of what parity
      compares, so a new branch without one is untested by it — **11 scenarios
      now**, three of them for the description branch. **Measured twice:**
      landing either round in the kernel alone makes the copies diverge and reds
      the gate, printing both versions of the line. That is the mechanism built in
      0255's third round doing its job on the next bug.
- [x] Every assertion is against the string the implementation emits, checked by
      running it. Four assertions on 0255's branch were written against text that
      was never printed; that record keeps the tally.

Deferred: none.

## Related

- [0255](./0255-an-exclusion-comment-that-cannot-apply-is-inert.md) — built
  the diagnostic this narrows.
- [0188](../../plans/0188-unify-the-duplicated-engine-modules.md) — why any fix here
  is two edits, and what will catch it if it is only one.
