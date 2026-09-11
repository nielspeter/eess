# Bug 0280: a doc cannot show a consumer-relative import

## Status

- **State:** Draft — found by the gate, in the changeset for the fix it documents.
- **Severity:** Low-to-medium — it blocks documenting a capability rather than
  hiding a false green, but it blocks it in the one document type that exists to
  tell adopters how to change their code.
- **Origin:** self-found · writing the changeset for
  [bug 0223](./fixed/0223-type-module-rule-files-cannot-import-a-sibling.md).

## Symptom

`check:docs-code` compiles every import-bearing `ts` fence in `docs/`, the package
READMEs, the migration pages and `.changeset/`. A **relative** specifier in such a
fence can never compile, because it names a file in the reader's tree:

```
.changeset/a-rule-file-may-import-a-sibling.md (fence 1) — tsc
  error TS2307: Cannot find module './sibling.js' or its corresponding type declarations.
```

So a fence may show `import { classes } from '@nielspeter/eess-ts'` and may not
show `import { p } from './sibling.js'` beside it — even though the second line
is the entire subject of that release.

## Measured

One relative import exists across all four checked populations: the one that
produced this bug. There is no precedent because the gate has never permitted
one.

## Why the obvious fixes are wrong

**The skip directive.** `<!-- eess-docs-code-skip -->` exists, and both of its
uses name a reason this is not: a pre-migration "before" example, and a
deliberately-deprecated API. `RELEASING.md` says outright that the directive is
"for a pre-migration 'before' example only, never for the migration itself".
Widening it to mean "and also anything that does not compile" would dissolve the
only category the gate has.

**An untagged fence.** Dropping the `ts` info string hides the fence from the
compiler, and `check:docs-code` already counts untagged fences carrying imports
precisely because that is the dodge (bug 0273's own residual).

**Prose.** What the 0223 changeset does today, and what
[bug 0275](./0275-a-migration-can-still-state-its-claim-in-prose.md) is filed
about: a claim in prose is the form nothing checks.

## The distinction the gate does not draw

An import statement in a fence is one of two different things:

| specifier               | claims                                  | this repo can check it |
| ----------------------- | --------------------------------------- | ---------------------- |
| `'@nielspeter/eess-ts'` | this symbol is exported by that package | yes                    |
| `'./sibling.js'`        | the reader has a file beside this one   | no                     |

The gate treats both as the first kind. The honest answer is probably to compile
the package-facing statements and syntax-check the relative ones — the shape is
still checkable, the resolution is not — but that is a change to what
`moduleClaimsIn()` returns and deserves its own argument.

## The corruption that must produce a violation

A fence that claims a symbol is exported by an eess package when it is not. That
is what the gate is for, and it must keep firing on it — any fix here that let a
package-facing claim through unchecked would be worse than the gap.

## Verification ledger

- [ ] A doc or changeset can show a consumer-relative import beside a package
      import, with the package import still compiled.
- [ ] Red first: a fence claiming a package export that does not exist still
      fails, with the relative-import support in place.
