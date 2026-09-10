#!/usr/bin/env node
/**
 * Dogfood: type-check + no-deprecated-lint the TypeScript code fences in THREE
 * populations — docs/, every packages/<name>/README.md, and .changeset/ (plan
 * 0082; README scope added plan 0089 round 3 — a dialect's own README teaching
 * code with the same rot risk had no coverage at all, confirmed by a stale
 * `packages/md/README.md` example that silently didn't compile standalone;
 * changesets added by bug 0273, after a published migration told adopters to
 * import from a subpath that did not export the symbol).
 *
 * The populations do NOT share a selection rule. A docs or README fence is
 * checked only if it is a self-contained example — it imports AND calls an entry
 * function. A changeset fence is reduced to its import STATEMENTS, because what
 * a migration must get right is where a symbol now lives, and a migration's body
 * legitimately references the reader's own variables. See `moduleClaimsIn`.
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
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
// Split out so it can be unit-tested per shape (bug 0273, second review round).
import { moduleClaimsIn } from './lib/import-statements.mjs'

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
// Bug 0273. A changeset body is the one document written specifically to tell an
// adopter how to change their code, and it was the one document with no compile
// gate — while changesets copies it verbatim into six `CHANGELOG.md` files and
// ships it to npm. Plan 0263 Phase 5 printed a migration telling adopters to
// import `finishPreset` from a subpath that did not export it; three reviewers
// caught it and no gate did.
//
// `README.md` is changesets' own boilerplate, not a changeset.
// The repo-root documents that teach code. `RELEASING.md` is the sharp case: it
// is where the changeset convention is written down, and a testing review found
// its example — the one saying "a claim about where a symbol lives is not
// checkable until it is written as an import" — sitting in none of the scanned
// populations. An unchecked import claim inside the section teaching that import
// claims get checked.
const ROOT_DOCS = ['README.md', 'RELEASING.md'].filter((f) => {
  try {
    readFileSync(f)
    return true
  } catch {
    return false
  }
})

// **Which rule a file gets, and why it is the file that decides.** A `docs/` or
// README fence teaches a self-contained example, so it must import AND call an
// entry function to be compiled. A changeset fence states a MIGRATION — where a
// symbol now lives — so it is reduced to its import statements. `RELEASING.md`
// is on the migration side because the example it carries IS a changeset
// migration, quoted in the section that defines them.
const IMPORT_CLAIM_FILES = new Set([
  'RELEASING.md',
  // A migration guide is a migration: its fences say where a symbol lives now,
  // not how to write a rule file. Same rule as a changeset, for the same reason.
  'docs/migrating-to-0.5.md',
])
const readsAsImportClaim = (file) => file.startsWith('.changeset') || IMPORT_CLAIM_FILES.has(file)

// Guarded the way `PACKAGE_READMES` above is: the directory is committed today,
// but a script that throws on a missing directory reports a broken extractor as
// a crash rather than as the zero it should be.
const CHANGESETS = (() => {
  try {
    return readdirSync('.changeset', { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
      .map((e) => join('.changeset', e.name))
  } catch {
    return []
  }
})()

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
let untaggedWithImport = 0
for (const file of [...mdFiles(DOCS), ...PACKAGE_READMES, ...CHANGESETS, ...ROOT_DOCS]) {
  const isChangeset = readsAsImportClaim(file)
  const kids = fromMarkdown(readFileSync(file, 'utf8')).children
  let fence = 0
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i]
    if (node.type !== 'code') continue
    const lang = (node.lang ?? '').toLowerCase()
    if (lang !== 'ts' && lang !== 'typescript') {
      // **A retag is a silent route-around, so it gets a counter.** The gate
      // reads `ts`/`typescript` only, and nothing requires a changeset fence to
      // carry that tag — so an author who hits a red can clear it in three
      // characters. Unlike the skip directive, which the summary counts and a
      // reader can audit, that left no trace at all. Measured by a release
      // review: across the pending changesets the tags were 13 untagged, 3 ts,
      // 1 typescript, 1 js.
      //
      // Counted rather than failed, deliberately. A changeset may legitimately
      // show shell output or JSON, and reddening on those would be a mechanism
      // firing on the thing it protects (ADR-009 rule 1). What is reported is
      // the narrower fact: a fence in a changeset that is NOT tagged for this
      // gate and yet contains something shaped like an import.
      if (isChangeset && /^[ \t]*import(?![.(\w])/m.test(node.value)) untaggedWithImport++
      continue
    }
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

    // **A changeset's unit is its import lines, not a runnable example.** The
    // docs rule above asks for a self-contained rule file because that is what
    // docs teach. A changeset teaches a migration, so what it must get right is
    // where a symbol now lives — see `moduleClaimsIn`. A fence with no
    // import claims nothing checkable and is a fragment, which is also what
    // makes the "before" half of a migration free: `throwIfViolations(v)` with
    // no import line is not a claim about where anything is exported.
    const imports = isChangeset ? moduleClaimsIn(node.value) : []
    const selfContained = isChangeset ? imports.length > 0 : importsEntryFn && callsEntryFn
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
    fences.push({ file, fence, code: isChangeset ? imports.join('\n') : node.value, tmp })
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
        // Without this, TypeScript does not report an unresolved SIDE-EFFECT
        // import at all — `import 'pkg/does-not-exist'` compiles clean. A
        // testing review measured a changeset fence of exactly that shape being
        // counted in the denominator, reported as checked, and unable to fail.
        // "Add this import" is an ordinary migration shape. The flag closes it
        // for all three populations; it was pre-existing for docs and READMEs.
        noUncheckedSideEffectImports: true,
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
// **Per population, not one merged number.** A single denominator across three
// populations cannot show one of them going dark — which is the shape that let
// the changeset half be absent while this gate printed green, and the shape
// `CLAUDE.md` records about its own gate table. A zero beside a population that
// should have fences is the signal.
const byPopulation = { docs: 0, readme: 0, changeset: 0, root: 0 }
for (const f of fences) {
  // Keyed off the same predicate that CHOSE the rule, not a second spelling of
  // it. Two predicates disagreeing about what a population is, is how a
  // `RELEASING.md` failure came to print the docs remedy — the skip directive
  // offered for a migration, inside the document whose own prose says the skip
  // directive is never for a migration. Measured by two reviews independently.
  const key = f.file.startsWith('docs')
    ? 'docs'
    : readsAsImportClaim(f.file)
      ? f.file.startsWith('.changeset')
        ? 'changeset'
        : 'root'
      : 'readme'
  byPopulation[key]++
}
console.error(
  `  scanned   ${fences.length} import-bearing TS fences ` +
    `(${byPopulation.docs} docs · ${byPopulation.readme} package README · ` +
    `${byPopulation.changeset} changeset · ${byPopulation.root} root doc) · ` +
    `${fragments} fragments + ${skipped} skip-directive'd (not checked)`,
)
if (untaggedWithImport > 0) {
  console.error(
    `  note      ${untaggedWithImport} changeset fence(s) carry an import but are not tagged ` +
      `\`ts\`/\`typescript\`, so this gate does not read them. Retag to have the claim checked.`,
  )
}

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
  // **The remedy differs by population, and offering the wrong one teaches the
  // wrong reflex.** For a docs fence, "fix it or mark it illustrative" is right.
  // For a changeset, the fence is a claim about WHERE a symbol is exported, and
  // a red means either the claim is wrong or the barrel is missing an export —
  // so offering the skip directive as a co-equal remedy would nudge an author
  // toward silencing exactly the defect this population was added to catch
  // (ADR-009 rule 1: a mechanism that fires on the thing it protects teaches
  // people to switch it off). Found by a product review.
  if (failures.some((v) => readsAsImportClaim(v.file))) {
    console.error(
      `  A changeset fence's import line is a claim about where a symbol is exported.\n` +
        `  A failure here means the claim is wrong, or the barrel is missing that export —\n` +
        `  fix one of those. The skip directive is for a pre-migration "before" example\n` +
        `  only, never for the migration itself. See RELEASING.md, "A migration names its\n` +
        `  import line".\n`,
    )
  }
  if (failures.some((v) => !readsAsImportClaim(v.file))) {
    console.error(
      `  Fix the example, or — if the fence is intentionally illustrative — precede it with\n  <!-- eess-docs-code-skip: <reason> -->\n`,
    )
  }
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
console.error(
  `  ✓ doc code-fence checks — ${fences.length} fences compile + no deprecated API (${elapsed()})`,
)
console.error('')
