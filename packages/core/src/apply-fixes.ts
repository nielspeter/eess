import fs from 'node:fs'
import type { ArchFix, ArchViolation } from './violation.js'

/** Outcome of an `applyFixes` run. */
export interface ApplyResult {
  /**
   * Number of distinct edits applied (or, in dry-run, that would apply). Identical fixes are one
   * edit (bug 0564): a copy of an applied edit is counted neither here nor in `skipped`, since
   * that edit cures its finding too.
   */
  readonly applied: number
  /** Number of fixes skipped because they overlapped another fix that differs from them. */
  readonly skipped: number
  /** Absolute paths of the files edited (or that would be edited). */
  readonly files: readonly string[]
  /** One-line descriptions of the applied fixes, in file/offset order. */
  readonly descriptions: readonly string[]
}

/** Do two spans on the same file overlap? Touching endpoints do not overlap. */
function overlaps(a: ArchFix, b: ArchFix): boolean {
  return a.start < b.end && b.start < a.end
}

/** The same edit: one file, one span, one replacement (bug 0564). */
function sameEdit(a: ArchFix, b: ArchFix): boolean {
  return (
    a.file === b.file && a.start === b.start && a.end === b.end && a.replacement === b.replacement
  )
}

/**
 * Apply the deterministic fixes carried by `violations` (plan 0066).
 *
 * Fixes are grouped by file and applied end-to-start so earlier offsets stay
 * valid. Identical fixes (one span, one replacement, from rules that found one
 * defect) are one edit, applied once (bug 0564). Overlapping fixes that differ
 * are **all skipped** — a fix is only ever applied when it is unambiguous, so a
 * collision is reported, never guessed.
 * With `write: false` (dry-run) nothing is written; the result still reports
 * what would change.
 */
export function applyFixes(
  violations: readonly ArchViolation[],
  opts: { write: boolean },
): ApplyResult {
  const byFile = new Map<string, ArchFix[]>()
  for (const v of violations) {
    if (v.fix === undefined) continue
    const list = byFile.get(v.fix.file)
    if (list) list.push(v.fix)
    else byFile.set(v.fix.file, [v.fix])
  }

  let applied = 0
  let skipped = 0
  const files: string[] = []
  const descriptions: string[] = []

  for (const [file, fixes] of byFile) {
    // Bug 0564: an identical fix (same span, same replacement) is the same edit, proposed by two
    // rules that found one defect; fold those into one before the overlap test, so only fixes that
    // disagree are dropped.
    const distinct = fixes.filter((f, i) => fixes.findIndex((o) => sameEdit(o, f)) === i)
    // Drop any fix that overlaps another (skip both) — never write a guess.
    const safe = distinct.filter((f) => !distinct.some((o) => o !== f && overlaps(f, o)))
    // A fix is skipped when no edit equal to it is applied; an identical copy of an applied one is not.
    skipped += fixes.filter((f) => !safe.some((s) => sameEdit(s, f))).length
    if (safe.length === 0) continue

    // Apply last-first so each edit's offsets remain valid.
    const ordered = [...safe].sort((a, b) => b.start - a.start)
    let content = fs.readFileSync(file, 'utf8')
    for (const f of ordered) {
      content = content.slice(0, f.start) + f.replacement + content.slice(f.end)
    }
    if (opts.write) fs.writeFileSync(file, content)

    files.push(file)
    applied += safe.length
    // Report in forward (offset-ascending) order for readability.
    for (const f of [...safe].sort((a, b) => a.start - b.start)) descriptions.push(f.describe)
  }

  return { applied, skipped, files, descriptions }
}
