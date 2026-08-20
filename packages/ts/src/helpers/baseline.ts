import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { ArchViolation } from '@nielspeter/eess'
import { subjectOf } from '@nielspeter/eess'
import { discoverIdentityRoot, normalizeIdentityText, toPortablePath } from '@nielspeter/eess'
import { writeStderr } from '@nielspeter/eess'
import { descriptionChangeFinding, unmatchedBaselineFinding } from './baseline-diagnostics.js'
import type { BaselineFacts } from './baseline-diagnostics.js'

/**
 * Identity-hash format version.
 *
 * 1 — sha256(rule::element::message) verbatim; absolute paths leak in.
 * 2 — the repository root is replaced with a token first, so identity is
 *     portable across checkouts (bug 0010).
 *
 * Note that v2 is byte-identical to v1 for any violation whose fields contain
 * no path, so most v1 baselines keep matching. The version alone is therefore
 * NOT grounds to fail — see `unmatchedBaselineFinding`, which fires on the
 * measurement instead.
 * 4 — bug 0012. Metric findings gained a producer-set `identity`
 *     (`file::element::metric`) and an accepted `measured` value, so every entry
 *     for the ten size and complexity conditions hashes differently. The v3
 *     precedent applies exactly: `hashViolation`'s FORMULA is untouched and one
 *     of its inputs moved, which is the case the 0.23.0 withdrawal established
 *     is worth a bump only when the identity of existing entries actually
 *     changes. It does here, for that family and no other — a baseline with no
 *     metric entries is byte-identical and keeps matching.
 *
 */
// Stays 2 through 0.23.0, deliberately. Accumulate (bug 0020) lengthens
// `buildRuleDescription()` for a rule derived off a held rule and for a
// pre-`.should()` `satisfy()`, and the description is hashed — so those entries
// stop matching. That is a change in the hash's *input*, not in how it is
// computed: `hashViolation` below never reads this constant.
//
// 0.23.0 drafted a bump to 3 to signal it and two independent reviews measured
// that as a defect. It matches no entry differently, and the only thing it
// changes is which `cause` sentence `unmatchedBaselineFinding` picks — so every
// user holding a pre-0.23.0 baseline that matched nothing for an unrelated
// reason would be told the format was "the likely cause", which cannot be true,
// while the branch naming the cause that usually is (a differently-resolved
// root) became unreachable. Bump this only when `hashViolation` changes.
//
// The unmatched *entry* still cannot be diagnosed — see bug 0027; that is the
// gap the bump was reaching for and did not close.
//
// 3 — dependency findings carry a producer-set `identity`, so `hashViolation`
//     computes a different string for all of them (bug 0028). This bump satisfies
//     the rule above, where 0.23.0's attempt did not: the *formula* changed, not
//     just one of its inputs.
//
//     Why it had to: a dependency message carries the basename and the resolved
//     target and nothing else, so two edges from one file to one module hashed
//     identically. Measured on this repo's barrel after v0.28.0 made barrels
//     dependency-bearing — 114 findings, 87 identities, 46.5% of findings sharing
//     one with a sibling. `identity` adds the imported names, which discriminate
//     and survive code moving where a line number would not.
//
//     **It invalidates existing baselines for every dependency finding**, not only
//     the colliding ones, because identity replaces `element::message` wholesale.
//     No printed text changes, which is why bug 0028 first recorded this as needing
//     no migration treatment — that conflated text-stability with baseline-stability
//     and was wrong. The bump is what lets `unmatchedBaselineFinding` name the real
//     cause instead of guessing at a re-resolved root.
//
// 5 — plan 0104. `beFreeOfCycles` gains a producer-set `identity` PER INTERNAL EDGE
//     (`cycle-edge::${from}->${to}`), replacing the old per-component `cycle::${members}`
//     scheme wholesale — so every existing cycle finding's identity changes, whether or
//     not its underlying edges did. The v3/v4 precedent applies exactly: `hashViolation`'s
//     FORMULA is untouched and one of its inputs moved, and the identity of existing
//     entries actually changes, for that family and no other — a baseline with no cycle
//     entries is byte-identical and keeps matching. Distinct prefix (`cycle-edge::` vs.
//     `cycle::`) also means an old-format entry cannot accidentally still match a
//     new-format finding by coincidence, independent of this version bump.
// eess-exclude eess/no-unused-exports: read by `baseline-diagnostics.ts`, which was
// split out of this file — the gate does not count a sibling module's import here.
export const HASH_VERSION = 5

