#!/usr/bin/env node
/**
 * check:bun-load — every published package of the family loads under Bun.
 *
 * ADR-020 rule 2: a load guard may run under a runtime no package claims, so a
 * defect like bug 0439 (a named import Bun cannot link) is fixed and kept fixed.
 * This is that guard, built by plan 0448.
 *
 * It has two halves, so that everything that needs no Bun runs locally:
 *
 * - `inspectWorkspace` reads the inputs WITHOUT Bun: the packages come from the
 *   root `workspaces` field, never a typed-in glob; every package not marked
 *   `private` is published; each one's `exports` and `bin` are read from its
 *   manifest; an `exports` shape the guard cannot enumerate is a finding; and
 *   the two committed lists below are validated against the workspace, so both
 *   only shrink. Its breaks are ordinary `check:nonvacuity` rows
 *   (`scripts/nonvacuity/bad-bun-load.mjs`).
 * - `runGuard` probes WITH Bun: one `bun` process per `exports` entry and per
 *   `bin`, from the repository root, where the workspace links resolve to
 *   `dist/`. Harness code prints the runtime and version before any code under
 *   check runs, and every probe is asserted against `.bun-version`.
 *
 * ADR-001 keeps Bun out of this repository's toolchain, so the Bun half runs in
 * the `bun-load` CI job only. `checkBunLoadJob` reads that job statically, and
 * `gateCoverage` (in `check:nonvacuity`, which runs everywhere) calls it, so a
 * deleted or conditional job is caught without Bun.
 *
 * `--self-test` runs the Bun breaks (`BUN_BREAKS`) over scratch workspaces in the
 * system temp directory and fails if any stays green. `gateCoverage` pins their
 * ids, so a deleted break is a finding, not a smaller count.
 */
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const selfFile = 'scripts/check-bun-load.mjs'

/**
 * Packages that cannot load under Bun, each with its reason. Empty since bug
 * 0439's fix. An entry naming no published package is a finding, and so is an
 * excluded package that loads: the list only shrinks (ADR-020 rule 2).
 * @type {Record<string, string>}
 */
export const EXCLUDED = {}

/**
 * Entries that run a command when imported, with the outcome they give under
 * Node, which they must give under Bun: the import completes, the process exits
 * non-zero, and the message is printed. A link error also exits non-zero, so
 * the exit code alone is not the outcome. An entry naming no export is a
 * finding.
 * @type {Record<string, { message: string }>}
 */
export const ON_IMPORT = {
  '@nielspeter/eess-ts/cli': { message: 'No command specified' },
}

const RULE = 'every published package loads under Bun'
const MARK_RUNTIME = 'EESS_BUN_LOAD_RUNTIME '
const MARK_LOADED = 'EESS_BUN_LOAD_LOADED'

function finding(kind, element, file, message, suggestion) {
  return { rule: RULE, ruleId: `bun-load/${kind}`, element, file, line: 1, message, suggestion }
}

// --- inputs, without Bun ---------------------------------------------------------

/** Expand the root `workspaces` field. Only `dir/*` and plain directories are read. */
function workspaceDirs(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const globs = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces?.packages ?? [])
  const dirs = []
  const unreadable = []
  for (const glob of globs) {
    if (glob.endsWith('/*') && !glob.slice(0, -2).includes('*')) {
      const base = join(root, glob.slice(0, -2))
      if (!existsSync(base)) continue
      for (const name of readdirSync(base).sort()) {
        if (existsSync(join(base, name, 'package.json'))) dirs.push(join(base, name))
      }
    } else if (!glob.includes('*')) {
      if (existsSync(join(root, glob, 'package.json'))) dirs.push(join(root, glob))
    } else {
      unreadable.push(glob)
    }
  }
  return { dirs, unreadable }
}

