#!/usr/bin/env node
/**
 * Workspace integrity guardrails for the eess monorepo (plan 0051, Phase 1).
 *
 * npm workspaces has two failure modes this repo must not regress into:
 *
 *  1. Phantom dependencies — hoisting lets a package `import` a package that only
 *     a sibling declares; it works in the workspace but breaks on a standalone
 *     install from the registry. Each package's `src/` may import only: node
 *     builtins, its own name, and packages it declares in
 *     dependencies/peerDependencies/optionalDependencies. This also enforces the
 *     kernel-purity guarantee for free: `@nielspeter/eess` declares no deps, so
 *     any bare import there (ts-morph, picomatch, a dialect) fails.
 *
 *  2. Broken local linking — npm has no `workspace:` protocol, so a lagging
 *     version range can silently install the published kernel instead of linking
 *     the local one. Every `@nielspeter/eess*` package must resolve to a symlink
 *     into `packages/`, not a real directory from the registry.
 *
 * Exits non-zero on any violation. Zero dependencies — node builtins only.
 * Run: `npm run check:integrity`.
 */

import { builtinModules } from 'node:module'
import { readFileSync, readdirSync, statSync, lstatSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const BUILTINS = new Set(builtinModules)
const WORKSPACE_PKGS = ['@nielspeter/eess', '@nielspeter/eess-ts', '@nielspeter/eess-mermaid']

const problems = []

// ---------- helpers ----------

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

function walkTs(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkTs(p, acc)
    else if (e.name.endsWith('.ts')) acc.push(p)
  }
}

// The npm package a bare specifier belongs to: '@scope/name/sub' -> '@scope/name',
// 'pkg/sub' -> 'pkg'.
function packageOf(spec) {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const FROM_RE = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g

// Strip block and line comments so JSDoc `@example import ... from '...'` snippets
// (this codebase documents its own API heavily) aren't mistaken for real imports.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// A syntactically valid npm package specifier. Filters out string/template noise
// like `${importPath}`, `DomainError`, or escaped example strings that the regex
// would otherwise pick up from a codebase whose job is analyzing import strings.
const VALID_PKG_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(?:\/.+)?$/

// Drop `import type …`/`export type …` statements: they are erased at runtime,
// so they can never cause a runtime standalone-install failure — which is the
// only thing the phantom-dep check guards. (A value import of a devDep — the
// jiti bug — is NOT stripped and is still caught.) This also lets a package use
// ambient `@types/*` modules (e.g. `import type { Root } from 'mdast'`) without
// a false positive.
function stripTypeOnlyImports(src) {
  return src.replace(/\b(?:import|export)\s+type\b[\s\S]*?from\s*['"][^'"]+['"]/g, '')
}

function importSpecifiers(file) {
  const src = stripTypeOnlyImports(stripComments(readFileSync(file, 'utf8')))
  const out = new Set()
  for (const m of src.matchAll(FROM_RE)) out.add(m[1])
  return out
}

// ---------- 1. phantom dependencies ----------

const packagesDir = join(ROOT, 'packages')
const pkgDirs = readdirSync(packagesDir).filter((d) => statSync(join(packagesDir, d)).isDirectory())

for (const dir of pkgDirs) {
  const pkgRoot = join(packagesDir, dir)
  let pkg
  try {
    pkg = readJson(join(pkgRoot, 'package.json'))
  } catch {
    continue
  }
  const declared = new Set([
    pkg.name,
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ])

  const files = []
  walkTs(join(pkgRoot, 'src'), files)
  for (const file of files) {
    for (const spec of importSpecifiers(file)) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue // relative
      const bare = spec.startsWith('node:') ? spec.slice(5) : spec
      if (BUILTINS.has(bare)) continue // node builtin
      if (!VALID_PKG_RE.test(spec)) continue // not a real package specifier (string noise)
      const owner = packageOf(spec)
      if (!declared.has(owner)) {
        problems.push(
          `phantom dep: ${pkg.name} src imports "${spec}" but "${owner}" is not in its package.json ` +
            `(${file.replace(ROOT + '/', '')})`,
        )
      }
    }
  }
}

// ---------- 2. local linking ----------

for (const name of WORKSPACE_PKGS) {
  const modPath = join(ROOT, 'node_modules', name)
  let st
  try {
    st = lstatSync(modPath)
  } catch {
    problems.push(`local linking: ${name} is not installed in node_modules`)
    continue
  }
  if (!st.isSymbolicLink()) {
    problems.push(
      `local linking: ${name} is a real directory, not a workspace symlink — ` +
        `it was likely installed from the registry instead of linked locally`,
    )
    continue
  }
  const target = readlinkSync(modPath)
  if (!target.includes('packages/')) {
    problems.push(`local linking: ${name} symlinks to "${target}", expected a packages/ path`)
  }
}

// ---------- report ----------

if (problems.length > 0) {
  console.error(`\nWorkspace integrity: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  console.error('')
  process.exit(1)
}
console.error(
  `Workspace integrity: OK — ${pkgDirs.length} packages, no phantom deps, all @nielspeter/eess* locally linked.`,
)
