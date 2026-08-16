import type picomatch from 'picomatch'

/**
 * Every string an import glob may be matched against, primary first.
 *
 * Non-empty by construction, and `[0]` is the primary — see `candidatesFor`.
 */
// eess-exclude eess/no-unused-exports: return type of the exported candidatesFor API (must stay exported for declaration emit)
export type ImportCandidates = readonly [primary: string, ...alternates: string[]]

/**
 * The same candidates, from the two values a `ModuleEdge` already carries.
 *
 * This is why `ModuleEdge` has **no `candidates` field**: candidates are a
 * function of `specifier` and `resolvedPath`, so storing them beside their
 * own two inputs would be two representations of one fact, free to
 * disagree. The function is exposed instead.
 *
 * `projectRoot` is optional. The workspace-aware callers (`dependency.ts`'s
 * `edgeCandidates`, `predicates/module.ts`'s `importCandidatePaths`) thread
 * `project-relative.ts`'s `rootOf(sourceFile)` through it, so an import
 * target resolves a project-relative candidate against the IMPORTING file's
 * own package root. A caller with no notion of a project root (a test
 * double, or code outside this library's own conditions/predicates) can
 * still omit it — every candidate then falls back to the absolute form.
 */
export function candidatesFor(
  specifier: string,
  resolvedPath: string | undefined,
  projectRoot?: string,
): ImportCandidates {
  if (resolvedPath === undefined) return [specifier]
  const alternates: string[] = isRelativeSpecifier(specifier) ? [] : [specifier]
  // The resolved path named from the project root, **appended**.
  //
  // An import glob is matched against an ABSOLUTE resolved path, so a
  // project-relative one could never match it on its own — a
  // `layeredArchitecture({ shared: ['src/shared/**'] })`-style rule would
  // report a violation on a correct architecture.
  //
  // Appended, never prepended: `[0]` is the primary candidate that violation
  // messages interpolate and `hashViolation` hashes, so putting the relative
  // form first would rewrite every baselined dependency finding.
  //
  // Bare specifiers are untouched — they have no `resolvedPath`, and
  // returning early above is what keeps `notImportFrom('fastify')` working.
  const fromRoot = relativeTo(projectRoot, resolvedPath)
  if (fromRoot !== undefined) alternates.push(fromRoot)
  return [resolvedPath, ...alternates]
}

/** `absolutePath` named from `root`, or `undefined` when it is outside or unknown. */
function relativeTo(root: string | undefined, absolutePath: string): string | undefined {
  if (root === undefined) return undefined
  const prefix = root === '/' ? '/' : `${root}/`
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : undefined
}

/**
 * The first candidate matching any matcher, or `undefined` if none do.
 *
 * "First" is what keeps messages stable: the primary is tested before the
 * specifier, so an import that already matched on its resolved path reports
 * the same string it always did.
 */
export function matchedCandidate(
  candidates: ImportCandidates,
  matchers: readonly picomatch.Matcher[],
): string | undefined {
  // Never `candidates.some(matcher)` — picomatch reads the array index as its
  // second argument and returns a truthy object from index 1 on.
  return candidates.find((candidate) => matchers.some((isMatch) => isMatch(candidate)))
}

/** A specifier that names a location relative to the importing file. */
function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/')
}