/**
 * A single entry in the baseline file.
 *
 * Violations are identified by rule + file + content hash.
 * Line numbers are stored for human readability but NOT used for matching —
 * they drift as code moves. The content hash (of the violation message +
 * element name) provides stable identity.
 */
export interface BaselineEntry {
  /** Rule description (from the fluent chain) */
  rule: string
  /** File path relative to the identity root (see `root` below), forward-slashed */
  file: string
  /** Line number at time of baseline (informational, not used for matching) */
  line: number
  /** Stable identity hash: sha256(rule + element + message) */
  hash: string
  /**
   * The measurement this entry accepted, for a metric finding (bug 0012).
   *
   * Present only on metric findings. `filterNew` suppresses such a finding
   * while the current measurement is **no greater** than this, so improving a
   * metric stays green and regressing past the accepted value fails. Without
   * it the message's embedded count made every change — in either direction —
   * a new finding, and paying down debt turned the build red.
   */
  measured?: number
  /**
   * What {@link measured} counts — `code-lines`, `methods`, `complexity`.
   *
   * Written since bug 0171 and optional. Absent means the entry predates unit
   * stamping, which {@link Baseline.isKnown} treats as "unknown unit": still
   * comparable for the metrics whose meaning has never changed, and NOT
   * comparable for `code-lines`, because such an entry necessarily recorded a
   * span. That distinction is the whole point — see {@link MEANING_NEVER_CHANGED}.
   */
  measuredUnit?: string
  /**
   * Subject hash: sha256(element + message), i.e. identity WITHOUT the rule
   * description. Written since 0.24.0 and optional, so a baseline from an
   * earlier version still loads — it simply cannot be diagnosed when an entry
   * stops matching, which is honest degradation rather than a guessed cause.
   * See \{@link hashSubject\} for what it is for.
   */
  subject?: string
}

/** A measurement an entry accepted, and what that number counts (bugs 0012, 0171). */
interface AcceptedMeasurement {
  value: number
  /** `undefined` on any entry written before unit stamping — see {@link measurementComparable}. */
  unit?: string
}

/**
 * Units whose meaning has never changed, so an entry that predates unit
 * stamping is still safely comparable against one.
 *
 * `code-lines` is deliberately absent, and that absence is the entire fix for
 * [bug 0171](../../../work/bugs/0171-a-metric-unit-change-silently-loosens-every-baselined-ratchet.md).
 * An unstamped `lines` entry was written when `linesOfCode` returned a SPAN, so
 * its number is denominated in something the tool no longer produces —
 * measured, roughly three times the current value on this repo's own source.
 * Comparing across that does not report a regression; it silently raises the
 * ceiling and keeps the build green while a class triples.
 *
 * A metric added here later is asserting "this counts what it always counted".
 */
const MEANING_NEVER_CHANGED: ReadonlySet<string> = new Set([
  'methods',
  'parameters',
  'properties',
  'named-exports',
  'complexity',
])

/**
 * Whether a stored measurement may be compared against a current one.
 *
 * Fails CLOSED: anything other than a demonstrable match is incomparable, and
 * an incomparable entry stops suppressing. The alternative — assume they agree —
 * is how a ratchet loosens without anyone being told (ADR-010: a pass is
 * constructed from evidence, and "probably the same unit" is not evidence).
 */
function measurementComparable(stored: string | undefined, current: string | undefined): boolean {
  // Both stamped and equal, or neither stamped (a producer that predates units
  // on both sides — the honest pre-0171 reading).
  if (stored === current) return true
  // Stored predates stamping. Comparable only where the meaning cannot have moved.
  if (stored === undefined) return current !== undefined && MEANING_NEVER_CHANGED.has(current)
  // Stored says one thing and this run says another. Never comparable.
  return false
}

/**
 * The baseline file structure.
 */
export interface BaselineFile {
  /** ISO timestamp when the baseline was generated */
  generatedAt: string
  /**
   * Identity-hash format version. Absent means 1 — a baseline written before
   * paths were stripped from identity, whose hashes cannot be matched.
   */
  hashVersion?: number
  /**
   * Where the identity root sits **relative to this file**, e.g. `'../..'`.
   *
   * Recorded rather than re-derived because generation and loading otherwise
   * discover the root independently, and a disagreement between them is
   * silent: every hash differs, the baseline matches nothing, and the format
   * version is identical on both sides so nothing notices. A relative position
   * is a property of the repository layout, so it is the same on every machine
   * — which is exactly what the absolute root is not.
   */
  root?: string
  /** Number of violations recorded */
  count: number
  /** The violations */
  violations: BaselineEntry[]
}

