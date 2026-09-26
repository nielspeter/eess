/**
 * Bug 0339 — a `**\/…` glob selected nothing when the project sat under a path with a dot-segment.
 *
 * picomatch's default `dot: false` stops `**` crossing a segment that begins with `.`, and these
 * globs are matched against the ABSOLUTE file path. A checkout under `~/.tool/worktrees/app` — a
 * git-worktree manager's layout, a cache directory, some CI workspaces — therefore selected 0
 * subjects for every rule, and ADR-010 reported correct rules as enforcing nothing.
 *
 * The same project is loaded from two paths that differ only in a leading dot-segment, and every
 * assertion compares the two. A fix that broke matching everywhere would keep them equal, so each
 * case also asserts the absolute count it expects.
 *
 * The dot-directory is CONSTRUCTED here rather than checked in: the path of the project under test
 * is the thing under test, and a fixture committed to this repository is always at this
 * repository's path.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from 'ts-morph'
import { functions } from '../../src/builders/function-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { crossLayer } from '../../src/builders/cross-layer-builder.js'
import { slices } from '../../src/builders/slice-rule-builder.js'
import { smells } from '../../src/smells/index.js'
import { call } from '../../src/helpers/matchers.js'
import { resideInFile, resideInFolder, havePathMatching } from '../../src/predicates/identity.js'
import * as structuralCondition from '../../src/conditions/structural.js'
import * as functionCondition from '../../src/conditions/function.js'
import { haveMatchingCounterpart } from '../../src/conditions/cross-layer.js'
import { onlyBeImportedVia } from '../../src/conditions/reverse-dependency.js'
import { resolvers } from '../../src/graphql/index.js'
import { diskSet } from '../../src/core/disk-set.js'
import { strictBoundaries } from '../../src/presets/boundaries.js'
import { CLASSIFIED } from '../matrix/path-glob-surfaces.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let underDot: ArchProject
let plain: ArchProject

/**
 * The same four files, written twice: once under a dot-segment, once not.
 *
 * Two files in `src/domain/` on purpose — the sibling detector only groups a
 * folder holding at least two, so a one-file-per-folder fixture would let its
 * probe below pass while measuring nothing.
 */
