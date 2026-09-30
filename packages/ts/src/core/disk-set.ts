import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import type { ArchProject } from './project.js'
import { byCodepoint, discoverIdentityRoot } from '@nielspeter/eess/internal'
import { readsRootRelativePath, rootFromTsConfigPath } from './project-relative.js'

/**
 * Directories never worth walking.
 *
 * `node_modules` and `.git` dominate the cost. The build-output names are here
 * because a walk that reports `dist/` as "absent from the project" is noise,
 * not a finding. The list cannot be complete — a real TypeScript monorepo may
 * hold a Rust `target/`, a Python `.venv`, a `.gradle` — which is why the
 * entry budget below exists rather than a longer list.
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
  // Added for bug 0359. Pruning — not repository size — is what decides whether
  // the walk finishes: measured on this repository, the list above removes
  // **88.9%** of entries, and unpruned this small repo would sit at 41% of the
  // old 50,000 budget by itself (spike 0368). The list named fourteen and missed
  // the one that mattered — an adopter's `.wrangler` was **58% of their entries**
  // in the monorepo that measured closest to the budget.
  //
  // Only the FIRST of these has a measured share; the rest are the same class of
  // thing — build, cache and framework output no rule can usefully scope to — and
  // are cheap to prune. Named individually rather than matched by a leading dot,
  // because `.claude/`, `.changeset/` and `.github/` are content this repo's own
  // corpus gate reads.
  '.wrangler',
  '.svelte-kit',
  '.nuxt',
  '.output',
  '.parcel-cache',
  '.vite',
  '.astro',
  '.docusaurus',
  '.serverless',
  '.terraform',
  'storybook-static',
  '.pnpm-store',
  '.angular',
  '.expo',
  '.dart_tool',
  '.sst',
])

/**
 * How many directory entries the walk will read before giving up.
 *
 * An implementation constant, not part of the public contract and not
 * tunable. It exists because the walk is unbounded in principle: a
 * contributor who has run `cargo build` inside a TypeScript monorepo has tens
 * of thousands of entries under one directory, and a *failing* run that then
 * hangs inside a 5s vitest timeout is a worse experience than the false green
 * this whole mechanism exists to remove.
 *
 * ## Exhaustion is VERDICT-BEARING since 0355. It did not used to be.
 *
 * This docstring used to end "above the budget the classification degrades to
 * `not-determined`, which costs message quality and nothing else — the
 * enrichment is already fail-open." **That is no longer true**, and the sentence
 * was a licence to lower the budget on the belief that nothing but wording
 * depended on it.
 *
 * `absenceClaimIsContradicted` below consumes this classification to decide
 * whether a cardinality rule (`.notExist()` and friends) reports at all. And the
 * degradation is **whole-set, not per-glob** — `build()` returns the single
 * `UNDETERMINED` object, whose `classify` answers `not-determined` for every
 * glob, and it is memoized per project. So one repository above the budget
 * silences that gate for *every* cardinality rule in the run at once, for a
 * reason that has nothing to do with any of their paths.
 *
 * That is not a regression — before 0355 those rules were silent everywhere —
 * but it is an undisclosed limit on a fix, and nothing currently reports that
 * the walk gave up. Surfacing exhaustion is
 * [bug 0359](../../../../work/bugs/fixed/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
 * and it is now surfaced: `exhaustion` on the returned `DiskSet` carries the
 * fact and what consumed the walk, and the cardinality path reports it rather
 * than going quiet.
 *
 * ## Why 500,000, and why the old 50,000 was far too low
 *
 * The justification above is a claim about TIME — a 5s vitest timeout. Measured
 * at **2.09 µs/entry** (spike 0367; spike 0360 got 1.55 µs/entry by a different
 * method, which is what makes either trustworthy), 50,000 entries is about
 * **105 ms of work**. The cutoff fired roughly **48× below its own stated
 * reason**, and silenced a gate to do it.
 *
 * 500,000 is 0.8–1.5s warm (spike 0360) and puts every repository measured so
 * far far inside it: this one at ~2,300 entries after pruning, an adopter's
 * 15-package monorepo at 16,770. **Not unbounded** — the cold-cache cost is
 * still unmeasured, which is exactly why 0360 declined to recommend removing the
 * bound, and raising it is supported by measurement where removing it is not.
 *
 * Anyone changing this number: it is the threshold at which a shipped gate stops
 * being able to answer. It no longer does so silently, which is the fix — but a
 * reported degradation is still a degradation. Measure before you lower it.
 */