/** The subpaths of an `exports` field, or why they cannot be enumerated. */
export function entriesOf(exportsField) {
  if (exportsField === undefined) return { entries: [], bad: 'has no "exports"' }
  if (typeof exportsField === 'string') return { entries: ['.'], bad: undefined }
  if (exportsField === null || Array.isArray(exportsField) || typeof exportsField !== 'object') {
    return { entries: [], bad: 'has an "exports" value that is not a string or an object' }
  }
  const keys = Object.keys(exportsField)
  if (keys.length === 0) return { entries: [], bad: 'has an empty "exports" object' }
  const subpaths = keys.filter((k) => k.startsWith('.'))
  if (subpaths.length === 0) return { entries: ['.'], bad: undefined } // a conditions object for "."
  if (subpaths.length !== keys.length) {
    return { entries: [], bad: 'mixes subpath keys and condition keys in "exports"' }
  }
  const problems = []
  for (const k of subpaths) {
    if (k.includes('*')) problems.push(`a wildcard subpath ("${k}")`)
    const target = exportsField[k]
    if (target === null || Array.isArray(target)) problems.push(`a null or array target for "${k}"`)
  }
  if (problems.length > 0) {
    return { entries: [], bad: `has ${problems.join(' and ')}, which the guard cannot enumerate` }
  }
  return { entries: subpaths, bad: undefined }
}

function binsOf(manifest) {
  if (manifest.bin === undefined) return []
  if (typeof manifest.bin === 'string') return [[manifest.name, manifest.bin]]
  return Object.entries(manifest.bin)
}

const specOf = (name, entry) => (entry === '.' ? name : name + entry.slice(1))

/**
 * Read the workspace and validate the committed lists. No Bun.
 * @param {{ root: string, excluded?: Record<string,string>, onImport?: typeof ON_IMPORT }} opts
 */
export function inspectWorkspace(opts) {
  const root = opts.root
  const excluded = opts.excluded ?? EXCLUDED
  const onImport = opts.onImport ?? ON_IMPORT
  const findings = []
  const rootManifest = join(root, 'package.json')
  const { dirs, unreadable } = workspaceDirs(root)
  for (const glob of unreadable) {
    findings.push(
      finding(
        'unreadable-workspaces',
        glob,
        rootManifest,
        `the workspaces glob "${glob}" is a shape the guard cannot expand, so the packages under it are not examined`,
        'use "dir/*" or a plain directory in "workspaces", or teach the guard the shape',
      ),
    )
  }
  const published = []
  for (const dir of dirs) {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (manifest.private === true) continue
    const { entries, bad } = entriesOf(manifest.exports)
    if (bad !== undefined) {
      findings.push(
        finding(
          'unreadable-exports',
          manifest.name,
          join(dir, 'package.json'),
          `${manifest.name} ${bad}`,
          'give the package an "exports" map of explicit subpaths, each with one target',
        ),
      )
    }
    published.push({ dir, manifest, entries, bins: binsOf(manifest) })
  }
  if (published.length === 0) {
    findings.push(
      finding(
        'empty',
        'workspace',
        rootManifest,
        'the workspace has no published package, so the guard has nothing to examine',
        'check the root package.json "workspaces" field and the packages\' "private" flags',
      ),
    )
  }
  const names = new Set(published.map((p) => p.manifest.name))
  for (const name of Object.keys(excluded)) {
    if (!names.has(name)) {
      findings.push(
        finding(
          'stale-exclusion',
          name,
          selfFile,
          `EXCLUDED names "${name}", which is no published workspace package`,
          `remove the entry from EXCLUDED in ${selfFile}`,
        ),
      )
    }
  }
  const specs = new Set(published.flatMap((p) => p.entries.map((e) => specOf(p.manifest.name, e))))
  for (const spec of Object.keys(onImport)) {
    if (!specs.has(spec)) {
      findings.push(
        finding(
          'stale-on-import',
          spec,
          selfFile,
          `ON_IMPORT names "${spec}", which is no published entry`,
          `remove or correct the entry in ON_IMPORT in ${selfFile}`,
        ),
      )
    }
  }
  return { findings, published }
}

// --- the CI job, without Bun -----------------------------------------------------

/**
 * ADR-020 rule 3, "blocking": the job always runs and a failure fails the run.
 * Read statically from the workflow text; called by `gateCoverage`.
 * @param {string} ciText the text of .github/workflows/ci.yml
 * @returns {string[]} problems, empty when the job is as plan 0448 requires
 */
