/**
 * The two roots a test in this package can mean, resolved once.
 *
 * `packages/ts/tests/<area>/../..` is `packages/ts`, and for most of this suite
 * that is exactly right — it is where `src/`, `tsconfig.json`, `README.md` and
 * this package's own `CHANGELOG.md` live. But the corpus a doc gate reads —
 * `docs/`, `work/plans/`, `adr/` — is at the MONOREPO root, one level further
 * up.
 *
 * [Bug 0179](../../../work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md):
 * a batch of tests adopted from `ts-archunit` — a single-package repository where
 * the two roots were the same directory — resolved `'../..'` and meant the
 * monorepo. 27 of them could not pass. Several files needed BOTH roots, which is
 * why a blanket `'../../..'` would have been wrong: `doc-globs-are-anchored.test.ts`
 * reads `docs/` (monorepo) and `src/conditions/dependency.ts` (package) in the
 * same file.
 *
 * So the two are named rather than counted. A test that says `repoRoot` cannot be
 * read as meaning the package, and a reviewer can see which one is intended
 * without counting `..` segments.
 *
 * **`repoRoot` is discovered, not counted.** Walking up to the workspace root
 * survives this file moving; a hard-coded `'../../..'` would reproduce the exact
 * defect one directory deeper.
 */
import fs from 'node:fs'
import path from 'node:path'

/** This package: `packages/ts`. Where `src/`, `tsconfig.json` and the package's own docs live. */
export const packageRoot = path.resolve(import.meta.dirname, '..')

/**
 * The monorepo root — the directory whose `package.json` declares `workspaces`.
 *
 * Throws rather than falling back to a guess. A doc gate handed the wrong root
 * reads zero documents and passes vacuously, which is worse than the honest
 * failure this replaces: the whole point of bug 0179 is that a gate reading
 * nothing must not look like a gate that found nothing wrong.
 */
export const repoRoot = ((): string => {
  let dir = packageRoot
  for (;;) {
    const manifest = path.join(dir, 'package.json')
    if (fs.existsSync(manifest)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      if (typeof parsed === 'object' && parsed !== null && 'workspaces' in parsed) return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      throw new Error(
        `no workspace root above ${packageRoot} — a package.json declaring "workspaces" is how tests/roots.ts finds the monorepo`,
      )
    }
    dir = parent
  }
})()

/** The published documentation corpus, at the monorepo root. */
export const docsDir = path.join(repoRoot, 'docs')

/** The engineering corpus: plans, bugs, proposals. All under `work/`. */
export const plansDir = path.join(repoRoot, 'work/plans')
