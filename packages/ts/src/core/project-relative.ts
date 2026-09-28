/**
 * Make a project-relative glob work, instead of failing loudly — plan 0067 C.
 *
 * Globs are matched against **absolute** file paths, so `'src/domain/**'`
 * matches nothing. That is the single commonest real mistake with this library:
 * it is the shape 0.18.1 was released for, and as of **0.34.0** it is a hard
 * build failure telling the author to prefix `'**\/'`.
 *
 * Prefixing works but says something different. `'**\/src/domain/**'` matches a
 * `src/domain` **anywhere** — including `vendor/thing/src/domain`, and
 * including a second `src/` nested inside a monorepo package. What the author
 * meant was the one at the project root. 0067 called normalization "the root
 * cause" fix for that reason, and 0069 sequenced it directly after R3b.
 *
 * So an unanchored glob is matched against the path **relative to the
 * tsconfig's directory**, in addition to the absolute path. Both spellings keep
 * working and they mean different things:
 *
 * | glob                  | matches                                     |
 * | --------------------- | ------------------------------------------- |
 * | `'src/domain/**'`     | that folder **at the project root**         |
 * | `'**\/src/domain/**'` | a `src/domain` **anywhere** in the project  |
 * | `'/abs/src/domain/**'`| exactly that absolute path                  |
 *
 * ## Three views since bug 0348, not two
 *
 * A `'**\/'`-led glob gets a THIRD naming: the path from the **repository root**
 * (`discoverIdentityRoot`'s `.git`/workspace root). Without it, `'**\/apps/api/src/**'`
 * — how a monorepo addresses its own packages — can be named by neither of the two
 * above: the absolute path carries the checkout's own location, and the
 * tsconfig-relative path has `apps/api/` stripped off the front. A project-relative
 * glob does NOT get it, deliberately; `readsRepoRelativePath` below owns that rule
 * and states why.
 *
 * ## Why the root comes from the element, not from the builder
 *
 * A predicate is constructed two ways that must not diverge:
 * `.that().resideInFolder(g)`, where the builder knows the project, and
 * `.that().satisfy(resideInFolder(g))`, where nothing does.
 * `tests/core/glob-declaration.test.ts` exists to assert the two spellings
 * agree, and threading the root through only the first would break that.
 *
 * Every `Located` element can reach its own `SourceFile`, and ts-morph carries
 * the tsconfig it was loaded from on the project's compiler options. So the
 * root is derived where the match happens, from the element itself, and both
 * spellings get it for free.
 *
 * `configFilePath` is `undefined` for a project built in memory or without a
 * tsconfig. That is a genuine "no root known" and normalization is skipped —
 * the glob keeps its absolute-only meaning rather than being matched against
 * something invented.
 */
import path from 'node:path'
import picomatch from 'picomatch'
import { discoverIdentityRoot, registerCacheReset } from '@nielspeter/eess/internal'
import type { Project as TsMorphProject, SourceFile } from 'ts-morph'

/**
 * Whether a glob can already match an absolute path, so the `**\/` hint would
 * be a no-op (or worse). Covers POSIX-absolute and Windows drive-absolute
 * globs as well as an explicit globstar.
 *
 * Lives here rather than in `glob-diagnosis.ts` (which re-exports it) because
 * `isProjectRelative` below is defined as its negation, and this module sits
 * under the one that diagnoses.
 */
export function isAnchored(glob: string): boolean {
  return isGlobstarLed(glob) || glob.startsWith('/') || /^[A-Za-z]:\//.test(glob)
}

/**
 * A glob that opens with `'**\/'` — "anywhere", the spelling `FAULT_ADVICE`
 * recommends.
 *
 * Named rather than inlined because two predicates in this file read it and they
 * must not become two lists: `isAnchored`, where it is one of three cases, and
 * `readsRootRelativePath`, where it is the case bug 0339 found missing. Not
 * exported — `isAnchored` is the answer any other module wants.
 */
function isGlobstarLed(glob: string): boolean {
  return glob.startsWith('**/')
}

