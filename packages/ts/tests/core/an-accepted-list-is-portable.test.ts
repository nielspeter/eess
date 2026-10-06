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
import { describe, expect, it } from 'vitest'
import { Project } from 'ts-morph'
import { modules } from '../../src/index.js'
import { subjectOf } from '@nielspeter/eess/internal'
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
