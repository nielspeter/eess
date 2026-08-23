#!/usr/bin/env node
/**
 * Dogfood: type-check + no-deprecated-lint the TypeScript code fences in docs/
 * and every packages/<name>/README.md (plan 0082; README scope added plan 0089
 * round 3 — a dialect's own README teaching code with the same rot risk had no
 * coverage at all, confirmed by a stale `packages/md/README.md` example that
 * silently didn't compile standalone).
 *
 * The docs teach code, but nothing compiled it — so a stale example (a moved import,
 * a removed/renamed method, a changed signature, a deprecated call) rots uncaught.
 * This extracts every import-bearing ```ts / ```typescript fence and checks each
 * with TWO passes, because no single tool catches both classes:
 *   - `tsc --noEmit`                    — imports resolve, methods/signatures exist;
 *   - ESLint `@typescript-eslint/no-deprecated` — a @deprecated-but-valid call (tsc
 *                                          exits 0 on those).
 * A fence immediately preceded by `<!-- eess-docs-code-skip: reason -->` is checked by
 * neither pass (a "don't do this" block, or one leaning on prior context).
 *
 * Type-check only — no fixtures, no execution: `project('tsconfig.json')` type-checks
 * fine even though the path is fake at runtime. Fragments (fences with no `import`, or
 * with an `import` but no self-contained root-selection call — `project`/`workspace`
 * for eess-ts, `corpus` for eess-md, `features` for eess-gherkin) are skipped — they
 * aren't compilable units. Run: `npm run check:docs-code`.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { undocumentedExports } from './lib/public-surface.mjs'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'

const DOCS = 'docs'
// Each package's own README teaches code too — same rot risk, same fix. Only
// the direct packages/<name>/README.md, not nested docs (tests/fixtures/**
// READMEs would drag in fixture-only, deliberately-non-compiling examples).
const PACKAGE_READMES = readdirSync('packages', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join('packages', e.name, 'README.md'))
  .filter((p) => {
    try {
      readFileSync(p)
      return true
    } catch {
      return false
    }
  })
const TMP = '.docs-code-check'
const SKIP_RE = /eess-docs-code-skip/
const t0 = Date.now()
const elapsed = () => {
  const ms = Date.now() - t0
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

// ---------- 1. extract import-bearing ts fences (honour the skip directive) ----------
function mdFiles(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && !e.name.startsWith('.')) mdFiles(join(dir, e.name), acc)
    } else if (e.name.endsWith('.md')) {
      acc.push(join(dir, e.name))
    }
  }
  return acc
}

const fences = [] // { file, fence, code, tmp }
let fragments = 0
let skipped = 0
for (const file of [...mdFiles(DOCS), ...PACKAGE_READMES]) {
  const kids = fromMarkdown(readFileSync(file, 'utf8')).children
  let fence = 0
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i]
    if (node.type !== 'code') continue
    const lang = (node.lang ?? '').toLowerCase()
    if (lang !== 'ts' && lang !== 'typescript') continue
    fence++
    // Self-contained = imports its own root-selection entry point AND calls it
    // (`project(...)` / `workspace(...)` for eess-ts, `corpus(...)` for eess-md,
    // `features(...)` for eess-gherkin) — not merely "some import exists and the
    // entry function is called somewhere." A fence that calls `project(...)`
    // without importing `project` itself (assuming it from an earlier fence's
    // import, a real shape found in packages/crossvalidate/README.md's narrative
    // sequence) is exactly the fragment case this guards against — the entry
    // import name must appear in THIS fence's own import list, not just anywhere.
    const ENTRY_FN = /(?:project|workspace|corpus|features)/
    const importsEntryFn = new RegExp(
      `^\\s*import\\s+(?:type\\s+)?\\{[^}]*\\b${ENTRY_FN.source}\\b[^}]*\\}`,
      'm',
    ).test(node.value)
    const callsEntryFn = new RegExp(`\\b${ENTRY_FN.source}\\s*\\(`).test(node.value)
    const selfContained = importsEntryFn && callsEntryFn
    if (!selfContained) {
      fragments++
      continue
    }
    const prev = kids[i - 1]
    if (prev?.type === 'html' && SKIP_RE.test(prev.value)) {
      skipped++
      continue
    }
    const tmp = `${file.replace(/[^\w]+/g, '_')}__f${fence}.ts`
    fences.push({ file, fence, code: node.value, tmp })
  }
}

// non-vacuity — a zero here means the extractor broke, not a clean pass.
if (fences.length === 0) {
  console.error(
    '\n✗ check:docs-code — 0 import-bearing TS fences found; the extractor is broken (vacuous).\n',
  )
  process.exit(1)
}

// ---------- 2. materialise temp modules + a tsconfig ----------
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const byTmp = new Map()
for (const f of fences) {
  writeFileSync(join(TMP, f.tmp), f.code)
  byTmp.set(f.tmp, f)
}
writeFileSync(
  join(TMP, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        jsx: 'react-jsx',
      },
      include: ['*.ts'],
    },
    null,
    2,
  ),
)

const failures = [] // { file, fence, tool, message }
const rel = (f) => byTmp.get(basename(f))

// ---------- 3a. pass 1 — tsc --noEmit ----------
try {
  execFileSync('node_modules/.bin/tsc', ['-p', join(TMP, 'tsconfig.json'), '--noEmit'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  const out = `${err.stdout ?? ''}${err.stderr ?? ''}`
  for (const line of out.split('\n')) {
    const m = /^(.*?\.ts)\(\d+,\d+\):\s*(error TS\d+:.*)$/.exec(line.trim())
    if (!m) continue
    const src = rel(m[1])
    if (src) failures.push({ file: src.file, fence: src.fence, tool: 'tsc', message: m[2] })
  }
}

// ---------- 3b. pass 2 — ESLint @typescript-eslint/no-deprecated (type-aware) ----------
const eslint = new ESLint({
  overrideConfigFile: true, // ignore the repo's eslint.config.ts — this is a focused pass
  overrideConfig: {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: join(TMP, 'tsconfig.json'), tsconfigRootDir: process.cwd() },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { '@typescript-eslint/no-deprecated': 'error' },
  },
})
for (const res of await eslint.lintFiles([join(TMP, '*.ts')])) {
  const src = rel(res.filePath)
  if (!src) continue
  for (const msg of res.messages) {
    failures.push({
      file: src.file,
      fence: src.fence,
      tool: msg.ruleId ?? 'eslint',
      message: msg.message,
    })
  }
}

rmSync(TMP, { recursive: true, force: true })

// ---------- report ----------
console.error('')
console.error('check:docs-code · doc code-fence checks (tsc + no-deprecated)')
console.error(
  `  scanned   ${fences.length} import-bearing TS fences · ${fragments} fragments + ${skipped} skip-directive'd (not checked)`,
)

if (failures.length > 0) {
  console.error('')
  console.error(`  ${failures.length} failure(s):`)
  for (const v of failures) {
    console.error(`    ${v.file} (fence ${v.fence}) — ${v.tool}\n      ${v.message}`)
  }
  console.error('')
  console.error(
    `  ✗ doc code-fence checks — ${failures.length} failure(s) across ${fences.length} fences (${elapsed()})`,
  )
  console.error(
    `  Fix the example, or — if the fence is intentionally illustrative — precede it with\n  <!-- eess-docs-code-skip: <reason> -->\n`,
  )
  process.exit(1)
}

// ---- bug 0220: the fences that exist are not the fences that are owed -------
//
// The check above compiles what is written. It requires nothing to BE written,
// so a new undocumented export is silent and deleting a documented section is
// silent — a denominator of supply, never of demand. That asymmetry is what
// ADR-009 calls a check that cannot fail.
//
// `NOT_PUBLIC_SURFACE` is read from `kernel-surface.mjs`, the one place that
// already declares which exports are plumbing rather than API. It is not
// extended here: an exemption list this gate maintains for itself would be the
// gate forgiving its own subject.
const surface = undocumentedExports(process.cwd())
if (surface.missing.length > 0) {
  console.error('')
  console.error(
    `  ✗ public surface — ${surface.missing.length} of ${surface.public.length} exported ` +
      'symbols appear in no docs/ page, package README or ADR:',
  )
  const byPkg = new Map()
  for (const m of surface.missing) byPkg.set(m.pkg, [...(byPkg.get(m.pkg) ?? []), m.name])
  for (const [pkg, names] of [...byPkg].sort()) {
    console.error(`      @nielspeter/eess${pkg === 'core' ? '' : `-${pkg}`}  (${names.length})`)
    console.error(`        ${names.sort().join(', ')}`)
  }
  console.error('')
  console.error(
    '      Fix: document it where a reader would look, or stop exporting it. A symbol on the',
  )
  console.error(
    '      public surface that no page mentions is either undocumented API or an accidental',
  )
  console.error(
    "      export — both are drift, and which one it is is the author's call, not this gate's.",
  )
  console.error('')
  process.exit(1)
}

console.error(
  `  ✓ doc code-fence checks — ${fences.length} fences compile + no deprecated API · ` +
    `${surface.public.length} public exports all documented (${elapsed()})`,
)
console.error('')
