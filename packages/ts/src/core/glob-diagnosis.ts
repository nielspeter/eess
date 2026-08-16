import picomatch from 'picomatch'
import type { GlobSite, PathUniverse, DiskSet, OnDisk } from '@nielspeter/eess'
import { isAnchored } from '@nielspeter/eess'

/**
 * Why a glob matches nothing.
 *
 * Two of these name a cause, and only because the fix is a transformation
 * that can be *verified*: removing `./`, and adding the `**\/` anchor. A
 * third, `file-not-folder`, is verifiable in the other direction — the glob
 * matches a file and no directory, and the predicate reads directories.
 * Everything else falls into `no-match`, which lists likely causes without
 * asserting one.
 *
 * That restraint is deliberate. Asserting a specific cause — "the directory
 * does not exist", "append `/**`" — is false on a reachable input: a glob
 * targeting a file, a directory whose name ends in `]`, a path that plainly
 * exists. A confidently wrong cause is worse than an honest list, because
 * the reader acts on it.
 */
export type GlobFault = 'dot-segment' | 'unanchored' | 'file-not-folder' | 'no-match'

export interface GlobDiagnosis {
  readonly fault: GlobFault
  readonly onDisk?: OnDisk
}

/**
 * The faults decidable from the glob string alone, with no project to
 * compare against.
 *
 * Split out because more than one caller needs exactly this and nothing
 * more — a message that groups dead globs by cause before any universe is
 * available, and `diagnoseGlob` below. One source of truth for the syntax
 * rules, so the two can never drift into disagreeing about what `./src/**`
 * is.
 */
export function syntacticFault(
  glob: string,
  kind: GlobSite['kind'],
  base: GlobSite['base'] = 'absolute',
): 'dot-segment' | 'unanchored' | undefined {
  // A './' anywhere — not just leading — makes the glob unmatchable, and
  // adding '**/' in front of it does not help ('**/./src/**' still matches
  // nothing). True for every base.
  if (/(?:^|\/)\.\//.test(glob)) return 'dot-segment'

  // Exempt for the kinds that are not paths: `notImportFrom('fastify')` is a
  // working rule and `isAnchored('fastify')` is false.
  const isPathKind = kind === 'file-path' || kind === 'parent-dir'

  // And exempt for the bases where a relative glob is the CORRECT spelling —
  // a base whose entry point strips and re-adds the anchor, or resolves
  // against a different root; telling either of them to anchor would be
  // telling the user to break a working rule.
  if (isPathKind && base === 'absolute' && !isAnchored(glob)) return 'unanchored'
  return undefined
}

/**
 * Diagnose one unsatisfiable glob.
 *
 * Call only on a site already known to be dead (via `isDeadSite`) — this
 * explains a fault, it does not detect one. Keeping detection and
 * explanation apart is what stops a disk walk from ever becoming a
 * *trigger*: a project with no faults never touches the filesystem.
 *
 * Each fault has a different fix, so they are reported separately. A
 * message that lumps them together, or reports only the first kind it
 * finds, sends the caller through repeated failing runs.
 */
export function diagnoseGlob(
  site: GlobSite,
  universe: PathUniverse,
  diskSet?: DiskSet,
): GlobDiagnosis {
  const syntactic = syntacticFault(site.glob, site.kind, site.base)
  if (syntactic) return { fault: syntactic }

  // A `parent-dir` glob that matches a FILE and no directory is a common
  // mistake for a directory-matching predicate: it reads the directory
  // portion, so a glob written at a file can never match.
  if (site.kind === 'parent-dir' && matchesAny(site.glob, universe.filePaths)) {
    return { fault: 'file-not-folder' }
  }
  if (site.kind === 'file-path' && matchesAny(site.glob, universe.parentDirs)) {
    return { fault: 'file-not-folder' }
  }

  return { fault: 'no-match', onDisk: diskSet?.classify(site.glob) ?? 'not-determined' }
}

/**
 * The remedy for each fault, or an honest list of causes where no remedy is
 * verifiable.
 */
export const FAULT_ADVICE: Readonly<Record<GlobFault, string>> = {
  'dot-segment':
    'a "./" segment never occurs in an absolute file path — remove it and anchor instead ("./src/x/**" -> "**/src/x/**")',
  unanchored:
    'these are matched against ABSOLUTE file paths, so a project-relative glob matches nothing — prefix these with "**/"',
  'file-not-folder':
    'this matches a FILE but is used where a directory is read, so it can never match — match the file directly, or append "/**" to name the files inside a directory',
  'no-match':
    'these are anchored but matched no file. Common causes: the glob names a directory rather than the files inside it (append "/**"), a path segment is misspelled, or the directory holds no source files',
}

/**
 * What the filesystem adds, when it adds anything.
 *
 * Stated as a fact and never as a remedy. Every candidate remedy here is
 * wrong on a reachable input: "add it to your tsconfig include" is wrong
 * for a build-output directory, for codegen output, or for a non-TypeScript
 * package a real monorepo happens to also hold. So this contributes the
 * fact and its own two causes, rather than deferring to `no-match`'s list —
 * two of whose three causes are refuted by the fact printed one line above.
 */
export const ON_DISK_ADVICE: Readonly<Record<OnDisk, string>> = {
  'holds-typescript':
    'this path exists and contains TypeScript, but your tsconfig include/exclude keeps it out of the project',
  'no-typescript': 'this path exists but contains no TypeScript',
  // A verified absence deferred to `no-match`'s cause list would be a
  // confidently-wrong non-answer: there is no directory, so "append /**" and
  // "holds no source files" are both false. `absent` means "not found in a
  // BOUNDED walk", scoped to the search rather than a universal claim.
  absent:
    'no file or directory matching this was found under the project root (build and vendor directories are not searched, so a path inside one is not seen) — a path segment does not match what is on disk, or a literal "(", ")", "{", "}" or "!" in a folder name is being read as pattern syntax rather than a literal character, in which case match that level with "*" instead',
  // Stays empty, and is NOT the same case as `absent` above despite looking
  // identical. Here the walk was pruned, so no fact is known — deferring to
  // `no-match`'s cause list is the honest move rather than a gap.
  'not-determined': '',
}

function matchesAny(glob: string, candidates: readonly string[]): boolean {
  const isMatch = picomatch(glob)
  // Never `candidates.some(isMatch)` — picomatch reads the array index as its
  // second argument and returns a truthy object from index 1 onwards.
  return candidates.some((candidate) => isMatch(candidate))
}