/**
 * A glob carrying a `./` or `../` segment, anywhere in it.
 *
 * Extracted so `isProjectRelative` and `readsRootRelativePath` test it with ONE
 * regex. They are the two callers and they must agree: the whole point of the
 * exclusion is that `syntacticFault` reports `dot-segment` for such a glob, so a
 * second copy that drifted would let it match at runtime while the gate still
 * called it dead.
 */
function hasRelativeSegment(glob: string): boolean {
  return /(?:^|\/)\.\.?\//.test(glob)
}

/**
 * Does this glob name a location relative to the project root?
 *
 * Only an **unanchored, relative** glob is normalized. `'**\/x'` is explicitly
 * "anywhere" and must keep meaning that; `'/abs/x'` is already absolute. So
 * this is the same population `syntacticFault` calls `unanchored`, which is
 * what makes the two consistent: a glob stops being reported dead for being
 * unanchored exactly when it starts working.
 */
export function isProjectRelative(glob: string): boolean {
  // A `./` segment is excluded, and that exclusion is load-bearing rather than
  // fussy. `syntacticFault` reports `dot-segment` for a `./` anywhere in a
  // glob, so normalizing one would make the rule MATCH at runtime while the
  // gate still reported it dead — two derivations disagreeing about the same
  // glob, which is the failure this project spends most of its guards on.
  // Measured before this line existed: `'./src/domain/**'` selected 3 subjects
  // and produced a dead-selector finding in the same run.
  //
  // `./` is a mistake in both worlds — it never occurs in an absolute path and
  // it says nothing extra in a relative one — so the honest fix is to leave it
  // failing, with advice that says to remove it.
  // `..` is not relative-to-the-root in any usable sense: containment returns
  // `undefined` for anything above the root, deliberately, so a `../`
  // glob would normalize to nothing and be reported dead with three false
  // causes. Excluded alongside `./` — both are mistakes in both readings.
  if (hasRelativeSegment(glob)) return false
  // Derived from `isAnchored`, not restated. They were two lists and disagreed:
  // `isAnchored` recognises a drive-absolute `C:/x/**` and this did not, so a
  // Windows path was declared project-relative. Benign today — it still matches
  // the absolute path — but `base` is a function of this at three sites now,
  // and `base` affects the verdict.
  // `isAnchored` covers `/x`, `**/x` and a drive-absolute `C:/x` — the last of
  // which this used to miss, declaring a Windows path project-relative.
  if (isAnchored(glob)) return false
  // `*/x/**` is deliberately NOT normalized, even though it is unanchored.
  // Normalizing it would make it match, which sounds like an improvement until
  // you notice it is the LAST reachable `unanchored` fault for a path glob —
  // the anchor advice, and the whole `ANCHOR_ADVICE` grouping in the slice
  // discovery message, would become unreachable code. Left failing, with a
  // remedy that works: `'**/x/**'`.
  return !glob.startsWith('*/')
}

/**
 * The directory holding the tsconfig this element's project was loaded from.
 *
 * Forward slashes, no trailing separator — the same normalization
 * `path-universe.ts` applies, so the two cannot disagree about what the root
 * is. `undefined` when the project has no tsconfig.
 */
/**
 * Every directory a project was loaded from, by ts-morph `Project`.
 *
 * A **workspace has no single root.** `workspace([a, b])` sets
 * `ArchProject.tsConfigPath` to the alphabetically first config, so resolving
 * "the project root" from it silently meant *that one package*: measured on a
 * two-package workspace, `'src/api/**'` matched `packages/alpha` and not
 * `packages/beta`, and adding a package named `aaa` would have changed which
 * one it meant. That is the machine-dependent shape bug 0011 already cost this
 * project once — a rule scoped by a name nobody chose deliberately.
 *
 * So a file resolves against **the root that contains it**, and every root is
 * kept. For a single-tsconfig project there is one, and the behaviour is
 * exactly what it was.
 *
 * A `WeakMap` on the ts-morph project, because a predicate sees only an
 * element: `sourceFile.getProject()` is the one handle both the predicate and
 * the slice resolver can reach, and ts-morph itself records only the primary
 * config.
 */
