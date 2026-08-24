/**
 * The public surface each package exports, and whether the docs mention it.
 *
 * The gate this feeds exists because `check:docs-code` compiles the fences that
 * EXIST and requires none — so a new undocumented export is silent, and deleting
 * a documented section is silent. Measured when bug 0220 was filed: 279 of 696
 * exported symbols appeared in no `docs/` page, no package README and no ADR.
 *
 * `KERNEL_INTERNAL` and friends already encode "exported, but not surface a
 * standalone consumer builds against" — `check:family` forces dialects to
 * re-export every kernel symbol their own source imports, so "exported" is a much
 * wider set than "public API" BY DESIGN. Those lists are the honest exemption and
 * they are read, not duplicated.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  KERNEL_INTERNAL,
  FAMILY_ONLY,
  ANSI_INTERNAL,
  KERNEL_PRIVATE_BEFORE_THE_SPLIT,
} from './kernel-surface.mjs'

export const PACKAGES = ['core', 'ts', 'md', 'mermaid', 'gherkin', 'crossvalidate']

/** Names already declared as not-public-surface, from the one place that says so. */
export const NOT_PUBLIC_SURFACE = new Set([
  ...KERNEL_INTERNAL,
  ...FAMILY_ONLY,
  ...ANSI_INTERNAL,
  ...KERNEL_PRIVATE_BEFORE_THE_SPLIT,
])

const NAMED_EXPORT_RE = /^export\s+(type\s+)?\{([^}]+)\}/gm
/** `export const X`, `export function X`, `export class X`, `export type X = …` */
const DECLARATION_EXPORT_RE =
  /^export\s+(?:declare\s+)?(type|interface|const|let|var|function\*?|async\s+function\*?|class|enum|abstract\s+class)\s+([A-Za-z_]\w*)/gm
/** `export * from './x.js'` — a blanket forward this has to follow. */
const STAR_EXPORT_RE = /^export\s+\*\s+from\s*['"](\.[^'"]+)['"]/gm
/** `export * as ns from './x.js'` — one name, not a spread. */
const STAR_AS_EXPORT_RE = /^export\s+\*\s+as\s+([A-Za-z_]\w*)\s+from/gm

/**
 * Every named export reachable from a package's entry point.
 *
 * Three shapes beyond the braced list, each added because review measured the
 * gate blind to it — and blind in the FAIL-OPEN direction, which for a coverage
 * gate is the whole ballgame: a symbol the scan cannot see is a symbol the
 * documentation requirement silently does not apply to. Measured before the fix:
 * appending `export const X = 1` and `export * from './silent-exclusion.js'` to
 * the kernel barrel left the denominator unchanged and the gate green.
 *
 * `export *` is followed one module at a time, depth-limited and cycle-guarded.
 * A specifier that cannot be read is NOT swallowed — it is reported as a
 * `?unresolved` entry so the caller sees a hole rather than a smaller number.
 */
function readEntry(repoRoot, pkg, relPath, seen, depth, out) {
  if (depth > 8 || seen.has(relPath)) return
  seen.add(relPath)
  let src
  try {
    src = readFileSync(join(repoRoot, 'packages', pkg, 'src', relPath), 'utf8')
  } catch {
    out.push({
      pkg,
      name: `UNRESOLVED_${relPath.replace(/\W/g, '_')}`,
      typeOnly: false,
      unresolved: true,
    })
    return
  }
  for (const m of src.matchAll(NAMED_EXPORT_RE)) {
    const typeOnly = Boolean(m[1])
    for (const part of m[2].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^[A-Za-z_]\w*$/.test(name)) out.push({ pkg, name, typeOnly })
    }
  }
  for (const m of src.matchAll(DECLARATION_EXPORT_RE)) {
    const kind = m[1] ?? ''
    const name = m[2]
    if (name) out.push({ pkg, name, typeOnly: kind === 'type' || kind === 'interface' })
  }
  for (const m of src.matchAll(STAR_AS_EXPORT_RE)) {
    const name = m[1]
    if (name) out.push({ pkg, name, typeOnly: false })
  }
  for (const m of src.matchAll(STAR_EXPORT_RE)) {
    const spec = m[1]
    if (!spec) continue
    // './core/index.js' -> 'core/index.ts', relative to this file's directory
    const here = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/') + 1) : ''
    const target = `${here}${spec.replace(/^\.\//, '').replace(/\.js$/, '.ts')}`
    readEntry(repoRoot, pkg, target, seen, depth + 1, out)
  }
}

/**
 * Every named export of every entry point a package PUBLISHES.
 *
 * Driven off `package.json`'s `exports` map, not a hardcoded `src/index.ts`.
 * Review measured what the hardcoded form cost: `@nielspeter/eess-crossvalidate`
 * has no `index.ts` at all — it is seven independent subpath entries — so the
 * whole package contributed **zero** and the `catch { return [] }` said nothing.
 * eess-ts's twelve subpaths (`./presets`, `./graphql`, ten `./rules/*`) were
 * likewise unscanned. A silently-skipped package inside a coverage gate is the
 * fail-open shape this file exists to catch.
 */
export function exportsOf(repoRoot, pkg) {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(repoRoot, 'packages', pkg, 'package.json'), 'utf8'))
  } catch {
    return []
  }
  const entries = new Set()
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    // `@nielspeter/eess/internal` is family plumbing by declaration (ADR-011);
    // it is not public API and carries no documentation obligation.
    if (subpath === './internal') continue
    const file = typeof target === 'string' ? target : (target?.types ?? target?.import)
    if (typeof file !== 'string') continue
    const rel = file
      .replace(/^\.\//, '')
      .replace(/^dist\//, '')
      .replace(/\.d\.ts$/, '.ts')
      .replace(/\.js$/, '.ts')
    // A bin entry is a CLI, not an API surface.
    if (/(^|\/)bin\.ts$/.test(rel)) continue
    entries.add(rel)
  }
  if (entries.size === 0) entries.add('index.ts')

  const out = []
  const seenFiles = new Set()
  for (const entry of entries) readEntry(repoRoot, pkg, entry, seenFiles, 0, out)
  const seen = new Set()
  return out.filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)))
}

/** Concatenated prose a reader could plausibly find a symbol in. */
export function documentationText(repoRoot) {
  const parts = []
  const push = (dir, filter) => {
    let entries
    try {
      entries = readdirSync(join(repoRoot, dir), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isFile() && filter(e.name))
        parts.push(readFileSync(join(repoRoot, dir, e.name), 'utf8'))
    }
  }
  push('docs', (n) => n.endsWith('.md'))
  push('adr', (n) => n.endsWith('.md'))
  for (const p of PACKAGES) {
    try {
      parts.push(readFileSync(join(repoRoot, 'packages', p, 'README.md'), 'utf8'))
    } catch {
      /* a package without a README is check:spec's business, not this gate's */
    }
  }
  return parts.join('\n')
}

/**
 * Public exports that appear nowhere in the documentation.
 *
 * A word-boundary match is deliberately GENEROUS — it counts an incidental
 * mention as documented. The gate is about symbols a reader cannot find at all;
 * judging whether a mention teaches anything is Tier 4 and belongs to review.
 * Being generous also means a violation here is never arguable.
 */
export function undocumentedExports(repoRoot) {
  const docs = documentationText(repoRoot)
  const all = PACKAGES.flatMap((p) => exportsOf(repoRoot, p))
  const public_ = all.filter((e) => !NOT_PUBLIC_SURFACE.has(e.name))
  const missing = public_.filter((e) => !new RegExp(`\\b${e.name}\\b`).test(docs))
  return { all, public: public_, missing }
}