/**
 * Compute a stable hash for a violation.
 *
 * Uses rule + element + message as identity. This survives:
 * - Line number changes (code moved)
 * - Unrelated code changes in the same file
 * - **The checkout's absolute location** — see `root` below
 *
 * Does NOT survive:
 * - Rule DESCRIPTION changes — the assembled `that … should …` text, i.e. editing
 *   the rule's predicates or conditions. **Not** `.because()`: that sets
 *   `because`, which is not hashed. The old wording said "(rewording
 *   .because())" and it was false — measured, two violations differing only in
 *   `because` hash identically, and so do two differing only in `suggestion`.
 *   The distinction is load-bearing: it is what makes correcting a preset's
 *   remedy text a patch rather than a change that invalidates every consumer's
 *   baseline (bug 0017, whose own defect was a remedy claiming something it
 *   could not do — sitting in the docstring a compat auditor would check).
 * - Element renames (class renamed)
 * - Message text changes (condition wording updated)
 *
 * This is intentional — if the rule or element changes,
 * the violation should be re-evaluated.
 *
 * @param root - Repository/workspace root. Every occurrence of it inside the
 *   rule, element and message is replaced with a stable token before hashing.
 *   Producers interpolate absolute paths into those fields, so without a root
 *   the identity encodes the checkout directory and a baseline written on one
 *   machine matches nothing on another (bug 0010). Omitting it preserves the
 *   pre-0.19 hash and is only correct when no field contains a path.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export function hashViolation(violation: ArchViolation, root?: string): string {
  const scrub = (text: string): string =>
    root === undefined ? text : normalizeIdentityText(text, root)
  // A producer that sets `identity` has declared its own canonical form, which
  // supersedes both element and message — see ArchViolation.identity. Without
  // one, the composed string is byte-identical to the pre-0.19 input, so a
  // violation whose fields never contained a path keeps its old hash.
  // ONE definition, shared with `disambiguateIdentities` — see `subjectOf`. It used to be
  // spelled out here and copied there, guarded by a test asserting the copies agree; the copy
  // is gone because `helpers/` may import from `core/` and a shared definition cannot diverge.
  const content = `${scrub(violation.rule)}::${scrub(subjectOf(violation))}`
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * The violation's **subject**: what was found, independent of which rule found it.
 *
 * `hashViolation` above is `rule::element::message`, so editing a rule's
 * predicates or conditions — or accumulating them, which v0.23.0 made happen for
 * a rule derived off a held rule — changes the identity of violations that did
 * not change at all. Those entries stop matching and their already-accepted
 * violations report as **new**, with nothing saying why (bug 0027).
 *
 * This is the differently-derived value that tells the two cases apart:
 *
 * | baseline entry did not match because… | subject present in the run? |
 * | ------------------------------------- | --------------------------- |
 * | the violation was fixed               | no — stay silent, this is success |
 * | the rule's description changed        | yes — say so, and regenerate |
 *
 * Bug 0027's own suggested signal was "an entry whose `rule` string appears under
 * a different hash", and it cannot work: the rule string is precisely what
 * changed. Measured before this was built.
 */
export function hashSubject(violation: ArchViolation, root?: string): string {
  const scrub = (text: string): string =>
    root === undefined ? text : normalizeIdentityText(text, root)
  return createHash('sha256')
    .update(scrub(subjectOf(violation)))
    .digest('hex')
    .slice(0, 16)
}

/** Forward slashes so the recorded root reads the same on Windows and CI. */
function toPosix(value: string): string {
  return value.replaceAll('\\', '/')
}

/**
 * Options shared by baseline loading and generation.
 */
export interface BaselineOptions {
  /**
   * Repository/workspace root used to make violation identity portable.
   *
   * Defaults to the **nearest** enclosing repository or workspace root above
   * the baseline file — `.git`, then a monorepo marker (`pnpm-workspace.yaml`,
   * `nx.json`, …) or a `package.json` declaring `workspaces`, then the nearest
   * `package.json`. Nearest, not outermost: an ancestor that is also a repo (a
   * home directory under dotfiles version control) would otherwise anchor above
   * the checkout and leave machine-specific segments in the "relative" path.
   *
   * You should rarely need this. `generateBaseline` records where the root sat
   * relative to the file, and `withBaseline` reuses that, so the two ends
   * cannot silently disagree. Pass it only to override both — and then the
   * value must be the same on every machine, so derive it from the repository
   * layout, never from `process.cwd()`.
   */
  readonly root?: string
}

