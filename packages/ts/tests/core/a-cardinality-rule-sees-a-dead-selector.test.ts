/**
 * Bug 0355 — a cardinality rule could not tell "none exist" from "my selector broke".
 *
 * `.notExist()` and friends are exempt from the dead-selector diagnosis AND from ADR-010's
 * evidence floor, because a rule asserting cardinality is SATISFIED by having no subjects.
 * Both exemptions are right on their own. Together they left the one rule shape with nothing
 * beneath it: a `.notExist()` whose selector silently stopped matching reported nothing and
 * exited 0, where the same selector under `notImportFrom` reported.
 *
 * The shape matters more than the count. `.notExist()` is what an adopter writes for their
 * strongest claims — "this package is gone", "nothing imports this any more" — which are
 * ratchets designed never to fire, so a green is unremarkable and nobody looks.
 *
 * **What separates the two cases is the filesystem, not the glob.** A holding ratchet and a
 * broken selector both match zero; `diskSet` knows whether the path is there. See the record's
 * `## Ruling: ask the filesystem, not the glob` — the first fix proposed for this bug keyed on
 * glob satisfiability and would have fired on every healthy ratchet.
 *
 * The fixture drives the real `project()`, not a hand-built `ArchProject`: bug 0348 shipped a
 * green suite over a live defect because its fixture skipped `registerProjectRoots`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { project } from '../../src/core/project.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { notExist } from '../../src/conditions/structural.js'
import { notImportFrom } from '../../src/conditions/dependency.js'
import { diskSet } from '../../src/core/disk-set.js'
import { jsxElements } from '../../src/builders/jsx-rule-builder.js'
import { areHtmlElements } from '../../src/predicates/jsx.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let p: ArchProject

/**
 * A monorepo where `apps/legacy/` EXISTS ON DISK and sits outside `apps/api`'s tsconfig
 * `include`. That is the whole fixture: a path the rule's author is asserting about, present
 * on disk, that the rule cannot see.
 */
function writeFixture(repoRoot: string, include: string[] = ['src']): string {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(repoRoot, 'package.json'),
    JSON.stringify({ name: 'repo', private: true, workspaces: ['apps/*'] }),
  )
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'src', 'old.ts'), 'export const old = 1\n')
  fs.writeFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'a.ts'), 'export const a = 1\n')
  const tsConfigPath = path.join(repoRoot, 'apps', 'api', 'tsconfig.json')
  fs.writeFileSync(tsConfigPath, JSON.stringify({ compilerOptions: { strict: true }, include }))
  return tsConfigPath
}

/** Findings a cardinality rule reports, by the element they name. */
function cardinalityFindings(selectorGlob: string): string[] {
  return modules(p)
    .that()
    .resideInFolder(selectorGlob)
    .should()
    .satisfy(notExist())
    .rule({ id: 'test/0355' })
    .violations()
    .map((v) => v.element ?? '')
}

/** The same selector under a positive-assertion condition — the shape that already reported. */
function positiveFindings(selectorGlob: string): string[] {
  return modules(p)
    .that()
    .resideInFolder(selectorGlob)
    .should()
    .satisfy(notImportFrom('**/no-such-package/**'))
    .rule({ id: 'test/0355' })
    .violations()
    .map((v) => v.element ?? '')
}

