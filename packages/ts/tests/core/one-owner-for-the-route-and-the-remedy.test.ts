/**
 * Bugs [0363](../../../../work/bugs/fixed/0363-a-remedy-that-cannot-remediate-survives-one-input-over.md)
 * and [0364](../../../../work/bugs/fixed/0364-doctor-states-the-cause-and-never-the-remedy.md) — one
 * seam, two symptoms.
 *
 * The admission gate decides WHY a dead site on a cardinality rule is a real fault, and the
 * message then re-derives that reason from different inputs. Two consequences:
 *
 * - **0363:** a `parent-dir` glob naming a file OUTSIDE the project is admitted because
 *   `classify` finds TypeScript at the path, and is then told to "widen the tsconfig include"
 *   — which can never make it match, because the predicate reads the directory portion.
 * - **0364:** `doctor` carries the cause and no remedy at all, so three rounds of work on what
 *   that sentence must say reach only the tool an adopter reaches second.
 *
 * Both close by giving the ROUTE one owner and the remedy one owner, derived from the
 * diagnosis both tools already share. `disk-set.ts` records what happened the last time this
 * pair grew two copies of one predicate: they disagreed about `discovery`, `doctor` reported a
 * dead layer glob, and the build stayed green.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { project } from '../../src/core/project.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { notExist } from '../../src/conditions/structural.js'
import { diagnose } from '../../src/core/diagnose.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let p: ArchProject

function writeFixture(repoRoot: string): string {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'src'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'package.json'), JSON.stringify({ name: 'repo' }))
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'src', 'old.ts'), 'export const o = 1\n')
  fs.writeFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'a.ts'), 'export const a = 1\n')
  const tsConfigPath = path.join(repoRoot, 'apps', 'api', 'tsconfig.json')
  fs.writeFileSync(
    tsConfigPath,
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  return tsConfigPath
}

/** On disk, outside the project, and a DIRECTORY — the tsconfig genuinely is the lever. */
const ON_DISK_FOLDER = '**/apps/legacy/**'
/**
 * On disk, outside the project, and a FILE. `resideInFolder` reads the directory portion, so
 * no `include` can make this match — the tsconfig is NOT the lever, and 0363 is that it was
 * offered anyway.
 */
const ON_DISK_FILE = '**/apps/legacy/src/old**'

const ratchet = (glob: string) =>
  modules(p).that().resideInFolder(glob).should().satisfy(notExist()).rule({ id: 'test/0363' })

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0363-'))
  p = project(writeFixture(path.join(base, 'repo')))
})
afterAll(() => fs.rmSync(base, { recursive: true, force: true }))

describe('bugs 0363 + 0364: one owner for the route and the remedy', () => {
  it('a glob naming a FILE is not offered the tsconfig', () => {
    // 0363. The finding is correct; the `Fix:` line beside it is impossible.
    const v = ratchet(ON_DISK_FILE).violations()[0]
    expect(v).toBeDefined()
    expect(v?.suggestion).not.toContain('tsconfig')
    // The ROUTE's own remedy, not merely "not the tsconfig one". `Correct the selector` alone
    // was the first assertion here and it is satisfied by the PRE-refactor code too — the
    // detection fix alone produces it — so it could not tell the one-owner change from its
    // absence. Measured the hard way: a stray `git checkout` reverted the refactor, the suite
    // stayed green at 3910, and only the architecture gate's unused-export rule noticed.
    // `names-a-file` has its own sentence, and only the route table can produce it.
    expect(v?.suggestion).toContain('name the DIRECTORY you mean')
    expect(v?.suggestion).toContain('Do not delete it')
  })

  it('CONTROL: a glob naming a FOLDER still is, because there the tsconfig is the lever', () => {
    // The discrimination, not merely the absence of the word. Removing the tsconfig remedy
    // everywhere would pass the row above and break this one.
    const v = ratchet(ON_DISK_FOLDER).violations()[0]
    expect(v?.suggestion).toContain('Widen the tsconfig include')
  })

  it('doctor carries the remedy, not only the cause', () => {
    // 0364. Three rounds of work went into what this sentence must say — never offer
    // deletion, name the achievable lever — and none of it reached `doctor`.
    const found = diagnose([ratchet(ON_DISK_FOLDER)])
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]?.advice).toContain('Widen the tsconfig include')
  })

  it('doctor and check give the SAME remedy on each route', () => {
    // The invariant that stops the two growing a second copy. Asserted as agreement rather
    // than as either tool's wording, so a drift in either direction reds.
    for (const glob of [ON_DISK_FOLDER, ON_DISK_FILE]) {
      const checkSuggestion = ratchet(glob).violations()[0]?.suggestion ?? ''
      const doctorAdvice = diagnose([ratchet(glob)])[0]?.advice ?? ''
      expect(checkSuggestion).not.toBe('')
      expect(doctorAdvice).not.toBe('')
      // `doctor` states the cause and then the remedy; `check` puts the cause in `message`
      // and the remedy in `suggestion`. What must match is the REMEDY.
      const remedy = checkSuggestion.slice(checkSuggestion.indexOf('Widen') >= 0 ? 0 : 0)
      expect(doctorAdvice.includes(remedy.split('.')[0] ?? '')).toBe(true)
    }
  })
})
