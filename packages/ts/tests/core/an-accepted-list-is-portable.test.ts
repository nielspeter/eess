/**
 * Bug 0389, built as spike 0392's C5. A deferred warning's `accepted` list keeps a finding at
 * `warn` only when its subject is in the list. Producer identities carry the absolute path, so a
 * list written on one checkout matched nothing on another, and the advice an adopter pastes from
 * printed the author's path.
 *
 * The advice now prints a portable form: every path token under the repository's root becomes
 * `<root:NAME>/relative/path`, where NAME is the root `package.json` name. A finding matches an
 * entry by its raw subject or by that form. The rows below are the spike's cases, driven through the
 * public path an adopter takes: run the rule, paste from the advice, run again. Root discovery reads
 * the real disk, so every row builds a real layout; the in-memory project's paths name it.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { modules, TerminalBuilder, collectResult } from '../../src/index.js'
import { portableTokens, subjectOf } from '@nielspeter/eess/internal'
import type { ArchViolation, CollectResult } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

const scratchDirs: string[] = []
afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
})

type Marker = 'gitdir' | 'gitfile' | 'workspaces' | 'pkg'
/** A real directory tree: each entry is a directory, a marker, and an optional package name. */
function layout(spec: Record<string, [Marker | 'dir', string?]>): string {
  const base = mkdtempSync(path.join(tmpdir(), 'eess-0389-'))
  scratchDirs.push(base)
  for (const [rel, [marker, name]] of Object.entries(spec)) {
    const dir = path.join(base, rel)
    mkdirSync(dir, { recursive: true })
    if (marker === 'gitdir') mkdirSync(path.join(dir, '.git'))
    if (marker === 'gitfile') writeFileSync(path.join(dir, '.git'), 'gitdir: elsewhere\n')
    const manifest: Record<string, unknown> = {}
    if (marker === 'workspaces') manifest.workspaces = ['*']
    if (name !== undefined) manifest.name = name
    if (marker === 'pkg' || Object.keys(manifest).length > 0) {
      writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest))
    }
  }
  return base
}

