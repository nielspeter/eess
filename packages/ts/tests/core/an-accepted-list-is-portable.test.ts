/**
 * Bug 0389. A deferred warning's `accepted` list keeps a finding at `warn` only when its subject
 * is in the list. Producer identities interpolate the absolute path, and the comparison used the
 * raw subject, so a list written on one checkout matched nothing on another: every accepted finding
 * escalated to `error` on CI, and the advice an adopter pastes from printed the author's path.
 *
 * The fix compares, and prints, the subject with the identity root scrubbed — the form the
 * baseline hash already uses. These rows drive the public path an adopter takes: run the rule,
 * copy the subjects the advice prints, put them in `accepted`, run again somewhere else.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { modules, TerminalBuilder, collectResult } from '../../src/index.js'
import { subjectOf } from '@nielspeter/eess/internal'
import type { ArchViolation, CollectResult } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

/** The same code, checked out under `root` — what a laptop and a CI runner differ by. */
function checkout(root: string): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  tsm.createSourceFile(`${root}/src/a.ts`, "import { x as y } from './b'\nexport const a = y\n")
  tsm.createSourceFile(`${root}/src/b.ts`, 'export const x = 1\n')
  return {
    tsConfigPath: `${root}/tsconfig.json`,
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}

const rule = (p: ArchProject) =>
  modules(p)
    .that()
    .resideInFolder('**/src/**')
    .should()
    .notHaveAliasedImports()
    .rule({ id: 'test/0389' })

/** The subjects the advice tells the author to paste, read back out of its own text. */
function pastedFromAdvice(p: ArchProject): string[] {
  const advice = rule(p).asSeverity('warn', { accepted: [] }).deferredWarningAdvice()
  const listed = /fail at check\(\) time: (.*)\. Either fix it/.exec(advice)?.[1]
  return listed === undefined ? [] : listed.split(', ')
}

const ALICE = '/home/alice/repo'
const CI = '/runner/work/repo'

describe('bug 0389: an accepted list written on one checkout holds on another', () => {
  it('the fixture produces a finding whose identity carries the checkout path', () => {
    const [finding] = rule(checkout(ALICE)).violations()
    expect(finding).toBeDefined()
    expect(subjectOf(finding!)).toContain(ALICE)
  })

  it('the advice prints a subject without the author checkout path', () => {
    const pasted = pastedFromAdvice(checkout(ALICE))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).not.toContain(ALICE)
  })

  it('a list pasted from the advice on one checkout keeps the finding at warn on another', () => {
    const accepted = pastedFromAdvice(checkout(ALICE))
    const severities = rule(checkout(CI))
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    expect(severities).toEqual(['warn'])
  })

  it('a list pasted before the fix, with the raw path, still holds in the checkout it was written in', () => {
    const accepted = rule(checkout(ALICE))
      .violations()
      .map((v) => subjectOf(v))
    expect(accepted[0]).toContain(ALICE)
    const severities = rule(checkout(ALICE))
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    expect(severities).toEqual(['warn'])
  })

  it('a different finding is still escalated, so the list did not become a blanket pass', () => {
    const accepted = pastedFromAdvice(checkout(ALICE))
    const tsm = new Project({ useInMemoryFileSystem: true })
    tsm.createSourceFile(`${CI}/src/a.ts`, "import { x as z } from './b'\nexport const a = z\n")
    tsm.createSourceFile(`${CI}/src/b.ts`, 'export const x = 1\n')
    const moved: ArchProject = {
      tsConfigPath: `${CI}/tsconfig.json`,
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    const severities = rule(moved)
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    expect(severities).toEqual(['error'])
  })
})

/**
 * Roots are found on the real disk, so these rows build real directories. The in-memory project's
 * paths name them; ts-morph never reads them.
 */
const scratchDirs: string[] = []
function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'eess-0389-'))
  scratchDirs.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
})
function aliasedProject(tsConfigPath: string, files: string[]): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const f of files) {
    tsm.createSourceFile(f, "import { x as y } from './b'\nexport const a = y\n")
    tsm.createSourceFile(path.join(path.dirname(f), 'b.ts'), 'export const x = 1\n')
  }
  return { tsConfigPath, _project: tsm, getSourceFiles: () => tsm.getSourceFiles() }
}