const rootsByProject = new WeakMap<TsMorphProject, readonly string[]>()

/**
 * Record the directories a project was loaded from.
 *
 * Load-bearing for `workspace()`, which has several. For a single-tsconfig
 * `project()` it is **defence in depth and not independently observable**:
 * removing that call leaves every test green, because `rootOf` then falls
 * through to ts-morph's `configFilePath`, which agrees. Recorded rather than
 * papered over — a sabotage row that survives because the behaviour is
 * genuinely redundant is a different thing from a missing guard, and the next
 * person to see it green should not go hunting for a test to write.
 */
export function registerProjectRoots(
  tsMorphProject: TsMorphProject,
  tsConfigPaths: readonly string[],
): void {
  const roots = tsConfigPaths
    .map((configPath) => rootFromTsConfigPath(configPath))
    .filter((root): root is string => root !== undefined)
  if (roots.length > 0) rootsByProject.set(tsMorphProject, roots)
}

/**
 * The project root implied by a tsconfig path.
 *
 * Preferred wherever the caller holds the `ArchProject`, because it is the path
 * the user named rather than what ts-morph recorded — `getCompilerOptions()
 * .configFilePath` is `undefined` for an in-memory project even when the
 * `ArchProject` carries a perfectly good path, and normalization then silently
 * did not happen. The predicates cannot use this (they see only an element, by
 * design, so the builder and `.satisfy()` spellings cannot diverge); the slice
 * resolver can.
 */
