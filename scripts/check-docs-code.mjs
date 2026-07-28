#!/usr/bin/env node
/**
 * Dogfood: type-check + no-deprecated-lint the TypeScript code fences in docs/ (plan 0082).
 *
 * The docs teach code, but nothing compiled it — so a stale example (a moved import,
 * a removed/renamed method, a changed signature, a deprecated call) rots uncaught.
 * This extracts every import-bearing ```ts / ```typescript fence under docs/ and
 * checks each with TWO passes, because no single tool catches both classes:
 *   - `tsc --noEmit`                    — imports resolve, methods/signatures exist;
 *   - ESLint `@typescript-eslint/no-deprecated` — a @deprecated-but-valid call (tsc
 *                                          exits 0 on those).
 * A fence immediately preceded by `<!-- eess-docs-code-skip: reason -->` is checked by
 * neither pass (a "don't do this" block, or one leaning on prior context).
 *
 * Type-check only — no fixtures, no execution: `project('tsconfig.json')` type-checks
 * fine even though the path is fake at runtime. Fragments (fences with no `import`) are
 * skipped — they aren't compilable units. Run: `npm run check:docs-code`.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'

const DOCS = 'docs'
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
for (const file of mdFiles(DOCS)) {
  const kids = fromMarkdown(readFileSync(file, 'utf8')).children
  let fence = 0
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i]
    if (node.type !== 'code') continue
    const lang = (node.lang ?? '').toLowerCase()
    if (lang !== 'ts' && lang !== 'typescript') continue
    fence++
    // Self-contained = imports AND sets up its own project (`project(...)` / `workspace(...)`).
    // A fence that only imports but assumes an ambient `p`/DSL fn from narrative is a
    // fragment, not a compilable unit (plan 0082 review finding 2 — the dominant case).
    const selfContained =
      /^\s*import\s/m.test(node.value) && /\b(?:project|workspace)\s*\(/.test(node.value)
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

console.error(
  `  ✓ doc code-fence checks — ${fences.length} fences compile + no deprecated API (${elapsed()})`,
)
console.error('')
