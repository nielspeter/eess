import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { ArchViolation } from './violation.js'
import { writeStderr } from './stderr.js'

/**
 * A diff filter that restricts violation reporting to files
 * changed since a base branch.
 *
 * IMPORTANT: Rules evaluate the FULL project (needed for cross-file
 * rules like cycles and layer ordering). Only the REPORTING is filtered
 * to changed files. This ensures correctness — a new file that creates
 * a cycle is detected even though the cycle involves unchanged files.
 */
export class DiffFilter {
  private readonly changedFiles: Set<string> | null

  /**
   * The branch this filter diffed against, for the suppression notice plan
   * 0071 added. Defaulted rather than required: the constructor is public API
   * (`src/index.ts` exports `DiffFilter`), so an existing
   * `new DiffFilter(files)` must keep compiling.
   */
  readonly baseBranch: string

  constructor(changedFiles: Set<string> | null, baseBranch: string = 'the base branch') {
    this.changedFiles = changedFiles
    this.baseBranch = baseBranch
  }

  /**
   * Filter violations to only those in changed files.
   * If changedFiles is null (git error), returns all violations unfiltered.
   */
  filterToChanged(violations: ArchViolation[]): ArchViolation[] {
    const files = this.changedFiles
    if (files === null) return violations
    // Config-level meta-findings (empty selector/discovery) have no changed file
    // to attribute to — never filter them out (ADR-008; plan 0067).
    //
    // Kept from the kernel's copy when the two were unified, because it is the
    // half that says WHY: a `bypassFilters` configuration finding (ADR-010's
    // zero-examined / expired-`.expectEmpty()` violations) has `file: ''` and can
    // never be a member of `changedFiles`. Without this branch, "unsuppressable"
    // was false for the most realistic adoption path — a rule whose instrument
    // silently broke reported nothing at all under `--changed`, with no
    // diagnostic that anything had been hidden.
    // `relatedFiles` (bug 0239): a finding about a RELATIONSHIP concerns several
    // files and can only be reported at one of them. Keeping it when any of them
    // changed is what makes `--changed` honest for it — the alternative measured
    // in 0239 was that the developer who introduced a duplicate saw nothing,
    // because the finding was anchored on the file they had not edited.
    return violations.filter(
      (v) =>
        v.bypassFilters === true ||
        files.has(v.file) ||
        (v.relatedFiles?.some((f) => files.has(f)) ?? false),
    )
  }

  /** Number of changed files detected, or -1 if diff unavailable */
  get size(): number {
    return this.changedFiles === null ? -1 : this.changedFiles.size
  }
}

/**
 * Create a diff filter from git, comparing HEAD against a base branch.
 *
 * Uses `git diff --name-only <base>...HEAD` to find changed files.
 * Resolves relative paths to absolute paths for matching against
 * violation file paths (which are always absolute).
 *
 * @param baseBranch - The base branch to diff against (default: 'main')
 * @returns A DiffFilter for use with check(\{ diff \})
 *
 * @example
 * // Only report violations in files changed since main
 * classes(p).should().notContain(call('eval')).check(\{ diff: diffAware('main') \})
 */
export function diffAware(baseBranch: string = 'main'): DiffFilter {
  const cwd = process.cwd()

  let output: string
  try {
    output = execFileSync('git', ['diff', '--name-only', `${baseBranch}...HEAD`], {
      encoding: 'utf-8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error: unknown) {
    // Not a git repo, or the base branch doesn't exist — skip filtering (report
    // all violations). The cause is named: "could not run git diff" alone sends
    // a reader looking for a missing branch when the real answer may be that git
    // is not installed, or that the cwd is not a repository at all.
    writeStderr(
      `[eess] Could not run git diff against '${baseBranch}' ` +
        `(${error instanceof Error ? error.message.split('\n')[0] : String(error)}). ` +
        'All violations will be reported.',
    )
    return new DiffFilter(null, baseBranch)
  }

  if (output === '') {
    // No changes — empty set means nothing is "changed", so all violations are filtered out
    return new DiffFilter(new Set(), baseBranch)
  }

  const changedFiles = new Set(
    output.split('\n').map((relativePath) => path.resolve(cwd, relativePath)),
  )

  return new DiffFilter(changedFiles, baseBranch)
}