export function checkBunLoadJob(ciText) {
  const lines = ciText.split('\n')
  const start = lines.findIndex((l) => /^ {2}bun-load:\s*(#.*)?$/.test(l))
  if (start === -1)
    return ['ci.yml has no `bun-load` job, so the Bun load guard runs on no CI path']
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i])) {
      end = i
      break
    }
  }
  const job = lines.slice(start + 1, end).filter((l) => !/^\s*#/.test(l))
  const problems = []
  if (job.some((l) => /^\s*-?\s*if:/.test(l))) {
    problems.push('the `bun-load` job or one of its steps has an `if:`, so it does not always run')
  }
  if (job.some((l) => /^\s*-?\s*continue-on-error:/.test(l))) {
    problems.push(
      'the `bun-load` job or one of its steps sets `continue-on-error`, so its failure need not fail the run',
    )
  }
  if (job.some((l) => /^ {4}needs:/.test(l))) {
    problems.push('the `bun-load` job has `needs:`, so a failed upstream job skips it')
  }
  if (!job.some((l) => /bun-version-file:\s*\.bun-version\s*$/.test(l))) {
    problems.push(
      'the `bun-load` job does not install Bun from `.bun-version` (`bun-version-file: .bun-version`)',
    )
  }
  if (!job.some((l) => /run:\s*npm run check:bun-load\s*$/.test(l))) {
    problems.push('the `bun-load` job does not run `npm run check:bun-load`')
  }
  if (!job.some((l) => /run:\s*npm run check:bun-load -- --self-test\s*$/.test(l))) {
    problems.push('the `bun-load` job does not run `npm run check:bun-load -- --self-test`')
  }
  return problems
}

// --- probes, with Bun ------------------------------------------------------------

function runtimeLine(stdout) {
  const line = stdout.split('\n').find((l) => l.startsWith(MARK_RUNTIME))
  if (line === undefined) return undefined
  try {
    return JSON.parse(line.slice(MARK_RUNTIME.length))
  } catch {
    return undefined
  }
}

const firstLine = (s) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith(MARK_RUNTIME)) ?? '(no output)'

/**
 * Run the guard: inputs, then one Bun probe per entry and per bin.
 * @param {{ root: string, excluded?: Record<string,string>, onImport?: typeof ON_IMPORT,
 *   env?: NodeJS.ProcessEnv, dropPackageForSelfTest?: string }} opts
 */
