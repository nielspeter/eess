#!/usr/bin/env node
/**
 * Dogfood: every Mermaid block in this repository's Markdown parses with Mermaid's own parser
 * (plan 0427, proposal 006 Ask C). The production consumer of eess-mermaid's `mermaidParser()`
 * (plan 0413) and eess-md's `codeBlocks().should().parse()` (plan 0412).
 *
 * Scope is the Markdown git sees: tracked files plus new ones not yet added, never ignored ones.
 * Not a glob over the disk: `**` skips dot directories (`.claude/`, `.changeset/`), and a walk of
 * the disk reads gitignored notes CI never sees. New files count so a diagram is checked before
 * `git add`, not only in CI.
 *
 * The exclusions are the trees of blocks broken on purpose. Each is resolved against the rule's
 * own violations, ADR-018's direction (that ADR is Proposed): an exclusion under which no block
 * fails is stale and is a finding, never a quiet no-op.
 *
 * Run: `npm run check:mermaid-parses` (`--format json` puts every finding on stdout). Exits
 * non-zero on any finding.
 */
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import picomatch from 'picomatch'
import { codeBlocks, corpus, parseCodeBlocks } from '@nielspeter/eess-md'
import { mermaidParser } from '@nielspeter/eess-mermaid'

const NAME = 'mermaid parses'
const started = performance.now()
const elapsed = () => `${Math.round(performance.now() - started)} ms`

const EXCLUSIONS = [
  'packages/crossvalidate/tests/fixtures/**',
  'packages/md/tests/fixtures/**',
  'scripts/nonvacuity/**',
]

const fmtArg = process.argv.indexOf('--format')
const format = fmtArg >= 0 ? process.argv[fmtArg + 1] : undefined

/** The gate's own findings, reported beside the parse rule's in both formats. */
const findings = []
const finding = (ruleId, file, message, suggestion) =>
  findings.push({ ruleId, severity: 'error', file, line: 1, message, suggestion })

function finish(summary) {
  if (format !== undefined && findings.length > 0) {
    process.stdout.write(`${JSON.stringify({ violations: findings }, null, 2)}\n`)
  }
  for (const f of findings) console.error(`✗ ${NAME} — ${f.message}\n  Fix: ${f.suggestion}`)
  console.error(`✗ ${NAME} — ${summary} (${elapsed()})`)
  process.exit(1)
}

let paths
try {
  paths = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
    .split('\0')
    .filter((f) => f !== '')
} catch (error) {
  finding(
    'eess/mermaid-scope-unreadable',
    '.',
    `git could not list the Markdown files: ${String(error).split('\n')[0]}`,
    'Run the gate inside a git checkout with git on the PATH; its scope is what git sees.',
  )
  finish('no document was read')
}
// `--cached` still lists a tracked file deleted from the working tree. It has nothing to parse, and
// as a root of its own it would match no file, which `corpus()` refuses (bug 0465).
paths = [...new Set(paths)].filter((f) => existsSync(f))

// Each path becomes a root glob, so a name the glob reads as a pattern would select something
// else. Refuse it rather than check the wrong file.
const unsafe = paths.filter((f) => /[*?[\]{}()!+@\\]/.test(f))
for (const f of unsafe) {
  finding(
    'eess/mermaid-scope-unsafe-path',
    f,
    `${f} contains a glob character and cannot be selected exactly`,
    'Rename the file, or teach this gate to select it without a glob.',
  )
}
if (unsafe.length > 0) finish(`${String(unsafe.length)} path(s) cannot be selected`)

const excluded = new Map(EXCLUSIONS.map((glob) => [glob, picomatch(glob)]))
const isExcluded = (p) => [...excluded.values()].some((m) => m(p))
// A root that matches no file: an empty side still runs, so the kernel refuses an empty check.
const roots = (list) => (list.length > 0 ? list : ['.eess-mermaid-parses-matches-no-file'])
const kept = corpus({ roots: roots(paths.filter((p) => !isExcluded(p))) })
const held = corpus({ roots: roots(paths.filter(isExcluded)) })

const loaded = kept.documents().length + held.documents().length
if (loaded !== paths.length) {
  const seen = new Set([...kept.documents(), ...held.documents()].map((d) => d.relPath))
  const missing = paths.filter((p) => !seen.has(p))
  finding(
    'eess/mermaid-scope-dropped',
    missing[0] ?? '.',
    `git lists ${String(paths.length)} Markdown files and ${String(loaded)} loaded; not loaded: ` +
      missing.slice(0, 10).join(', '),
    'Find why eess-md did not load these files; the gate checks only what it loaded.',
  )
}

const rule = (parsed) =>
  codeBlocks(parsed)
    .should()
    .parse()
    .rule({ id: 'eess/mermaid-blocks-parse' })
    .because('a Mermaid block that does not parse renders as an error box, not a diagram')

// The exclusions are measured against the rule's own violations on the blocks they hold.
const heldParsed = await parseCodeBlocks(held, { language: 'mermaid', parser: mermaidParser() })
if (heldParsed.failure !== null) {
  finding(
    'eess/mermaid-exclusions-unmeasured',
    '.',
    `the excluded blocks could not be parsed, so no exclusion was measured: ${heldParsed.failure.cause}`,
    heldParsed.failure.remedy,
  )
} else {
  const failing = rule(heldParsed).violations()
  for (const [glob, inGlob] of excluded) {
    if (failing.some((v) => inGlob(String(v.file ?? '').slice(held.root.length + 1)))) continue
    finding(
      'eess/mermaid-exclusion-stale',
      'scripts/check-mermaid-parses.mjs',
      `the exclusion '${glob}' suppresses no failing Mermaid block`,
      `Remove '${glob}' from EXCLUSIONS in scripts/check-mermaid-parses.mjs; nothing under it ` +
        'is broken on purpose any more.',
    )
  }
}

const parsed = await parseCodeBlocks(kept, { language: 'mermaid', parser: mermaidParser() })
let ruleFailed = false
try {
  // `check()` owns the reporting (ADR-008) and refuses a run that examined no block (ADR-014).
  rule(parsed).check(format === undefined ? {} : { format })
} catch (error) {
  ruleFailed = true
  if (format === undefined) console.error(error instanceof Error ? error.message : String(error))
}

if (ruleFailed || findings.length > 0) finish(parsed.summary())
console.error(
  `✓ ${NAME} — ${parsed.summary()}, across ${String(kept.documents().length)} documents git ` +
    `sees · ${String(EXCLUSIONS.length)} exclusions, each suppressing a failing block (${elapsed()})`,
)
