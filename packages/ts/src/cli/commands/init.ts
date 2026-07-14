import fs from 'node:fs'
import path from 'node:path'

/**
 * "Floor" presets — a universal rule set scoped to your source glob. eess only
 * scaffolds the floor presets: unlike ts-archunit, eess presets return eager
 * `ArchViolation[]` (ADR-008), which a CLI rule file cannot spread. So `init`
 * emits the floor rules **expanded as builders** (CLI-loadable, editable), and
 * leaves the shape presets (layered / boundaries / data-layer) to test-file use.
 */
const FLOOR_PRESETS = ['recommended', 'agent-guardrails'] as const
const VALID_PRESETS = [...FLOOR_PRESETS] as const
type FloorPreset = (typeof FLOOR_PRESETS)[number]
type InitPreset = FloorPreset

const VALID_PRESET_SET: ReadonlySet<string> = new Set(VALID_PRESETS)

// eess-exclude eess/no-unused-exports: parameter type of the exported runInit API (must stay exported for declaration emit)
export interface InitArgs {
  /** Directory to scaffold into. Defaults to `process.cwd()`. */
  cwd?: string
  /** Starter preset: `recommended` (default) | `agent-guardrails`. */
  preset?: string
  /** tsconfig path written into the generated files. Default `tsconfig.json`. */
  tsconfig?: string
  /** Overwrite existing files instead of refusing. */
  force?: boolean
  /** Print the plan; write nothing. */
  dryRun?: boolean
  /** Skip `arch-baseline.json` (and omit the `baseline` config field). */
  noBaseline?: boolean
}

interface StagedFile {
  /** Absolute path. */
  path: string
  /** Display name (relative to cwd). */
  name: string
  content: string
}

/**
 * Scaffold a working eess-ts setup in `cwd`. Returns the process exit code
 * (0 success, 1 on a recoverable error — bad `--preset`, missing tsconfig, a
 * file conflict without `--force`, or a write failure). All reads, parses, and
 * conflict checks run before any file is written, so a validation failure never
 * leaves a partial scaffold; a raw I/O failure mid-write is caught and reported.
 */
export function runInit(args: InitArgs): number {
  const cwd = args.cwd ?? process.cwd()
  const tsconfig = args.tsconfig ?? 'tsconfig.json'

  const preset = args.preset ?? 'recommended'
  if (!isValidPreset(preset)) {
    console.error(
      `Error: unknown --preset '${preset}'. Valid presets: ${VALID_PRESETS.join(', ')}.`,
    )
    return 1
  }

  // tsconfig must exist — the generated project() call points at it.
  if (!fs.existsSync(path.join(cwd, tsconfig))) {
    console.error(
      `Error: eess-ts needs a ${tsconfig} — run \`tsc --init\` first or pass --tsconfig <path>.`,
    )
    return 1
  }

  const sourceRoot = detectSourceRoot(cwd, tsconfig)
  const writeBaseline = args.noBaseline !== true

  // Stage the generated files in memory (no writes yet).
  const staged: StagedFile[] = [
    stage(cwd, 'eess-ts.config.ts', configTemplate(writeBaseline)),
    stage(cwd, 'arch.rules.ts', rulesTemplate(preset, tsconfig, sourceRoot)),
  ]
  if (writeBaseline) {
    staged.push(stage(cwd, 'arch-baseline.json', baselineTemplate()))
  }

  // Read + parse package.json up front so a parse failure never crashes mid-write.
  const pkgPlan = planPackageJson(cwd)

  // A dry run writes nothing, so it previews regardless of existing files.
  if (args.dryRun === true) {
    printDryRun(staged, pkgPlan, cwd, sourceRoot)
    return 0
  }

  // Conflict detection (before any write).
  if (args.force !== true) {
    const conflicts = staged.filter((f) => fs.existsSync(f.path)).map((f) => f.name)
    if (conflicts.length > 0) {
      console.error(
        `Error: refusing to overwrite existing file(s): ${conflicts.join(', ')}.\n` +
          `Re-run with --force to overwrite or --dry-run to preview.`,
      )
      return 1
    }
  }

  // Flush. Every read/parse/validate is already done, so a validation failure
  // can't leave a partial scaffold; the `wx` flag (unless --force) also fails
  // fast if a file appeared after the conflict check rather than clobbering it.
  const writeFlag = args.force === true ? 'w' : 'wx'
  try {
    for (const file of staged) {
      fs.writeFileSync(file.path, file.content, { flag: writeFlag })
    }
    if (pkgPlan.action === 'write') {
      fs.writeFileSync(pkgPlan.path, pkgPlan.content)
    }
  } catch (err) {
    console.error(
      `Error: could not write files — ${err instanceof Error ? err.message : String(err)}`,
    )
    return 1
  }

  printClosing(staged, pkgPlan, cwd, sourceRoot)
  return 0
}