/**
 * Load a baseline from a JSON file.
 *
 * @param baselinePath - Path to the baseline JSON file
 * @param options - See \{@link BaselineOptions\}
 * @returns A Baseline object for use with check(\{ baseline \})
 */
export function withBaseline(baselinePath: string, options: BaselineOptions = {}): Baseline {
  const resolved = path.resolve(baselinePath)
  const baselineDir = path.dirname(resolved)
  const root =
    options.root !== undefined ? path.resolve(options.root) : discoverIdentityRoot(baselineDir)

  if (!fs.existsSync(resolved)) {
    // No baseline file = no known violations = all violations are new
    return new Baseline(new Set(), root, HASH_VERSION)
  }

  const raw = fs.readFileSync(resolved, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('violations' in parsed) ||
    !Array.isArray(parsed.violations)
  ) {
    writeStderr(`[eess] Invalid baseline file format at ${resolved} — treating as empty`)
    return new Baseline(new Set(), root, HASH_VERSION)
  }
  const hashVersion =
    'hashVersion' in parsed && typeof parsed.hashVersion === 'number' ? parsed.hashVersion : 1

  // A recorded root wins over re-discovery: it is what the hashes in this file
  // were actually built against. Re-deriving here is what lets a machine
  // without `.git` disagree with the machine that wrote the file, and that
  // disagreement produces no signal at all (bug 0010, review C2). An explicit
  // `options.root` still wins over both — the caller is overriding on purpose.
  const recordedRoot =
    'root' in parsed && typeof parsed.root === 'string'
      ? path.resolve(baselineDir, parsed.root)
      : undefined
  const effectiveRoot = options.root !== undefined ? root : (recordedRoot ?? root)
  const hashes = new Set<string>()
  // subject hash -> the rule description recorded for it. Only what the
  // description-change diagnosis needs, so a large baseline does not carry a
  // second copy of every entry. Entries written before 0.24.0 have no subject
  // and simply do not appear here.
  const subjects = new Map<string, string>()
  /** hash -> accepted measurement and its unit, for metric findings (bugs 0012, 0171). */
  const accepted = new Map<string, AcceptedMeasurement>()
  // Annotated as `readonly unknown[]`, not iterated directly: `parsed.violations`
  // is `any[]` after the `Array.isArray` check, and ADR-005 bars both `any` and
  // the `as` that would otherwise be needed to re-narrow it. Assigning to this
  // type is allowed and hands each element back as `unknown`.
  const rawEntries: readonly unknown[] = parsed.violations
  for (const entry of rawEntries) {
    if (entry === null || typeof entry !== 'object') continue
    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
    if (
      'subject' in entry &&
      typeof entry.subject === 'string' &&
      'rule' in entry &&
      typeof entry.rule === 'string'
    ) {
      subjects.set(entry.subject, entry.rule)
    }
    // Bug 0012: the measurement this entry accepted. Absent on every non-metric
    // entry and on anything written before this shipped, which `isKnown` reads
    // as "no ratchet recorded" rather than as zero.
    if (
      'hash' in entry &&
      typeof entry.hash === 'string' &&
      'measured' in entry &&
      typeof entry.measured === 'number'
    ) {
      accepted.set(entry.hash, {
        value: entry.measured,
        // Absent on any entry written before bug 0171 — deliberately left
        // `undefined` rather than defaulted, because a guess here is exactly
        // the silent re-denomination this field exists to prevent.
        unit:
          'measuredUnit' in entry && typeof entry.measuredUnit === 'string'
            ? entry.measuredUnit
            : undefined,
      })
    }
  }

  return new Baseline(hashes, effectiveRoot, hashVersion, resolved, subjects, accepted)
}

/**
 * Generate a baseline file from a list of violations.
 *
 * Call this to create/update the baseline:
 * ```typescript
 * const violations = collectAllViolations(rules)
 * generateBaseline(violations, 'arch-baseline.json')
 * ```
 */
