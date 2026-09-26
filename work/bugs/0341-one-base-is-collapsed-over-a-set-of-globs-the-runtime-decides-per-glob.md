# Bug 0341: one `base` is collapsed over a set of globs whose runtime decides per glob

## Status

- **State:** Draft — measured; the fix is a small kernel surface addition, which is why it is not a
  one-line patch.
- **Severity:** Medium — **a false red or a false green, caller's choice, and no third option
  today.** `globAnyOf(globs, kind, base)` takes ONE `base` for a whole set. The runtime decides per
  glob. So a mixed set has no honest declaration, and the two available spellings are wrong in
  opposite directions.
- **Origin:** the product review of PR #150, 2026-09-26 (Important 3), and the method review of the
  same PR (Minor 8), which caught the change riding along undeclared.
- **Reported:** 2026-09-26

## Symptom

`packages/ts/src/smells/smell-builder.ts:137` declares one `base` for every glob passed to
`inFolder()`. Take `inFolder(['src/a/**', '*/b/**'])`, where the first is project-relative and the
second is neither project-relative nor anchored:

| spelling                             | `base` declared | what happens                                                                                                                                        |
| ------------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `every((g) => isProjectRelative(g))` | `'absolute'`    | `syntacticFault` reports `'src/a/**'` `unanchored` — a **false red** on a glob the runtime matches                                                  |
| `some((g) => isProjectRelative(g))`  | `'normalized'`  | `'*/b/**'` escapes the `unanchored` branch, and it is genuinely dead — `readsRootRelativePath` withholds the second view from it. A **false green** |

The code currently spells it `every`, deliberately: ADR-009 takes the red. The `some` spelling was
written during [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
and reverted before merge for exactly this reason.

The same shape is reachable at every variadic path-glob declaration —
`builders/cross-layer-builder.ts` and `builders/slice-rule-builder.ts` declare one glob at a time and
so dodge it today, but nothing stops the next one passing a set.

## Root cause

`globAnyOf` (`packages/core/src/glob-site.ts:245`) maps one `base` over every child:

```ts
return { op: 'any', children: globs.map((glob) => ({ glob, kind, base })) }
```

`DeclaredGlob.base` is already **per-glob** — the collapse happens only in this constructor. The
dialect cannot fix it locally without either building the node literal by hand (which drops it out of
`pathGlobSurfaces()`, the census that scans for `globAnyOf(`/`globNode(` — see
[0340](./0340-the-path-glob-census-keys-on-declaration-not-on-matching.md)) or splitting the set into
one node per glob, which changes the meaning: repeated `inFolder()` calls OR together, so the set is
dead only when every glob in it is, and one node per glob makes each independently dead-able.

## Fix

Not decided. The shape is clear: let `globAnyOf` take a `base` **per glob**, e.g. an overload
accepting `(glob: string) => GlobBase` beside the current constant. Then

```ts
globAnyOf(this._folders, 'file-path', (g) => (isProjectRelative(g) ? 'normalized' : 'absolute'))
```

declares what the runtime actually does, and the dilemma above disappears rather than being resolved
in one direction.

This is a **kernel** surface change (`@nielspeter/eess`), additive, and every dialect that ever
declares a set of path globs meets it.

## Related

- [0339](./fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md) — where the
  `every`/`some` dilemma was met and deliberately left at `every`; its `smell-builder.ts` comment
  points here.
- [0340](./0340-the-path-glob-census-keys-on-declaration-not-on-matching.md) — why the dialect cannot
  simply hand-build the node.

## Verification

- [x] measured: the two spellings and their opposite failure directions, and `DeclaredGlob.base`
      already being per-glob.
- [ ] a red test showing a mixed set declared honestly, failing on today's constructor
- [ ] the kernel overload, with the dialect switched to it
- [ ] a changeset naming `@nielspeter/eess` and `@nielspeter/eess-ts`
- [ ] `npm run validate` green.

Deferred: none.