/** A project whose tsconfig sits in `dir`, with one aliased import in `dir/<file>`. */
function projectIn(dir: string, file = 'src/a.ts', alias = 'y'): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  const abs = path.join(dir, file)
  tsm.createSourceFile(abs, `import { x as ${alias} } from './b'\nexport const a = ${alias}\n`)
  tsm.createSourceFile(path.join(path.dirname(abs), 'b.ts'), 'export const x = 1\n')
  return {
    tsConfigPath: path.join(dir, 'tsconfig.json'),
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
function pastedFrom(builder: TerminalBuilder): string[] {
  const advice = builder.asSeverity('warn', { accepted: [] }).deferredWarningAdvice()
  const listed = /fail at check\(\) time: (.*)\. Either fix it/.exec(advice)?.[1]
  return listed === undefined ? [] : listed.split(', ')
}

const severities = (builder: TerminalBuilder, accepted: string[]) =>
  builder
    .asSeverity('warn', { accepted })
    .violations()
    .map((v) => v.severity)

describe('bug 0389: a list pasted on one checkout holds on another', () => {
  const alice = path.join(layout({ repo: ['gitdir', 'acme'] }), 'repo')
  const ci = path.join(layout({ repo: ['gitdir', 'acme'] }), 'repo')

  it('the fixture produces a finding whose identity carries the checkout path', () => {
    const [finding] = rule(projectIn(alice)).violations()
    expect(finding).toBeDefined()
    expect(subjectOf(finding!)).toContain(alice)
  })

  it('the advice prints the portable form, not the author checkout path', () => {
    const pasted = pastedFrom(rule(projectIn(alice)))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain('<root:acme>/src/a.ts')
    expect(pasted[0]).not.toContain(alice)
  })

  it('a list pasted from the advice on one checkout keeps the finding at warn on another', () => {
    const accepted = pastedFrom(rule(projectIn(alice)))
    expect(severities(rule(projectIn(ci)), accepted)).toEqual(['warn'])
  })

  it('a list pasted before the fix, with the raw path, still holds in the checkout it was written in', () => {
    const accepted = rule(projectIn(alice))
      .violations()
      .map((v) => subjectOf(v))
    expect(accepted[0]).toContain(alice)
    expect(severities(rule(projectIn(alice)), accepted)).toEqual(['warn'])
  })

  it('a different finding is still escalated, so the list did not become a blanket pass', () => {
    const accepted = pastedFrom(rule(projectIn(alice)))
    expect(severities(rule(projectIn(ci, 'src/a.ts', 'z')), accepted)).toEqual(['error'])
  })

  it('a worktree, whose .git is a file, is the same repository', () => {
    const worktree = path.join(layout({ wt: ['gitfile', 'acme'] }), 'wt')
    const accepted = pastedFrom(rule(projectIn(alice)))
    expect(severities(rule(projectIn(worktree)), accepted)).toEqual(['warn'])
  })

  it('a checkout without .git is the same repository when a workspace manifest names it', () => {
    const laptop = path.join(layout({ repo: ['workspaces', 'acme'] }), 'repo')
    const docker = path.join(layout({ app: ['workspaces', 'acme'] }), 'app')
    const accepted = pastedFrom(rule(projectIn(laptop)))
    expect(severities(rule(projectIn(docker)), accepted)).toEqual(['warn'])
  })
})

describe('bug 0389: a portable entry never accepts a different finding (spike 0392)', () => {
  /** List pasted from pkgA's builder; pkgA fixed; the same finding appears in pkgB's builder. */
  function fixedThenNew(spec: Record<string, [Marker | 'dir', string?]>): (string | undefined)[] {
    const base = layout(spec)
    const accepted = pastedFrom(rule(projectIn(path.join(base, 'pkgA'))))
    return severities(rule(projectIn(path.join(base, 'pkgB'))), accepted)
  }

  it('two packages with their own package.json and no repository marker', () => {
    expect(fixedThenNew({ pkgA: ['pkg', 'a'], pkgB: ['pkg', 'b'] })).toEqual(['error'])
  })

  it('two packages inside one repository that share a package name, such as copied templates', () => {
    // The root is the repository, never a package's own package.json: under that fallback both
    // would be `<root:template>/src/a.ts`, and one entry would cover both.
    expect(
      fixedThenNew({
        '.': ['gitdir', 'mono'],
        pkgA: ['pkg', 'template'],
        pkgB: ['pkg', 'template'],
      }),
    ).toEqual(['error'])
  })

  it('submodules: each package has a .git file inside one repository', () => {
    expect(
      fixedThenNew({ '.': ['gitdir', 'mono'], pkgA: ['gitfile', 'a'], pkgB: ['gitfile', 'b'] }),
    ).toEqual(['error'])
  })

  it('two separate repositories under one rule file', () => {
    expect(fixedThenNew({ pkgA: ['gitdir', 'a'], pkgB: ['gitdir', 'b'] })).toEqual(['error'])
  })

  it('a repository with no package name keeps the raw subject, so nothing is shared', () => {
    expect(fixedThenNew({ pkgA: ['gitdir'], pkgB: ['gitdir'] })).toEqual(['error'])
    const unnamed = path.join(layout({ repo: ['gitdir'] }), 'repo')
    expect(pastedFrom(rule(projectIn(unnamed)))[0]).toContain(unnamed)
  })

  it('KNOWN RESIDUAL — two separate repositories that share one package name do share an entry', () => {
    // Spike 0392's floor: nothing machine-independent tells two repositories apart that carry the
    // same name. Accepted by the maintainer 2026-10-06. If this row turns red, the residual is gone.
    expect(fixedThenNew({ pkgA: ['gitdir', 'same'], pkgB: ['gitdir', 'same'] })).toEqual(['warn'])
  })

  it('whole path tokens, not substrings: a root that spells a path segment keeps two files apart', () => {
    // Bug 0391's shape. Under a root `/app`, the old substring scrub turned both into one subject.
    const repo = { root: '/app', name: 'acme' }
    expect(portableTokens('/app/src/app/user.ts::m', repo)).toBe('<root:acme>/src/app/user.ts::m')
    expect(portableTokens('/app/src/appuser.ts::m', repo)).toBe('<root:acme>/src/appuser.ts::m')
    expect(portableTokens('/app2/src/x.ts::m', repo)).toBe('/app2/src/x.ts::m')
  })

  it('the rest of a path is kept as written, so a backslash names a different file', () => {
    // On POSIX, `src\\a.ts` is one file name, not a path into `src`.
    const repo = { root: '/r', name: 'acme' }
    expect(portableTokens('/r/src\\a.ts::m', repo)).toBe('<root:acme>/src\\a.ts::m')
    expect(portableTokens('/r/src/a.ts::m', repo)).toBe('<root:acme>/src/a.ts::m')
  })

  it.skipIf(path.sep === '\\')(
    'a backslash at the root prefix is part of a file name, not a separator, on POSIX',
    () => {
      const repo = { root: '/r', name: 'acme' }
      expect(portableTokens('/r\\src/a.ts::m', repo)).toBe('/r\\src/a.ts::m')
    },
  )

  it('the builder replaces whole tokens: a path that spells the root again keeps it', () => {
    const repo = path.join(layout({ repo: ['gitdir', 'acme'] }), 'repo')
    const pasted = pastedFrom(rule(projectIn(repo, `src${repo}/a.ts`)))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain(`<root:acme>/src${repo}/a.ts`)
  })
})

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

describe('bug 0389: a builder that names no project', () => {
  it('leaves its subjects as they are', () => {
    const repo = path.join(layout({ repo: ['gitdir', 'acme'] }), 'repo')
    const found = rule(projectIn(repo)).violations()
    const pasted = pastedFrom(new NoProjectBuilder(found))
    expect(pasted).toHaveLength(1)
    expect(pasted[0]).toContain(repo)
  })
})

/** A builder that names its project and judges hand-picked findings: the shape a custom dialect takes. */
class ProjectBuilder extends TerminalBuilder {
  constructor(
    private readonly project: ArchProject,
    private readonly findings: readonly ArchViolation[],
  ) {
    super()
  }
  override getProject(): ArchProject {
    return this.project
  }
  protected collectViolations(): CollectResult {
    return collectResult([...this.findings], { examined: this.findings.length })
  }
}

describe('bug 0389: a subject that already spells the portable syntax turns portable matching off (spike 0393)', () => {
  const repo = path.join(layout({ repo: ['gitdir', 'acme'] }), 'repo')
  const p = projectIn(repo)
  const [real] = rule(p).violations()
  const portable = pastedFrom(rule(p))[0]!
  // A custom producer whose identity literally spells another finding's portable form.
  const literal: ArchViolation = {
    ...real!,
    file: path.join(repo, 'src/other.ts'),
    identity: portable,
  }

  it('turns portable matching off for the rule, which then judges exactly as main did', () => {
    // The literal finding matches its entry raw, as on `main`; the real one is not matched through
    // its portable form.
    expect(severities(new ProjectBuilder(p, [literal, real!]), [portable])).toEqual([
      'warn',
      'error',
    ])
  })

  it('names the cause and the subject that spells the syntax', () => {
    const advice = new ProjectBuilder(p, [literal, real!])
      .asSeverity('warn', { accepted: [portable] })
      .deferredWarningAdvice()
    expect(advice).toContain('portable matching is off')
    expect(advice).toContain(portable)
  })

  it('the subjects its advice lists, pasted back, clear the findings', () => {
    const builder = new ProjectBuilder(p, [literal, real!])
    const advice = builder.asSeverity('warn', { accepted: [] }).deferredWarningAdvice()
    const listed = /Not in the list: (.*)\.$/.exec(advice)?.[1]
    expect(listed).toBeDefined()
    expect(severities(builder, listed!.split(', '))).toEqual(['warn', 'warn'])
  })

  it('following its remedy, with the old entry removed, keeps the real finding reported', () => {
    const renamed: ArchViolation = { ...literal, identity: 'custom::id' }
    expect(severities(new ProjectBuilder(p, [renamed, real!]), ['custom::id'])).toEqual([
      'warn',
      'error',
    ])
    expect(
      new ProjectBuilder(p, [literal, real!])
        .asSeverity('warn', { accepted: [] })
        .deferredWarningAdvice(),
    ).toContain("and remove the finding's old entry from `accepted`")
  })

  it('says an excluded finding still counts, when that is the one that spells the syntax', () => {
    const advice = new ProjectBuilder(p, [literal, real!])
      .excluding(literal.file)
      .asSeverity('warn', { accepted: [] })
      .deferredWarningAdvice()
    expect(advice).toContain('portable matching is off')
    expect(advice).toContain('.excluding()')
  })

  it('a collision is reported before it, because a collision escalates every finding', () => {
    const advice = new ProjectBuilder(p, [literal, literal, real!])
      .asSeverity('warn', { accepted: [portable] })
      .deferredWarningAdvice()
    expect(advice).toContain('not reliably identifiable')
  })

  it('a subject without an identity counts too: element and message spell it', () => {
    const viaMessage: ArchViolation = {
      ...real!,
      file: path.join(repo, 'src/other.ts'),
      identity: undefined,
      element: 'x',
      message: portable,
    }
    expect(severities(new ProjectBuilder(p, [viaMessage, real!]), [portable])).toEqual([
      'error',
      'error',
    ])
  })

  it('KNOWN RESIDUAL — once the literal finding is gone, an entry written for it matches the real one', () => {
    // Spike 0393: no syntax is unspellable. Turning portable matching off closes the case while the literal finding is
    // present; an entry kept from before that finding was fixed still equals the other's portable
    // form. If this row turns red, the residual is gone.
    expect(severities(new ProjectBuilder(p, [real!]), [portable])).toEqual(['warn'])
  })
})
