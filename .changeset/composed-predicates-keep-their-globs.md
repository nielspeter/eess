---
'@nielspeter/eess': minor
---

**Fixed: `not()`, `and()` and `or()` were dropping the glob declarations of the
predicates they compose.**

The dead-glob diagnosis reads `Predicate.globs` to tell an author that a
selector like `resideInFolder('scr/**')` matched nothing. The kernel's
combinators built a new predicate without that field, so composing any
predicate with them made its declaration invisible — and a diagnosis that
reports nothing reads exactly like a healthy rule.

`eess-ts` had fixed this on its own copy of `combinators.ts`; the kernel never
adopted it. So `eess-md`, `eess-mermaid`, `eess-gherkin` and
`eess-crossvalidate` all lost the declaration on any composed selector, and a
mistyped glob under `or(...)` in a markdown rule was silently undiagnosable.
`negateGlobs` and `combineGlobs` were already the kernel's own, exported from
`/internal` for `eess-ts` to use — only these three call sites were missing.

The operator is the load-bearing part, not the presence of a field: a
conjunction selects nothing as soon as ONE input does (`all`), a disjunction
only when EVERY input does (`any`), and `not` inverts the operator as well as
each leaf's polarity — a negated site over-selects rather than going vacuous,
but a `not` nested inside the subtree flips it back.

Consequence for adopters: a composed selector whose glob is dead can now
produce a configuration finding where it previously produced silence. That is
the diagnosis working, not a new rule — but a rule file with a typo that was
quietly passing will now say so.
