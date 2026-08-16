/**
 * What the filesystem says about a glob that the compiler's file set does
 * not — the shape of the data, not how to build it.
 *
 * `OnDisk`/`DiskSet` are pure: a materialized `DiskSet` is just a closure
 * over already-walked filesystem data, so the type stays in the kernel.
 * Walking a real project's filesystem needs Node's `fs`/`path` and the
 * dialect's own project type to find the root, so the MATERIALIZER lives in
 * that dialect (e.g. `packages/ts/src/core/disk-set.ts`'s `diskSet()`).
 */

/**
 * What the filesystem knows that the compiler's file set does not.
 *
 * Distinguishes "your glob is misspelled" from "your glob is fine and your
 * tsconfig scope excludes it" — the cheapest wrong action an agent can take
 * on a dead-glob finding, and the common case in a real monorepo where a
 * build-output or docs directory sits outside the loaded project.
 */
export type OnDisk = 'holds-typescript' | 'no-typescript' | 'absent' | 'not-determined'

/**
 * What the filesystem knows that the compiler's file set does not.
 */
export interface DiskSet {
  /** Classify a glob by what exists on disk under the paths it matches. */
  classify(glob: string): OnDisk
}