const ENTRY_BUDGET = 500_000

// `.d.ts` and its `.d.mts`/`.d.cts` siblings count. They ARE TypeScript for
// the question this set answers — "does this path contain TypeScript your
// tsconfig is keeping out" — and excluding them made a `types/` directory of
// pure declarations report "this path exists but contains no TypeScript",
// which is false.
const TS_FILE = /\.(m|c)?tsx?$/

/**
 * What the filesystem says about a glob that the compiler's file set does not.
 *
 * Only populated for `no-match` — the other faults are syntactic and the disk
 * has nothing to add. `not-determined` is the honest answer above the walk's
 * entry budget, or where the walk refused to look.
 *
 * Declared here rather than in `glob-diagnosis.ts` because this is the module
 * that produces it: the other way round made the two files import each other.
 * Both edges were `import type` and therefore erased at runtime — but our own
 * `arch/no-cycles` rule slices by directory, so it could not see a cycle
 * INSIDE `core/`, and a per-file slicing in a test found it immediately. A
 * cycle nothing can see is the shape this whole plan is about.
 */
export type OnDisk = 'holds-typescript' | 'no-typescript' | 'absent' | 'not-determined'

/**
 * What the filesystem knows that the compiler's file set does not.
 *
 * The second derivation ADR-009 rule 5 asks for: filesystem contents versus
 * compiler membership. It is what distinguishes "your glob is misspelled" from
 * "your glob is fine and your tsconfig scope excludes it" — the cheapest wrong
 * action an agent can take, and the majority case in a real monorepo.
 */
export interface DiskSet {
  /** Classify a glob by what exists on disk under the paths it matches. */
  classify(glob: string): OnDisk
  /**
   * Present ONLY when the walk gave up, and then verdict-bearing.
   *
   * `classify` answers `not-determined` for every glob in that state, which
   * since 0355 means a cardinality rule stays green — so the caller that
   * consumes a classification has to be able to tell "the disk says no" from
   * "the walk never looked". Reading `classify` alone cannot.
   */
  readonly exhaustion?: WalkExhaustion
}

/**
 * What the walk read before it stopped, and what dominated it.
 *
 * `consumers` exists because of ADR-009 rule 2: the remedy has to be real, and
 * "your repository is too large" is not one — the adopter cannot act on it.
 * [Spike 0368](../../../../work/spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md)
 * measured why naming directories IS actionable: pruning removes **88.9%** of
 * entries in a repository with no generated output at all, so a repository that
 * exhausts is overwhelmingly carrying directories that should never have been
 * walked. One adopter's `.wrangler` was **58%** of their entries by itself.
 */
export interface WalkExhaustion {
  /** The directory the walk started from. */
  readonly root: string
  /** The budget it exceeded. */
  readonly budget: number
  /** Largest first — the directories to name in the finding. */
  readonly consumers: readonly WalkConsumer[]
}

/** One subtree's share of the walk. Not exported: `WalkExhaustion` carries it. */
interface WalkConsumer {
  /** Path relative to `root`. */
  readonly dir: string
  readonly entries: number
}

let cache = new WeakMap<ArchProject, DiskSet>()

