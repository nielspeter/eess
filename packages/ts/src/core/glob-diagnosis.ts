import picomatch from 'picomatch'
import type { GlobSite } from '@nielspeter/eess'
import type { PathUniverse } from './path-universe.js'
import type { DiskSet, OnDisk } from './disk-set.js'
import { contradictsAbsence } from './disk-set.js'

/**
 * Why a glob matches nothing.
 *
 * Two of these name a cause, and only because the fix is a transformation that
 * can be *verified*: removing `./`, and adding the `**\/` anchor. A third,
 * `file-not-folder`, is verifiable in the other direction — the glob matches a
 * file and no directory, and the predicate reads directories. Everything else
 * falls into `no-match`, which lists likely causes without asserting one.
 *
 * That restraint is deliberate and was learned the hard way. Earlier revisions
 * asserted a specific cause — "the directory does not exist", "append `/**`" —
 * and each was false on a reachable input: a glob targeting a file, a
 * directory whose name ends in `]`, a path that plainly existed. Under ADR-008
 * a confidently wrong cause is worse than an honest list, because the agent
 * acts on it.
 */
export type GlobFault = 'dot-segment' | 'unanchored' | 'file-not-folder' | 'no-match'

interface GlobDiagnosis {
  readonly fault: GlobFault
  readonly onDisk?: OnDisk
}

/** Where the glob conventions these messages talk about are documented. */
export const GLOB_DOCS = 'https://github.com/nielspeter/eess/blob/main/docs/slices.md'

/**
 * Whether a glob can already match an absolute path.
 *
 * Defined in `project-relative.ts` and re-exported here, where its callers are.
 * It has to live at the lower level: `isProjectRelative` is defined as its
 * negation, and importing it upward from there closed a cycle —
 * `disk-set -> path-universe -> glob-diagnosis -> project-relative -> project
 * -> disk-set`, caught by this repository's own `beFreeOfCycles` rule. The
 * predicate is pure string syntax with no dependencies, so the lower level is
 * where it belonged anyway.
 */
export { isAnchored } from './project-relative.js'
import { isAnchored } from './project-relative.js'

/**
 * The faults decidable from the glob string alone, with no project to compare
 * against.
 *
 * Split out because two callers need exactly this and nothing more: the
 * `assignedFrom()` message, which groups entries by cause before any universe
 * is available, and `diagnoseGlob` below. One source of truth for the syntax
 * rules, so the two can never drift into disagreeing about what `./src/**` is.
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

  // Exempt for the kinds that are not paths: after the bug 0014 fix,
  // `notImportFrom('fastify')` is a working rule and `isAnchored('fastify')`
  // is false.
  const isPathKind = kind === 'file-path' || kind === 'parent-dir'

  // And exempt for the bases where a relative glob is the CORRECT spelling.
  // `slices().matching()` strips and re-adds the anchor, and `resolvers()`
  // resolves against the tsconfig directory; telling either of them to anchor
  // would be telling the user to break a working rule.
  if (isPathKind && base === 'absolute' && !isAnchored(glob)) return 'unanchored'
  return undefined
}

/**
 * Diagnose one unsatisfiable glob.
 *
 * Call only on a site already known to be dead — this explains a fault, it
 * does not detect one. Keeping detection (`isDeadSite`) and explanation apart
 * is what stops the disk walk from ever becoming a *trigger*: a project with
 * no faults never touches the filesystem.
 *
 * Each fault has a different fix, so they are reported separately. A message
 * that lumps them together, or reports only the first kind it finds, sends the
 * caller through repeated failing runs.
 */
export function diagnoseGlob(
  site: GlobSite,
  universe: PathUniverse,
  diskSet?: DiskSet,
): GlobDiagnosis {
  const syntactic = syntacticFault(site.glob, site.kind, site.base)
  if (syntactic) return { fault: syntactic }

  // A `parent-dir` glob that matches a FILE and no directory is the
  // `resideInFolder` mistake: the predicate reads the directory portion, so a
  // glob written at a file can never match. Verifiable, and therefore safe to
  // assert — measured instance: '**/src/predicates/module**' matches 1 file
  // and 0 parent directories.
  // The project's own files answer this for a path inside it; the DISK answers it for a path
  // outside, which the universe cannot see. Without the second half the fault was invisible
  // for an out-of-project file and the author was offered a tsconfig `include` that can never
  // make a directory read match a file — [bug 0363](../../../../work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md).
  // `matchesOnlyFiles` answers `false` when the walk cannot say, so this never claims the
  // fault without evidence.
  if (
    site.kind === 'parent-dir' &&
    (matchesAny(site.glob, universe.filePaths) || diskSet?.matchesOnlyFiles?.(site.glob) === true)
  ) {
    return { fault: 'file-not-folder' }
  }
  if (site.kind === 'file-path' && matchesAny(site.glob, universe.parentDirs)) {
    return { fault: 'file-not-folder' }
  }

  return { fault: 'no-match', onDisk: diskSet?.classify(site.glob) ?? 'not-determined' }
}

