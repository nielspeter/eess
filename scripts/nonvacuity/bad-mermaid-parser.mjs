#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — plan 0413: eess-mermaid ships Mermaid's own parser.
 * Fixture tier (bug 0127): each scenario drives `parseCodeBlocks` + `codeBlocks().should().parse()`
 * with `mermaidParser()` (the built package) or, for the instrument's causes, the built
 * `create-mermaid-parser.js` over a copy of the built worker in a scratch directory. No production
 * rule parses Mermaid until plan 0427's gate.
 *
 * With the real mermaid, over bad-mermaid-parser/:
 *   mid-body            a syntax error after two mid-body comments → its exact Markdown line, 8.
 *   trailing-comment    a block with a trailing `%%` comment → no line claimed, Mermaid's quoted.
 *   empty, no-kind, unclosed-frontmatter, misspelt, zenuml
 *                       each → its own remedy.
 * With the built code sabotaged by the harness (the row passes when this goes red):
 *   ok-wins             Mermaid's `ok` no longer wins → the lone-`\r` block (bug 0434) is reported, as
 *                       text 4.
 *   dom-shim            the worker's DOM shim dropped → the labelled flowchart is the instrument,
 *                       named by its file and line.
 *   line-canary         one line-map behaviour removed → "line map, written for mermaid 11.17.2,
 *                       disagrees".
 * Against a scratch worker:
 *   missing-peer, missing-dependency, early-exit, out-of-range, unreadable, loaded-not-declared,
 *   stops-throwing, non-parse-throw, non-result, hang
 *                       each → its own cause's text.
 *
 * Every scenario ends by letting the process exit on its own: a worker left running keeps it alive,
 * and the unref'd watchdog then exits 0, which the harness reads as vacuous.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the named finding was reported — OK
 *   0 = not reported, or the process did not exit (the check is vacuous)
 *   2 = unexpected error, or an unknown scenario
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { codeBlocks, corpus, parseCodeBlocks } from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const ROOT = 'scripts/nonvacuity/bad-mermaid-parser'
const DIST = new URL('../../packages/mermaid/dist/mermaid-js/', import.meta.url)
const INSTRUMENT = 'eess-md: code-block parser'
const require = createRequire(import.meta.url)

const watchdog = setTimeout(() => {
  console.error('bad-mermaid-parser: the process did not exit on its own — a worker was left running')
  process.exit(0)
}, 20_000)
watchdog.unref()

const scratchDirs = []
function real(name) {
  for (const dir of require.resolve.paths(name) ?? []) {
    if (existsSync(join(dir, name, 'package.json'))) return join(dir, name)
  }
  throw new Error(`${name} is not installed`)
}

/** The built worker, copied into a scratch directory with these packages. */
function scratch(modules) {
  const dir = mkdtempSync(join(tmpdir(), 'eess-nonvacuity-mermaid-'))
  scratchDirs.push(dir)
  cpSync(new URL('mermaid-worker.mjs', DIST), join(dir, 'mermaid-worker.mjs'))
  mkdirSync(join(dir, 'node_modules'))
  for (const [name, module] of Object.entries(modules)) {
    const target = join(dir, 'node_modules', name)
    if (module === 'real') {
      symlinkSync(real(name), target)
      continue
    }
    mkdirSync(target)
    const pkg = { name, version: module.version ?? '11.17.2', type: 'module', exports: './index.mjs' }
    writeFileSync(join(target, 'package.json'), module.raw ?? JSON.stringify(pkg))
    writeFileSync(join(target, 'index.mjs'), module.source ?? '')
  }
  return pathToFileURL(join(dir, 'mermaid-worker.mjs'))
}

const stub = (parse, version) => ({ version, source: `export default { parse: ${parse} }` })
const STUB_JSDOM = { version: '29.1.1', source: 'export class JSDOM { constructor() { this.window = {} } }' }

const instrument = (says) => (vs) => vs.some((v) => v.ruleId === INSTRUMENT && v.message.includes(says))
const at = (file, line) => (v) => v.file.endsWith(file) && (line === undefined || v.line === line)
const remedy = (dir, says) => ({
  dir,
  found: (vs) => vs.some((v) => at(`${dir}/${dir}.md`)(v) && String(v.suggestion).includes(says)),
})

