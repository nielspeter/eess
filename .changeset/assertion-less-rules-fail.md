---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': patch
'@nielspeter/eess-md': patch
'@nielspeter/eess-mermaid': patch
'@nielspeter/eess-gherkin': patch
'@nielspeter/eess-crossvalidate': patch
---

A rule that selects subjects and asserts nothing about them now fails — bug 0155.

**Breaking (0.x — minor signals it, not a 1.0 stability claim):** a rule
written as `.that().<predicate>.should()` with no condition after it used to
pass in **total silence**. It now produces an unsuppressable configuration
finding, so a build that was green on such a rule will go red on upgrade with
no code change of its own.

That is the fix working. Such a rule cannot fail, so it certifies nothing while
reading as coverage — the false-green class ADR-009 and ADR-010 exist to make
unrepresentable.

- **The guard was unreachable, not merely quiet.** It tested
  `_conditions.length === 0 && _phase === 'predicate'`, and `should()` sets the
  phase to `'condition'` — so for every rule shape the DSL documents it could
  never fire. Even the stderr warning it was routed to never appeared. The
  `_phase` term is gone.
- **A finding, not a warning**, per ADR-009 rule 1's discriminator: the remedy
  is not optional. There is no state in which "keeps asserting nothing" is
  correct — add a condition, or delete the rule. (`no-silent-catch` and
  `no-empty-bodies` stay `warn` precisely because they carry suppressible false
  positives a reader must judge one by one. This carries none.)
- **`bypassFilters`**: `error` regardless of `.asSeverity('warn')`, refused by
  `.excluding()`, skipped by diff and baseline. It reports that the rule's own
  instrument is broken, not a fault in what was examined.
- **A dead selector still reports as a dead selector.** This finding fires only
  when subjects were actually selected; a rule with a dead glob and no
  condition reports the dead glob, the more useful root cause.
- **Every builder gives the same answer.** `slices()`, `schema()`,
  `schemaFromSDL()` and `resolvers()` carried the identical branch as a stderr
  warning and now fail too, each with its own remedy. Fixing only the kernel
  would have left one DSL with four different answers to the same mistake.

**Every dialect is named deliberately.** The behaviour change is in the kernel,
but an adopter installs `eess-ts` (or `-md`, `-mermaid`, …) and reads _that_
package's changelog. Declaring only the kernel would route this text to a
package they may not know exists, while their own changelog said "Updated
dependencies" — the standalone-sufficiency failure `check:family` exists to
prevent, in documentation rather than code.

**Migration:** each finding names the rule and both remedies. Add the condition
you meant to assert, or delete the rule. If a rule was deliberately held as a
reusable _selection_, keep holding it — the finding fires only when a rule is
actually executed, not when a selection is derived from.

Measured before landing: **zero** assertion-less rules across this repo's own
five gate files, and one affected test — a kernel contract test that was green
for the wrong reason and is rewritten here to prove its contract directly.
