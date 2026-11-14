#!/usr/bin/env node
/**
 * Spike 0651 (proposal 021, ask A2): can a TypeScript producer give plan 0649's `CodeFacts`, at
 * what cost, and does the line rule built on them agree with the judged samples?
 *
 * A prototype, not a producer: it loads the package tsconfigs through eess-ts's public `project()`,
 * as an eess-ts producer would, walks every source file once for its names, and shapes them to the
 * contract proposal 021 gives (`coverage`, `names` with `declaration | import | use`, a declaration's
 * `end`, `scope`, `container` and attached `doc`). It then applies plan 0649's line rule to every
 * named reference the stock pattern reads through eess-md, with the enforcement review's
 * stale-facts guard (a green also needs the name as a token on the cited line), and prints each
 * class's count and, with `--samples <dir>`, the rule against the judged samples.
 *
 * Run: npm run build -w @nielspeter/eess -w @nielspeter/eess-ts -w @nielspeter/eess-md, then
 *   node scripts/measure-code-facts.mjs [--json] [--samples <dir holding judged-*.tsv>]
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Node, SyntaxKind } from 'ts-morph'
import { project } from '../packages/ts/dist/index.js'
import { corpus, mentions } from '../packages/md/dist/index.js'
import { pathSuffixIndex } from '../packages/core/dist/internal.js'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const json = args.includes('--json')
const samplesAt = args.includes('--samples') ? args[args.indexOf('--samples') + 1] : undefined

// --- The producer: one walk per covered file. ---------------------------------------------------

const t0 = performance.now()
const projects = ['core', 'ts', 'md', 'mermaid', 'gherkin', 'crossvalidate']
  .map((p) => join(ROOT, 'packages', p, 'tsconfig.json'))
  .filter((p) => existsSync(p))
  .map((p) => project(p))
const loadMs = performance.now() - t0

const DECL = (n) =>
  Node.isFunctionDeclaration(n) ||
  Node.isClassDeclaration(n) ||
  Node.isInterfaceDeclaration(n) ||
  Node.isTypeAliasDeclaration(n) ||
  Node.isEnumDeclaration(n) ||
  Node.isVariableDeclaration(n) ||
  Node.isMethodDeclaration(n) ||
  Node.isMethodSignature(n) ||
  Node.isPropertyDeclaration(n) ||
  Node.isPropertySignature(n) ||
  Node.isPropertyAssignment(n) ||
  Node.isGetAccessorDeclaration(n) ||
  Node.isSetAccessorDeclaration(n) ||
  Node.isModuleDeclaration(n) ||
  Node.isEnumMember(n) ||
  Node.isParameterDeclaration(n) ||
  Node.isBindingElement(n) ||
  Node.isTypeParameterDeclaration(n) ||
  ((Node.isFunctionExpression(n) || Node.isClassExpression(n)) && n.getNameNode() !== undefined)

const MEMBER = (n) =>
  Node.isMethodDeclaration(n) ||
  Node.isPropertyDeclaration(n) ||
  Node.isMethodSignature(n) ||
  Node.isPropertySignature(n) ||
  Node.isGetAccessorDeclaration(n) ||
  Node.isSetAccessorDeclaration(n) ||
  Node.isEnumMember(n)

/** The declaration that owns `n`'s attached JSDoc: a variable's statement, else itself. */
const owner = (n) => (Node.isVariableDeclaration(n) ? (n.getVariableStatement() ?? n) : n)

/** The nearest enclosing named declaration's name, or null at module scope. */
function containerOf(n) {
  for (let p = owner(n).getParent(); p !== undefined; p = p.getParent()) {
    if (Node.isSourceFile(p)) return null
    if (
      (Node.isClassDeclaration(p) ||
        Node.isInterfaceDeclaration(p) ||
        Node.isFunctionDeclaration(p) ||
        Node.isMethodDeclaration(p) ||
        Node.isModuleDeclaration(p) ||
        Node.isEnumDeclaration(p)) &&
      p.getName?.() !== undefined
    )
      return p.getName()
    if (Node.isVariableDeclaration(p)) return p.getName()
  }
  return null
}

function scopeOf(n) {
  const o = owner(n)
  if (Node.isSourceFile(o.getParent())) return 'module'
  if (MEMBER(n)) return 'member'
  return 'local'
}

