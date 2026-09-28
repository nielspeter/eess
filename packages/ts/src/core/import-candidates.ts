import picomatchFactory from 'picomatch'
import type picomatch from 'picomatch'
import type { ImportDeclaration } from 'ts-morph'

/**
 * Every string an import glob may be matched against, primary first.
 *
 * Non-empty by construction, and `[0]` is the primary — see `importCandidates`.
 */
type ImportCandidates = readonly [primary: string, ...alternates: string[]]

/**
 * Every string a glob may legitimately be matched against for one import.
 *
 * The old rule was "the resolved path, **or** the raw specifier if it does not
 * resolve" — which is backwards. An installed package with types resolves, so
 * `notImportFrom('fastify')` was compared against
 * `/…/node_modules/@types/fastify/index.d.ts` and never matched. The documented
 * way to ban a dependency worked only on dependencies you had not installed
 * (bug 0014).
 *
 * So: match against **both**, and a glob matches the import if it matches
 * either. Path globs keep working, because the resolved path is still tested.
 *
 * The specifier is offered only when it is **non-relative**. A relative
 * specifier (`'../services/foo.js'`) carries no information the resolved path
 * lacks, and testing it as a string would let `'**\/services/**'` match an
 * import that resolves somewhere else entirely. Bare package names and path
 * aliases (`'@/lib/x'`) are the cases this exists for, and both are
 * non-relative.
 *
 * **`[0]` is the primary candidate, and it is exactly what the old
 * `resolveImportPath` returned.** That is load-bearing rather than incidental:
 * violation messages interpolate it, `hashViolation` hashes the message, and a
 * changed message silently invalidates every baselined dependency violation.
 * Keeping the primary stable means only genuinely *new* findings get new text.
 * A test asserts the equivalence across the whole fixture corpus.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function importCandidates(decl: ImportDeclaration): ImportCandidates {
  return candidatesFor(
    decl.getModuleSpecifierValue(),
    decl.getModuleSpecifierSourceFile()?.getFilePath(),
  )
}

/**
 * The same candidates, from the two values a `ModuleEdge` already carries.
 *
 * This is why `ModuleEdge` has **no `candidates` field** (plan 0071 §1):
 * candidates are a function of `specifier` and `resolvedPath`, so storing them
 * beside their own two inputs would be two representations of one fact, free to
 * disagree. The function is exposed instead.
 *
 * `importCandidates` above is now a thin wrapper over this, which is what lets
 * `tests/core/module-edges-corpus.test.ts` compare the two derivations across
 * the whole repository: same rule, reached from a declaration on one side and
 * from an edge on the other.
 */
export function candidatesFor(
  specifier: string,
  resolvedPath: string | undefined,
  projectRoot?: string,
): ImportCandidates {
  if (resolvedPath === undefined) return [specifier]
  const alternates: string[] = isRelativeSpecifier(specifier) ? [] : [specifier]
  // The resolved path named from the project root, **appended** — bug 0037.
  //
  // An import glob is matched against an ABSOLUTE resolved path, so a
  // project-relative one could never match it: measured,
  // `layeredArchitecture({ shared: ['src/shared/**'] })` reported a violation
  // on a correct architecture, because `shared` also reaches
  // `onlyImportFrom(...)`. A **false red**, with no configuration finding and a
  // silent `doctor` — worse than a false green for an agent, which will edit
  // real imports to satisfy a broken allowlist.
  //
  // Appended, never prepended: `[0]` is the primary candidate that violation
  // messages interpolate and `hashViolation` hashes, so putting the relative
  // form first would rewrite every baselined dependency finding.
  //
  // Bare specifiers are untouched — they have no `resolvedPath`, and returning
  // early above is what keeps `notImportFrom('fastify')` working (bug 0014).
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
 * The matcher an import glob is matched with — `dot: true`, deliberately.
 *
 * ## Why this differs from a project-source glob (bug 0349)
 *
 * picomatch's default `dot: false` stops `**` crossing a path segment that begins
 * with `.`. Under pnpm a package resolves to
 * `node_modules/.pnpm/knex@3/node_modules/knex/…` and under Yarn's cache to
 * `.yarn/cache/knex-npm-3/…`, so `notImportFrom('**\/node_modules/knex/**')` — the
 * spelling for "this package, however it is imported" — matched nothing and
 * reported a **pass**. No dot-directory checkout is involved; the dot segment is
 * the package manager's own layout, inside an ordinary tree.
 *
 * [Bug 0339](../../../../work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
 * weighed `{ dot: true }` for path globs generally and **rejected** it, because it
 * would change matching inside the project: `'**\/*.ts'` would begin matching
 * `.nuxt/` or `.next/` content. That rejection stands and is not touched here.
 *
 * **It does not transfer to an import target, for a reason and a measurement.**
 *
 * The reason: an adopter authors their project's paths, so crossing `.storybook/`
 * changes which of *their* files a rule reads — their decision to make. They do
 * not author `node_modules`' layout. A dot segment there is the resolver's
 * implementation detail, and refusing to cross it means the glob cannot name the
 * package it is about.
 *
 * The measurement, which is the stronger half. Today the SAME rule gives different
 * verdicts for the same dependency depending only on how `node_modules` was laid
 * out — `onlyImportFrom('**\/shared/**')` against a dependency's internal
 * `shared/` directory **allows** it under a hoisted npm tree and **reports** it
 * under pnpm. So the current behaviour is not safely strict, it is inconsistent by
 * package manager, which is the same defect 0339 is named for: a verdict that
 * depends on where things sit on disk rather than on the code. `dot: true` makes
 * every layout agree, on what the majority layout already does.
 *
 * **The consequence to state plainly:** an allowlist widens under pnpm and Yarn to
 * match what it always did under npm. A sloppy allowlist glob was always this
 * permissive; those layouts were accidentally hiding it.
 *
 * One definition rather than six call sites, because six copies of a matching rule
 * is how this area has repeatedly drifted.
 */
export function importTargetMatcher(glob: string): picomatch.Matcher {
  return picomatchFactory(glob, { dot: true })
}

/**
 * The first candidate matching any matcher, or `undefined` if none do.
 *
 * "First" is what keeps messages stable: the primary is tested before the
 * specifier, so an import that already matched on its resolved path reports
 * the same string it reported before this fix.
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
