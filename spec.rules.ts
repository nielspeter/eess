/**
 * spec.rules.ts — eess validates its own specs against its own code (plan 0061).
 *
 * Two markdown tables in this repo are *specs*: the README package list and the
 * CLAUDE.md ADR index. This file binds each to the code it describes with the
 * kernel `correspondence()` primitive, so drift in either direction fails the
 * build. Run by `eess-ts check spec.rules.ts` (the `check:spec` gate).
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  correspondence,
  type Selection,
  type Condition,
  type ArchViolation,
} from '@nielspeter/eess'
import { corpus, rows, links, type MdRow } from '@nielspeter/eess-md'
import { files } from '@nielspeter/eess-crossvalidate/files'

const c = corpus({ roots: ['README.md', 'CLAUDE.md'] })

/** Strip inline-code backticks a table cell keeps, e.g. "`@nielspeter/eess`" → "@nielspeter/eess". */
function bare(cell: string): string {
  return cell.replace(/`/g, '').trim()
}

// ─── 2a. README "Packages" table ↔ the actual workspace packages ─────────────

interface WorkspacePackage {
  readonly name: string
  readonly version: string
  readonly dir: string
}

/** Read each package.json under `packages/` — the ground truth the README describes. */
function readWorkspacePackages(): WorkspacePackage[] {
  const out: WorkspacePackage[] = []
  for (const entry of fs.readdirSync('packages', { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.posix.join('packages', entry.name)
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'name' in parsed &&
      'version' in parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.version === 'string'
    ) {
      out.push({ name: parsed.name, version: parsed.version, dir })
    }
  }
  return out
}

const workspace = readWorkspacePackages()

const workspaceSelection: Selection<WorkspacePackage> = {
  elements: workspace,
  label: 'workspace package',
  identify: (p) => ({ name: p.name, file: `${p.dir}/package.json`, line: 1 }),
}

const packageRowSelection = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ },
}).select({
  label: 'README package row',
  identify: (r) => ({ name: bare(r.get('pkg')), file: r.doc.relPath, line: r.line }),
})

const readmePackagesMatchWorkspace = correspondence({
  left: packageRowSelection,
  right: workspaceSelection,
  keyBy: { left: (r) => bare(r.get('pkg')), right: (p) => p.name },
  suggest: {
    left: (info) => `remove the README row for '${info.name}' or restore the package`,
    right: (info) => `add a row for '${info.name}' to the README Packages table`,
  },
})
  .should()
  .beComplete({ direction: 'both' })
  .because('the README package table is a spec: it must not drift from the workspace')
  .rule({ id: 'spec/readme-packages-match-workspace' })

// No half-verified rows: the Status column carries the published version, so it
// is bound too — the cell must contain the package's actual major.minor.
const versionByName = new Map(workspace.map((p) => [p.name, p.version]))

const statusMatchesVersion: Condition<MdRow> = {
  description: 'README Status cell contains the package major.minor version',
  evaluate: (rowsIn, ctx) =>
    rowsIn.flatMap((row): ArchViolation[] => {
      const name = bare(row.get('pkg'))
      const version = versionByName.get(name)
      if (version === undefined) return [] // unknown name → the correspondence above reports it
      const [major, minor] = version.split('.')
      const wanted = `${major}.${minor}`
      const status = row.get('status')
      if (status.includes(wanted)) return []
      return [
        {
          rule: ctx.rule,
          ruleId: ctx.ruleId,
          element: name,
          file: row.doc.file,
          line: row.line,
          message: `README Status "${status}" does not match ${name}@${version} (expected to contain "${wanted}")`,
          suggestion: `update the Status cell for ${name} to reflect ${wanted}.x`,
        },
      ]
    }),
}

const readmeStatusMatchesVersion = rows(c, {
  section: /^Packages$/,
  columns: { pkg: /^Package$/, status: /^Status$/ },
})
  .should()
  .satisfy(statusMatchesVersion)
  .because('a gated table with an unverified column lends false credibility')
  .rule({ id: 'spec/readme-status-matches-version' })

// ─── 2b. CLAUDE.md ADR index table ↔ the adr/*.md files ──────────────────────

/** Extract an ADR number from a path, e.g. "adr/001-toolchain.md" → "001". */
function adrNumber(p: string): string {
  return /(\d+)-/.exec(p)?.[1] ?? ''
}

// The code side is a set of files — `files()` turns adr/*.md into a Selection.
const adrFilesSelection = files({
  glob: 'adr/*.md',
  label: 'ADR file',
  identify: (f) => ({ name: adrNumber(f.path), file: f.path, line: 1 }),
})

const adrRowSelection = rows(c, {
  columns: { adr: /^ADR$/, title: /^Title$/ },
}).select({
  label: 'CLAUDE.md ADR index row',
  identify: (r) => ({ name: bare(r.get('adr')), file: r.doc.relPath, line: r.line }),
})

const adrIndexMatchesFiles = correspondence({
  left: adrRowSelection,
  right: adrFilesSelection,
  keyBy: { left: (r) => bare(r.get('adr')), right: (f) => adrNumber(f.path) },
  suggest: {
    left: (info) => `remove the ADR ${info.name} index row or restore adr/${info.name}-*.md`,
    right: (info) => `add ADR ${info.name} to the CLAUDE.md index table`,
  },
})
  .should()
  .beComplete({ direction: 'both' })
  .because('the CLAUDE.md ADR index is a spec: every ADR is listed, every listing is real')
  .rule({ id: 'spec/adr-index-matches-files' })

// A row only carries the link text (the number), not its URL — so verify the
// `[NNN](./adr/…)` targets resolve with a scoped links() rule alongside.
const adrIndexLinksResolve = links(c)
  .that()
  .areInternal()
  .satisfy({ description: 'point into adr/', test: (l) => /\/adr\/\d/.test(l.url) })
  .should()
  .resolve()
  .because('the ADR index links are part of the spec — they must resolve')
  .rule({ id: 'spec/adr-index-links-resolve' })

export default [
  readmePackagesMatchWorkspace,
  readmeStatusMatchesVersion,
  adrIndexMatchesFiles,
  adrIndexLinksResolve,
]