export function rootFromTsConfigPath(tsConfigPath: string): string | undefined {
  if (tsConfigPath === '') return undefined
  const normalized = tsConfigPath.replaceAll('\\', '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash === -1) return undefined
  // A tsconfig AT the filesystem root gives `'/'`, not `''`. Returning `''`
  // overloaded one value with two meanings — "no root known" and "the root is
  // `/`" — and the three copies of this derivation disagreed about which:
  // measured on `/tsconfig.json`, the rule discovered its file and `diagnose()`
  // called the same glob dead, in one run. Reachable in a container that mounts
  // the repository at `/`.
  return lastSlash === 0 ? '/' : normalized.slice(0, lastSlash)
}

/** The prefix a path under `root` starts with. `'/'` is its own prefix. */
function prefixOf(root: string): string {
  return root === '/' ? '/' : `${root}/`
}

export function rootOf(sourceFile: SourceFile, fallbackTsConfigPath?: string): string | undefined {
  const filePath = sourceFile.getFilePath().replaceAll('\\', '/')

  // The registered root that CONTAINS this file, longest first — a nested
  // package's tsconfig must win over the repository's, or every file in it
  // resolves against the outer root and the inner one never applies.
  const registered = rootsByProject.get(sourceFile.getProject())
  if (registered !== undefined) {
    // Roots WERE registered for this project (a real `workspace()`) — fail
    // CLOSED here (ADR-009) rather than falling through to the generic fallback
    // below. That fallback resolves to the tie-break-winner's own tsconfig for a
    // `workspace()`-built project, which is a specific, plausible-looking, WRONG
    // answer for a file outside every registered package (a shared root-level
    // `.d.ts`, a broad `include`/`references` reaching outside a package's own
    // directory) — exactly the silent mis-scoping this module exists to
    // eliminate, just relocated to the edges. `fallbackTsConfigPath` doesn't
    // rescue it either: for a `workspace()` caller it is typically the primary
    // config's own path (see `resolveByDefinition`'s `project.tsConfigPath`), so
    // honoring it here would reintroduce the same bug through the back door.
    //
    // eess's own fix (plan 0148 Phase 1). The wholesale engine copy of plan 0165
    // reverted it to `if (best !== undefined) return best`, which reads as a
    // harmless guard and is in fact the fall-through. Pinned by
    // `tests/core/project-relative.test.ts` · `a file outside every registered
    // root of a real workspace() is unresolved, not silently the tie-break
    // winner`.
    const containing = registered
      .filter((root) => filePath.startsWith(prefixOf(root)))
      .sort((a, b) => b.length - a.length)
    return containing[0]
  }

  // A project built without going through `project()`/`workspace()` — a test
  // double, or an in-memory project, where ts-morph records no config path.
  if (fallbackTsConfigPath !== undefined) return rootFromTsConfigPath(fallbackTsConfigPath)
  const configFilePath = sourceFile.getProject().getCompilerOptions().configFilePath
  return typeof configFilePath === 'string' ? rootFromTsConfigPath(configFilePath) : undefined
}

/**
 * `absolutePath` relative to the project root, or `undefined` when it sits
 * outside the root or the root is unknown.
 *
 * Never `path.relative`, which emits `../../..` for a path above the root and
 * so encodes the root's depth — machine-dependent, and the mistake
 * `path-universe.ts` documents avoiding for the same reason.
 */
export function relativeToRoot(
  sourceFile: SourceFile,
  absolutePath: string,
  fallbackTsConfigPath?: string,
): string | undefined {
  const root = rootOf(sourceFile, fallbackTsConfigPath)
  if (root === undefined) return undefined
  const prefix = prefixOf(root)
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : undefined
}

/**
 * The identity root above a tsconfig directory, memoized.
 *
 * `discoverIdentityRoot` walks the filesystem with `existsSync`, and this sits
 * on the per-element match path, so it is cached by the directory asked about.
 * The cache is keyed by an absolute directory and holds at most one entry per
 * loaded project, so it is bounded by the rule file rather than by the corpus.
 *
 * The guard is on the INPUT, exactly as `disk-set.ts` does it and for the same
 * reason: `discoverIdentityRoot` calls `path.resolve`, so a relative input —
 * this suite's `'in-memory'` double, an `ArchProject` a user constructed by hand
 * — would walk up from the current working directory and answer with THIS
 * repository's root. That is a plausible-looking wrong answer rather than a
 * missing one, which is the shape ADR-009 rule 2 forbids.
 */
const repoRootCache = new Map<string, string | undefined>()
// Every other module-level cache in this dialect registers (`element-cache.ts`,
// `module-edges.ts`, `line-index.ts`, `descendant-cache.ts`), and
// `clearRegisteredCaches()` promises a consumer holding an `ArchProject` they built
// that a mutation is survivable. This cache is keyed by a STRING, so unlike
// `disk-set.ts`'s `WeakMap<ArchProject, …>` it outlives every project: in a watch
// run or an editor session a `git init`, a worktree move or a new
// `pnpm-workspace.yaml` would otherwise leave the matcher on the old root while
// `disk-set` walked the new one — the two-derivations disagreement again.
registerCacheReset(() => {
  repoRootCache.clear()
})

function repoRootOfDir(dir: string | undefined): string | undefined {
  if (dir === undefined) return undefined
  if (repoRootCache.has(dir)) return repoRootCache.get(dir)
  const discovered = path.isAbsolute(dir)
    ? discoverIdentityRoot(dir).replaceAll('\\', '/')
    : undefined
  repoRootCache.set(dir, discovered)
  return discovered
}

/**
 * The identity root for a project, from the path of its tsconfig.
 *
 * For the materializer in `path-universe.ts`, which holds the `ArchProject` and
 * no `SourceFile`. It must agree with `matchesPath`'s view or the diagnosis and
 * the runtime disagree about one glob — so both derive it here.
 */
export function repoRootOf(tsConfigPath: string): string | undefined {
  return repoRootOfDir(rootFromTsConfigPath(tsConfigPath))
}

/**
 * `absolutePath` named from the identity root — the `.git`/workspace root above
 * the tsconfig — or `undefined` when there is no such root or the path sits
 * outside it.
 *
 * This is the view a monorepo's own addressing needs: `'**\/apps/api/src/**'`
 * names segments BETWEEN the repository root and the tsconfig directory, so the
 * tsconfig-relative view has stripped off the very thing it names.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function relativeToRepoRoot(
  sourceFile: SourceFile,
  absolutePath: string,
  fallbackTsConfigPath?: string,
): string | undefined {
  const repoRoot = repoRootOfDir(projectTsConfigRoot(sourceFile, fallbackTsConfigPath))
  if (repoRoot === undefined) return undefined
  const prefix = prefixOf(repoRoot)
  return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : undefined
}

/**
 * The directory of the tsconfig the PROJECT was built from — not `rootOf`, which
 * answers with the registered package root containing this file.
 *
 * The difference is the whole of review finding 0348/customer-1, and it is not a
 * shortcut. `rootOf` fails CLOSED for a file outside every registered root — a
 * shared root-level `.d.ts`, or anything ts-morph pulls in across a package
 * boundary — because naming such a file from the wrong PACKAGE is a specific,
 * plausible-looking wrong answer. That reasoning does not transfer to the
 * identity root: it is the repository's, not the package's, so every file inside
 * the repository can be named from it whichever package owns it. Deriving it via
 * `rootOf` inherited the fail-closed exit and left the cross-package case exactly
 * as broken as this bug reports. Measured through the real `project()` API before
 * this function existed:
 *
 * | glob                  | under a dot-directory | beside one          |
 * | --------------------- | --------------------- | ------------------- |
 * | `'**\/apps/api/src/**'` | `thing.ts`          | `thing.ts`          |
 * | `'**\/apps/identity/**'` | **nothing**        | `jwt.service.ts`    |
 *
 * It is also what makes `path-universe.ts`'s claim true rather than aspirational:
 * the materializer derives the identity root from `project.tsConfigPath`, and
 * `workspace()` sets both that and the ts-morph project's own `configFilePath` to
 * the primary config, so the two now read the same input and cannot disagree
 * about one glob.
 */
function projectTsConfigRoot(
  sourceFile: SourceFile,
  fallbackTsConfigPath?: string,
): string | undefined {
  if (fallbackTsConfigPath !== undefined) return rootFromTsConfigPath(fallbackTsConfigPath)
  const configFilePath = sourceFile.getProject().getCompilerOptions().configFilePath
  return typeof configFilePath === 'string' ? rootFromTsConfigPath(configFilePath) : undefined
}

/**
 * Is this glob matched against the path named from the identity root, as well as
 * the two views above?
 *
 * ## Globstar-led only, and that is the whole ruling — bug 0348
 *
 * `'**\/x'` says **anywhere**. The only reason it fails to match a file under a
 * checkout like `~/.worktrees/repo` is picomatch's default `dot: false` applied
 * to a prefix the author does not own — where the repository happens to sit on
 * this machine. Naming the path from the repository root removes exactly that
 * prefix and nothing else, so the glob gets to mean what it says. It is the same
 * authorship argument [bug 0349](../../../../work/bugs/fixed/0349-a-path-shaped-dependency-ban-passes-silently-under-pnpm-and-yarn.md)
 * makes for a package manager's layout: a verdict must not be decided by where
 * things sit on disk.
 *
 * A **project-relative** glob (`'src/**'`) is deliberately excluded, and this is
 * the exclusion that keeps the fix from being a widening. That spelling MEANS
 * "relative to the project root", and `core/project-relative.ts`'s first job is
 * that the project root is the tsconfig's directory. Offering it an identity-root
 * view would make one spelling name two different directories in a monorepo —
 * `packages/api/src/` and the repository's own `src/` — which is a second meaning
 * for one glob with no bug behind it. Pinned by `a-glob-above-the-tsconfig-root.test.ts`
 * · `it('CONTROL: a glob relative to the package root keeps meaning the package root')`.
 *
 * Project-relative globs need nothing here anyway: their second view is already
 * free of the checkout path, which is why bug 0339 fixed them and left this.
 *
 * ## Why this adds no matches except the broken ones
 *
 * The identity-relative path is a SUFFIX of the absolute path. For a glob led by
 * `'**\/'`, if it matches the suffix it also matches the whole — unless some
 * segment of the stripped prefix begins with `.`, which is precisely the defect.
 * So under a checkout with no dot-segment the third view selects nothing the
 * first did not. Measured rather than argued: `it('adds no match under a
 * checkout with no dot-segment')` compares every file in a fixture with the view
 * on and off.
 */
export function readsRepoRelativePath(glob: string): boolean {
  // Defence in depth, and NOT independently observable — stated the way
  // `registerProjectRoots` states the same thing, so the next reader does not go
  // hunting for a test. `isGlobstarLed` already excludes a leading `./` or `../`
  // (neither is `'**\/'`-led), and a mid-glob `/./` or `/../` is a literal segment
  // picomatch matches against nothing in any view. Measured in review over
  // `'**\/./apps/api/src/**'`, `'**\/../identity/src/**'` and `'**\/apps/./api/src/**'`:
  // dropping this line changes `readsRepoRelative` from false to true and changes
  // no verdict. It is kept because the two gates in this file must agree about what
  // a relative segment is, not because it is reachable today.
  if (hasRelativeSegment(glob)) return false
  return isGlobstarLed(glob)
}

/**
 * Is this glob matched against the path named from the project root, as well as
 * the absolute path?
 *
 * ## The case that was missing — bug 0339
 *
 * This used to be `isProjectRelative` alone, so `'**\/src/**'` — the one
 * spelling `FAULT_ADVICE` tells the author to write — was the one spelling that
 * never got the second view. picomatch's default `dot: false` stops `**`
 * crossing a segment that begins with `.`, and these globs are matched against
 * an ABSOLUTE path, so a checkout under `~/.tool/worktrees/app` (a worktree
 * manager's layout, a cache directory, some CI workspaces) selected **nothing**
 * for every rule. Measured on 0.7.0 over one fixture copied to two paths:
 * `resideInFile('**\/src/**')` examined 0 subjects under a dot-segment and 1
 * beside it, and ADR-010's guard then reported correct rules as enforcing
 * nothing — with a remedy that says to widen the selector or declare it empty.
 *
 * It was also the last disagreement with the DIAGNOSIS: `viewsFor` takes
 * satisfiability against the **union** of the absolute and tsconfig-relative
 * views, unconditionally. So a `'**\/src/**'` under a dot-directory was live to
 * `isDeadSite` and dead at runtime — two derivations disagreeing about one glob,
 * which is the failure this file spends most of its guards on.
 *
 * ## Why this is not simply "every glob"
 *
 * Removing the gate outright was tried, and this repository's own controls
 * refused it — both exclusions `isProjectRelative` makes are load-bearing, and
 * neither is about anchoring:
 *
 * - a `./` segment stays excluded, because `syntacticFault` reports
 *   `dot-segment` for it. picomatch matches `'./src/domain/**'` against
 *   `src/domain`, so offering the view reinstates exactly the split verdict
 *   `isProjectRelative`'s own comment records: 3 subjects selected AND a dead
 *   selector reported, in one run. `../` is excluded alongside it and is a
 *   DIFFERENT fault — `syntacticFault`'s dot-segment test is `/(?:^|\/)\.\//`,
 *   which `'../src/**'` does not match, so it is reported `unanchored` instead.
 *   The exclusion is right either way (nothing above the root has a second view,
 *   so no match is forged); it is the fault name that differs, and this comment
 *   claimed one rule for two shapes.
 * - `'*\/x/**'` stays excluded, because it is the last reachable `unanchored`
 *   fault for a path glob. Normalizing it made the anchor advice and the whole
 *   `ANCHOR_ADVICE` grouping unreachable — measured as seven failures in
 *   `tests/builders/slice-rule-builder.test.ts`, whose subject is that each
 *   remedy is TRUE.
 *
 * `'/abs/x'` and a drive-absolute `'C:/x'` are excluded too, and there it makes
 * no behavioural difference — neither can match a relative path — but the
 * declaration stays honest about what is tried.
 *
 * So the rule is: the root-relative view is offered to a glob that names a
 * location relative to the root, and to one that says "anywhere". Both readings
 * are location-independent, which is the property the bug was about.
 */
export function readsRootRelativePath(glob: string): boolean {
  if (hasRelativeSegment(glob)) return false
  return isProjectRelative(glob) || isGlobstarLed(glob)
}

/**
 * A compiled path glob: the matcher, and whether it reads the root-relative
 * view.
 *
 * Both together, because the decision is a function of the glob and the sites
 * that match several globs at once would otherwise carry a parallel array of
 * booleans. Deciding it once per glob rather than once per path also keeps
 * `picomatch()` and `readsRootRelativePath()` off the per-element path.
 */
export interface PathGlobMatcher {
  readonly glob: string
  readonly isMatch: picomatch.Matcher
  readonly readsRootRelative: boolean
  readonly readsRepoRelative: boolean
}

/** Compile one path glob. */
export function pathGlobMatcher(glob: string): PathGlobMatcher {
  return {
    glob,
    isMatch: picomatch(glob),
    readsRootRelative: readsRootRelativePath(glob),
    readsRepoRelative: readsRepoRelativePath(glob),
  }
}

/** Compile several path globs, in order. */
export function pathGlobMatchers(globs: readonly string[]): PathGlobMatcher[] {
  return globs.map((glob) => pathGlobMatcher(glob))
}

/**
 * Does this glob match this path — absolutely, or named from the project root?
 *
 * The one place a path glob meets a path **where a `SourceFile` is in hand**.
 * `disk-set.ts` reimplements the decision inline over walked disk paths, which
 * have no `SourceFile` and are named from a root of their own — that copy is
 * deliberate and is marked as such there, so this is not "the only place" and
 * saying so would leave the next reader trusting a claim with a second copy
 * behind it.
 *
 * Every site that matched a file path against a glob had its own copy of this
 * three-line decision and they disagreed. Over the ten that carry a sabotage row
 * in bug 0339, measured at 0.7.0: **three** offered the second view only for a
 * project-relative glob (`predicates/identity.ts`, `cross-layer-builder.ts`,
 * `slice.ts`'s `resolveByDefinition`), **one** offered it always
 * (`duplicate-bodies.ts`), and **six** never offered it at all. Bug 0339 was in
 * the last group's shape and bug 0036 in the first's.
 * `conditions/reverse-dependency.ts` also offered it always and needed no
 * change, so it has no row.
 *
 * `undefined` from `relativeToRoot` (no root known, or a file above the root) is
 * a genuine "there is no second view" and yields the absolute answer rather than
 * an invented one.
 */
export function matchesPath(
  matcher: PathGlobMatcher,
  sourceFile: SourceFile,
  absolutePath: string,
  fallbackTsConfigPath?: string,
): boolean {
  if (matcher.isMatch(absolutePath)) return true
  if (matcher.readsRootRelative) {
    const fromRoot = relativeToRoot(sourceFile, absolutePath, fallbackTsConfigPath)
    if (fromRoot !== undefined && matcher.isMatch(fromRoot)) return true
  }
  // The third view, and the last one — bug 0348. The ORDER here is not a semantic:
  // this is a boolean disjunction, so trying the repo root first would give the same
  // answer, and review confirmed a row that reorders the branches reds nothing. What
  // narrows the third view is `readsRepoRelativePath` alone — only a glob that says
  // "anywhere" reaches this line, because a glob naming a location relative to the
  // project must be decided by the project.
  if (!matcher.readsRepoRelative) return false
  const fromIdentityRoot = relativeToRepoRoot(sourceFile, absolutePath, fallbackTsConfigPath)
  return fromIdentityRoot !== undefined && matcher.isMatch(fromIdentityRoot)
}

/**
 * Does ANY of these globs match this path?
 *
 * Never `matchers.some(isMatch)` at a call site: picomatch takes the array index
 * as its second argument and returns a truthy object from index 1 onwards, so
 * the shorthand reports a match for every path in a list of two or more. Four
 * files in `src/` carry a comment warning about it; this is the version that
 * cannot be written the other way.
 */
export function anyMatchesPath(
  matchers: readonly PathGlobMatcher[],
  sourceFile: SourceFile,
  absolutePath: string,
  fallbackTsConfigPath?: string,
): boolean {
  return matchers.some((matcher) =>
    matchesPath(matcher, sourceFile, absolutePath, fallbackTsConfigPath),
  )
}