/**
 * The shape an adopter's own dialect takes: a builder that names no project. Its findings are real
 * ones, produced by `modules()`; only the builder that judges them is this one.
 */
class NoProjectBuilder extends TerminalBuilder {
  constructor(private readonly findings: readonly ArchViolation[]) {
    super()
  }
  protected collectViolations(): CollectResult {
    return collectResult([...this.findings], { examined: this.findings.length })
  }
}

function pastedFrom(builder: TerminalBuilder): string[] {
  const advice = builder.asSeverity('warn', { accepted: [] }).deferredWarningAdvice()
  const listed = /fail at check\(\) time: (.*)\. Either fix it/.exec(advice)?.[1]
  return listed === undefined ? [] : listed.split(', ')
}

describe('bug 0389: which root a subject is scrubbed against', () => {
  it('a builder that names no project leaves its subjects as they are', () => {
    const dir = scratch()
    const a = path.join(dir, 'pkgA/src/a.ts')
    const found = rule(aliasedProject(path.join(dir, 'tsconfig.json'), [a])).violations()
    const pasted = pastedFrom(new NoProjectBuilder(found))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain(a)
  })

  it('an entry pasted for a fixed finding does not accept a new one under another package root', () => {
    // Enforcement review measured this `warn` when the root was found per finding: two package
    // roots scrub `pkgA/src/a.ts` and `pkgB/src/a.ts` to one subject, and the guard cannot see a
    // collision with a finding that is no longer in the run. `main` said `error`.
    const dir = scratch()
    for (const pkg of ['pkgA', 'pkgB']) {
      mkdirSync(path.join(dir, pkg), { recursive: true })
      writeFileSync(path.join(dir, pkg, 'package.json'), '{}')
    }
    const a = path.join(dir, 'pkgA/src/a.ts')
    const b = path.join(dir, 'pkgB/src/a.ts')
    const found = rule(aliasedProject(path.join(dir, 'tsconfig.json'), [a, b])).violations()
    const accepted = pastedFrom(new NoProjectBuilder(found.filter((v) => v.file === a)))

    const later = new NoProjectBuilder(found.filter((v) => v.file === b))
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    expect(later).toEqual(['error'])
  })

  it('a builder that names its project scrubs against the root above its tsconfig, not above the file', () => {
    const dir = scratch()
    writeFileSync(path.join(dir, 'package.json'), '{}')
    mkdirSync(path.join(dir, 'libs/x'), { recursive: true })
    writeFileSync(path.join(dir, 'libs/x/package.json'), '{}')
    const file = path.join(dir, 'libs/x/src/a.ts')
    const pasted = pastedFrom(rule(aliasedProject(path.join(dir, 'tsconfig.json'), [file])))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain('libs/x/src/a.ts')
    expect(pasted[0]).not.toContain(dir)
  })

  it('two findings that scrub to one subject escalate together (the guard sees what the matcher sees)', () => {
    // Bug 0391: the scrub replaces the root inside a path too, so under `/app` the files
    // `src/app/user.ts` and `src/appuser.ts` scrub to one subject. One pasted entry would forgive
    // both; the collision guard compares the scrubbed key, so neither stays at warn.
    const user = '/app/src/app/user.ts'
    const other = '/app/src/appuser.ts'
    const p = aliasedProject('/app/tsconfig.json', [user, other])
    const accepted = pastedFrom(rule(aliasedProject('/app/tsconfig.json', [user])))
    expect(accepted).toHaveLength(1)
    const both = rule(p).asSeverity('warn', { accepted })
    expect(both.violations().map((v) => v.severity)).toEqual(['error', 'error'])
    expect(both.deferredWarningAdvice()).toContain('bug 0391')
  })

  it('a filesystem root is no root: the subject is left as it is', () => {
    const pasted = pastedFrom(rule(aliasedProject('/tsconfig.json', ['/src/a.ts'])))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain('/src/a.ts')
    expect(pasted[0]).not.toContain('<root>')
  })
})