const SCENARIOS = {
  'mid-body': {
    dir: 'mid-body',
    found: (vs) => vs.some((v) => at('mid-body/mid-body.md', 8)(v) && v.message.includes('Parse error')),
  },
  'trailing-comment': {
    dir: 'trailing',
    found: (vs) =>
      vs.some(
        (v) =>
          at('trailing/trailing.md', 3)(v) &&
          v.message.includes('unreliable in a block with a trailing `%%` comment; it reported line'),
      ),
  },
  empty: remedy('empty', 'The block is empty'),
  'no-kind': remedy('no-kind', 'declares no diagram after its directives, comments or frontmatter'),
  'unclosed-frontmatter': remedy('unclosed-frontmatter', 'Close the frontmatter'),
  misspelt: remedy('misspelt', 'Check the spelling of the diagram kind'),
  zenuml: remedy('zenuml', 'needs a newer `mermaid` or a plugin'),
  // An accepted block's fact carries no message, so the block read past `ok` reaches eess-md as a
  // verdict with an empty one: the finding names it as text 4 (eess-md's three canaries come first).
  'ok-wins': { dir: 'ok-wins', found: instrument("the parser's answer for text 4") },
  'dom-shim': {
    dir: 'labelled',
    found: instrument('at the block at scripts/nonvacuity/bad-mermaid-parser/labelled/labelled.md:3'),
  },
  'line-canary': {
    dir: 'valid',
    found: instrument("eess-mermaid's line map, written for mermaid 11.17.2, disagrees with mermaid 11.17.2"),
  },
  'missing-peer': {
    dir: 'valid',
    worker: () => scratch({}),
    found: instrument('mermaid is not installed where eess-mermaid can resolve it'),
  },
  'missing-dependency': {
    dir: 'valid',
    worker: () =>
      scratch({
        mermaid: 'real',
        jsdom: { version: '29.1.1', source: "import 'eess-absent-dependency'\nexport class JSDOM {}" },
      }),
    found: (vs) =>
      vs.some((v) => v.suggestion?.includes('`eess-absent-dependency`, a dependency of mermaid or jsdom')),
  },
  'early-exit': {
    dir: 'early-exit',
    worker: () =>
      scratch({
        jsdom: STUB_JSDOM,
        mermaid: stub(`async (t) => { if (t.includes('EXIT-HERE')) process.exit(7); return {} }`),
      }),
    found: (vs) =>
      instrument('at the block at scripts/nonvacuity/bad-mermaid-parser/early-exit/early-exit.md:3')(vs) &&
      instrument('exited (code 7) without a result, while parsing text 4')(vs),
  },
  'out-of-range': {
    dir: 'valid',
    worker: () => scratch({ jsdom: STUB_JSDOM, mermaid: stub('async () => ({})', '12.0.0-rc.1') }),
    found: instrument('mermaid 12.0.0-rc.1 is installed'),
  },
  unreadable: {
    dir: 'valid',
    worker: () => scratch({ jsdom: STUB_JSDOM, mermaid: { raw: '{ not json' } }),
    found: instrument('has no readable version'),
  },
  'loaded-not-declared': { relaunch: true, found: () => false },
  'under-a-hook': {
    dir: 'valid',
    found: instrument('the Mermaid worker loaded mermaid 11.99.0, but mermaid 11.17.2 is installed'),
  },
  'stops-throwing': {
    dir: 'valid',
    worker: () => scratch({ jsdom: STUB_JSDOM, mermaid: stub('async () => ({})') }),
    found: instrument('canary 1 was answered wrongly'),
  },
  'non-parse-throw': {
    dir: 'valid',
    worker: () => scratch({ jsdom: STUB_JSDOM, mermaid: stub("async () => { throw new Error('boom') }") }),
    found: instrument('Mermaid threw something eess-mermaid does not recognise as a syntax error: boom'),
  },
  'non-result': {
    dir: 'valid',
    worker: () => scratch({ jsdom: STUB_JSDOM, mermaid: stub('async () => false') }),
    found: instrument('resolved without a result'),
  },
  hang: {
    dir: 'hang',
    budget: { startUpMs: 1500, perBlockMs: 0 },
    worker: () =>
      scratch({
        jsdom: STUB_JSDOM,
        mermaid: stub(
          `(t) => t.includes('HANG-HERE') ? new Promise((r) => setTimeout(r, 60_000)) : Promise.resolve({})`,
        ),
      }),
    found: (vs) =>
      vs.some(
        (v) =>
          v.message.includes('ran past its budget') &&
          v.message.includes('at the block at scripts/nonvacuity/bad-mermaid-parser/hang/hang.md:3') &&
          String(v.suggestion).includes('Raise `budget.perBlockMs`'),
      ),
  },
}

const name = process.argv[2]
const scenario = SCENARIOS[name]
if (scenario === undefined) {
  console.error(
    `bad-mermaid-parser: unknown scenario "${name}" — expected one of ${Object.keys(SCENARIOS).join(', ')}`,
  )
  process.exit(2)
}

// A resolve hook reaches the worker only through `--import`, which a worker inherits: run this
// fixture again under one, with a scenario that expects "loaded ≠ declared".
if (scenario.relaunch === true) {
  const hook = fileURLToPath(new URL('./bad-mermaid-parser/hook.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', hook, fileURLToPath(import.meta.url), 'under-a-hook'], {
    encoding: 'utf8',
    timeout: 30_000,
  })
  process.stderr.write(r.stderr.replaceAll('under-a-hook', name))
  process.exitCode = r.status ?? 2
} else {
  await run(scenario)
}

async function run(s) {
  let violations
  try {
    const { createMermaidParser } = await import(new URL('create-mermaid-parser.js', DIST).href)
    const parser = s.worker === undefined ? mermaidParser() : createMermaidParser({ workerUrl: s.worker() })
    const parsed = await parseCodeBlocks(corpus({ roots: [`${ROOT}/${s.dir}/**`] }), {
      language: 'mermaid',
      parser,
      ...(s.budget !== undefined && { budget: s.budget }),
    })
    violations = codeBlocks(parsed).should().parse().rule({ id: 'nonvacuity/mermaid-parser' }).violations()
  } catch (err) {
    console.error(`bad-mermaid-parser: ${name}: unexpected error — ${String(err)}`)
    process.exitCode = 2
    return
  } finally {
    for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
  }
  if (s.found(violations)) {
    console.error(`bad-mermaid-parser: ${name}: reported as expected`)
    for (const v of violations) console.error(`  x ${v.message.split('\n')[0]}`)
    process.exitCode = 1
    return
  }
  console.error(
    `bad-mermaid-parser: ${name}: NOT reported — the check is vacuous ` +
      `(${String(violations.length)} finding(s): ${violations.map((v) => v.message.split('\n')[0]).join(' | ')})`,
  )
  process.exitCode = 0
}
