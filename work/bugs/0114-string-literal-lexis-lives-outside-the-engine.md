# Bug 0114: the bridge package owns TypeScript's string-literal grammar — `ArchCall` hands out raw text and has no accessor for a literal argument

## Status

- **State:** Draft — a design finding against ADR-007's Rule 2, raised as the
  design review that row calls for. No red test; the remedy is an API addition.
- **Severity:** Medium — a missing capability plus a boundary leak. Nothing is
  wrong today; the shape is.
- **Origin:** self-found · architect review of [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md)'s
  fix
- **Reported:** 2026-08-12

## Symptom

`packages/crossvalidate/src/it-title.ts` parses TypeScript string literals with a
regex — delimiters, escapes, and all — in the **bridge** package. Its input is
the enriched call name from `calls(project)` → `getName({ withArgument: 0 })`,
i.e. AST text handed back out of the engine and re-lexed textually.

eess-ts already owns the capability, correctly, one file away:

```ts
// packages/ts/src/predicates/call.ts:112-113
if (!Node.isStringLiteral(arg)) return false
return isMatch(arg.getLiteralValue())
```

It is exposed only as a **glob filter** (`withStringArg`), never as an
**accessor**, so a consumer that wants the value has no route but text.
`fromCallExpression` (`packages/ts/src/models/arch-call.ts`) extracts the
argument node with proper ts-morph guards and then returns `arg.getText()` glued
into a display string.

## Root cause

`ArchCall`'s public surface — `getName`, `getObjectName`, `getMethodName`,
`getArguments`, `getNode`, `getSourceFile`, `getStartLineNumber` — has no "give
me argument N as a string literal". `getName({ withArgument })` was built for
_display_ (it elides at 80 chars, `arch-call.ts`), and callers repurposed it as
a data channel because nothing else was offered.

This is not an ADR-007 Rule 1 violation — no `ts-morph` import crosses into
crossvalidate. It is Rule 2: the boundary leaks the engine's shape _textually_,
and the knowledge that leaks (how TypeScript delimits and escapes a string) is
the AST engine's by construction. ADR-007's Rule 2 row is `manual` / tier 4,
"design review against this ADR's Rule 2" — this record is that review.

## Why it matters

0104 was a defect in exactly this re-lexing, and it shipped in two packages
because the capability had no home. A third copy lives in `eess-md`
([0111](./0111-md-adr-citations-resolve-by-prefix.md)). Every consumer that needs
a literal argument writes the grammar again, and gets it wrong the same way.

There is also a live inconsistency to settle: `withStringArg` matches on
`getLiteralValue()` — the **evaluated** string — while 0104's fix keys on **raw
source text**, so `it('it\'s fine')` is `it's fine` to one and `it\'s fine` to the
other. Two answers to "what is the string argument of this call" inside one
family, neither aware of the other.

## Fix

Add a first-class accessor to `ArchCall` — e.g. `getStringArgument(index)` —
implemented behind the existing ts-morph guards, and move the bridge onto it.

The raw-vs-evaluated question must be decided **as part of this**, not
discovered afterwards:

- **Evaluated** is what a reader expects and what `withStringArg` already does.
- **Raw** is what an ADR author can see and copy, and what the markdown side of a
  citation can be compared against without an evaluator. 0104 chose raw for that
  reason and documented it.

Both may be needed (`getStringArgument` vs `getStringArgumentText`). Whichever is
chosen, "the family compares call arguments as \<X\>" becomes a binding decision
and belongs in an ADR clause, not a module header.

`minor` on `@nielspeter/eess-ts`; `patch` on `@nielspeter/eess-crossvalidate`
once it stops parsing.

## Verification

- [ ] Red test written first: a template-literal, a double-quoted and an escaped
      title all read through the accessor without the caller touching text.
- [ ] `it-title.ts`'s anchored readers are gone; only the prose scanner remains
      (a Mechanism cell is not source, so it keeps its own grammar).
- [ ] The raw-vs-evaluated decision is recorded in an ADR clause with an
      Enforcement row.
- [ ] `npm run validate` green.

Deferred: none — but this record is a prerequisite for retiring the duplicate in
[0111](./0111-md-adr-citations-resolve-by-prefix.md), and should be sequenced
before it.