/**
 * Budget override for the MEMOIZED path. Tests only.
 *
 * `buildDiskSet` above already takes an injectable budget and is documented
 * "exported for tests only" — but it bypasses the memo, and the production
 * consumer of a classification is `absenceClaimIsContradicted`, which goes
 * through `diskSet(project)`. So a test could construct an exhausted set and
 * could not make a RULE see one, which left bug 0359's defect reachable only
 * below the public entry point. A test that drives a stand-in instead of
 * `violations()` is how a suite stays green while the defect survives.
 *
 * Reaching exhaustion honestly is not an option: the budget is 500,000 entries.
 *
 * This overrides the constant and clears the memo, so the walk really runs, the
 * real `classify` answers, and the finding travels the real path — only the
 * number differs from production.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function setDiskWalkBudgetForTests(limit: number | undefined): void {
  budgetForTests = limit
  cache = new WeakMap()
}

let budgetForTests: number | undefined

/**
 * The project's disk set, walked at most once and only when asked.
 *
 * Lazy on purpose. This is only ever reached from `diagnoseGlob`, which is
 * only ever reached from an already-firing fault, so a project with no faults
 * never touches the filesystem. An eager version would charge every `check()`
 * a recursive walk to answer a question no fault asked.
 */
/**
 * Does the filesystem CONTRADICT a rule's claim that nothing matching this glob exists?
 *
 * The one owner of a policy two tools have to share — the gate's evidence floor
 * (`vacuity-diagnosis.ts`) and the preview (`diagnose.ts`). It is written here, beside the
 * classification it reads, because the pair has already grown two hand-maintained copies of one
 * rule and had them disagree: `isFaultPosition` was inverse lists in both files, differing over
 * exactly `discovery`, so `doctor` reported a dead layer glob and the build stayed green.
 *
 * ## Why only `holds-typescript`
 *
 * A rule asserting cardinality — `.notExist()` and friends — is SATISFIED by having no
 * subjects, so examining zero is normally the rule working. The trouble is that a holding
 * ratchet and a selector that silently stopped matching are identical from the glob and the
 * path universe: both match nothing. Only disk tells them apart.
 *
 * | classification     | verdict | why                                                              |
 * | ------------------ | ------- | ---------------------------------------------------------------- |
 * | `holds-typescript` | **contradicted** | the code being asserted away is right there, unexamined |
 * | `absent`           | consistent | the ratchet holding — the common case, and it must stay silent |
 * | `no-typescript`    | consistent | no TypeScript means no modules, which is what the rule asserts  |
 * | `not-determined`   | consistent | the walk could not answer; blaming the author for that is the confidently-wrong remedy this module exists not to give |
 *
 * [Bug 0355](../../../../work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
 * for the gate half, [0357](../../../../work/bugs/fixed/0357-doctor-reports-a-healthy-ratchet-as-a-dead-glob.md)
 * for the preview.
 */
function absenceClaimIsContradicted(project: ArchProject, glob: string): boolean {
  return contradictsAbsence(diskSet(project).classify(glob))
}

/**
 * The policy alone, as a TOTAL function on the four classifications.
 *
 * Split from the lookup above so it can be pinned exhaustively. Test review sabotaged the
 * threshold three ways — accepting `not-determined`, accepting `no-typescript`, and simply
 * "anything but `absent`" — and **all three reddened nothing across 3,884 tests**. The
 * narrowing was stated in four places in prose (this docstring, `vacuity-diagnosis.ts`, both
 * bug records, and the shipped changeset) and enforced by none of them. An unfalsifiable
 * guard is pinned or deleted; this one is load-bearing, so it is pinned.
 *
 * Exhaustive by construction: `OnDisk` is a four-value union, so a test that enumerates it
 * cannot silently stop covering a case when a fifth is added — it stops compiling.
 */
export function contradictsAbsence(onDisk: OnDisk): boolean {
  return onDisk === 'holds-typescript'
}