export function generateBaseline(
  violations: ArchViolation[],
  outputPath: string,
  options: BaselineOptions = {},
): BaselineDelta {
  const resolved = path.resolve(outputPath)
  const baselineDir = path.dirname(resolved)
  const root =
    options.root !== undefined ? path.resolve(options.root) : discoverIdentityRoot(baselineDir)

  // Config-level meta-findings (empty selector/discovery) must never be
  // baselined away — they carry bypassFilters and are re-kept by filterNew
  // regardless, so writing them in only pollutes the file (plan 0067).
  const entries: BaselineEntry[] = violations
    .filter((v) => v.bypassFilters !== true)
    .map((v) => ({
      rule: v.rule,
      // Root-relative, not baseline-relative: the stored path must read the
      // same in every checkout, and `../../` chains encode the baseline file's
      // depth. Forward slashes so a file written on Windows reads on CI.
      file: toPortablePath(v.file, root),
      line: v.line,
      hash: hashViolation(v, root),
      subject: hashSubject(v, root),
      // Bug 0012. Written only for metric findings, so a baseline of ordinary
      // findings is byte-identical to one from before this shipped.
      ...(v.measured === undefined ? {} : { measured: v.measured }),
      // Bug 0171: what that number counts, so a later change to the metric
      // cannot silently re-denominate an accepted ceiling.
      ...(v.measuredUnit === undefined ? {} : { measuredUnit: v.measuredUnit }),
    }))

  // Read before writing — this is the only moment both sets exist (plan 0071).
  const prior = readPriorHashes(resolved)

  const baseline: BaselineFile = {
    generatedAt: new Date().toISOString(),
    hashVersion: HASH_VERSION,
    root: toPosix(path.relative(baselineDir, root)) || '.',
    count: entries.length,
    violations: entries,
  }

  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(baseline, null, 2) + '\n')

  const written = new Set(entries.map((e) => e.hash))
  return {
    before: prior?.count,
    after: entries.length,
    added:
      prior === undefined
        ? entries.length
        : [...written].filter((h) => !prior.hashes.has(h)).length,
    removed: prior === undefined ? 0 : [...prior.hashes].filter((h) => !written.has(h)).length,
    priorHashVersion: prior?.hashVersion,
    priorUnreadable: prior?.unreadable ?? false,
  }
}

/**
 * The hashes of the baseline file about to be overwritten.
 *
 * `undefined` when there is no prior file — the first-run case, which must read
 * as "41 new entries", never as "+41, −0 against an empty baseline".
 *
 * Deliberately tolerant in the same shape as {@link withBaseline}, and for the
 * same reason: a prior file that cannot be parsed must not throw here, because
 * the write is the user's whole purpose. But it is reported rather than treated
 * as absent — silently calling a corrupt baseline "no prior baseline" would
 * print `(+78, −0)` and hide that 41 accepted findings just stopped being
 * accepted.
 */
function readPriorHashes(resolved: string):
  | {
      hashes: Set<string>
      count: number
      hashVersion: number | undefined
      unreadable: boolean
      /** Why it was unreadable, when it was — malformed vs absent are different remedies. */
      unreadableReason?: string
    }
  | undefined {
  if (!fs.existsSync(resolved)) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf-8'))
  } catch (error: unknown) {
    // `unreadable` carries the cause, so the finding can say whether the file is
    // malformed or simply absent — two different remedies (regenerate vs create).
    return {
      hashes: new Set(),
      count: 0,
      hashVersion: undefined,
      unreadable: true,
      unreadableReason: error instanceof Error ? error.message : String(error),
    }
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('violations' in parsed) ||
    !Array.isArray(parsed.violations)
  ) {
    return { hashes: new Set(), count: 0, hashVersion: undefined, unreadable: true }
  }

  const hashVersion =
    'hashVersion' in parsed && typeof parsed.hashVersion === 'number' ? parsed.hashVersion : 1
  // Same `readonly unknown[]` narrowing as `withBaseline`, for the ADR-005
  // reason documented there.
  const rawEntries: readonly unknown[] = parsed.violations
  const hashes = new Set<string>()
  for (const entry of rawEntries) {
    if (entry === null || typeof entry !== 'object') continue
    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
  }
  // `count` is the entry count, not `hashes.size`: two entries can share a hash
  // (bug 0028, measured at 17% in this repo), and reporting the deduplicated
  // number as "41 entries" would disagree with the file the reader can open.
  return { hashes, count: rawEntries.length, hashVersion, unreadable: false }
}

/**
 * The delta a `generateBaseline` call applied, for the caller to report.
 *
 * Plan 0071's second instrument. The 0.28.0 upgrade recipe is "refresh the
 * baseline, commit, then upgrade", and its whole safety rests on the adopter
 * seeing what that refresh accepted. Before this, `baseline` printed only the
 * new total — so a refresh that accepted 37 findings and one that accepted none
 * printed the same shape of line, and the number that mattered was the one
 * nobody could see.
 */
