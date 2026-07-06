import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Condition } from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import type { MdPointer } from '../model/pointers.js'
import { mdViolation } from '../model/violation.js'

/** Result of a unique-path-suffix lookup. */
type SuffixMatch =
  | { readonly kind: 'unique'; readonly file: string }
  | { readonly kind: 'ambiguous' }
  | { readonly kind: 'none' }

/** How a pointer path resolves against the repo file index. */
export interface PointerResolveOptions {
  /**
   * - `suffix` (default) — a pointer resolves to the one file whose repo-relative
   *   path *ends with* the pointer path on a `/` boundary. Bare basenames are the
   *   single-segment case, so `index.vue` and `admin/index.vue` resolve by the
   *   same rule. Multiple matches → ambiguous (skipped, never failed).
   * - `exact` — a pointer must be the exact repo-relative path; no suffix or
   *   basename leniency. Choose this when pointers are required to carry full
   *   paths (e.g. the external repo's `spec-check.ts` strictness).
   */
  readonly paths?: 'suffix' | 'exact'
}

/**
 * Condition: every code pointer resolves to a real file with the referenced
 * line in range. Closes over the `Corpus` for the repo file index.
 *
 * Classification mirrors the hand-rolled `spec-check.ts`:
 *  - **broken** — no file matches the pointer path
 *  - **stale**  — file exists but is shorter than the referenced line
 *  - **ambiguous** — a path-suffix matching several files → **reported, never
 *    failed** (the fix is to write more of the path), so it yields no violation
 *  - **ok** — otherwise
 *
 * Resolution (default `suffix` mode): exact repo-relative path first, else the
 * unique file whose path ends with the pointer path. `exact` mode requires the
 * full repo-relative path. `.check()` fails on broken/stale; `.warn()` reports
 * without failing. Frozen vs live scoping is done by the `areFrozen()` /
 * `areLive()` predicates upstream.
 */
export function pointerResolves(
  corpus: Corpus,
  options: PointerResolveOptions = {},
): Condition<MdPointer> {
  const mode = options.paths ?? 'suffix'
  const byBasename = new Map<string, string[]>()
  for (const rel of corpus.fileIndex) {
    const base = rel.slice(rel.lastIndexOf('/') + 1)
    const list = byBasename.get(base)
    if (list) list.push(rel)
    else byBasename.set(base, [rel])
  }

  const lineCountCache = new Map<string, number>()
  const lineCount = (rel: string): number => {
    const cached = lineCountCache.get(rel)
    if (cached !== undefined) return cached
    const n = readFileSync(join(corpus.root, rel), 'utf8').split('\n').length
    lineCountCache.set(rel, n)
    return n
  }

  return {
    description: 'resolve to a real file and line',
    evaluate: (pointers, ctx) =>
      pointers.flatMap((p) => {
        const wanted = p.path.replace(/^\.?\//, '')
        // The unique file whose path ends with `wanted` (on a / boundary).
        // Narrow by last segment, then confirm the full suffix.
        const uniqueSuffix = (): SuffixMatch => {
          const lastSeg = wanted.slice(wanted.lastIndexOf('/') + 1)
          const matches = (byBasename.get(lastSeg) ?? []).filter(
            (f) => f === wanted || f.endsWith('/' + wanted),
          )
          const only = matches[0]
          if (matches.length === 1 && only !== undefined) return { kind: 'unique', file: only }
          if (matches.length > 1) return { kind: 'ambiguous' }
          return { kind: 'none' }
        }

        let targetRel: string | null = null
        if (corpus.fileIndex.has(wanted)) {
          // Exact repo-relative path — preferred in both modes.
          targetRel = wanted
        } else if (mode === 'suffix') {
          const m = uniqueSuffix()
          if (m.kind === 'ambiguous') return [] // reported elsewhere, never failed
          targetRel = m.kind === 'unique' ? m.file : null
        }

        if (targetRel === null) {
          // Broken. If exactly one file uniquely resolves the shortened path, the
          // repair is deterministic — attach an autofix that expands it to the
          // full repo-relative path (plan 0066). Ambiguous → no fix.
          const m = uniqueSuffix()
          const fix =
            m.kind === 'unique' && m.file !== wanted
              ? {
                  file: p.doc.file,
                  start: p.pathStart,
                  end: p.pathEnd,
                  replacement: m.file,
                  describe: `rewrite pointer "${p.path}" → "${m.file}"`,
                }
              : undefined
          return [
            mdViolation({
              element: `${p.doc.relPath} → ${p.raw}`,
              file: p.doc.file,
              line: p.line,
              message: `broken code pointer: "${p.raw}" — no such file in the repo`,
              sourceText: p.doc.text,
              fix,
              context: ctx,
            }),
          ]
        }

        const lines = lineCount(targetRel)
        if (Math.max(p.startLine, p.endLine) > lines) {
          return [
            mdViolation({
              element: `${p.doc.relPath} → ${p.raw}`,
              file: p.doc.file,
              line: p.line,
              message: `stale code pointer: ${targetRel} has ${lines} lines; "${p.raw}" references line ${Math.max(
                p.startLine,
                p.endLine,
              )}`,
              sourceText: p.doc.text,
              context: ctx,
            }),
          ]
        }
        return []
      }),
  }
}