/**
 * Is a dead site on a CARDINALITY rule a real fault, given the glob and the disk?
 *
 * Two independent ways to be one, and the second was missing for a release:
 *
 * 1. **The glob is broken in every possible project** — a syntactic fault, decided from the
 *    text with no filesystem and no universe. `'./src/**'` is one character wrong and matches
 *    nothing anywhere.
 * 2. **The filesystem contradicts the absence claim** — `contradictsAbsence` above.
 *
 * Bug 0357 added the disk test and, by placing it after `isDeadSite`, dropped the first.
 * Measured on a healthy project with `src/a.ts` loaded: a `.notExist()` over `'./src/**'`
 * went green in `doctor` AND `check`, while the same glob on a positive-assertion rule
 * reported — so a ratchet broken by one character said nothing in either tool, and the
 * directory it names exists, is in the project, and holds TypeScript. Shipped in 0.10.0 and
 * caught by a review of the review's own fixes.
 *
 * `diagnose.ts` states the principle twice about itself — syntactic faults "are properties of
 * the glob text, not of what loaded", and survive even an empty project. They must survive
 * this narrowing too.
 */
export function cardinalityDeadSiteIsAtFault(
  project: ArchProject,
  glob: string,
  hasSyntacticFault: boolean,
): boolean {
  return hasSyntacticFault || absenceClaimIsContradicted(project, glob)
}

export function diskSet(project: ArchProject): DiskSet {
  const cached = cache.get(project)
  if (cached) return cached
  const built = build(project, budgetForTests ?? ENTRY_BUDGET)
  cache.set(project, built)
  return built
}