/**
 * WHY a dead site on a cardinality rule is a real fault — the route, not a boolean.
 *
 * One owner, consulted by the admission gate AND by both tools' messages, so the reason a
 * finding was admitted and the reason its message gives cannot be two different derivations.
 * Before this, the gate asked `classify(glob)` directly while the message read
 * `diagnosis.onDisk`, and the two disagree for `file-not-folder`: the gate admitted the
 * finding *because the disk contradicted the claim* and the message then offered to widen a
 * tsconfig `include`, which can never make a glob naming a FILE match a directory read
 * ([bug 0363](../../../../work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)).
 *
 * `undefined` means "not a fault" — a holding ratchet, which is the common case and must stay
 * green. Exhaustive over `GlobFault` **by the `never` witness in the default branch**, not by
 * the shape of the switch — a distinction that was got wrong here and measured by architecture
 * review. Because `undefined` is a legal return value, a switch missing a case falls off the end
 * and **compiles**, so a fifth fault became silently "not a fault"; the module reddened at
 * `FAULT_ADVICE` instead, a different line with a different fix. `isFaultPosition`
 * (`packages/core/src/glob-site.ts:86`) carries the same witness for the same reason.
 *
 * _`contradictsAbsence` was cited here as a model and should not have been: it also compiles
 * clean against a fifth `OnDisk`. What is exhaustive there is the TEST enumerating the union,
 * not the function._
 */
export type DeadSiteRoute = 'syntactic' | 'names-a-file' | 'contradicted-by-disk'

export function deadSiteRoute(diagnosis: GlobDiagnosis): DeadSiteRoute | undefined {
  switch (diagnosis.fault) {
    case 'dot-segment':
    case 'unanchored':
      return 'syntactic'
    case 'file-not-folder':
      return 'names-a-file'
    case 'no-match':
      // The disk is the only thing that can tell a holding ratchet from a broken selector here,
      // and `contradictsAbsence` owns WHICH classification counts — `disk-set.ts` carries the
      // four-row table saying why `holds-typescript` is the only admitting answer.
      return diagnosis.onDisk !== undefined && contradictsAbsence(diagnosis.onDisk)
        ? 'contradicted-by-disk'
        : undefined
    default: {
      // The witness, not a comment claiming one. Measured with the repo's own `tsc`: without
      // this, a fifth `GlobFault` left the function at exit 0 returning `undefined` — "not a
      // fault" — and the predecessor `isSyntacticFault(fault): boolean` could not have.
      const exhaustive: never = diagnosis.fault
      return exhaustive
    }
  }
}

/**
 * The remedy a CARDINALITY rule gets on each route, owned once.
 *
 * `check` puts this in `suggestion` (the `Fix:` line) and `doctor` appends it to its own
 * advice, so the two cannot drift — which is
 * [bug 0364](../../../../work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md):
 * three rounds of work on what this sentence must say reached only the tool an adopter
 * reaches second.
 *
 * **None of them offers deletion.** On a finding no filter can suppress, deletion is the only
 * achievable exit, and the rule is the thing that noticed — so an instruction to delete it is
 * the ADR-009 rule 2 defect this family has already shipped once.
 */
export const CARDINALITY_REMEDY: Readonly<Record<DeadSiteRoute, string>> = {
  // The tsconfig cannot help: the glob matches nothing in any project.
  syntactic: 'Correct the selector — this rule has not been enforcing anything. Do not delete it.',
  // The tsconfig cannot help either, for a different reason: the predicate reads the
  // directory portion and the glob names a file, so no `include` makes it match.
  //
  // **The rule for this table, stated where a table author will see it:** the CAUSE in
  // `FAULT_ADVICE` owns the concrete edit, and a route remedy here must neither repeat it nor
  // choose between its options. For a cardinality rule the `Fix:` line is `${cause}. ${remedy}`,
  // so anything said here is said a second time, and the remedy is the LAST sentence — where an
  // agent reading `Fix:` acts.
  //
  // History, kept because it is the argument for getting this wrong again. 0363's review had this
  // name `resideInFile()` verbatim, which duplicated the cause in one sentence. Bug 0372's first
  // fix removed that by saying "name the DIRECTORY you mean" — and product review measured the
  // consequence: the cause offers TWO edits (`resideInFile()` for a file, `/**` for a directory),
  // and a last sentence naming only one of them overrides the cause. For a `.notExist()` rule,
  // meaning a file is the common case ("legacy/old.ts must not come back"), and an agent told to
  // name a directory widens the rule to the parent folder — changing what it asserts. So it
  // defers to the cause's choice instead, and stays a distinct sentence from `syntactic` so a
  // hand-rolled copy of this table remains detectable (0363's S7).
  // See [bug 0372](../../../../work/bugs/fixed/0372-the-file-not-folder-sentence-says-it-can-never-match-twice.md).
  'names-a-file':
    'Apply whichever of those two fixes you meant — this rule has not been enforcing anything. ' +
    'Do not delete it.',
  'contradicted-by-disk':
    'Widen the tsconfig include to cover this path, or correct the selector — ' +
    'do not delete this rule, it is what detected the gap.',
}

