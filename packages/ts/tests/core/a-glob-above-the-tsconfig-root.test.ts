/**
 * Bug 0348 — a glob naming segments ABOVE the tsconfig root selected nothing under a dot-directory.
 *
 * [Bug 0339](../../../../work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md)
 * gave every path glob a second view: the file named from the **tsconfig's** directory. That fixes
 * a glob written relative to a package root. It does not fix `'**\/apps/api/src/**'` — how a
 * monorepo addresses its own packages — because the tsconfig-relative view has `apps/api/` stripped
 * off the front, which is the very thing the glob names, while the absolute view carries the
 * checkout's dot-segment that `**` will not cross.
 *
 * Reported by an adopter verifying 0.8.0 with the intent of REMOVING their dot-directory guard: a
 * rule asserting one app does not import a JWT service caught a planted import in a plain checkout
 * and **passed** in a dot-directory one. They kept the guard.
 *
 * Every assertion compares the two checkouts rather than asserting a number under the dot alone: a
 * fix that broke matching everywhere would keep them equal, so each case also pins the count.
 *
 * The dot-directory is CONSTRUCTED here rather than checked in — the path of the project under test
 * is the thing under test, and a committed fixture is always at this repository's path.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { modules } from '../../src/builders/module-rule-builder.js'
import { project } from '../../src/core/project.js'
import { resideInFile } from '../../src/predicates/identity.js'
import { notImportFrom } from '../../src/conditions/dependency.js'
import { diskSet } from '../../src/core/disk-set.js'
import { pathGlobMatcher, relativeToRepoRoot, repoRootOf } from '../../src/core/project-relative.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let underDot: ArchProject
let plain: ArchProject

/**
 * A two-package monorepo, with `apps/api` importing `apps/identity` across the package boundary.
 *
 * The workspace marker sits at `repoRoot` and the tsconfig at `repoRoot/apps/api`, so the two roots
 * eess knows about genuinely differ — which is the whole subject. The cross-package import is
 * written as a RELATIVE specifier because that is what the reporter planted, and it matters:
 * `candidatesFor` offers a raw specifier only when it is non-relative, so this one is matched
 * against the resolved target PATH and nothing else.
 */
function writeFixture(repoRoot: string): ArchProject {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'identity', 'src', 'services'), { recursive: true })
  fs.writeFileSync(
    path.join(repoRoot, 'package.json'),
    JSON.stringify({ name: 'repo', private: true, workspaces: ['apps/*'] }),
  )
  fs.writeFileSync(
    path.join(repoRoot, 'apps', 'identity', 'src', 'services', 'jwt.service.ts'),
    'export class JwtService {\n  sign(): string {\n    return ""\n  }\n}\n',
  )
  fs.writeFileSync(
    path.join(repoRoot, 'apps', 'api', 'src', 'thing.ts'),
    "import { JwtService } from '../../identity/src/services/jwt.service.js'\n" +
      'export function use(): JwtService {\n  return new JwtService()\n}\n',
  )
  const tsConfigPath = path.join(repoRoot, 'apps', 'api', 'tsconfig.json')
  fs.writeFileSync(
    tsConfigPath,
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  // The REAL `project()`, not a hand-built `ArchProject`. It calls
  // `registerProjectRoots`, which makes `rootOf` fail closed for any file outside the
  // tsconfig's own directory — so a fixture that skips it cannot see the cross-package
  // case at all. Review of this branch measured exactly that: the first version of this
  // file hand-built the project, its suite was green, and `'**\/apps/identity/**'`
  // selected nothing under the dot-directory through the API an adopter actually uses.
  return project(tsConfigPath)
}

/** Subjects a selector reaches — the number ADR-010 reads as `examined`. */
function selected(p: ArchProject, glob: string): string[] {
  return modules(p)
    .that()
    .satisfy(resideInFile(glob))
    .subjects()
    .map((sf) => sf.getBaseName())
}

/** Findings a cross-package import ban reports, excluding ADR-010 configuration findings. */
function banned(p: ArchProject, glob: string): string[] {
  return modules(p)
    .should()
    .satisfy(notImportFrom(glob))
    .rule({ id: 'test/0348' })
    .violations()
    .filter((v) => v.bypassFilters !== true)
    .map((v) => v.element ?? '')
}

