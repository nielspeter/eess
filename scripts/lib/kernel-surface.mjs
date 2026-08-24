/**
 * The one place that says which kernel exports a dialect need NOT re-export.
 *
 * Two consumers read it and they must never disagree:
 *
 *  - `scripts/lib/family-re-exports.mjs`, behind `npm run check:family`;
 *  - `packages/ts/tests/standalone-surface.test.ts`.
 *
 * They used to hold the same list twice, synced by a comment that said "kept in
 * sync with that file by hand". Plan 0165 Phase 2 moved 30 modules into the
 * kernel and grew one list by 47 names, which is exactly when a hand-synced pair
 * drifts — so the pair became one module instead.
 */

/**
 * Kernel-internal plumbing, exempt on every package (plan 0088's own ratified
 * decision: "implementation detail, not part of the surface a standalone
 * consumer builds against").

 * **Emptied by ADR-011.** Every name that used to be here now lives behind
 * `@nielspeter/eess/internal`, so it is not on the kernel's root surface at all
 * and needs no exemption from the re-export requirement. The list is kept as an
 * empty, exported set rather than deleted: `check:family` and
 * `standalone-surface.test.ts` both read it, and an empty set is the honest
 * statement that the boundary moved into the module structure. A name added back
 * here would mean "public at the root, but deliberately not re-exported" — a real
 * category, currently unused.
 */
export const KERNEL_INTERNAL = new Set([])

/**
 * The dialect-family-only surface — plan 0088 Phase 4's named exception. Serves
 * crossvalidate/md's two-sided binding, not a standalone ts user.
 */
export const FAMILY_ONLY = new Set(['correspondence', 'CorrespondenceBuilder'])

/**
 * ANSI colour helpers — terminal-formatting internals, not programmatic surface.
 */
export const ANSI_INTERNAL = new Set([])

/**
 * Kernel exports that eess-ts has never published.
 *
 * The rule: *moving a module's home must not change eess-ts's public API.*
 *
 * **This list was wrong when Phase 2 wrote it, and the correction is the point.**
 * It held 47 names, justified as "none was reachable from eess-ts before the
 * move" — measured against `119ba6d`, which is the Phase 1 close, i.e. AFTER the
 * engine copy had already dropped them. Circular: the damaged state was used as
 * the definition of normal. Re-measured against `3b851d2` — the last commit
 * before the copy — **34 of those 47 were public**, and Phase 3 re-exported all
 * 34 from `packages/ts/src/index.ts`. Removing a published export is a breaking
 * change; the burden sits on the removal.
 *
 * These 13 are what survives that correction: kernel internals eess-ts did not
 * export before the copy either.
 *
 * The ratchet still bites — a kernel export that is NOT here and NOT re-exported
 * reds `standalone-surface.test.ts`. Its companion staleness test requires every
 * name here to still exist on the kernel root; with the list empty that loop runs
 * over nothing, which is why the clause-2 assertion beside it (no `/internal`
 * symbol is reachable from a dialect) is what now carries the weight.
 */
export const KERNEL_PRIVATE_BEFORE_THE_SPLIT = new Set([])