export interface BaselineDelta {
  /** Entries in the file that was overwritten; `undefined` if there was none. */
  readonly before: number | undefined
  /** Entries written now. */
  readonly after: number
  /** Entries written now whose identity was not in the prior file. */
  readonly added: number
  /** Prior entries whose identity is not in what was just written. */
  readonly removed: number
  /** The prior file's hash version, when it had a readable one. */
  readonly priorHashVersion?: number
  /** A prior file existed but could not be read as a baseline. */
  readonly priorUnreadable: boolean
}

/**
 * The one-line delta, e.g. `41 → 78 entries (+37, −0)`.
 *
 * Kept beside {@link BaselineDelta} rather than in the CLI so the `baseline`
 * command and any programmatic caller print the same sentence.
 */
export function formatBaselineDelta(delta: BaselineDelta): string {
  const plural = (n: number): string => (n === 1 ? 'entry' : 'entries')

  if (delta.priorUnreadable) {
    return (
      `Baseline replaced: ${String(delta.after)} ${plural(delta.after)} written. ` +
      `The previous file could not be read as a baseline, so this is not a delta — ` +
      `whatever it accepted is no longer accepted. Check it in git history if that matters.`
    )
  }
  if (delta.before === undefined) {
    return `Baseline created: ${String(delta.after)} ${plural(delta.after)} accepted (no previous baseline).`
  }

  const line =
    `Baseline updated: ${String(delta.before)} → ${String(delta.after)} ${plural(delta.after)} ` +
    `(+${String(delta.added)}, −${String(delta.removed)}).`

  // A full replacement — nothing carried over — means something different from a
  // delta of the same magnitude, and the reader's next action is not the same:
  // "you accepted 78 new findings" versus "the identities all changed, so this
  // says nothing about what you accepted".
  //
  // **Keyed on the measurement, not on the version.** A version mismatch looks
  // like the obvious trigger and is not one: v2 is byte-identical to v1 for any
  // violation whose fields contain no path (see HASH_VERSION), so a v1 baseline
  // usually keeps matching entirely — and a message asserting "none of its
  // identities could be compared" beside `(+0, −0)` would be plainly false. The
  // overlap is the differently-derived value (ADR-008 rule 5); the version is
  // offered as a likely cause only once the measurement has established there
  // is something to explain.
  if (delta.before > 0 && delta.added === delta.after && delta.removed === delta.before) {
    const cause =
      delta.priorHashVersion !== undefined && delta.priorHashVersion !== HASH_VERSION
        ? ` The identity format changed (v${String(delta.priorHashVersion)} → v${String(HASH_VERSION)}), which is the usual cause.`
        : ''
    return (
      `${line} No entry survived: every prior identity is gone and every entry written is new, ` +
      `so this delta does not tell you what changed in your code.${cause}`
    )
  }

  if (delta.added > 0) {
    return `${line} The +${String(delta.added)} are findings this file now accepts that it did not before.`
  }
  return line
}

/**
 * A loaded baseline. Passed to check(\{ baseline \}) to filter known violations.
 */
export class Baseline {
  // `Baseline` is an exported type and `new Baseline(hashes, root)` is a
  // documented call, so folding these into an options object is a breaking
  // change and not this plan's to make. Every parameter after the second is
  // optional and defaulted, so the call sites that matter take two.
  //
  // The directive is the LAST line before the declaration on purpose: a
  // single-line waiver covers exactly the next line, so prose placed under it
  // consumes the waiver instead of the code (measured, right here).
  // eess-exclude eess/max-parameters: published constructor; an options object would break it
  constructor(
    private readonly knownHashes: Set<string>,
    private readonly root: string,
    private readonly hashVersion: number = HASH_VERSION,
    private readonly sourcePath?: string,
    /**
     * Subject hash -> the rule description recorded against it. Empty for a
     * baseline written before 0.24.0, which disables the description-change
     * diagnosis rather than guessing at it (bug 0027).
     */
    private readonly knownSubjects: ReadonlyMap<string, string> = new Map(),
    /**
     * Hash -> the measurement accepted for it, for metric findings (bug 0012).
     * Absent for every non-metric entry and for baselines written before this
     * shipped, where equality of identity remains the right test.
     */
    private readonly acceptedMeasurements: ReadonlyMap<string, AcceptedMeasurement> = new Map(),
  ) {}