/**
 * Selectors the diagnosis reports as unable to match anything — the adopter's loudest signal.
 *
 * Deadness is taken against the UNION of the universe's views (`viewsFor`), which is a second
 * derivation from the matcher's. The two must agree in BOTH directions: a view the matcher has
 * and the universe lacks reports a working rule as a configuration finding, and a view the
 * universe has and the matcher lacks lets a glob that selects nothing pass unremarked.
 */
function deadSelectors(p: ArchProject, selectorGlob: string): string[] {
  return modules(p)
    .that()
    .resideInFolder(selectorGlob)
    .should()
    .notImportFrom('**/no-such-package/**')
    .rule({ id: 'test/0348' })
    .violations()
    .filter((v) => v.message.includes('can never match anything in this project'))
    .map((v) => v.element ?? '')
}

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0348-'))
  underDot = writeFixture(path.join(base, '.worktrees', 'repo'))
  plain = writeFixture(path.join(base, 'plain', 'repo'))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('bug 0348: a glob naming segments above the tsconfig root', () => {
  const ABOVE_THE_TSCONFIG = '**/apps/api/src/**'

  it('selects the same files under a dot-directory as beside one', () => {
    expect(selected(underDot, ABOVE_THE_TSCONFIG)).toEqual(selected(plain, ABOVE_THE_TSCONFIG))
    // Pinned, so "equal" cannot be satisfied by selecting nothing in both.
    expect(selected(plain, ABOVE_THE_TSCONFIG)).toEqual(['thing.ts'])
  })

  it('reports a cross-package import ban under a dot-directory as it does beside one', () => {
    const glob = '**/apps/identity/src/services/jwt*'
    expect(banned(underDot, glob)).toEqual(banned(plain, glob))
    expect(banned(plain, glob)).toEqual(['thing.ts'])
  })

  it('does not disagree with the filesystem fact the diagnosis states', () => {
    // `disk-set.ts` ALREADY names each candidate from BOTH the identity root and the tsconfig
    // root, so it answers `holds-typescript` for this glob under the dot-directory — while the
    // runtime matcher selects nothing. Two derivations disagreeing about one glob is the failure
    // `core/project-relative.ts` spends most of its guards on, and here it is the reason the
    // adopter got no dead-selector finding to go with the silent pass.
    expect(diskSet(underDot).classify(ABOVE_THE_TSCONFIG)).toBe('holds-typescript')
    expect(selected(underDot, ABOVE_THE_TSCONFIG).length).toBeGreaterThan(0)
  })

  it('answers no repository root for a relative tsconfig path, rather than the wrong one', () => {
    // `repoRootOfDir` guards on `path.isAbsolute` before walking, and its docstring argues
    // the guard is load-bearing: `discoverIdentityRoot` calls `path.resolve`, so a relative
    // input walks up from the CURRENT WORKING DIRECTORY and answers with *this* repository's
    // root — a plausible-looking wrong answer, which ADR-009 rule 2 forbids, rather than a
    // missing one. Review dropped the guard and the whole suite stayed green, so the
    // argument had no falsifier. This is it.
    expect(repoRootOf('./tsconfig.json')).toBeUndefined()
    expect(repoRootOf('sub/tsconfig.json')).toBeUndefined()
    // The other half, so "always undefined" cannot pass it.
    expect(repoRootOf(plain.tsConfigPath)).toBeDefined()
  })

  it('CONTROL: a glob naming a package that does not exist still selects nothing', () => {
    // Without this, "match everything" would pass every case above.
    expect(selected(underDot, '**/apps/billing/src/**')).toEqual([])
    expect(selected(plain, '**/apps/billing/src/**')).toEqual([])
    expect(banned(underDot, '**/apps/billing/**')).toEqual([])
  })

  it('does not report the selector as one that can never match', () => {
    // The adopter's loudest signal: 61 selectors logging "can never match anything in this
    // project" under the dot-directory against 0 beside it. Deadness is taken against the UNION
    // of the universe's views (`viewsFor`), so the diagnosis needs the third view too — a view
    // the matcher has and the universe lacks turns a working rule into a configuration finding,
    // which is the same disagreement in the opposite direction.
    expect(deadSelectors(underDot, ABOVE_THE_TSCONFIG)).toEqual(
      deadSelectors(plain, ABOVE_THE_TSCONFIG),
    )
    expect(deadSelectors(plain, ABOVE_THE_TSCONFIG)).toEqual([])
  })

  it('CONTROL: a project-relative glob does not reach above the tsconfig root', () => {
    // The other half of the ruling, and the one that keeps it from being a widening. The
    // cross-package import pulls `apps/identity/src/services/jwt.service.ts` into the project,
    // so a file ABOVE the tsconfig root is genuinely there to be matched. `'apps/identity/**'`
    // is project-relative — it means "relative to THIS package" — and must keep selecting
    // nothing. Only the `'**\/'` spelling, which says "anywhere", reaches it.
    expect(selected(underDot, 'apps/identity/**')).toEqual([])
    expect(selected(plain, 'apps/identity/**')).toEqual([])
    // BOTH checkouts, not just the plain one. Asserting only `plain` here is how the first
    // version of this file stayed green while the cross-package case was still broken —
    // it was one line from red and the line was missing.
    expect(selected(underDot, '**/apps/identity/**')).toEqual(
      selected(plain, '**/apps/identity/**'),
    )
    expect(selected(plain, '**/apps/identity/**')).toEqual(['jwt.service.ts'])
    // And it is still REPORTED as selecting nothing. This half is the fix's own near-miss,
    // measured before `viewsFor` took `readsRepoRelative`: adding the view to the universe
    // for every glob made this one satisfiable — 0 subjects and 0 findings, a silently vacuous
    // selector introduced by the fix for a silently vacuous rule. Deadness has to be taken
    // against the views the MATCHER reads, not every view the universe holds.
    expect(deadSelectors(plain, 'apps/identity/**')).toEqual(['apps/identity/**'])
    // And under the dot-directory too. Without this line the only proof the machinery
    // FIRES runs on the plain checkout, while every other case here is about the other one.
    expect(deadSelectors(underDot, 'apps/identity/**')).toEqual(['apps/identity/**'])
  })

  it('adds no match under a checkout with no dot-segment', () => {
    // The property the whole ruling rests on, measured rather than argued. The identity-relative
    // path is a SUFFIX of the absolute path, and `**` crosses any dot-free segment, so a
    // globstar-led glob that matches the suffix matches the whole — UNLESS a stripped segment
    // begins with `.`, which is exactly the defect. So on an ordinary checkout the third view
    // contributes nothing, and "every view added makes a glob match more" — the objection this
    // fix had to answer — does not hold for this one.
    const files = plain.getSourceFiles()
    expect(files.length).toBeGreaterThan(0)
    let repoViewMatches = 0
    for (const glob of ['**/apps/api/src/**', '**/src/**', '**/services/**', '**/thing.ts']) {
      const matcher = pathGlobMatcher(glob)
      expect(matcher.readsRepoRelative).toBe(true)
      for (const sf of files) {
        const absolute = sf.getFilePath()
        const fromRepoRoot = relativeToRepoRoot(sf, absolute, plain.tsConfigPath)
        expect(fromRepoRoot, `no repo view for ${absolute}`).toBeDefined()
        if (fromRepoRoot !== undefined && matcher.isMatch(fromRepoRoot)) {
          repoViewMatches += 1
          expect(matcher.isMatch(absolute), `${glob} gained ${absolute} from the third view`).toBe(
            true,
          )
        }
      }
    }
    // The denominator, and it has to count the times the third view actually MATCHED.
    // An iteration counter here was `4 * files.length` BY CONSTRUCTION — true however
    // dead the view was — so a view that matched nothing, or that was silently the
    // absolute path, satisfied "repo match implies absolute match" trivially and this
    // test stayed green. Review measured exactly that hole. Not pinned to a literal
    // count either (ADR-009 rule 4): one hit per file is the floor, and it scales with
    // the fixture.
    expect(repoViewMatches).toBeGreaterThanOrEqual(files.length)
  })

  it('CONTROL: a glob relative to the package root keeps meaning the package root', () => {
    // 0339's view, unchanged. `'src/**'` must NOT start matching a `src/` at the repository root
    // belonging to some other package — the widening a repo-relative view would cause if it were
    // offered to project-relative globs rather than to globstar-led ones.
    expect(selected(underDot, 'src/**')).toEqual(selected(plain, 'src/**'))
    expect(selected(plain, 'src/**')).toEqual(['thing.ts'])
  })
})
