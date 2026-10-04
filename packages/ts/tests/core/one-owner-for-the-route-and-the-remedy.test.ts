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
import { Project } from 'ts-morph'
import { diskSet } from '../../src/core/disk-set.js'
import { CARDINALITY_REMEDY, FAULT_ADVICE } from '../../src/core/glob-diagnosis.js'
import type { DeadSiteRoute } from '../../src/core/glob-diagnosis.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let p: ArchProject

function writeFixture(repoRoot: string): string {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'src'), { recursive: true })
  // A PRUNED directory that really holds TypeScript. The walk refuses to enter `dist`, so it
  // lands in neither the file list nor the directory list — and reading its absence from the
  // directory list as "no directory here" asserts a universal negative over ground the walk
  // declined to look at.
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'dist'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'dist', 'old.ts'), 'export const d = 1\n')
  // A non-TypeScript file on disk, outside the project: the shape whose admission changed.
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'notes.md'), '# notes\n')
  // A real PRUNED directory holding TypeScript, plus a `.ts` sibling sharing its prefix — the
  // sibling is what makes a `vendor**` glob match a file, which is what made the walk's missing
  // directory witness look like evidence.
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'vendor'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'vendor', 'v.ts'), 'export const v = 1\n')
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'vendor-notes.ts'), 'export const n = 1\n')
  // A real directory holding TypeScript, reached by a SYMLINK — recorded as a file because
  // `Dirent.isDirectory()` is false for a link.
  fs.mkdirSync(path.join(repoRoot, 'real-target'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'real-target', 'old.ts'), 'export const o = 1\n')
  fs.symlinkSync(path.join(repoRoot, 'real-target'), path.join(repoRoot, 'apps', 'shared'), 'dir')
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

/**
 * One glob text at TWO fault-position sites, in either order.
 *
 * `resideInFolder` declares a `parent-dir` glob and `resideInFile` a `file-path` one, so the
 * same text sits at two sites whose routes differ — the shape that broke when admission was a
 * map keyed on glob text with last-write-wins.
 */
