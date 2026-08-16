import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import type { DiskSet, OnDisk } from '@nielspeter/eess'
import { discoverIdentityRoot } from '@nielspeter/eess'
import type { ArchProject } from './project.js'

/**
 * Materialize the project's disk set by walking the real filesystem. The
 * pure `OnDisk`/`DiskSet` shape lives in the kernel; only the walk needs
 * `ArchProject` (to find the tsconfig directory) and `node:fs`, so only the
 * walk lives here.
 */

/**
 * Directories never worth walking.
 *
 * `node_modules` and `.git` dominate the cost. The build-output names are
 * here because a walk that reports a `dist/` directory as "absent from the
 * project" is noise, not a finding. The list cannot be complete — a real
 * TypeScript monorepo may hold a Rust `target/`, a Python `.venv`, a
 * `.gradle` — which is why the entry budget below exists rather than a
 * longer list.
 */
const PRUNE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.venv',
  'vendor',
  'target',
  '.gradle',
  '.yarn',
  '.cache',
])

/**
 * How many directory entries the walk will read before giving up.
 *
 * An implementation constant, not part of the public contract and not
 * tunable. The walk is unbounded in principle: a contributor who has run a
 * native build inside a TypeScript monorepo can leave tens of thousands of
 * entries under one directory, and a *failing* run that then hangs inside a
 * test timeout is a worse experience than the false green this whole
 * mechanism exists to remove. Above the budget the classification degrades
 * to `not-determined`, which costs message quality and nothing else — the
 * enrichment is already fail-open.
 */
const ENTRY_BUDGET = 50_000

// `.d.ts` and its `.d.mts`/`.d.cts` siblings count. They ARE TypeScript for
// the question this set answers — "does this path contain TypeScript your
// tsconfig is keeping out" — and excluding them makes a directory of pure
// declarations report "this path exists but contains no TypeScript", which
// is false.
const TS_FILE = /\.(m|c)?tsx?$/

const cache = new WeakMap<ArchProject, DiskSet>()

/**
 * The project's disk set, walked at most once and only when asked.
 *
 * Lazy on purpose. This is only ever reached from `diagnoseGlob`, which is
 * only ever reached from an already-firing fault, so a project with no
 * faults never touches the filesystem. An eager version would charge every
 * `check()` a recursive walk to answer a question no fault asked.
 */
export function diskSet(project: ArchProject): DiskSet {
  const cached = cache.get(project)
  if (cached) return cached
  const built = build(project, ENTRY_BUDGET)
  cache.set(project, built)
  return built
}

/**
 * The walk, with the budget injectable. Exported for tests only — the
 * degrade path is the difference between "not determined" and a *partial,
 * wrong* classification, and with the budget a module constant it could
 * only ever be reached by accident on a repository nobody has.
 */
export function buildDiskSet(project: ArchProject, budgetLimit = ENTRY_BUDGET): DiskSet {
  return build(project, budgetLimit)
}