  /**
   * Check if a violation is known (exists in the baseline).
   * Known violations are filtered out — they don't cause failures.
   */
  /**
   * Whether the baseline holds an entry with this violation's identity.
   *
   * Distinct from {@link isKnown}, which also asks whether a metric finding is
   * still within the measurement that entry accepted. A regressed metric has an
   * entry and is not known.
   */
  hasEntry(violation: ArchViolation): boolean {
    return this.knownHashes.has(hashViolation(violation, this.root))
  }

  /**
   * Whether this violation is already accepted by the baseline.
   *
   * Identity answers "is this the same finding?"; for a metric finding that is
   * not enough, so a known hash is additionally required to be **no worse** than
   * the accepted measurement — improving a metric stays green, regressing past
   * the accepted value fails (bug 0012).
   */
  isKnown(violation: ArchViolation): boolean {
    const hash = hashViolation(violation, this.root)
    if (!this.knownHashes.has(hash)) return false

    // Bug 0012: a metric finding is known only while it is **no worse** than
    // what was accepted. Identity answers "is this the same finding?"; a metric
    // needs "is it worse than what we accepted?", which is a comparison.
    //
    // Both sides must be present. A metric violation matched against an entry
    // written before this shipped has no accepted value to compare with, and
    // the honest reading of that is the pre-0012 one — the entry was accepted,
    // so it stays accepted until the baseline is regenerated. Treating a
    // missing value as 0 would fail every metric finding in an older baseline
    // and call it a regression.
    const accepted = this.acceptedMeasurements.get(hash)
    if (violation.measured === undefined || accepted === undefined) return true

    // Bug 0171: the entry's number and this run's number must count the same
    // thing before `<=` means anything. When they do not, the finding is NOT
    // known — reporting it is the only honest answer, because the accepted
    // ceiling is denominated in a unit the tool no longer produces.
    // `staleMeasurementFinding` supplies the cause and the remedy so this does
    // not read as fresh rot in the code (ADR-009 rule 2).
    if (!measurementComparable(accepted.unit, violation.measuredUnit)) return false

    return violation.measured <= accepted.value
  }

  /**
   * What the diagnoses in `baseline-diagnostics.ts` need, stated explicitly.
   *
   * An object rather than `this`, because the fields are `private readonly` and
   * a diagnosis should depend on the facts it reads, not on the class that
   * happens to hold them.
   */
  private facts(): BaselineFacts {
    return {
      knownHashes: this.knownHashes,
      knownSubjects: this.knownSubjects,
      root: this.root,
      sourcePath: this.sourcePath,
      hashVersion: this.hashVersion,
      isKnown: (violation) => this.isKnown(violation),
      hasEntry: (violation) => this.hasEntry(violation),
    }
  }

  /**
   * Filter out known violations, returning only new ones.
   *
   * Config-level meta-findings (empty selector/discovery) are never baselined
   * away — a regenerated baseline must not silence them (ADR-008; plan 0067).
   *
   * A baseline that matches **nothing** looks identical to "every accepted
   * violation regressed at once", so that case is reported as what it is —
   * see \{@link unmatchedBaselineFinding\}.
   */
  filterNew(violations: ArchViolation[]): ArchViolation[] {
    const kept: ArchViolation[] = []
    let matched = 0
    let matchable = 0
    for (const violation of violations) {
      if (violation.bypassFilters === true) {
        kept.push(violation)
        continue
      }
      matchable += 1
      // `matched` counts entries the baseline RECOGNISED, not violations it
      // suppressed, and the two differ for a metric finding that regressed past
      // its accepted value (bug 0012). Counting suppression instead made a
      // single-entry baseline whose one metric got worse report "no entry
      // survived: every prior identity is gone" — a false cause, since the
      // identity matched perfectly and only the number moved.
      if (this.hasEntry(violation)) matched += 1
      if (this.isKnown(violation)) continue
      kept.push(violation)
    }
    // The specific diagnosis SUPERSEDES the generic one, and not merely for
    // tidiness: it disproves it. `unmatchedBaselineFinding` fires on
    // `matched === 0` and, in the same-version case, tells the reader the likely
    // cause is a differently-resolved repository root. A detected description
    // change means a stored SUBJECT matched — and subjects are scrubbed with the
    // same root as hashes — so the root is demonstrably resolving consistently
    // and the root explanation is false. Reporting both would put two
    // contradictory causes in one run, which is the ADR-008 rule 2 defect the
    // withdrawn HASH_VERSION bump already committed once in this area.
    const facts = this.facts()
    const descriptionChange = descriptionChangeFinding(facts, violations)
    const finding = descriptionChange ?? unmatchedBaselineFinding(facts, matched, matchable)
    // Additive, not exclusive: a stale unit and a renamed rule are independent
    // causes that can both be true in one upgrade, and each carries its own
    // remedy. The `??` above is a different situation — there, one diagnosis
    // DISPROVES the other.
    const stale = this.staleMeasurementFinding(violations)
    const meta: ArchViolation[] = []
    if (stale !== undefined) meta.push(stale)
    if (finding !== undefined) meta.push(finding)
    return meta.length === 0 ? kept : [...meta, ...kept]
  }

