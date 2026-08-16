import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { ArchViolation } from './violation.js'
import { discoverIdentityRoot, normalizeIdentityText } from './identity-root.js'
import { writeStderr } from './stderr.js'

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
  /** Relative file path (relative to baseline file location) */
  file: string
  /** Line number at time of baseline (informational, not used for matching) */
  line: number
  /** Stable identity hash: sha256(rule + element + message) */
  hash: string
  /**
   * The measurement this entry accepted, for a metric finding
   * (`ArchViolation.measured`). Absent for every non-metric entry, so a
   * baseline with no metric findings is byte-identical to one without this
   * field at all.
   */
  measured?: number
}

/**
 * The baseline file structure.
 */
export interface BaselineFile {
  /** ISO timestamp when the baseline was generated */
  generatedAt: string
  /** Number of violations recorded */
  count: number
  /** The violations */
  violations: BaselineEntry[]
}

/**
 * Compute a stable hash for a violation.
 *
 * Uses `violation.identity` when the condition set one (a canonical,
 * position-independent key — see `ArchViolation.identity`'s own doc comment);
 * otherwise falls back to rule + element + message. The fallback survives:
 * - Line number changes (code moved)
 * - Unrelated code changes in the same file
 *
 * Does NOT survive:
 * - Rule description changes (rewording .because())
 * - Element renames (class renamed)
 * - Message text changes (condition wording updated) — including a message
 *   that embeds a line number, which changes whenever code shifts above the
 *   match. A condition that reports such a message sets `identity` instead
 *   of relying on this fallback.
 *
 * This is intentional — if the rule or element changes,
 * the violation should be re-evaluated.
 *
 * `root`, when supplied, is scrubbed out of both fields via
 * `normalizeIdentityText` before hashing — an `identity` string that
 * interpolates a file path (e.g. `identifyMatches`'s per-declaration
 * identities) otherwise embeds the absolute checkout path, and the same
 * baseline generated on two machines (or locally vs. CI) would never match.
 * Omitted, hashing is unchanged — this stays opt-in so a caller with no
 * portability need (or no discoverable root) pays nothing for it.
 */
export function hashViolation(violation: ArchViolation, root?: string): string {
  const scrub = (text: string): string =>
    root === undefined ? text : normalizeIdentityText(text, root)
  // `rule` is always part of the hash, even when `identity` is set — two
  // different rules that happened to produce the same identity string (e.g.
  // two metric conditions on the same class) must not collide in one
  // baseline entry.
  const subject =
    violation.identity !== undefined
      ? violation.identity
      : `${violation.element}::${violation.message}`
  const content = `${scrub(violation.rule)}::${scrub(subject)}`
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

/**
 * Convert an absolute file path to a path relative to the baseline file.
 * Baseline files store relative paths so they're portable across machines.
 */
function toRelativePath(absolutePath: string, baselineDir: string): string {
  return path.relative(baselineDir, absolutePath)
}

/**
 * Load a baseline from a JSON file.
 *
 * @param baselinePath - Path to the baseline JSON file
 * @returns A Baseline object for use with check(\{ baseline \})
 */
export function withBaseline(baselinePath: string): Baseline {
  const resolved = path.resolve(baselinePath)
  const baselineDir = path.dirname(resolved)
  const root = discoverIdentityRoot(baselineDir)

  if (!fs.existsSync(resolved)) {
    // No baseline file = no known violations = all violations are new
    return new Baseline(new Set(), baselineDir, root)
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
    return new Baseline(new Set(), baselineDir, root)
  }
  const violations: unknown[] = parsed.violations
  const hashes = new Set<string>()
  const accepted = new Map<string, number>()
  for (const entry of violations) {
    if (entry && typeof entry === 'object' && 'hash' in entry && typeof entry.hash === 'string') {
      hashes.add(entry.hash)
      if ('measured' in entry && typeof entry.measured === 'number') {
        accepted.set(entry.hash, entry.measured)
      }
    }
  }

  return new Baseline(hashes, baselineDir, root, accepted)
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
export function generateBaseline(violations: ArchViolation[], outputPath: string): void {
  const resolved = path.resolve(outputPath)
  const baselineDir = path.dirname(resolved)
  const root = discoverIdentityRoot(baselineDir)

  // A bypassFilters configuration finding (ADR-010) can never legitimately
  // become "known, pre-existing debt" — it means the rule's own instrument
  // is broken right now. Recording it would let a future run of `check
  // --baseline` silently treat a dead selector as already-accepted.
  const entries: BaselineEntry[] = violations
    .filter((v) => v.bypassFilters !== true)
    .map((v) => ({
      rule: v.rule,
      file: toRelativePath(v.file, baselineDir),
      line: v.line,
      hash: hashViolation(v, root),
      // Written only for metric findings, so a baseline with none is
      // byte-identical to one from before this field existed.
      ...(v.measured === undefined ? {} : { measured: v.measured }),
    }))

  const baseline: BaselineFile = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    violations: entries,
  }

  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, JSON.stringify(baseline, null, 2) + '\n')
}

/**
 * A loaded baseline. Passed to check(\{ baseline \}) to filter known violations.
 */
export class Baseline {
  constructor(
    private readonly knownHashes: Set<string>,
    private readonly baselineDir: string,
    /** Computed once at load time — must match `generateBaseline()`'s root for entries to line up. */
    private readonly root?: string,
    /** hash -> accepted measurement, for metric findings. */
    private readonly accepted: Map<string, number> = new Map(),
  ) {}

  /**
   * Check if a violation is known (exists in the baseline).
   * Known violations are filtered out — they don't cause failures.
   *
   * For a metric finding (`violation.measured` set), "known" is a **ratchet**,
   * not hash equality: the finding is known if the baseline has an accepted
   * measurement for this identity AND the current measurement is no worse
   * than what was accepted. Identity alone (the hash) cannot express this —
   * it deliberately excludes the count, so an improved measurement keeps the
   * same hash as a regressed one, and hash-only matching would treat both as
   * "known" alike. Comparing the two numbers is what tells them apart: an
   * improvement stays known (still <= accepted), a regression does not (now >
   * accepted), even though neither changed which entry it matches.
   */
  isKnown(violation: ArchViolation): boolean {
    const hash = hashViolation(violation, this.root)
    if (violation.measured === undefined) return this.knownHashes.has(hash)
    const acceptedMeasurement = this.accepted.get(hash)
    if (acceptedMeasurement === undefined) return false
    return violation.measured <= acceptedMeasurement
  }

  /**
   * Filter out known violations, returning only new ones.
   *
   * A `bypassFilters` configuration finding is never treated as known, even
   * if an older or hand-edited baseline file happens to carry a matching
   * hash — `generateBaseline()` no longer writes these, but a baseline
   * generated before that fix (or hand-edited) must not be able to
   * resurrect the suppression this defends against.
   */
  filterNew(violations: ArchViolation[]): ArchViolation[] {
    return violations.filter((v) => v.bypassFilters === true || !this.isKnown(v))
  }

  /** Number of known violations in the baseline */
  get size(): number {
    return this.knownHashes.size
  }
}