function isValidPreset(value: string): value is InitPreset {
  return VALID_PRESET_SET.has(value)
}

function stage(cwd: string, name: string, content: string): StagedFile {
  return { path: path.join(cwd, name), name, content }
}

// --- Templates ---------------------------------------------------------------

function configTemplate(writeBaseline: boolean): string {
  const baselineLine = writeBaseline ? `\n  baseline: 'arch-baseline.json',` : ''
  return `import { defineConfig } from '@nielspeter/eess-ts'

export default defineConfig({
  // The active tsconfig is set in arch.rules.ts via project('...').
  rules: ['arch.rules.ts'],${baselineLine}
  format: 'auto',
})
`
}

/** The source-file glob for the floor rules, sourceRoot-aware. */
function includeGlob(sourceRoot: string): string {
  return `**/${sourceRoot}/**`
}

function rulesTemplate(preset: InitPreset, tsconfig: string, sourceRoot: string): string {
  return preset === 'recommended'
    ? recommendedRulesTemplate(tsconfig, sourceRoot)
    : agentGuardrailsRulesTemplate(tsconfig, sourceRoot)
}

/**
 * Header shared by both floor templates: the CLI runs a rule file's default
 * export (an array of builders). eess presets return violations for a test
 * harness, so `init` expands the floor into builders here — visible and editable.
 */
function rulesHeader(tsconfig: string): string {
  return `// Architecture rules for eess-ts. Run with \`eess-ts check\` (or \`npm run arch\`).
//
// This file expands the 'floor' preset into individual builders. eess presets
// (recommended / agentGuardrails) return violations for a test harness; a CLI
// rule file is an array of builders, so the rules are inlined below — edit,
// remove, or add freely. \`eess-ts explain --format agent\` turns the imperative
// metadata into a rules block for an AI agent's system prompt.

const p = project('${tsconfig}')`
}

function recommendedRulesTemplate(tsconfig: string, sourceRoot: string): string {
  const include = includeGlob(sourceRoot)
  return `import { project, functions } from '@nielspeter/eess-ts'
import { functionNoEval, functionNoFunctionConstructor } from '@nielspeter/eess-ts/rules/security'
import { functionNoSilentCatch } from '@nielspeter/eess-ts/rules/errors'
import { noEmptyBodies } from '@nielspeter/eess-ts/rules/hygiene'

${rulesHeader(tsconfig)}
const include = '${include}'

// Thin universal safety floor — dangerous regardless of project shape.
export default [
  functions(p).that().resideInFile(include).should().satisfy(functionNoEval()).rule({
    id: 'preset/recommended/no-eval',
    because: 'eval() executes arbitrary code — a code-injection risk',
    suggestion: 'remove eval(); parse or dispatch explicitly',
    imperative: 'Do NOT call eval()',
  }),
  functions(p).that().resideInFile(include).should().satisfy(functionNoFunctionConstructor()).rule({
    id: 'preset/recommended/no-function-constructor',
    because: 'the Function constructor is eval() in disguise',
    suggestion: 'define the function directly instead of building it from a string',
    imperative: 'Do NOT use the Function constructor',
  }),
  functions(p).that().resideInFile(include).should().satisfy(functionNoSilentCatch()).rule({
    id: 'preset/recommended/no-silent-catch',
    because: 'a silent catch hides failures',
    suggestion: 'handle or rethrow the caught error (reference it in the catch)',
    imperative: 'Do NOT swallow errors in an empty catch',
  }),
  functions(p).that().resideInFile(include).should().satisfy(noEmptyBodies()).rule({
    id: 'preset/recommended/no-empty-bodies',
    because: 'an empty function body is usually an unfinished stub',
    suggestion: 'implement the body or remove the function',
    imperative: 'Do NOT leave a function body empty',
  }),

  // Add project-specific rules below — builders, no .check().
  //   modules(p).that().resideInFolder('${sourceRoot}/core/**')
  //     .should().notImportFrom('${sourceRoot}/app/**'),
]
`
}