/** The attached JSDoc only (`getJsDocs()`), never leading trivia or a file header. */
function docOf(n) {
  const o = owner(n)
  const docs = typeof o.getJsDocs === 'function' ? o.getJsDocs() : []
  if (docs.length === 0) return null
  const first = docs[0]
  const last = docs[docs.length - 1]
  return { start: first.getStartLineNumber(), end: last.getEndLineNumber() }
}

const t1 = performance.now()
const coverage = new Set()
const names = []
const seen = new Set()
for (const p of projects) {
  for (const sf of p.getSourceFiles()) {
    const rel = relative(ROOT, sf.getFilePath())
    if (rel.startsWith('..') || seen.has(rel)) continue
    seen.add(rel)
    coverage.add(rel)
    // `forEachDescendant` does not enter JSDoc, so `{@link X}` is never a use (proposal 021).
    sf.forEachDescendant((node) => {
      const k = node.getKind()
      if (k !== SyntaxKind.Identifier && k !== SyntaxKind.PrivateIdentifier) return
      const name = node.getText()
      const line = node.getStartLineNumber()
      const parent = node.getParent()
      if (parent && DECL(parent) && parent.getNameNode?.() === node) {
        names.push({
          kind: 'declaration',
          file: rel,
          name,
          line,
          end: owner(parent).getEndLineNumber(),
          scope: scopeOf(parent),
          container: containerOf(parent),
          doc: docOf(parent),
        })
      } else if (
        parent &&
        (Node.isImportSpecifier(parent) ||
          Node.isImportClause(parent) ||
          Node.isNamespaceImport(parent) ||
          Node.isExportSpecifier(parent) ||
          Node.isImportEqualsDeclaration(parent))
      ) {
        names.push({ kind: 'import', file: rel, name, line })
      } else {
        names.push({ kind: 'use', file: rel, name, line })
      }
    })
  }
}
const walkMs = performance.now() - t1
const facts = { label: 'the six package tsconfigs', coverage, names }

// --- The rule (plan 0649, with the stale-facts guard). -----------------------------------------

const byFileName = new Map()
for (const n of names) {
  const key = `${n.file}\u0000${n.name}`
  if (!byFileName.has(key)) byFileName.set(key, [])
  byFileName.get(key).push(n)
}
const fileLines = new Map()
const linesOf = (rel) => {
  if (!fileLines.has(rel)) fileLines.set(rel, readFileSync(join(ROOT, rel), 'utf8').split('\n'))
  return fileLines.get(rel)
}
const tokensOf = (text) => new Set(text.split(/[^A-Za-z0-9_$]+/).filter((t) => t !== ''))

const c = corpus({
  cwd: ROOT,
  roots: ['work/**', 'adr/**', 'docs/**'],
  frozen: ['**/completed/**', '**/wont-do/**', '**/fixed/**', '**/archived/**', 'work/spikes/**'],
  expectEmptyFrozen: ['**/wont-do/**', '**/archived/**'],
})
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g
const refs = mentions(c, { pattern: NAMED, keepBackticks: true }).select({
  label: 'm',
  identify: (m) => ({ name: m.text }),
}).elements
const index = pathSuffixIndex(c.fileIndex)
const FROZEN = /\/(completed|wont-do|fixed|archived)\/|^work\/spikes\//