/**
 * Does the route's fault hold in EVERY project, or only in this one?
 *
 * A property of the glob text for the syntactic and file-naming routes, and of this project's
 * `include` for the disk route. "in this project" understates the first two by exactly the
 * scope that invites a tsconfig reading.
 */
export const ROUTE_HOLDS_IN_ANY_PROJECT: Readonly<Record<DeadSiteRoute, boolean>> = {
  // Decidable from the glob TEXT, with no filesystem and no project: `'./src/**'` matches
  // nothing anywhere.
  syntactic: true,
  // **False, and a first draft had it true.** The fault is contingent on what is on disk: the
  // same glob matches fine in a project where that name is a directory rather than a file. The
  // pinning row in `doctor-and-check-agree-about-a-ratchet.test.ts` caught the error — it
  // exists precisely because that route is the one input separating this claim from a
  // constant, and asserting "any project" there would be confidently wrong.
  'names-a-file': false,
  // Contingent on this project's `include`.
  'contradicted-by-disk': false,
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
  // NO scope claim here — the headline owns scope, and states it correctly as "in this project"
  // (the same text matches fine where that name is a directory). A cause that also states scope
  // can only repeat the headline or contradict it. The first version said "so it can never
  // match", unqualified; the second qualified it "as a folder glob", which product review showed
  // is STILL universal — `**/src/domain/user.ts` matches as a folder glob where `user.ts` is a
  // directory. Qualifying by shape fixed the wrong axis. "Used where a directory is read"
  // already says why it fails here — [bug 0372](../../../../work/bugs/fixed/0372-the-file-not-folder-sentence-says-it-can-never-match-twice.md).
  'file-not-folder':
    'this matches a FILE but is used where a directory is read — use resideInFile() for a file, or append "/**" to name the files inside a directory',
  'no-match':
    'these are anchored but matched no file. Common causes: the glob names a directory rather than the files inside it (append "/**"), a path segment is misspelled, or the directory holds no source files',
}

/**
 * What the filesystem adds, when it adds anything.
 *
 * Stated as a fact and never as a remedy. Every candidate remedy here is wrong
 * on a reachable input: "add it to your tsconfig `include`" is wrong for
 * `dist/`, for codegen output, and absurd for the Rust crate that a real
 * TypeScript monorepo turned out to contain. So this contributes the fact and
 * its own two causes, rather than deferring to `no-match`'s list — two of
 * whose three causes are refuted by the fact printed one line above.
 */
export const ON_DISK_ADVICE: Readonly<Record<OnDisk, string>> = {
  'holds-typescript':
    'this path exists and contains TypeScript, but your tsconfig include/exclude keeps it out of the project',
  'no-typescript': 'this path exists but contains no TypeScript',
  // Bug 0032. This was `''`, so a verified absence deferred to `no-match`'s
  // list — the exact deferral the paragraph above rules out, and two of that
  // list's three causes are refuted by the fact: there is no directory, so
  // "append /**" and "holds no source files" are both false.
  //
  // TWO CORRECTIONS FROM REVIEW OF THE FIRST FIX, both of which made this
  // string a new confidently-wrong message while removing an old one:
  //
  // 1. It said "nothing matching this exists on disk" — a universal claim the
  //    walk cannot support. `absent` means "not found in a BOUNDED walk" from
  //    `discoverIdentityRoot`, with pruned directory names and unreadable
  //    directories dropped. Measured false on two reachable inputs: a sibling
  //    package outside the identity root (a monorepo checkout with no `.git`,
  //    which `identity-root.ts` itself documents), and a real directory whose
  //    name holds glob metacharacters. So the claim is scoped to the search.
  // 2. It offered "a folder you have not created yet — banning one
  //    pre-emptively is legitimate", borrowed from plan 0072. But 0072's case
  //    is a `notImportFrom`, a CONDITION glob, and `diagnose()` drops
  //    condition and exclusion positions before reaching here. This string is
  //    printed only for `selector` and `discovery`, where a glob matching
  //    nothing means the rule has no subjects — the false green 0069 is named
  //    after and R3b will fail the build on. It told the agent that was fine.
  //
  // The metacharacter cause is `slice-rule-builder.ts`'s, verbatim in
  // substance, because it already states it for `check` — the same
  // one-fact-two-texts trap this fix fell into elsewhere.
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