function agentGuardrailsRulesTemplate(tsconfig: string, sourceRoot: string): string {
  const include = includeGlob(sourceRoot)
  return `import { project, functions, smells } from '@nielspeter/eess-ts'
import { functionNoGenericErrors } from '@nielspeter/eess-ts/rules/errors'
import { noStubComments, noEmptyBodies } from '@nielspeter/eess-ts/rules/hygiene'

${rulesHeader(tsconfig)}
const include = '${include}'

// Guardrails for the mistakes AI coding agents make most.
export default [
  functions(p).that().resideInFile(include).should().satisfy(functionNoGenericErrors()).rule({
    id: 'preset/agent/no-generic-errors',
    because: 'a generic Error loses the type/context callers need to handle it',
    suggestion: 'throw a domain-specific error (NotFoundError, ValidationError, …)',
    imperative: 'Do NOT throw new Error() — throw a domain-specific error class',
  }),
  functions(p).that().resideInFile(include).should().satisfy(noStubComments()).rule({
    id: 'preset/agent/no-stubs',
    because: 'stub comments (TODO/FIXME/"not implemented") ship unfinished work',
    suggestion: 'implement the body or remove the stub before committing',
    imperative: 'Do NOT leave stub comments in a function body',
  }),
  functions(p).that().resideInFile(include).should().satisfy(noEmptyBodies()).rule({
    id: 'preset/agent/no-empty-bodies',
    because: 'an empty function body is almost always an unfinished stub',
    suggestion: 'implement the body — every function must have at least one statement',
    imperative: 'Do NOT leave a function body empty',
  }),
  smells.duplicateBodies(p).withMinSimilarity(0.9).rule({
    id: 'preset/agent/no-copy-paste',
    because: 'near-identical bodies are copy-paste instead of reuse',
    suggestion: 'extract the shared logic into one function',
    imperative: 'Do NOT duplicate a function body — extract the shared logic',
  }),

  // Ban a specific call from being inlined (one rule per API):
  //   import { call } from '@nielspeter/eess-ts'
  //   functions(p).that().resideInFile(include).should().notContain(call('parseInt')),
]
`
}

function baselineTemplate(): string {
  // Inert seed — an empty baseline filters nothing. Timestamp is fixed so the
  // seed is deterministic; `eess-ts baseline` restamps it when populated.
  return JSON.stringify({ generatedAt: null, count: 0, violations: [] }, null, 2) + '\n'
}

// --- Source-root detection ---------------------------------------------------

/**
 * Best-effort project source root from the tsconfig `include` globs or
 * `compilerOptions.rootDir`. Falls back to `src`. tsconfig files are often JSONC
 * (comments / trailing commas), so parse failures fall back rather than throw.
 */
function detectSourceRoot(cwd: string, tsconfig: string): string {
  const parsed = readJsonc(path.join(cwd, tsconfig))
  if (!isRecord(parsed)) return 'src'

  const include = parsed['include']
  if (Array.isArray(include)) {
    for (const entry of include) {
      if (typeof entry !== 'string') continue
      const root = leadingDir(entry)
      if (root !== undefined) return root
    }
  }

  const compilerOptions = parsed['compilerOptions']
  if (isRecord(compilerOptions) && typeof compilerOptions['rootDir'] === 'string') {
    const root = leadingDir(compilerOptions['rootDir'])
    if (root !== undefined) return root
  }

  return 'src'
}

/**
 * The first path segment of a glob, if it is a plausible literal source
 * directory. Rejects wildcards, `.`/`..`, and file-like segments (a dotted
 * extension, e.g. `vite.config.ts`) — a common `include` lists config files
 * before the source glob (`["vite.config.ts", "src/**\/*.ts"]`), and picking
 * the file would scaffold a glob that matches nothing (a silently vacuous rule
 * set — exactly what eess exists to prevent). Callers keep scanning past an
 * `undefined` to the next entry.
 */
