/**
 * Every path a glob could legitimately match in a project — the shape of the
 * data, not how to build it.
 *
 * `PathUniverse` and `viewsFor` are pure: given the materialized string
 * arrays, they need no `ArchProject`/ts-morph and stay in the kernel. Only
 * the MATERIALIZER — walking a real project's source files into this shape —
 * needs the dialect's own project type, and lives in that dialect (e.g.
 * `packages/ts/src/core/path-universe.ts`'s `pathUniverse()`).
 */
export interface PathUniverse {
  /** Absolute paths of every file in the project. */
  readonly filePaths: readonly string[]
  /**
   * Immediate parent directories only.
   *
   * Not all ancestors. A directory-matching predicate typically tests
   * `filePath.substring(0, filePath.lastIndexOf('/'))` — the immediate
   * parent and nothing else — so an all-ancestors set is not a harmless
   * over-approximation, it is a false green: many ancestors are no file's
   * direct parent, so a glob naming one of those can never select anything
   * while an all-ancestors universe would call it satisfiable.
   */
  readonly parentDirs: readonly string[]
  /** `filePaths` relative to the tsconfig directory, for message wording. */
  readonly tsconfigRelativeFilePaths: readonly string[]
  /** `parentDirs` relative to the tsconfig directory, for message wording. */
  readonly tsconfigRelativeParentDirs: readonly string[]
  /**
   * `filePaths` named from the **identity root** — the `.git`/workspace root
   * above the tsconfig, as `discoverIdentityRoot` finds it.
   *
   * A third view, because the first two cannot express how a monorepo addresses
   * its own packages. `'**\/apps/api/src/**'` names segments BETWEEN the
   * repository root and the tsconfig directory: the absolute view carries the
   * checkout's own path (and a dot-segment in it stops `**` dead), while the
   * tsconfig-relative view has `apps/api/` stripped off the front — the very
   * thing the glob names. [Bug 0348](../../../work/bugs/fixed/0348-a-glob-naming-segments-above-the-tsconfig-root-still-dies-under-a-dot-directory.md).
   *
   * Required rather than optional deliberately. An optional view is one a
   * materializer can omit and still typecheck, and a missing view here makes a
   * live glob look unsatisfiable — a dead-selector finding against a rule that
   * works, which is ADR-009 rule 2's confidently-wrong cause.
   */
  readonly identityRelativeFilePaths: readonly string[]
  /** `parentDirs` named from the identity root. See `identityRelativeFilePaths`. */
  readonly identityRelativeParentDirs: readonly string[]
}

/**
 * The views a glob of this kind is matched against.
 *
 * Satisfiability is taken against the **union** — a glob is unsatisfiable
 * only when nothing in any view matches it. That is deliberately generous,
 * so that a wrong `base` cannot make a glob look unmatched by accident. It
 * does NOT make `base` message-only: the anchor check in `syntacticFault`
 * consults it directly, and an unanchored `base: 'absolute'` glob is dead
 * regardless of what any view holds — see `GlobBase`.
 *
 * `import-target`, `specifier` and `literal` are not path kinds and have no
 * views, so they can never be found unsatisfiable here.
 *
 * ## Why the identity view is asked for and the others are not
 *
 * `readsIdentityRelative` is the caller's answer to "does the MATCHER give this
 * glob the identity-root view?" — the dialect owns that rule (ADR-013: the
 * kernel takes the fact, not the policy), and it is required rather than
 * defaulted because a caller that forgets would get the generous union.
 *
 * Generosity is safe for the tsconfig view and is not for this one, which is the
 * whole reason for the asymmetry. The tsconfig view differs from the absolute
 * path only by a prefix the matcher usually strips too. The identity view adds
 * the segments BETWEEN the repository root and the package — so in a monorepo
 * `'apps/identity/**'`, a project-relative glob that selects nothing because the
 * project root is `apps/api`, matches `apps/identity/src/…` in this view and
 * stops being reported dead. Measured while fixing bug 0348, before this
 * parameter existed: that glob selected 0 subjects and produced 0 findings, a
 * silently vacuous selector introduced by the fix for a silently vacuous rule.
 *
 * The tsconfig view needs no such gate, and that was MEASURED rather than
 * assumed: the two globs the matcher withholds it from — `'*\/x/**'` and
 * anything carrying a `'./'` segment — are caught by `syntacticFault` before
 * any view is consulted, so each still reports as dead. A draft of this
 * comment cited a bug for that case; there is none.
 */
export function viewsFor(
  universe: PathUniverse,
  kind: 'file-path' | 'parent-dir' | 'import-target' | 'specifier' | 'literal',
  readsIdentityRelative: boolean,
): readonly (readonly string[])[] {
  if (kind === 'file-path')
    return readsIdentityRelative
      ? [universe.filePaths, universe.tsconfigRelativeFilePaths, universe.identityRelativeFilePaths]
      : [universe.filePaths, universe.tsconfigRelativeFilePaths]
  if (kind === 'parent-dir')
    return readsIdentityRelative
      ? [
          universe.parentDirs,
          universe.tsconfigRelativeParentDirs,
          universe.identityRelativeParentDirs,
        ]
      : [universe.parentDirs, universe.tsconfigRelativeParentDirs]
  return []
}