  /**
   * The stale-unit measurements in this run, grouped by the unit pair that
   * changed — so one upgrade is described once however many elements it
   * touched, with the identities carried inside.
   *
   * Extracted from {@link staleMeasurementFinding} because the four
   * disqualifying cases are most of that method's branching, the same reason
   * {@link renamedRuleFor} sits beside {@link descriptionChangeFinding}.
   */
  private staleMeasurementsByUnit(violations: ArchViolation[]): Map<string, string[]> {
    const stale = new Map<string, string[]>()
    for (const violation of violations) {
      const accepted = this.incomparableAcceptedFor(violation)
      if (accepted === undefined) continue
      const key = `${accepted.unit ?? '(unrecorded)'} -> ${violation.measuredUnit ?? '(none)'}`
      const named = stale.get(key) ?? []
      named.push(
        `${violation.element} (accepted ${String(accepted.value)}, now ${String(violation.measured ?? 0)})`,
      )
      stale.set(key, named)
    }
    return stale
  }

  /**
   * The accepted measurement this violation matches but CANNOT be compared
   * against, or `undefined` when there is no such conflict — which covers the
   * ordinary cases too: not a metric finding, no matching entry, or a unit that
   * still means what it meant.
   */
  private incomparableAcceptedFor(violation: ArchViolation): AcceptedMeasurement | undefined {
    if (violation.bypassFilters === true || violation.measured === undefined) return undefined
    const accepted = this.acceptedMeasurements.get(hashViolation(violation, this.root))
    if (accepted === undefined) return undefined
    if (measurementComparable(accepted.unit, violation.measuredUnit)) return undefined
    return accepted
  }

  /**
   * A meta-finding for baselined metric entries whose accepted measurement is
   * denominated in a unit this version no longer produces — bug 0171.
   *
   * Without it, the upgrade that changed a metric reports the affected classes
   * as ordinary new violations. The author sees findings against code they did
   * not touch, on a rule they had already baselined, with nothing connecting
   * that to the release note — the "eess started reporting something new"
   * failure ADR-009 rule 2 exists to prevent.
   *
   * This fires where `unmatchedBaselineFinding` structurally cannot: those
   * entries MATCH. Identity is intact and only the unit moved, so `matched` is
   * non-zero and that check stays silent by design.
   */
  private staleMeasurementFinding(violations: ArchViolation[]): ArchViolation | undefined {
    const stale = this.staleMeasurementsByUnit(violations)
    if (stale.size === 0) return undefined

    const where = this.sourcePath ?? 'the baseline file'
    const total = [...stale.values()].reduce((n, xs) => n + xs.length, 0)
    // Identities, never a bare total (ADR-008 rule 4).
    const detail = [...stale.entries()]
      .map(([units, names]) => `\n  ${units}:${names.map((n) => `\n    ${n}`).join('')}`)
      .join('')
    return {
      rule: 'eess-ts: baseline',
      element: 'baseline',
      file: '',
      line: 0,
      message:
        `Baseline at ${where} accepted ${String(total)} metric ${total === 1 ? 'finding' : 'findings'} ` +
        `under a measurement this version no longer produces, so ${total === 1 ? 'it is' : 'they are'} ` +
        `being reported rather than silently re-accepted. This is not new rot in your code — the ` +
        `metric changed what it counts:${detail}`,
      because:
        'An accepted ceiling is a number in a unit. Comparing this run against a ceiling recorded in a different unit does not measure a regression — it moves the bar, and the build stays green while the code gets worse.',
      suggestion: `Check that each element above is genuinely acceptable at its NEW number, then regenerate: \`npx eess-ts baseline <your-rule-files> --output ${where}\`. Re-accepting without reading it re-baselines whatever drift the old unit was hiding.`,
      bypassFilters: true,
    }
  }

  /** Number of known violations in the baseline */
  get size(): number {
    return this.knownHashes.size
  }
}