export function runGuard(opts) {
  const root = opts.root
  const excluded = opts.excluded ?? EXCLUDED
  const onImport = opts.onImport ?? ON_IMPORT
  const env = opts.env ?? process.env
  const inspected = inspectWorkspace({ root, excluded, onImport })
  const findings = [...inspected.findings]
  const counts = []

  const versionFile = join(root, '.bun-version')
  const wanted = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : ''
  if (wanted === '') {
    findings.push(
      finding(
        'no-version-pin',
        '.bun-version',
        versionFile,
        '.bun-version is missing or empty, so no Bun version can be asserted',
        'commit the Bun version the guard runs on in .bun-version',
      ),
    )
    return { findings, counts, bunVersion: undefined }
  }
  const v = spawnSync('bun', ['--version'], { encoding: 'utf8', env })
  if (v.error !== undefined || v.status !== 0) {
    findings.push(
      finding(
        'no-bun',
        'bun',
        versionFile,
        `Bun did not run (${v.error?.message ?? `exit ${v.status}`}), so nothing was loaded`,
        `install Bun ${wanted}, the version in .bun-version. This guard is not part of \`validate\` (ADR-001 keeps Bun out of the toolchain); CI runs it in the bun-load job`,
      ),
    )
    return { findings, counts, bunVersion: undefined }
  }
  if (v.stdout.trim() !== wanted) {
    findings.push(
      finding(
        'wrong-runtime',
        'bun',
        versionFile,
        `\`bun --version\` is ${v.stdout.trim()}, not ${wanted}`,
        `install Bun ${wanted}, or change .bun-version on purpose`,
      ),
    )
    return { findings, counts, bunVersion: undefined }
  }

  const scratch = mkdtempSync(join(tmpdir(), 'eess-bun-load-preload-'))
  const preload = join(scratch, 'runtime.mjs')
  writeFileSync(
    preload,
    `console.log(${JSON.stringify(MARK_RUNTIME)} + JSON.stringify({ bun: process.versions.bun ?? null }))\n`,
  )
  const probe = (args) => {
    const r = spawnSync('bun', args, { cwd: root, encoding: 'utf8', env, timeout: 60_000 })
    return {
      status: r.status,
      out: r.stdout ?? '',
      err: r.stderr ?? '',
      runtime: runtimeLine(r.stdout ?? ''),
      error: r.error,
    }
  }
  const onRightRuntime = (what, file, r) => {
    if (r.runtime?.bun === wanted) return true
    findings.push(
      finding(
        'wrong-runtime',
        what,
        file,
        `the probe for ${what} ran on ${r.runtime?.bun ? `Bun ${r.runtime.bun}` : 'no Bun the harness could see'}, not Bun ${wanted}`,
        `make \`bun\` on PATH be Bun ${wanted}`,
      ),
    )
    return false
  }

  try {
    for (const { dir, manifest, entries, bins } of inspected.published) {
      const name = manifest.name
      if (opts.dropPackageForSelfTest === name) continue
      const file = relative(root, join(dir, 'package.json'))
      let failed = false
      let loaded = 0
      for (const entry of entries) {
        const spec = specOf(name, entry)
        const code = `await import(${JSON.stringify(spec)}); console.log(${JSON.stringify(MARK_LOADED)})`
        const r = probe(['--preload', preload, '--eval', code])
        if (!onRightRuntime(spec, file, r)) {
          failed = true
          continue
        }
        const completed = r.out.includes(MARK_LOADED)
        const expected = onImport[spec]
        if (expected !== undefined) {
          if (completed && r.status !== 0 && `${r.out}\n${r.err}`.includes(expected.message))
            loaded += 1
          else {
            failed = true
            findings.push(
              finding(
                'on-import-outcome',
                spec,
                file,
                `${spec} runs a command when imported; under Node it loads, exits non-zero and prints "${expected.message}". Under Bun ${completed ? 'it loaded' : 'it did not load'} and exited ${r.status}: ${firstLine(r.err || r.out)}`,
                completed
                  ? 'if the command changed on purpose, update ON_IMPORT'
                  : 'a link error: see bug 0439 — import the module as a namespace and test for the member at the call site',
              ),
            )
          }
          continue
        }
        if (r.status === 0 && completed) loaded += 1
        else {
          failed = true
          findings.push(
            finding(
              'link-error',
              spec,
              file,
              `${spec} does not load under Bun ${wanted}: ${firstLine(r.err || r.out)}`,
              'an import Bun cannot link (bug 0439: a named import from a node: module Bun lacks); import the module as a namespace and test for the member at the call site',
            ),
          )
        }
      }
      let ran = 0
      for (const [binName, binPath] of bins) {
        const r = probe(['--preload', preload, join(dir, binPath), '--help'])
        if (!onRightRuntime(binName, file, r)) {
          failed = true
          continue
        }
        if (r.status === 0) ran += 1
        else {
          failed = true
          findings.push(
            finding(
              'bin-failed',
              binName,
              file,
              `\`bun ${join(relative(root, dir), binPath)} --help\` exited ${r.status}: ${firstLine(r.err || r.out)}`,
              "the bin must answer --help when Bun runs it directly; a link error here is bug 0439's class",
            ),
          )
        }
      }
      if (name in excluded) {
        if (!failed) {
          findings.push(
            finding(
              'excluded-loads',
              name,
              selfFile,
              `${name} is excluded ("${excluded[name]}") but all of it loads under Bun ${wanted}`,
              `remove it from EXCLUDED in ${selfFile}: the list only shrinks`,
            ),
          )
        }
        // An excluded package's own failures are the reason it is excluded.
        for (let i = findings.length - 1; i >= 0; i--) {
          const f = findings[i]
          if (
            f.file === file &&
            ['bun-load/link-error', 'bun-load/bin-failed', 'bun-load/on-import-outcome'].includes(
              f.ruleId,
            )
          )
            findings.splice(i, 1)
        }
      }
      counts.push({
        name,
        entries: loaded,
        manifestEntries: entries.length,
        bins: ran,
        manifestBins: bins.length,
      })
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }

  const reported = new Set(counts.map((c) => c.name))
  for (const { manifest } of inspected.published) {
    if (!reported.has(manifest.name)) {
      findings.push(
        finding(
          'not-examined',
          manifest.name,
          'package.json',
          `${manifest.name} is a published workspace package no probe reported on`,
          'every published package is probed; one that cannot load goes in EXCLUDED with its reason',
        ),
      )
    }
  }
  for (const c of counts) {
    if (c.manifestEntries + c.manifestBins === 0 && !(c.name in excluded)) {
      findings.push(
        finding(
          'examined-nothing',
          c.name,
          'package.json',
          `${c.name} has no entry and no bin, so nothing of it was examined`,
          'give the package an "exports" map',
        ),
      )
    }
  }
  return { findings, counts, bunVersion: wanted }
}

// --- self-test, with Bun --------------------------------------------------------------

/** Build a scratch workspace in the system temp directory. Exported for the self-test only. */
export function scratchWorkspace(packages, bunVersion) {
  const root = mkdtempSync(join(tmpdir(), 'eess-bun-load-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'scratch', private: true, workspaces: ['packages/*'] }),
  )
  writeFileSync(join(root, '.bun-version'), `${bunVersion}\n`)
  mkdirSync(join(root, 'node_modules', '@scratch'), { recursive: true })
  for (const p of packages) {
    const dir = join(root, 'packages', p.dir)
    mkdirSync(dir, { recursive: true })
    const manifest = { name: p.name, version: '0.0.0', type: 'module', exports: p.exports }
    if (p.bin) manifest.bin = p.bin
    if (p.private) manifest.private = true
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
    for (const [f, text] of Object.entries(p.files)) writeFileSync(join(dir, f), text)
    symlinkSync(dir, join(root, 'node_modules', p.name), 'dir')
  }
  return root
}

const NAMED_IMPORT =
  "import { registerHooks } from 'node:module'\nexport const hooks = typeof registerHooks\n"
const pkg = (name, dir, extra = {}) => ({
  name,
  dir,
  exports: { '.': './index.js' },
  files: { 'index.js': 'export const ok = 1\n', ...(extra.files ?? {}) },
  ...(extra.bin ? { bin: extra.bin } : {}),
  ...(extra.exports ? { exports: extra.exports } : {}),
})

/**
 * The Bun breaks. `gateCoverage` pins these ids (plan 0448), so deleting one is a
 * finding. Each must produce its `expect` ruleId; the clean workspace must be green.
 */
export const BUN_BREAKS = [
  {
    id: 'named-import-in-export',
    expect: 'link-error',
    packages: [pkg('@scratch/a', 'a', { files: { 'index.js': NAMED_IMPORT } })],
  },
  {
    id: 'named-import-in-bin',
    expect: 'bin-failed',
    packages: [
      pkg('@scratch/a', 'a', {
        bin: { 'scratch-a': './bin.js' },
        files: { 'bin.js': NAMED_IMPORT },
      }),
    ],
  },
  {
    id: 'on-import-entry-link-error',
    expect: 'on-import-outcome',
    packages: [
      pkg('@scratch/a', 'a', {
        exports: { '.': './index.js', './cli': './cli.js' },
        files: {
          'cli.js': `${NAMED_IMPORT}console.error('Error: No command specified.'); process.exitCode = 1\n`,
        },
      }),
    ],
    onImport: { '@scratch/a/cli': { message: 'No command specified' } },
  },
  {
    id: 'excluded-package-loads',
    expect: 'excluded-loads',
    packages: [pkg('@scratch/a', 'a')],
    excluded: { '@scratch/a': 'self-test' },
  },
  {
    id: 'other-bun-version',
    expect: 'wrong-runtime',
    packages: [pkg('@scratch/a', 'a')],
    bunVersion: '0.0.1',
  },
  {
    id: 'fake-bun-runs-node',
    expect: 'wrong-runtime',
    packages: [pkg('@scratch/a', 'a')],
    fakeBun: true,
  },
  {
    id: 'package-dropped',
    expect: 'not-examined',
    packages: [pkg('@scratch/a', 'a'), pkg('@scratch/b', 'b')],
    drop: '@scratch/b',
  },
]

function fakeBunEnv(wanted) {
  const dir = mkdtempSync(join(tmpdir(), 'eess-bun-load-fake-'))
  const bin = join(dir, 'bun')
  // Answers --version as the real Bun would, then runs everything on Node.
  writeFileSync(
    bin,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${wanted}; exit 0; fi\nif [ "$1" = "--preload" ]; then shift; P="$1"; shift; fi\nif [ "$1" = "--eval" ]; then shift; exec node --input-type=module --import "$P" -e "$1"; fi\nexec node --import "$P" "$@"\n`,
  )
  chmodSync(bin, 0o755)
  return { dir, env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH ?? ''}` } }
}

export function selfTest(wanted) {
  const problems = []
  const run = (b) => {
    const root = scratchWorkspace(b.packages, b.bunVersion ?? wanted)
    const fake = b.fakeBun ? fakeBunEnv(wanted) : undefined
    try {
      return runGuard({
        root,
        excluded: b.excluded ?? {},
        onImport: b.onImport ?? {},
        env: fake?.env,
        dropPackageForSelfTest: b.drop,
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
      if (fake) rmSync(fake.dir, { recursive: true, force: true })
    }
  }
  const clean = run({
    packages: [
      pkg('@scratch/a', 'a'),
      pkg('@scratch/b', 'b', {
        exports: { '.': './index.js', './cli': './cli.js' },
        bin: { 'scratch-b': './bin.js' },
        files: {
          'bin.js': "console.log('usage')\n",
          'cli.js': "console.error('Error: No command specified.'); process.exitCode = 1\n",
        },
      }),
    ],
    onImport: { '@scratch/b/cli': { message: 'No command specified' } },
  })
  if (clean.findings.length > 0)
    problems.push(
      `the clean workspace is not green: ${clean.findings.map((f) => `${f.ruleId} (${f.message})`).join('; ')}`,
    )
  for (const b of BUN_BREAKS) {
    const r = run(b)
    if (!r.findings.some((f) => f.ruleId === `bun-load/${b.expect}`)) {
      problems.push(
        `break "${b.id}" stayed green for bun-load/${b.expect} (got: ${r.findings.map((f) => f.ruleId).join(', ') || 'nothing'})`,
      )
    }
  }
  return { breaks: BUN_BREAKS.length, problems }
}

// --- CLI ---------------------------------------------------------------------------

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const json = args.includes('--format') && args[args.indexOf('--format') + 1] === 'json'
  const t0 = Date.now()
  const secs = () => ((Date.now() - t0) / 1000).toFixed(2)
  if (args.includes('--self-test')) {
    const wanted = existsSync(join(repoRoot, '.bun-version'))
      ? readFileSync(join(repoRoot, '.bun-version'), 'utf8').trim()
      : ''
    const r =
      wanted === ''
        ? { breaks: 0, problems: ['.bun-version is missing or empty'] }
        : selfTest(wanted)
    if (r.problems.length > 0) {
      for (const p of r.problems) console.error(`✗ ${p}`)
      console.error(`✗ bun load self-test — ${r.problems.length} problem(s) (${secs()}s)`)
      process.exit(1)
    }
    console.error(
      `bun-load self-test: OK — ${r.breaks} breaks each red, 1 clean workspace green, on Bun ${wanted} (${secs()}s)`,
    )
    process.exit(0)
  }
  const { findings, counts, bunVersion } = runGuard({ root: repoRoot })
  if (json) process.stdout.write(`${JSON.stringify({ violations: findings }, null, 2)}\n`)
  if (findings.length > 0) {
    if (!json)
      for (const f of findings)
        console.error(`✗ ${f.element} — ${f.message}\n    Fix: ${f.suggestion}`)
    console.error(`✗ bun load — ${findings.length} finding(s) (${secs()}s)`)
    process.exit(1)
  }
  for (const c of counts) console.error(`  ${c.name}: ${c.entries} entries, ${c.bins} bins`)
  const entries = counts.reduce((n, c) => n + c.entries, 0)
  const bins = counts.reduce((n, c) => n + c.bins, 0)
  console.error(
    `✓ bun load — ${entries} entries and ${bins} bins across ${counts.length} packages, loaded by Bun ${bunVersion} (${secs()}s)`,
  )
}