/**
 * The walk, with the budget injectable.
 *
 * Exported for tests only. The degrade path is the difference between "not
 * determined" and a *partial, wrong* classification — a false "contains no
 * TypeScript" in the one message whose whole defence is that it states only
 * facts — and with the budget a module constant it could only ever have been
 * reached by accident on a repository nobody has.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function buildDiskSet(project: ArchProject, budgetLimit = ENTRY_BUDGET): DiskSet {
  return build(project, budgetLimit)
}

function build(project: ArchProject, budgetLimit: number): DiskSet {
  // Guard on the INPUT, before deriving anything. `discoverIdentityRoot` calls
  // `path.resolve`, so every root it returns is absolute and checking the
  // output can never fail. Both halves matter, and this repo's own suite
  // supplies both: the relative `'in-memory'` double (whose dirname is '.',
  // which would walk the real CWD) and absolute paths that do not exist, where
  // `readdirSync` throws from inside a guard. Counted in prose as "eight
  // doubles, two relative" until the suite reached 114 of them — so the shapes
  // are named and the arithmetic is not. And `ArchProject` is a public type, so
  // this protects user-constructed projects, not only test doubles.
  if (!path.isAbsolute(project.tsConfigPath)) return UNDETERMINED
  const root = discoverIdentityRoot(path.dirname(project.tsConfigPath))
  if (!fs.existsSync(root)) return UNDETERMINED
  // The FILESYSTEM root is never a project root, and walking it is never
  // meaningful. `discoverIdentityRoot` falls back to its own argument when it
  // finds no marker, so a tsconfig path with nothing above it resolves to `/`
  // and this walked the entire disk.
  //
  // Found by bug 0359's own fix: that walk always happened, exhausted, and
  // returned the silent `UNDETERMINED`, so nobody could see it. The moment
  // exhaustion started reporting, every in-memory double in this suite surfaced a
  // finding — 0359's thesis landing in a second place. `not-determined` was the
  // right answer all along; it now arrives without reading the whole disk first.
  //
  // Narrow on purpose. A first draft refused any root without a `.git` or
  // `package.json` and reddened two legitimate fixtures: a bare directory holding
  // only a tsconfig IS a project, and eess must not require a manifest it never
  // asked for. The pathology is reaching `/`, not lacking a marker.
  if (path.dirname(root) === root) return UNDETERMINED

  const files: string[] = []
  /** Every file, TypeScript or not — so `absent` means absent, not "not TypeScript". */
  const everyFile: string[] = []
  const dirs: string[] = []
  /**
   * Directories the walk refused to enter.
   *
   * A glob matching one of these cannot be classified: nothing under it was
   * seen. Reporting `absent` would say "this path does not exist" about
   * `**\/dist/**` or `**\/vendor/**` — all realistic rule scopes — and
   * `absent` carries no advice, so the caller then falls back to a cause list
   * beginning "a path segment is misspelled".
   */
  const pruned: string[] = []
  let budget = budgetLimit
  let exhausted = false
  /**
   * Entries read per top-level subtree of `root`, so exhaustion can name what
   * consumed the walk instead of blaming the repository's size (spike 0368).
   * Attributed to the FIRST segment below `root` and no deeper: the remedy is
   * "stop walking this tree", which is a decision about a top-level directory.
   */
  const perSubtree = new Map<string, number>()

  const walk = (dir: string): void => {
    if (exhausted) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch (err) {
      void err // unreadable or gone: not a finding, just not walkable
      return
    }
    // Count BEFORE the budget check, so the subtree that pushed the walk over
    // is the one the finding names. Counting after would attribute the
    // decisive read to nobody — the directory that exhausted the budget would
    // be missing from the list of what exhausted it.
    const rel = path.relative(root, dir).replaceAll('\\', '/')
    const top = rel === '' ? '.' : (rel.split('/')[0] ?? '.')
    perSubtree.set(top, (perSubtree.get(top) ?? 0) + entries.length)
    budget -= entries.length
    if (budget < 0) {
      exhausted = true
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name).replaceAll('\\', '/')
      // Prune by NAME, before asking whether it is a directory.
      //
      // [ts-archunit Bug 0045](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0045-two-tests-fail-by-environment-and-corrupt-sabotage-verdicts.md):
      // `Dirent.isDirectory()` is false for a symlink, so a symlinked
      // `node_modules` — what pnpm produces, and what `git worktree add`
      // leaves behind — fell through to the `else` branch and was recorded as
      // a **file**. It never entered `pruned`, so a glob under it classified
      // `absent` ("no such path") instead of `not-determined` ("this walk
      // cannot say"). Those carry different advice, and `absent` is the one
      // that asserts something false.
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
      // The cost, for symlinks we do NOT prune: a symlinked source directory —
      // pnpm and yarn workspaces create them — is recorded as a file, so a glob
      // naming it classifies `no-typescript`. Wrong, but wrong in the direction
      // that only weakens a message; following the link risks a walk that never
      // terminates.
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
  // NOT the shared `UNDETERMINED` constant. It is deliberately identity-free so
  // it can be returned from the guards above, where there is nothing to say; a
  // walk that gave up has something to say, and bug 0359 is that it said
  // nothing. `classify` still answers `not-determined` for every glob — the
  // classification is unchanged and still honest. What changes is that the
  // caller can now discover WHY.
  if (exhausted) return exhaustedDiskSet(root, budgetLimit, perSubtree)

  // Containment is TRANSITIVE, and that is load-bearing. Using each file's
  // immediate parent instead labels `docs/` "contains no TypeScript" while
  // `docs/.vitepress/config.ts` sits one level below it — a false statement in
  // the one message whose entire defence is that it states only facts.
  // Measured on this repo: 36 directories hold TypeScript transitively but not
  // directly.
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
  // `absent` from the TypeScript-only set asserted "this path does not exist"
  // about any path holding a `.md`, a `.json`, or anything under a pruned
  // name — and `absent` carries no advice, so the caller fell back to
  // `no-match`'s list, whose first cause is "a path segment is misspelled".
  // Exactly the confidently-wrong cause ADR-009 rule 2 forbids.
  const everything = [...everyFile, ...dirs]
  const typeScript = new Set(files)
  // TWO prefixes, not one. The walk starts at `discoverIdentityRoot(...)` — the
  // `.git`/workspace root — while every rule-facing matcher names its second
  // view from `rootOf(sourceFile)`, the **tsconfig's** directory. In a monorepo
  // package those differ, and using the walk root alone left this producer
  // answering `absent` for a `'src/**'` the runtime matcher selects: the same
  // two-derivations-disagree failure bug 0339 is about, surviving in the one
  // place that states a fact about the filesystem. Reported in review, and the
  // pinning test below now carries a fixture where the two roots differ.
  //
  // The absolute candidate is what stays in `matched`: `holdsTypeScript` and
  // `typeScript` are keyed by absolute path, and a second spelling in the set
  // would be a second key for one directory.
  const prefixes = [root, rootFromTsConfigPath(project.tsConfigPath)]
    .filter((r): r is string => r !== undefined)
    .map((r) => (r === '/' ? '/' : `${r.replaceAll('\\', '/')}/`))
  const namedFromARoot = (candidate: string): string[] =>
    prefixes
      .filter((prefix) => candidate.startsWith(prefix))
      .map((prefix) => candidate.slice(prefix.length))
  return {
    classify(glob: string): OnDisk {
      const isMatch = picomatch(glob)
      // Both views of each path, as every rule-facing matcher does since bug
      // 0339 — and here it is a claim about the FILESYSTEM, which makes getting
      // it wrong worse than a missed match. Under a project path holding a
      // dot-segment, picomatch's default `dot: false` stops `**` crossing it, so
      // a `'**\/src/**'` whose directory exists and is merely excluded by the
      // tsconfig was classified `absent` — and `absent`'s advice says no such
      // path was found and a segment must be misspelled. Confidently wrong about
      // a fact, which is the one thing this producer exists not to be.
      const readsRootRelative = readsRootRelativePath(glob)
      const hits = (candidate: string): boolean => {
        if (isMatch(candidate)) return true
        if (!readsRootRelative) return false
        return namedFromARoot(candidate).some((named) => isMatch(named))
      }
      // Never `everything.some(isMatch)` — picomatch reads the array index as
      // its second argument and returns a truthy object from index 1 onwards.
      const matched = everything.filter((candidate) => hits(candidate))
      if (matched.length === 0) {
        // Not seen is not the same as not there.
        return pruned.some((dir) => hits(dir) || glob.includes(dir.slice(root.length + 1)))
          ? 'not-determined'
          : 'absent'
      }
      // Per GLOB, not per path: one glob routinely matches paths in both
      // categories — `**/tests/**` matched 44 directories of mixed kind on the
      // monorepo this was gated against. Any matched path holding TypeScript
      // makes the tsconfig the story worth telling.
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

/**
 * How many consuming directories the exhaustion finding names.
 *
 * Four, not all of them: the finding is a sentence an agent acts on, and a list
 * of forty directories is the ADR-009 rule 4 noise problem moved inside one
 * message. Four was enough to cover 91% of this repository's entries when
 * measured (spike 0368), and the total is reported alongside so the reader can
 * tell a dominated walk from an evenly-spread one.
 */
export const NAMED_CONSUMERS = 4

/**
 * The walk gave up, and says what it read.
 *
 * Its own object rather than the shared `UNDETERMINED`, because the consumers
 * differ per project and a shared constant cannot carry them.
 */
function exhaustedDiskSet(
  root: string,
  budget: number,
  perSubtree: ReadonlyMap<string, number>,
): DiskSet {
  const consumers = [...perSubtree]
    .map(([dir, entries]) => ({ dir, entries }))
    // NOT `localeCompare`: this order decides which directories the message names,
    // the message reaches a baseline identity, and the host locale would make the
    // same finding hash differently on a laptop and in CI. The repo's own
    // `scan-locale-ordering` gate caught this.
    .sort((a, b) => b.entries - a.entries || byCodepoint(a.dir, b.dir))
  return {
    classify: () => 'not-determined',
    exhaustion: { root, budget, consumers },
  }
}