function build(project: ArchProject, budgetLimit: number): DiskSet {
  // Guard on the INPUT, before deriving anything. `discoverIdentityRoot`
  // calls `path.resolve`, so every root it returns is absolute and checking
  // the output can never fail; a relative or nonexistent `tsConfigPath` (a
  // hand-built `ArchProject` test double, or a genuinely broken one) must
  // not walk an unrelated directory or throw from inside a guard.
  if (!path.isAbsolute(project.tsConfigPath)) return UNDETERMINED
  const root = discoverIdentityRoot(path.dirname(project.tsConfigPath))
  if (!fs.existsSync(root)) return UNDETERMINED

  const files: string[] = []
  /** Every file, TypeScript or not — so `absent` means absent, not "not TypeScript". */
  const everyFile: string[] = []
  const dirs: string[] = []
  /**
   * Directories the walk refused to enter.
   *
   * A glob matching one of these cannot be classified: nothing under it was
   * seen. Reporting `absent` would say "this path does not exist" about a
   * realistic rule scope like `**\/dist/**` or `**\/vendor/**`, and `absent`
   * carries no advice, so the caller falls back to a cause list beginning
   * "a path segment is misspelled".
   */
  const pruned: string[] = []
  let budget = budgetLimit
  let exhausted = false

  const walk = (dir: string): void => {
    if (exhausted) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      void err // unreadable or gone: not a finding, just not walkable
      return
    }
    budget -= entries.length
    if (budget < 0) {
      exhausted = true
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name).replaceAll('\\', '/')
      // Prune by NAME, before asking whether it is a directory.
      //
      // `Dirent.isDirectory()` is false for a symlink, so a symlinked
      // `node_modules` — what pnpm produces, and what `git worktree add`
      // leaves behind — falls through to the `else` branch and is recorded
      // as a **file** unless pruned by name first. Recording it as a file
      // means it never enters `pruned`, so a glob under it would classify
      // `absent` ("no such path") instead of `not-determined` ("this walk
      // cannot say") — those carry different advice, and `absent` is the
      // one that asserts something false.
      //
      // Safe: pruning records the path and does not recurse, so no link is
      // followed and the loop argument below is untouched.
      if (PRUNE.has(entry.name)) {
        pruned.push(full)
        continue
      }
      // `Dirent.isDirectory()` is false for a symlink under `withFileTypes`,
      // so symlink loops are impossible by construction. Do not "fix" this
      // with `statSync`, which follows them.
      //
      // The cost, for symlinks we do NOT prune: a symlinked source
      // directory — pnpm and yarn workspaces create them — is recorded as a
      // file, so a glob naming it classifies `no-typescript`. Wrong, but
      // wrong in the direction that only weakens a message; following the
      // link risks a walk that never terminates.
      if (entry.isDirectory()) {
        dirs.push(full)
        walk(full)
      } else {
        everyFile.push(full)
        if (TS_FILE.test(entry.name)) files.push(full)
      }
    }
  }
  walk(root.replaceAll('\\', '/'))
  if (exhausted) return UNDETERMINED

  // Containment is TRANSITIVE, and that is load-bearing. Using each file's
  // immediate parent instead would label a docs directory "contains no
  // TypeScript" while a `.vitepress/config.ts` sits one level below it — a
  // false statement in the one message whose entire defence is that it
  // states only facts.
  const holdsTypeScript = new Set<string>()
  for (const file of files) {
    let dir = path.dirname(file)
    while (dir.length >= root.length) {
      holdsTypeScript.add(dir)
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }

  // Directories AND every file, not just the TypeScript ones. Deriving
  // `absent` from the TypeScript-only set would assert "this path does not
  // exist" about any path holding only a `.md`, a `.json`, or anything
  // under a pruned name — and `absent` carries no advice, so the caller
  // falls back to `no-match`'s list, whose first cause is "a path segment
  // is misspelled". Exactly the confidently-wrong cause this whole
  // mechanism exists to avoid.
  const everything = [...everyFile, ...dirs]
  const typeScript = new Set(files)
  return {
    classify(glob: string): OnDisk {
      const isMatch = picomatch(glob)
      // Never `everything.some(isMatch)` — picomatch reads the array index
      // as its second argument and returns a truthy object from index 1
      // onwards.
      const matched = everything.filter((candidate) => isMatch(candidate))
      if (matched.length === 0) {
        // Not seen is not the same as not there.
        return pruned.some((dir) => isMatch(dir) || glob.includes(dir.slice(root.length + 1)))
          ? 'not-determined'
          : 'absent'
      }
      // Per GLOB, not per path: one glob routinely matches paths in both
      // categories. Any matched path holding TypeScript makes the tsconfig
      // the story worth telling.
      return matched.some(
        (candidate) => holdsTypeScript.has(candidate) || typeScript.has(candidate),
      )
        ? 'holds-typescript'
        : 'no-typescript'
    },
  }
}

const UNDETERMINED: DiskSet = {
  classify: () => 'not-determined',
}
