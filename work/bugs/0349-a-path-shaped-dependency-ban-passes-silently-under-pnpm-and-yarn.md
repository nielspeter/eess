# Bug 0349: a path-shaped dependency ban passes silently under pnpm and Yarn's cache

## Status

- **State:** Draft — measured; found by sizing
  [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
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
[0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
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

Not decided. The candidates differ in blast radius, and the one that looks obvious
is the one 0339 already rejected.

- **`{ dot: true }` for path globs.** It is the direct answer and 0339 weighed and
  rejected it: it changes matching _inside_ a project too, so `**/*.ts` would begin
  matching `.nuxt/`, `.next/` and `.cache` content when those are in the program.
  That rejection was made for a project's own sources; whether it holds for an
  **import target**, which is a different population, is not the same question and
  has not been asked.
- **Match import targets differently from source paths.** An import target is
  already handled by its own producer (`candidatesFor`), so a dot-crossing rule
  could be confined to it without touching selector globs. Narrower, and it splits
  one matching rule into two — which is the divergence this area keeps paying for.
- **Say so instead.** Document that a dependency ban should be written against the
  **specifier**, not the resolved path, and make the path spelling report that it
  cannot see a dot-segmented layout. This is the ADR-009 Rule 3 shape ("where there
  is deliberately no escape hatch, say so, and say what to do instead") and it is
  the only candidate that helps an adopter who is already on pnpm today.

## Related

- [0348](./0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md)
  — the sibling this was found while sizing; its proposed repo-relative view does
  **not** cover this case.
- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
  — the first of the three, and the record that weighed and rejected `{ dot: true }`.

## Verification

- [x] measured: the table above, in a plain checkout, with the pinned picomatch.
- [x] the bare-specifier path confirmed unaffected, by an adopter's real run.
- [ ] reproduced end-to-end through `notImportFrom` against a real pnpm-shaped tree,
      not picomatch alone
- [ ] a ruling among the three candidates
- [ ] a red-first test
- [ ] a changeset
- [ ] `npm run validate` green.

Deferred: none.
