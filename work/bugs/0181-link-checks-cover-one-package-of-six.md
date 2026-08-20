# Bug 0181: link checks cover one package of six

## Status

- **State:** Draft — measured.
- **Found:** 2026-08-20, architect and devops review of the bug 0179 fix.
- **Severity:** a placement gap. Two real defect classes are checked for
  `eess-ts` and unchecked for the kernel and four sibling dialects.

## Symptom

Two properties are enforced, and both are enforced in exactly one package:

**1. Relative links in a shipped README.** `packages/*/README.md` ships in every
package's tarball (`files: ["dist","README.md","LICENSE"]`), so a relative link
in one resolves to nothing from npm or `node_modules`. The only mechanism is
`packages/ts/tests/docs/shipped-links.test.ts`, which reads `packageRoot` — its
own package. Bug 0179 fixed `eess-ts`; review then found **11 more** in `core`,
`md`, `mermaid` and `crossvalidate`, one of which (`mermaid` →
`../../plans/0059-…`) was dead in the repository too. Those are fixed, but
nothing stops the twelfth.

**2. `.md` citations in source comments.** The only mechanism is
`cross-document-links-resolve.test.ts`'s source-comment row, whose
`sourceFiles()` walks `packageRoot` only. Measured populations after 0179's fix:

| package                                 | relative `.md` citations | checked? |
| --------------------------------------- | ------------------------ | -------- |
| `ts`                                    | 25                       | yes      |
| `core`                                  | 10                       | **no**   |
| `md`                                    | 2                        | **no**   |
| `mermaid` · `gherkin` · `crossvalidate` | 0                        | n/a      |

Bug 0179's fix is the first commit to put eess-relative citations into
`packages/core/src`, and nothing checks them.

## Root cause

Both checks live in `eess-ts`'s test suite because that is where they were
adopted from `ts-archunit`, a single-package repository where "the package" and
"the repo" were the same thing. Neither property is dialect-specific: "a link in
a shipped README resolves from the tarball" and "a `.md` citation in a source
comment resolves" are true of every package.

`check:corpus` is the natural home — it already walks the repo and already owns
`path:line` pointer resolution — but its `ROOTS` are `work/**`, `adr/**` and
`docs/**`. `packages/` is in none of them.

## Fix

Not built. Move both properties into a `check:*` gate over all six packages.

Keeping the `eess-ts` test as a second, independent derivation is fine and
defensible (ADR-009 rule 5); keeping it as the ONLY derivation for five packages
is the defect.

Note the ordering dependency: `packages/ts/tests/roots.ts` is correctly placed
today because no sibling package's tests read the monorepo corpus. Moving these
checks up is what creates the cross-package need, and the root helper should move
with them rather than being duplicated per package.

## Verification

- [ ] A relative link added to any `packages/*/README.md` fails a gate.
- [ ] A broken `.md` citation added to any `packages/*/src` comment fails a gate.
- [ ] Each has a non-zero denominator reported, so a gate that stopped matching
      cannot read as a gate that found nothing wrong.
