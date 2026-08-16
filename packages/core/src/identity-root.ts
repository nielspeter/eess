import fs from 'node:fs'
import path from 'node:path'

/**
 * Where the repository or workspace root is, and how to make a path portable
 * relative to it.
 *
 * Depends on nothing but `node:fs` and `node:path` — engine-neutral by
 * construction, so it belongs in the kernel: baseline identity is a
 * dialect-independent concern (`packages/core/src/baseline.ts` already is).
 */

/**
 * Placeholder substituted for the identity root when hashing a violation.
 * Chosen to be something no real path contains.
 */
const ROOT_TOKEN = '<root>'

/**
 * Find the identity root for a baseline: the repository or workspace root
 * containing `startDir`.
 *
 * Resolution order, all **nearest-first**:
 *
 * 1. `.git` — the definitive repository root. Tested with `existsSync`, not
 *    `isDirectory`: in a worktree or submodule it is a *file* holding a gitdir
 *    pointer, and a worktree is precisely the "same code, different absolute
 *    path" case this module exists to survive.
 * 2. a `package.json` declaring `workspaces` — a monorepo root without git.
 * 3. any `package.json` — a single-package project.
 * 4. `startDir` itself, when nothing is found. That degrades to the previous
 *    behaviour for that one path rather than guessing.
 *
 * Nearest, **not** outermost. Outermost is tempting for monorepos, but it is
 * wrong the moment any ancestor is also a repository — a home directory under
 * dotfiles version control is the common case — because the root would then sit
 * above the checkout and the "relative" path would still carry
 * `Documents/Projects/…`, which differs per machine. It reproduces the bug it
 * is meant to fix. The nearest `.git` is the repository root by definition, and
 * in a monorepo that is already the workspace root, so nearest costs nothing.
 */
export function discoverIdentityRoot(startDir: string): string {
  const resolved = path.resolve(startDir)
  let nearestPackage: string | undefined

  let current = resolved
  for (;;) {
    if (fs.existsSync(path.join(current, '.git'))) return current

    if (WORKSPACE_MARKERS.some((marker) => fs.existsSync(path.join(current, marker))))
      return current

    const manifest = path.join(current, 'package.json')
    if (fs.existsSync(manifest)) {
      if (nearestPackage === undefined) nearestPackage = current
      if (declaresWorkspaces(manifest)) return current
    }

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return nearestPackage ?? resolved
}

/**
 * Files that mark a monorepo root for a tool other than npm/yarn/bun.
 *
 * Without these, a pnpm or Nx repo whose `.git` is absent — a Docker build
 * (`.dockerignore` excludes `.git` in essentially every Node guide), a source
 * tarball, `git archive`, a CI provider that ships a source artifact — falls
 * through to the *nearest* `package.json`, i.e. the individual package. The
 * developer machine has `.git` and resolves the workspace root, CI does not
 * and resolves `packages/api`, the two roots disagree, and every hash differs.
 *
 * Deliberately **root-only** files. `turbo.json` and `deno.json` are excluded
 * even though they mark monorepos, because both are legal *inside* a package
 * (Turborepo Package Configurations, per-package Deno config) and would anchor
 * below the workspace root — the exact divergence this list exists to prevent.
 * Turborepo is covered anyway: it runs on top of npm/pnpm/yarn workspaces, so
 * one of the other markers is always present at the real root.
 */
const WORKSPACE_MARKERS = [
  'pnpm-workspace.yaml',
  'pnpm-workspace.yml',
  'lerna.json',
  'rush.json',
  'nx.json',
] as const

/**
 * Whether a package.json declares npm/yarn/bun workspaces, marking it as the
 * root of a monorepo. An unreadable or malformed manifest is simply not a
 * workspace root — it must not abort baseline loading.
 */
function declaresWorkspaces(manifestPath: string): boolean {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    return parsed !== null && typeof parsed === 'object' && 'workspaces' in parsed
  } catch (error: unknown) {
    // A malformed or unreadable package.json is simply not a workspace root —
    // it must not abort identity-root discovery (or baseline loading behind
    // it) over a manifest this function doesn't even need to parse correctly.
    // Deliberately unexamined: every failure mode (bad JSON, permissions, a
    // symlink race) reduces to the same "not a workspace root" answer.
    void error
    return false
  }
}

/**
 * Replace every occurrence of the identity root inside free text with a stable
 * token.
 *
 * Rule descriptions, element names and messages are prose: producers
 * interpolate a file path into them. Since the text is unstructured, this
 * substitutes the known root prefix rather than trying to parse paths out of
 * it — a regex would also rewrite a `/src` inside a doubled-star glob, which is
 * not a path at all, and relativising it would encode the root's depth.
 *
 * Substring replacement is sufficient because the only machine-dependent part
 * of an interpolated path IS the root prefix; everything after it is a
 * property of the repository.
 *
 * Only the *root* is separator-normalized, never the surrounding text: rule
 * descriptions can embed regex sources (`/\bparse/`), and rewriting their
 * backslashes would let two distinct rules collide on one identity.
 */
export function normalizeIdentityText(text: string, root: string): string {
  const posixRoot = normalizeSeparators(root)
  if (posixRoot === '') return text
  const win32Root = posixRoot.replaceAll('/', '\\')
  const withToken = text.replaceAll(posixRoot, ROOT_TOKEN).replaceAll(win32Root, ROOT_TOKEN)
  // Collapse `<root>/x` and `<root>x` so a root with and without a trailing
  // separator produce identical identity.
  return withToken
    .replaceAll(ROOT_TOKEN + '/', ROOT_TOKEN)
    .replaceAll(ROOT_TOKEN + '\\', ROOT_TOKEN)
}

/**
 * Normalize Windows separators so a baseline generated on one OS matches on
 * another. Interpolated `path.*` output and the stored `file` field do not
 * always carry forward slashes.
 */
function normalizeSeparators(value: string): string {
  return value.replaceAll('\\', '/')
}