const twoSites = (order: 'folder-first' | 'file-first' | 'no-and') => {
  const G = '**/apps/legacy/notes**'
  const base = modules(p).that()
  const chained =
    order === 'folder-first'
      ? base.resideInFolder(G).and().resideInFile(G)
      : order === 'file-first'
        ? base.resideInFile(G).and().resideInFolder(G)
        : // Without `.and()` — the exact expression enforcement review measured going green in
          // `check` while `doctor` reported. `resideInFile` returns `this`, so it chains.
          base.resideInFolder(G).resideInFile(G)
  return chained
    .should()
    .satisfy(notExist())
    .rule({ id: `test/0363-${order}` })
}

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
    // `names-a-file` has its own sentence, and only the route table can produce it. Asserted
    // against the TABLE rather than a quoted phrase: bug 0372 reworded this entry, and a quoted
    // phrase would have had to move with it — or, for a negative assertion, gone silently vacuous.
    expect(v?.suggestion).toContain(CARDINALITY_REMEDY['names-a-file'])
    // …and the entry really is distinct from `syntactic`, or a hand-rolled copy that emits
    // `syntactic`'s sentence for every non-disk route would pass the row above (0363's S7).
    expect(CARDINALITY_REMEDY['names-a-file']).not.toBe(CARDINALITY_REMEDY['syntactic'])
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
    // Against the TABLE, not against a slice of one tool's output. A first draft compared
    // `checkSuggestion.slice(x.indexOf('Widen') >= 0 ? 0 : 0)` — both branches are `0`, so the
    // conditional was decoration and the comparison was "does doctor contain check's first
    // sentence". That happens to hold, but it asserts the two agree with each other rather
    // than that both read the one owner, which is the actual invariant.
    const expected: ReadonlyArray<readonly [string, DeadSiteRoute]> = [
      [ON_DISK_FOLDER, 'contradicted-by-disk'],
      [ON_DISK_FILE, 'names-a-file'],
    ]
    for (const [glob, route] of expected) {
      const remedy = CARDINALITY_REMEDY[route]
      // `toContain`, not `toBe`: both surfaces lead with the CAUSE and then the remedy —
      // `check` because a `Fix:` line that names no edit is only half a remedy, `doctor`
      // because its one `advice` field carries both. What must be identical is the remedy,
      // and it must come from the table rather than from either tool's own words.
      expect(ratchet(glob).violations()[0]?.suggestion).toContain(remedy)
      expect(diagnose([ratchet(glob)])[0]?.advice).toContain(remedy)
    }
    // …and the two routes really are different sentences, or the row above would pass with
    // one table entry serving both and the discrimination lost.
    expect(CARDINALITY_REMEDY['names-a-file']).not.toBe(CARDINALITY_REMEDY['contradicted-by-disk'])
  })

  it('the Fix line names resideInFile() once, not twice', () => {
    // Bug 0372. For a cardinality rule the `Fix:` line is cause-then-remedy, and both halves
    // named `resideInFile()`. Counted on a word boundary rather than the exact `resideInFile()`
    // token: test review showed a remedy saying "use resideInFile" without parens would have
    // duplicated the advice and passed a parens-keyed count.
    const fix = ratchet(ON_DISK_FILE).violations()[0]?.suggestion ?? ''
    expect(fix.match(/resideInFile\b/g)?.length ?? 0).toBe(1)
  })

  it('the scope is claimed once, by the headline', () => {
    // Bug 0372's other half. The headline says "can never match anything in this project" —
    // correct, since the same text matches fine where that name is a directory. A first fix
    // QUALIFIED the cause's second claim to "as a folder glob", which is still universal:
    // `**/src/domain/user.ts` does match as a folder glob where `user.ts` is a directory. The
    // invariant is not "qualify the second claim" but "make only one". So: count it.
    const v = ratchet(ON_DISK_FILE).violations()[0]
    expect(v?.message ?? '').toContain('can never match anything in this project')
    expect((v?.message ?? '').match(/can never match/g)?.length ?? 0).toBe(1)
    // …and the cause table itself makes no scope claim, so no other surface reading it repeats one.
    expect(FAULT_ADVICE['file-not-folder']).not.toMatch(/never match/)
  })

  it('the remedy does not choose between the two fixes the cause offers', () => {
    // Product review of 0372's first fix. The cause offers TWO edits — `resideInFile()` for a
    // file, `/**` for a directory — and a remedy reading "name the DIRECTORY you mean" picked one.
    // It is the LAST sentence, where an agent acts, so it overrode the cause. For a `.notExist()`
    // rule meaning a file is the common case, and an agent told to name a directory widens the
    // rule to the parent folder — changing what it asserts. The remedy now defers.
    const remedy = CARDINALITY_REMEDY['names-a-file']
    expect(remedy).not.toMatch(/DIRECTORY|directory|folder/)
    expect(remedy).not.toMatch(/resideInFile/)
    expect(FAULT_ADVICE['file-not-folder']).toContain('resideInFile()')
    expect(FAULT_ADVICE['file-not-folder']).toContain('/**')
  })

  it('a positive-assertion rule still learns resideInFile() from the cause', () => {
    // The half of the deduplication that decides WHICH copy goes. The cause keeps the API name
    // because a non-cardinality rule's remedy — "Correct the glob, or remove the rule." — names
    // no edit at all, so the cause is its only concrete guidance. Test review measured that this
    // was asserted by nothing: swapping the name from the cause into the remedy stayed green
    // across all 3,921 tests, because the count above runs only the cardinality route, where
    // cause and remedy are concatenated and the total stays at one.
    const positive = modules(p)
      .that()
      .resideInFolder(ON_DISK_FILE)
      .should()
      .notImportFrom('**/no-such-package/**')
      .rule({ id: 'test/0372-positive' })
    const v = positive.violations()[0]
    expect(v).toBeDefined()
    expect(`${v?.message ?? ''} ${v?.suggestion ?? ''}`).toContain('resideInFile()')
  })

  it('a cardinality rule is never told to remove itself, on any route or none', () => {
    // The invariant `CARDINALITY_REMEDY`'s docstring states and a draft of this change broke:
    // `route === undefined` was folded into the non-cardinality arm, so a `.notExist()` could
    // reach "Correct the glob, or remove the rule." On an unsuppressable finding deletion is
    // the only achievable exit and the rule is the thing that noticed — ADR-009 rule 2, and the
    // defect this family has already shipped once. Found by enforcement review, not by this
    // suite, so it is now asserted over every glob shape the fixture offers.
    const globs = [ON_DISK_FOLDER, ON_DISK_FILE, '**/apps/legacy/notes**', '**/nothing-here/**']
    const single = globs.flatMap((g) => ratchet(g).violations())
    // BOTH orders of the two-site shape. The deletion sentence was reachable only here — a
    // first version of this test swept single-site globs only and could not red, which
    // measurement showed before review did.
    const twoSite = [
      twoSites('folder-first').violations(),
      twoSites('file-first').violations(),
      twoSites('no-and').violations(),
    ].flat()
    expect(twoSite.length).toBeGreaterThan(0) // guard the guard: the shape must produce findings
    for (const v of [...single, ...twoSite]) {
      expect(v.suggestion ?? '').not.toContain('remove the rule')
      expect(v.message ?? '').not.toContain('remove the rule')
    }
  })

  it('doctor and check agree when one glob sits at two fault positions', () => {
    // Admission was a Map keyed on glob TEXT with `set` overwriting, so a second site's "no
    // route" erased the first site's route: `check` filtered the finding out while `doctor` —
    // which keys per site — reported it. A green build beside a preview saying broken is the
    // disagreement `doctor-and-check-agree-about-a-ratchet.test.ts` exists to forbid.
    // Both orders: the overwrite made the outcome depend on which site was visited last, so
    // one order went green and the other reported twice. Architecture review measured both.
    for (const order of ['folder-first', 'file-first', 'no-and'] as const) {
      const checkSpoke = twoSites(order).violations().length > 0
      const doctorSpoke = diagnose([twoSites(order)]).length > 0
      expect({ order, checkSpoke }).toEqual({ order, checkSpoke: doctorSpoke })
    }
  })

  it('doctor carries the remedy on the SYNTACTIC route too, not only the disk ones', () => {
    // Test review: a mutation removing `doctor`'s remedy on the syntactic route ALONE stayed
    // green across all 318 files. The other rows drive the disk routes, so `doctor`'s remedy was
    // pinned on two of three — and the syntactic route is the one 0362 was about.
    const typo = modules(p)
      .that()
      .resideInFolder('./src/**')
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0363-syntactic' })
    expect(diagnose([typo])[0]?.advice ?? '').toContain(CARDINALITY_REMEDY['syntactic'])
    expect(typo.violations()[0]?.suggestion ?? '').toContain(CARDINALITY_REMEDY['syntactic'])
  })

  it('doctor does not hand the cardinality remedy to a positive-assertion rule', () => {
    // Test review: dropping `doctor`'s `isCardinality` guard stayed green across 318 files. The
    // guard matters — "do not delete this rule, it is what detected the gap" is false for a rule
    // asserting something positive, whose dead glob really is its author's to remove.
    const positive = modules(p)
      .that()
      .resideInFolder(ON_DISK_FOLDER)
      .should()
      .notImportFrom('**/no-such-package/**')
      .rule({ id: 'test/0363-positive' })
    const advice = diagnose([positive])[0]?.advice ?? ''
    expect(advice).not.toBe('')
    for (const route of ['syntactic', 'names-a-file', 'contradicted-by-disk'] as const)
      expect(advice).not.toContain(CARDINALITY_REMEDY[route])
  })

  it('a set with no evidence refuses the kind question too', () => {
    // Test review: flipping `UNDETERMINED.matchesOnlyFiles` to `true` stayed green across 318
    // files, while making it THROW reddened — so the path runs and the value was asserted by
    // nothing. "Not seen is not the same as not there" has to hold for the no-evidence set as
    // much as for a pruned path.
    const tsm = new Project({ useInMemoryFileSystem: true })
    const orphan: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    // `?.` because the member is OPTIONAL on the public `DiskSet` — a required one broke every
    // hand-built value a consumer might have, which architecture review caught.
    expect(diskSet(orphan).matchesOnlyFiles?.('**/anything/**')).toBe(false)
    expect(diskSet(orphan).classify('**/anything/**')).toBe('not-determined')
  })

  it('a directory the walk could not witness is never called a file', () => {
    // `matchesOnlyFiles` asserts "files and NO directory". Two kinds of ground make that
    // unwitnessable, and BOTH were answered `true` before this change — a confidently wrong
    // claim about a directory, on the one route whose point is that the tsconfig is not your
    // lever. Fixtures supplied by architecture review, which measured both; my own attempts to
    // construct them failed and the first version of this test was vacuous as a result.
    //
    // PRUNED: `vendor` is in the prune list, so its entry is recorded before `isDirectory()` is
    // asked and lands in neither list. The `.ts` sibling sharing its prefix is what makes the
    // glob match a file at all.
    const pruned = ratchet('**/apps/legacy/vendor**').violations()[0]
    expect(pruned?.message ?? '').not.toContain('matches a FILE')
    // …and it is still correctly told the tsconfig IS its lever, so refusing one claim did not
    // cost the true one.
    expect(pruned?.suggestion ?? '').toContain('Widen the tsconfig include')

    // SYMLINKED: `Dirent.isDirectory()` is false for a symlink, so a symlinked directory is
    // recorded as a file. `classify` lives with that deliberately — being wrong that way only
    // weakens a message — but a claim of "no directory" cannot, because the kind is exactly
    // what the walk declined to resolve.
    const linked = ratchet('**/apps/shared**').violations()[0]
    expect(linked?.message ?? '').not.toContain('matches a FILE')
    // Against the table, not a phrase: when bug 0372 reworded this remedy, a quoted
    // `not.toContain('name the DIRECTORY you mean')` would have passed forever, testing nothing.
    expect(linked?.suggestion ?? '').not.toContain(CARDINALITY_REMEDY['names-a-file'])
  })
})