function leadingDir(glob: string): string | undefined {
  const first = glob.replace(/^\.\//, '').split('/')[0]
  if (
    first === undefined ||
    first === '' ||
    first === '.' ||
    first === '..' ||
    first.includes('*') ||
    /\.[a-z0-9]+$/i.test(first) // looks like a file (has an extension), not a dir
  ) {
    return undefined
  }
  return first
}

function readJsonc(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return undefined
  const raw = fs.readFileSync(filePath, 'utf-8')
  // Strip block and line comments and trailing commas, then parse best-effort.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1')
  try {
    return JSON.parse(stripped)
  } catch (err) {
    // Best-effort JSONC parse: a malformed tsconfig falls back to `src` root
    // detection rather than crashing init. The parse error carries no fix here.
    void err
    return undefined
  }
}

// --- package.json script merge -----------------------------------------------

type PackageJsonPlan =
  | { action: 'write'; path: string; content: string }
  | { action: 'skip'; reason: string }

/**
 * Plan the `package.json` script merge without writing. Reads and parses up
 * front; any problem (missing / unparseable / scripts already present) resolves
 * to a graceful skip rather than a mid-run crash. Preserves the file's indent,
 * EOL, and trailing-newline state so the diff stays to the two added scripts.
 */
function planPackageJson(cwd: string): PackageJsonPlan {
  const pkgPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { action: 'skip', reason: 'no package.json (run `npx eess-ts check` directly)' }
  }

  const raw = fs.readFileSync(pkgPath, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    // The skip reason IS the error handling — we surface it and leave the file
    // untouched rather than risk corrupting an unparseable package.json.
    void err
    return { action: 'skip', reason: 'package.json is not valid JSON — skipped script entry' }
  }
  if (!isRecord(parsed)) {
    return { action: 'skip', reason: 'package.json is not an object — skipped script entry' }
  }

  const existingScripts = parsed['scripts']
  const scripts: Record<string, unknown> = isRecord(existingScripts) ? { ...existingScripts } : {}
  if (scripts['arch'] !== undefined || scripts['arch:baseline'] !== undefined) {
    return { action: 'skip', reason: 'an `arch` or `arch:baseline` script already exists' }
  }

  scripts['arch'] = 'eess-ts check'
  scripts['arch:baseline'] = 'eess-ts baseline'
  parsed['scripts'] = scripts

  const indent = detectIndent(raw)
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const trailingNewline = /\n$/.test(raw)
  let content = JSON.stringify(parsed, null, indent)
  if (eol === '\r\n') content = content.replace(/\n/g, '\r\n')
  if (trailingNewline) content += eol

  return { action: 'write', path: pkgPath, content }
}

/**
 * Detect the indentation (a tab or N spaces) of an existing JSON file. A
 * minified single-line file (no newline) returns `''` so it stays compact
 * rather than being re-expanded to 2-space — keeping the write to the two added
 * scripts. Multi-line files default to 2 spaces when no indent is detected.
 */
function detectIndent(raw: string): string {
  if (!raw.includes('\n')) return ''
  const match = raw.match(/\n(\t+|[ ]+)"/)
  return match?.[1] ?? '  '
}

// --- Messaging ---------------------------------------------------------------

function printDryRun(
  staged: StagedFile[],
  pkg: PackageJsonPlan,
  cwd: string,
  sourceRoot: string,
): void {
  process.stdout.write('Dry run — would create:\n')
  for (const file of staged) {
    const exists = fs.existsSync(file.path) ? ' (exists — needs --force)' : ''
    process.stdout.write(`  ${file.name}${exists}\n`)
  }
  if (pkg.action === 'write') {
    process.stdout.write('  package.json (add `arch` + `arch:baseline` scripts)\n')
  } else {
    process.stdout.write(`  (package.json script entry skipped — ${pkg.reason})\n`)
  }
  if (hasSource(cwd, sourceRoot)) {
    process.stdout.write(
      `\nNote: this codebase already has source under ${sourceRoot}/ — errors fail the ` +
        `build, warnings don't. Run \`eess-ts baseline\` before gating CI on \`arch\`.\n`,
    )
  }
}

function printClosing(
  staged: StagedFile[],
  pkg: PackageJsonPlan,
  cwd: string,
  sourceRoot: string,
): void {
  const scriptsAdded = pkg.action === 'write'
  const runCmd = scriptsAdded ? 'npm run arch' : 'npx eess-ts check'
  const baselineCmd = scriptsAdded ? 'npm run arch:baseline' : 'npx eess-ts baseline'

  process.stdout.write(`Created ${String(staged.length)} file(s).\n`)
  if (!scriptsAdded && pkg.action === 'skip') {
    process.stdout.write(`Note: package.json script entry skipped — ${pkg.reason}.\n`)
  }

  if (hasSource(cwd, sourceRoot)) {
    process.stdout.write(
      `\nThis codebase already has source under ${sourceRoot}/. Errors fail the build; ` +
        `warnings are advisory and never fail CI.\n` +
        `To accept current violations as tracked legacy debt before gating CI, run ` +
        `\`${baselineCmd}\` and commit the result, then: \`${runCmd}\`.\n`,
    )
  } else {
    process.stdout.write(`\nNext: \`${runCmd}\`.\n`)
  }
}

/** Does the source root directory exist and contain at least one entry? */
function hasSource(cwd: string, sourceRoot: string): boolean {
  const dir = path.join(cwd, sourceRoot)
  try {
    return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length > 0
  } catch (err) {
    // A missing/unreadable source dir simply means "no existing source" — the
    // greenfield closing message applies. Nothing to report.
    void err
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
