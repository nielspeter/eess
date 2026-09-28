# Bug 0349: a path-shaped dependency ban passes silently under pnpm and Yarn's cache

## Status

- **State:** Fixed — on branch `fix/0349-dependency-ban-under-pnpm`. Measured; found by sizing
  [0348](../0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  and larger than it.
- **Severity:** High — **a silent false green in an advertised use case, on every
  released version, with no dot-directory involved.** Banning a dependency is one
  of the things eess is for. A ban written against the resolved path — the spelling
  an adopter reaches for when they want "this package, however it is imported" —
  matches nothing under the two commonest non-npm layouts, and reports a pass.
- **Origin:** an adopter, sizing 0348, disclosed that ten of their rules match a
  resolved `node_modules` target and that their own dot-directory proof never
  exercised them (their worktrees symlinked `node_modules` to a plain checkout, so
  those targets resolved dot-free). Measuring that residue found this.
- **Reported:** 2026-09-28

## Symptom

Measured, picomatch 4.0.4, **plain checkout, no dot-directory anywhere**:

| glob                      | npm/Yarn hoisted | pnpm virtual store | Yarn `.yarn/cache` |
| ------------------------- | ---------------- | ------------------ | ------------------ |
| `**/node_modules/knex/**` | **true**         | **false**          | **false**          |
| `**/knex/**`              | **true**         | **false**          | **false**          |

The paths:

- pnpm — `…/repo/node_modules/.pnpm/knex@3.1.0/node_modules/knex/lib/index.js`
- Yarn — `…/repo/.yarn/cache/knex-npm-3.1.0/node_modules/knex/lib/index.js`

Both carry a dot segment (`.pnpm`, `.yarn`) that picomatch's default `dot: false`
will not let `**` cross. So the rule matches nothing and `notImportFrom` returns
"nothing forbidden was imported" — a pass.

## Root cause

The same picomatch default behind
[0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
and 0348, reached by a third route. 0339 was about a dot segment in the **project's
own path**; 0348 about a glob naming segments **above the tsconfig root**. This one
needs neither: the dot segment is in the **package manager's layout**, inside an
ordinary checkout.

Neither of the views eess offers helps:

- the absolute path carries the dot segment;
- the root-relative path also carries it (`node_modules/.pnpm/…`), because the
  segment is below the root, not above it.

**This is the case a repo-relative view — 0348's candidate fix — does not reach.**
Measured: `node_modules/.pnpm/knex@3/node_modules/knex/lib/index.js` against
`**/node_modules/knex/**` is `false`.

**Bare-specifier bans are unaffected.** `candidatesFor` offers the raw specifier
when it is non-relative, so `notImportFrom('knex')` matches on the specifier and
never touches a path. The reporter confirms this from a real run:
`imports "fastify" which matches forbidden [fastify]`.

## Fix

**Candidate 2: one matcher for import targets, `{ dot: true }`, confined there.**
`importTargetMatcher` in `packages/ts/src/core/import-candidates.ts` — the module
that already owns what an import glob is matched against — and all **six** call
sites use it (`conditions/dependency.ts`'s `onlyImportFrom`, `notImportFrom`,
`dependOn`, `onlyHaveTypeImportsFrom`, and `predicates/module.ts`'s `importFrom`
and `notImportFrom`). One definition, because six copies of a matching rule is how
this area has repeatedly drifted.

### Why 0339's rejection of `{ dot: true }` does not transfer

0339 weighed this exact option for path globs and rejected it, because it would
change matching **inside the project**: `'**/*.ts'` would begin matching `.nuxt/`
or `.next/` content. **That rejection stands and is untouched** — this change
reaches import targets only.

Two arguments, and the second is the stronger:

1. **Authorship.** An adopter authors their project's paths, so crossing
   `.storybook/` changes which of _their_ files a rule reads. They do not author
   `node_modules`' layout; a dot segment there is the resolver's implementation
   detail, and refusing to cross it means the glob cannot name the package it is
   about.
2. **The current behaviour is not safely strict — it is inconsistent by package
   manager.** Measured: `onlyImportFrom('**/shared/**')` against a dependency's
   internal `shared/` directory

   | layout             | verdict today |
   | ------------------ | ------------- |
   | hoisted npm / Yarn | **allowed**   |
   | pnpm               | **reported**  |

   Same rule, same code, same dependency, different answer — which is the defect
   0339 is named for (a verdict decided by where things sit on disk) one population
   over. `{ dot: true }` makes every layout agree, on what the majority layout
   already did.

**The consequence, stated rather than discovered:** an allowlist widens under pnpm
and Yarn. A loose allowlist glob was always this permissive; those layouts were
accidentally hiding it. The changeset says so.

### What the sabotage matrix corrected before this shipped

The first pass had **three rows that fired nothing**, and two were real gaps in the
tests rather than unfalsifiable guards:

| row                                        | first pass                                              | after                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bypass one of the six call sites           | **green** — the test reached one surface                | reds: all four condition/predicate surfaces are covered, including the allowlist                                                                        |
| reduce the cross-layout test to one layout | **green** — `new Set([x]).size === 1` is trivially true | reds: the row asserts its denominator first                                                                                                             |
| remove the resolve non-vacuity check       | green                                                   | still green — it is a **diagnostic**, not a guard; the assertion after it already fails when nothing resolves, and this record does not claim otherwise |

The first of those is the one that matters: the fix reasoned at length about
`onlyImportFrom`'s direction and did not test it until the matrix said so.

## Related

- [0348](../0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — the sibling this was found while sizing; its proposed repo-relative view does
  **not** cover this case.
- [0339](./0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  — the first of the three, and the record that weighed and rejected `{ dot: true }`.

## Verification

- [x] measured: the table above, in a plain checkout, with the pinned picomatch.
- [x] the bare-specifier path confirmed unaffected, by an adopter's real run and by
      a control here.
- [x] **reproduced end-to-end through the real condition and real resolution** —
      `packages/ts/tests/conditions/a-dependency-ban-under-pnpm.test.ts` builds the
      three layouts **on disk** and lets ts-morph resolve, because a fixture
      asserting against a hand-written path would pass whatever the resolver did.
      Confirmed red in exactly the pnpm and Yarn-cache rows, with npm and both
      controls green. (The first draft used the `predicates/module.ts`
      `notImportFrom` after `.should()`, which filters rather than asserts, and
      every row went green-by-vacuity — including its own controls.)
- [x] a ruling among the three candidates, with 0339's rejection re-examined rather
      than inherited.
- [x] a sabotage matrix — 5 rows plus a control; three fired nothing on the first
      pass and two of those were fixed rather than explained away. The repo's own
      `test files should not use aliased imports` rule also reddened this test and
      is now satisfied.
- [x] a changeset — `minor`, marked breaking, declaring both directions.
- [x] `npm run validate` green.

Deferred: none.