/** The path that EXISTS on disk and that `apps/api`'s tsconfig does not include. */
const ON_DISK = '**/apps/legacy/**'
/** A path that is genuinely not there — the ratchet holding. */
const GENUINELY_GONE = '**/apps/deleted-long-ago/**'

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0355-'))
  p = project(writeFixture(path.join(base, 'repo')))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('bug 0355: a cardinality rule sees a dead selector', () => {
  it('reports when the path it asserts about holds TypeScript on disk', () => {
    // The defect. Zero subjects, and the files are right there — so the selector did not reach
    // the thing the assertion is about. Asserted by IDENTITY, not by count: a bare
    // `toHaveLength(1)` accepts whichever finding happens to be there (ADR-009 rule 4).
    expect(cardinalityFindings(ON_DISK)).toEqual([ON_DISK])
  })

  it('CONTROL: stays green when the path is genuinely absent — the ratchet holding', () => {
    // The case the exemption exists for, and the reason the first proposed fix was wrong: a
    // holding ratchet and a broken selector both examine zero, so keying on glob
    // satisfiability would report every `.notExist()` rule that is doing its job.
    expect(cardinalityFindings(GENUINELY_GONE)).toEqual([])
  })

  it('the two cases are indistinguishable by the glob and separable only on disk', () => {
    // Why the fix reads the filesystem. Both selectors examine zero; only `diskSet` tells them
    // apart. If this ever stops holding, the ruling behind the fix has changed.
    expect(modules(p).that().resideInFolder(ON_DISK).subjects()).toHaveLength(0)
    expect(modules(p).that().resideInFolder(GENUINELY_GONE).subjects()).toHaveLength(0)
    expect(diskSet(p).classify(ON_DISK)).toBe('holds-typescript')
    expect(diskSet(p).classify(GENUINELY_GONE)).toBe('absent')
  })

  it('reports when a tsconfig include stops covering the path — the adopter shape', () => {
    // How this actually happens in the wild, reported by an adopter: nobody deletes a folder,
    // somebody edits `include`. The files stay on disk and the project stops loading them, so
    // every `.notExist()` rule over them goes quiet.
    //
    // Two sub-cases that take DIFFERENT paths, which is why both are pinned:
    //  - `include` drops the path but still loads something → the disk check here
    //  - `include` loads nothing at all → the empty-project branch, which runs BEFORE the
    //    cardinality exemption and already reported before this fix
    const partial = project(writeFixture(path.join(base, 'partial'), ['src']))
    expect(
      modules(partial)
        .that()
        .resideInFolder(ON_DISK)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0355' })
        .violations()
        .map((v) => v.element ?? ''),
    ).toEqual([ON_DISK])

    const nothing = project(writeFixture(path.join(base, 'nothing'), []))
    const findings = modules(nothing)
      .that()
      .resideInFolder(ON_DISK)
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0355' })
      .violations()
    // Named by its cause, not merely counted: the empty project is the fault here, and
    // reporting the glob instead would send the reader to fix a glob that is fine.
    const phrase = 'The project loaded 0 source files'
    expect(findings.map((v) => v.message.slice(0, phrase.length))).toEqual([phrase])
  })

  it('never tells the reader to delete the ratchet', () => {
    // The finding is `bypassFilters` — unsuppressable by `.warn()`, `.asSeverity()`,
    // `.excluding()`, an `// eess-exclude` comment, a baseline or diff-aware mode. So its
    // remedy is the ONLY achievable exit, and the primary consumer is an agent that does not
    // read warnings and takes the achievable branch.
    //
    // Before this assertion existed the text read "so it has no subjects and cannot fail …
    // Correct the glob, or remove the rule" — which, for a rule satisfied BY having no
    // subjects, describes the rule passing and then offers to delete it. Three review lenses
    // found that independently; no test did, because no test asserted the message.
    const rule = modules(p)
      .that()
      .resideInFolder(ON_DISK)
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0355' })
    const found = rule.violations()[0]
    expect(found).toBeDefined()
    expect(found?.message).not.toContain('remove the rule')
    expect(found?.message).not.toContain('has no subjects and cannot fail')
    expect(found?.message).toContain('the absence it asserts was never actually checked')
    expect(found?.message).toContain('do not delete this rule')
    // And the remedy has to reach the `Fix:` line, which `format.ts` drops when `message`
    // and `suggestion` are equal — so this population shipped with no `Fix:` line at all.
    expect(found?.suggestion).not.toBe(found?.message)
    expect(found?.suggestion).toContain('do not delete this rule')
  })

  it('CONTROL: a positive-assertion rule keeps the old remedy', () => {
    // The branch must not leak. A dead selector on a rule that asserts something positive is
    // still a rule that cannot fail, and "remove the rule" is a legitimate remedy there.
    const found = modules(p)
      .that()
      .resideInFolder(ON_DISK)
      .should()
      .satisfy(notImportFrom('**/no-such-package/**'))
      .rule({ id: 'test/0355' })
      .violations()[0]
    expect(found?.message).toContain('Correct the glob, or remove the rule')
    expect(found?.message).toContain('has no subjects and cannot fail')
  })

  it('reaches a JSX rule too, not only modules() — the builder-independence claim', () => {
    // The record claims the fix is builder-independent because it lives in `evidenceFloor`,
    // which every builder's terminal goes through. That claim was measured in a throwaway
    // probe and RETAINED BY NOTHING until method review pointed out that the one row carrying
    // the load-bearing claim was the one row not pinned.
    //
    // The shape is an adopter's: `include` drops `src`, a raw `<button>` is planted in an
    // unimported `src/*.tsx`, and a `.notExist()` jsx rule is scoped to `'**/src/**'`.
    const dir = path.join(base, 'jsx')
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'tests'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ui' }))
    fs.writeFileSync(
      path.join(dir, 'src', 'Widget.tsx'),
      'export const W = (): unknown => <button type="button">x</button>\n',
    )
    fs.writeFileSync(path.join(dir, 'tests', 'keep.ts'), 'export const keep = 1\n')
    const tsConfigPath = path.join(dir, 'tsconfig.json')
    fs.writeFileSync(
      tsConfigPath,
      JSON.stringify({ compilerOptions: { strict: true, jsx: 'react-jsx' }, include: ['tests'] }),
    )
    const jsxProject = project(tsConfigPath)
    expect(
      jsxElements(jsxProject)
        .that()
        .satisfy(areHtmlElements('button'))
        .and()
        .resideInFolder('**/src/**')
        .should()
        .notExist()
        .rule({ id: 'test/0355-jsx' })
        .violations()
        .map((v) => v.element ?? ''),
    ).toEqual(['**/src/**'])
  })

  it('CONTROL: a positive-assertion condition still reports, as it always did', () => {
    // The asymmetry that made this a bug rather than a design. Same selector, and this shape
    // was never silent — so the fix must not be "report more", it must be "report here too".
    expect(positiveFindings(ON_DISK)).toEqual([ON_DISK])
  })

  it('CONTROL: a live selector is untouched, and the rule still fails on real subjects', () => {
    // Without this, "report whenever a cardinality rule examines zero" passes every case above
    // while breaking the rules that work. `apps/api/src` IS in the project, so `.notExist()`
    // over it must fail for the ORDINARY reason — a subject exists — and name that subject.
    // `notExist()` names the element kind, not the file — checked against the product rather
    // than guessed, after a first draft asserted `'a.ts'`.
    expect(cardinalityFindings('**/apps/api/src/**')).toEqual(['SourceFile'])
  })
})
