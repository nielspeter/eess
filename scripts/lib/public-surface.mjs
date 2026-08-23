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

/** Every named export of a package's entry point, with whether it is a type-only export. */
export function exportsOf(repoRoot, pkg) {
  let src
  try {
    src = readFileSync(join(repoRoot, 'packages', pkg, 'src', 'index.ts'), 'utf8')
  } catch {
    return []
  }
  const out = []
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
  return out
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