function judge(m) {
  const cg = m.codeGroups ?? []
  if (!['name', 'path', 'line'].every((g) => cg.includes(g))) return { cls: 'not-code' }
  const name = m.groups.name
  const judged = name.split('.').pop()
  if (!/^[A-Za-z_$][\w$]+$/.test(judged)) return { cls: 'not-a-name' }
  const wanted = m.groups.path.replace(/^\.?\//, '')
  const r = index.resolve(wanted)
  const rel = r.kind === 'exact' || r.kind === 'unique' ? r.file : null
  if (r.kind === 'ambiguous') return { cls: 'ambiguous' }
  if (rel === null) return { cls: 'broken' }
  if (rel === m.doc.relPath) return { cls: 'self-cite' }
  const line = Number(m.groups.line)
  const lines = linesOf(rel)
  if (line < 1 || line > lines.length) return { cls: 'stale' }
  if (!coverage.has(rel)) return { cls: 'not-covered', rel }
  const all = byFileName.get(`${rel}\u0000${judged}`) ?? []
  const onLine = all.filter((n) => n.line === line)
  const token = tokensOf(lines[line - 1]).has(judged)
  if (onLine.length > 0 && token) return { cls: 'holds', rel }
  if (onLine.length > 0 && !token) return { cls: 'stale-facts', rel }
  const decls = all.filter((n) => n.kind === 'declaration')
  if (decls.some((d) => d.doc !== null && line >= d.doc.start && line <= d.doc.end))
    return { cls: 'doc-comment', rel }
  if (token) return { cls: 'text-only', rel }
  if (decls.some((d) => line > d.line && line <= d.end)) return { cls: 'body', rel }
  const outer = decls.filter((d) => d.scope !== 'local')
  if (outer.length === 1) return { cls: 'drift-declared-once', rel, at: outer[0].line }
  if (outer.length > 1) return { cls: 'declared-many', rel }
  if (decls.length > 0) return { cls: 'local-only', rel }
  if (all.some((n) => n.kind === 'import')) return { cls: 'imported-only', rel }
  if (all.length > 0) return { cls: 'used-only', rel }
  return { cls: 'no-fact', rel }
}

const t2 = performance.now()
const rows = refs.map((m) => ({
  doc: m.doc.relPath,
  line: m.line,
  name: m.groups.name,
  pointer: `${m.groups.path ?? ''}:${m.groups.line ?? ''}${m.groups.end ? `-${m.groups.end}` : ''}`,
  live: !FROZEN.test(m.doc.relPath),
  ...judge(m),
}))
const ruleMs = performance.now() - t2

const tally = (rs) => {
  const out = {}
  for (const r of rs) out[r.cls] = (out[r.cls] ?? 0) + 1
  return out
}

// --- Against the judged samples. ---------------------------------------------------------------

const GREEN = new Set(['holds', 'doc-comment'])
let samples
if (samplesAt !== undefined) {
  const readTsv = (f) => {
    const [head, ...body] = readFileSync(join(samplesAt, f), 'utf8').trim().split('\n')
    const cols = head.split('\t')
    return body.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])))
  }
  const key = (doc, name, pointer) => `${doc.replace(/:\d+$/, '')}\u0000${name}\u0000${pointer}`
  const mine = new Map(rows.map((r) => [key(r.doc, r.name, r.pointer), r]))
  samples = {}
  for (const [sample, judged] of [
    ['sample-holders.tsv', 'judged-holders.tsv'],
    ['sample-misses.tsv', 'judged-misses.tsv'],
    ['sample-span.tsv', 'judged-span.tsv'],
  ]) {
    const verdict = new Map(readTsv(judged).map((r) => [r.id, r.verdict]))
    const cross = {}
    let unmatched = 0
    for (const s of readTsv(sample)) {
      const r = mine.get(key(s.doc, s.name, s.pointer))
      if (r === undefined) {
        unmatched++
        continue
      }
      const v = verdict.get(s.id) ?? '?'
      const side = GREEN.has(r.cls) ? 'green' : r.cls
      const k = `${v} → ${side}`
      cross[k] = (cross[k] ?? 0) + 1
    }
    samples[sample] = { cross, unmatched }
  }
}

const result = {
  cost: {
    projects: projects.length,
    loadMs: Math.round(loadMs),
    walkMs: Math.round(walkMs),
    ruleMs: Math.round(ruleMs),
    heapMB: Math.round(process.memoryUsage().heapUsed / 1e6),
  },
  facts: {
    coveredFiles: coverage.size,
    names: names.length,
    byKind: tally(names.map((n) => ({ cls: n.kind }))),
    declarationsWithDoc: names.filter((n) => n.kind === 'declaration' && n.doc !== null).length,
    docEndingAtOrAfterLine: names.filter(
      (n) => n.kind === 'declaration' && n.doc !== null && n.doc.end >= n.line,
    ).length,
  },
  references: { examined: rows.length, all: tally(rows), live: tally(rows.filter((r) => r.live)) },
  ...(samples ? { samples } : {}),
}
if (json) console.log(JSON.stringify({ ...result, rows }, null, 1))
else console.log(JSON.stringify(result, null, 1))