function writeFixture(root: string): ArchProject {
  fs.mkdirSync(path.join(root, 'src', 'domain'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  fs.writeFileSync(
    path.join(root, 'src', 'a.ts'),
    'export function alpha(): number {\n  return 1\n}\n',
  )
  fs.writeFileSync(
    path.join(root, 'src', 'domain', 'b.ts'),
    "import { alpha } from '../a.js'\nexport function beta(): number {\n  return alpha()\n}\n",
  )
  fs.writeFileSync(
    path.join(root, 'src', 'domain', 'c.ts'),
    "import { alpha } from '../a.js'\nexport function gamma(): number {\n  return alpha() + 1\n}\n",
  )
  const tsConfigPath = path.join(root, 'tsconfig.json')
  const tsm = new Project({ tsConfigFilePath: tsConfigPath })
  return { tsConfigPath, _project: tsm, getSourceFiles: () => tsm.getSourceFiles() }
}

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0339-'))
  underDot = writeFixture(path.join(base, '.tooldir', 'worktrees', 'app'))
  plain = writeFixture(path.join(base, 'plain', 'app'))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

/** Subjects a selector reaches, as names — an identity, not a count. */
const selected = (p: ArchProject, glob: string): string[] =>
  functions(p)
    .that()
    .resideInFile(glob)
    .should()
    .haveNameMatching(/^nothing-matches-this$/)
    .rule({ id: 'test/0339' })
    .violations()
    .map((v) => v.element ?? '')
    .sort()

describe('bug 0339: a project under a dot-directory', () => {
  it('selects the same files by an anywhere-glob as from a plain path', () => {
    expect(selected(underDot, '**/src/**')).toEqual(['alpha', 'beta', 'gamma'])
    expect(selected(underDot, '**/src/**')).toEqual(selected(plain, '**/src/**'))
  })

  it('selects the same files by a file glob, a folder glob and a suffix glob', () => {
    for (const glob of ['**/*.ts', '**/domain/**', '**/b.ts']) {
      expect(selected(underDot, glob), glob).toEqual(selected(plain, glob))
    }
    // The absolute answers too, so a fix that matched nothing anywhere could not pass.
    expect(selected(underDot, '**/*.ts')).toEqual(['alpha', 'beta', 'gamma'])
    expect(selected(underDot, '**/domain/**')).toEqual(['beta', 'gamma'])
    expect(selected(underDot, '**/b.ts')).toEqual(['beta'])
  })

  it('reaches a folder selector from under a dot-directory', () => {
    const inFolder = (p: ArchProject): string[] =>
      functions(p)
        .that()
        .resideInFolder('**/domain/**')
        .should()
        .haveNameMatching(/^nothing-matches-this$/)
        .rule({ id: 'test/0339-folder' })
        .violations()
        .map((v) => v.element ?? '')

    expect(inFolder(underDot)).toEqual(['beta', 'gamma'])
    expect(inFolder(underDot)).toEqual(inFolder(plain))
  })

  it('keeps a project-relative glob working, which was the documented workaround', () => {
    expect(selected(underDot, 'src/**')).toEqual(['alpha', 'beta', 'gamma'])
    expect(selected(underDot, 'src/**')).toEqual(selected(plain, 'src/**'))
  })

  it('discovers boundaries from under a dot-directory', () => {
    // `strictBoundaries` is NOT in the census table below — it declares no glob
    // site, so the scan that builds that table cannot see it — and its folder
    // discovery is therefore the one site in this fix with no other falsifier.
    // Measured: reverting it to the absolute path alone left the whole suite
    // green, which is an unfalsifiable guard. This is that row.
    const configFindings = (p: ArchProject): string[] =>
      strictBoundaries(p, { folders: '**/src/*', report: 'builders' })
        .flatMap((rule) => rule.violations())
        .filter((v) => v.bypassFilters === true)
        .map((v) => v.ruleId ?? '')
        .sort()

    expect(configFindings(underDot)).toEqual(configFindings(plain))
    // Non-vacuity: boundaries were actually discovered, so this is not two
    // identical failures agreeing with each other.
    expect(configFindings(underDot)).toEqual([])
  })

  it('tells the truth about what is on disk', () => {
    // `diagnose()` reaches `diskSet.classify` only for a glob already found dead
    // in the project, and then prints a FACT about the filesystem — so a wrong
    // answer here is worse than a missed match. `classify` matched the glob
    // against absolute walked paths alone, so under a dot-segment a directory
    // that exists and holds TypeScript was reported `absent`, whose advice says
    // no such path was found and a segment must be misspelled.
    expect(diskSet(underDot).classify('**/src/**')).toBe('holds-typescript')
    expect(diskSet(underDot).classify('**/src/**')).toBe(diskSet(plain).classify('**/src/**'))
    // The control: a path that genuinely is not there is still absent, from both.
    expect(diskSet(underDot).classify('**/no-such-dir/**')).toBe('absent')
    expect(diskSet(plain).classify('**/no-such-dir/**')).toBe('absent')
  })

  it('does not report a correct rule as enforcing nothing', () => {
    // The symptom an adopter meets: ADR-010's guard firing on a selector that is fine, with a
    // remedy that tells them to widen it or declare it empty.
    const configFindings = modules(underDot)
      .that()
      .resideInFile('**/src/**')
      .should()
      .notImportFrom('**/nowhere/**')
      .rule({ id: 'test/0339-vacuity' })
      .violations()
      .filter((v) => v.bypassFilters === true)

    expect(configFindings.map((v) => v.message ?? '')).toEqual([])
  })
})

/**
 * The same question asked of EVERY classified path-glob surface, not only the
 * three predicates the report named.
 *
 * Why a table over the census rather than a test per surface: the census in
 * `tests/matrix/path-glob-surfaces.ts` classified `conditions/structural.ts`,
 * `conditions/function.ts` and `smells/smell-builder.ts` as `'normalized'` while
 * all three matched the absolute path alone. The classification was a claim with
 * no mechanism, so it could be wrong for as long as nobody read the code beside
 * it. Reading the same table here is what makes it falsifiable: a surface cannot
 * be classified without also being measured, and a new one cannot be added
 * without a probe.
 *
 * Each probe returns a NUMBER the surface derives from a path glob — subjects
 * examined where the family exposes `examinedUnits()`, findings otherwise. The
 * absolute value is not the assertion; the assertion is that it does not depend
 * on where the project sits on disk.
 */
interface Probe {
  readonly name: string
  readonly measure: (p: ArchProject, glob: string) => number
}

const PROBES: Readonly<Record<string, readonly Probe[]>> = {
  'predicates/identity.ts': [
    {
      name: 'resideInFile',
      measure: (p, g) => modules(p).that().satisfy(resideInFile(g)).examinedUnits(),
    },
    {
      name: 'resideInFolder',
      measure: (p, g) => modules(p).that().satisfy(resideInFolder(g)).examinedUnits(),
    },
    {
      name: 'havePathMatching',
      measure: (p, g) => modules(p).that().satisfy(havePathMatching(g)).examinedUnits(),
    },
  ],
  // A CONDITION, so the number is FAILURES: every subject fails a glob the
  // condition cannot match, which is the false red this surface produced from a
  // dot-directory rather than the empty selection the predicates produced.
  'conditions/structural.ts': [
    {
      name: 'resideInFile (failures)',
      measure: (p, g) =>
        reportedBy(modules(p).should().satisfy(structuralCondition.resideInFile(g))),
    },
    {
      name: 'resideInFolder (failures)',
      measure: (p, g) =>
        reportedBy(modules(p).should().satisfy(structuralCondition.resideInFolder(g))),
    },
  ],
  'conditions/function.ts': [
    {
      name: 'resideInFile (failures)',
      measure: (p, g) =>
        reportedBy(functions(p).should().satisfy(functionCondition.resideInFile(g))),
    },
    {
      name: 'resideInFolder (failures)',
      measure: (p, g) =>
        reportedBy(functions(p).should().satisfy(functionCondition.resideInFolder(g))),
    },
  ],
  // Failures again, and the glob list below carries one that matches nothing so
  // this probe has a non-zero answer: every importer in the fixture matches every
  // other glob, so an allowlist built from one is satisfied and reports 0.
  'conditions/reverse-dependency.ts': [
    {
      name: 'onlyBeImportedVia (failures)',
      measure: (p, g) => reportedBy(modules(p).should().satisfy(onlyBeImportedVia(g))),
    },
  ],
  'builders/cross-layer-builder.ts': [
    {
      name: 'layer (pairs)',
      // `examinedUnits()` — the layer PAIRS the rule reached, which is what the
      // glob decides. Counting findings here would have measured the discovery
      // guard instead of the resolver.
      measure: (p, g) =>
        crossLayer(p)
          .layer('left', g)
          .layer('right', g)
          .mapping(() => true)
          .forEachPair()
          .should(haveMatchingCounterpart())
          .examinedUnits(),
    },
  ],
  'smells/smell-builder.ts': [
    {
      name: 'duplicateBodies().inFolder',
      measure: (p, g) => smells.duplicateBodies(p).minLines(1).inFolder(g).examinedUnits(),
    },
    {
      name: 'inconsistentSiblings().inFolder',
      measure: (p, g) =>
        smells.inconsistentSiblings(p).forPattern(call('nothing')).inFolder(g).examinedUnits(),
    },
  ],
  'builders/slice-rule-builder.ts': [
    {
      name: 'matching',
      measure: (p, g) => slices(p).matching(g).should().beFreeOfCycles().examinedUnits(),
    },
  ],
  'graphql/resolver-rule-builder.ts': [
    {
      name: 'resolvers',
      // No predicate: `resolvers(p, glob)` filters the files by the glob and the
      // builder's unit count is that selection, so this measures the glob and
      // nothing else.
      measure: (p, g) => resolvers(p, g).examinedUnits(),
    },
  ],
}

/** Findings a rule reports, excluding the configuration findings ADR-010 adds. */
function reportedBy(builder: {
  rule: (meta: { id: string }) => { violations: () => readonly { bypassFilters?: boolean }[] }
}): number {
  return builder
    .rule({ id: 'test/0339-condition' })
    .violations()
    .filter((v) => v.bypassFilters !== true).length
}

describe('every classified path-glob surface reads the same project from two paths', () => {
  // `'**/nowhere/**'` is here for the condition probes: a glob every file
  // matches leaves an allowlist satisfied, so without one that matches nothing
  // those probes would be inert and the non-vacuity assertion below would
  // (rightly) fail.
  const globs = ['**/src/**', 'src/**', '**/*.ts', '**/domain/**', '**/b.ts', '**/nowhere/**']

  it('every surface the census classifies has a probe here', () => {
    // THE guard, and the one bug 0339 needed. A surface classified `'normalized'`
    // with nothing measuring it is how three of them stayed absolute-only through
    // two releases. `'fixed'` surfaces take the library's own constants, never a
    // caller's glob, so they have nothing to measure.
    const owed = Object.entries(CLASSIFIED)
      .filter(([, base]) => base !== 'fixed')
      .map(([file]) => file)
      .filter((file) => PROBES[file] === undefined)
    expect(owed).toEqual([])
  })

  it('no probe is stale', () => {
    expect(Object.keys(PROBES).filter((file) => CLASSIFIED[file] === undefined)).toEqual([])
  })

  it.each(
    Object.entries(PROBES).flatMap(([file, probes]) => probes.map((probe) => ({ file, probe }))),
  )('$file · $probe.name', ({ probe }) => {
    // Not vacuous by construction: at least one glob has to reach something,
    // or a surface broken for EVERY glob would pass this by symmetry — two
    // zeroes agree perfectly.
    const answers = globs.map((glob) => ({
      glob,
      dot: probe.measure(underDot, glob),
      plain: probe.measure(plain, glob),
    }))
    for (const { glob, dot, plain: onPlain } of answers) {
      expect({ glob, n: dot }).toEqual({ glob, n: onPlain })
    }
    expect(answers.some(({ dot }) => dot > 0)).toBe(true)
  })
})
