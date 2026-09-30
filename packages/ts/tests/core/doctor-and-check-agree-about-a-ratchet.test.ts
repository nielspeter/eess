/**
 * Bug 0357 — `doctor` reported a healthy `.notExist()` ratchet as a dead glob.
 *
 * `diagnose()` exempts cardinality rules in `zeroSubjectsFinding` and **not** on its
 * universe-based dead-glob path, so a `.notExist()` whose selector matches nothing — which is
 * every healthy ratchet — took the dead-glob branch before the exemption was ever consulted.
 *
 * The invariant it broke is written down in `vacuity-diagnosis.ts`: "Exempt since 0.34.0, and
 * `diagnose()` exempts it too — **the two must agree or `doctor` and `check` disagree about a
 * working rule.**"
 *
 * [Bug 0355](../../../../work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
 * gave the gate the discriminator that tells a holding ratchet from a broken selector — the
 * filesystem — and took the disagreement from two cases to one. This closes the third.
 *
 * **The test is the agreement, not either tool's output.** Asserting what `doctor` says would
 * pass while `check` drifted away from it, which is the whole defect.
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

/** `apps/legacy/` EXISTS on disk and sits outside `apps/api`'s tsconfig `include`. */
function writeFixture(repoRoot: string): string {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'src'), { recursive: true })
  // Exists on disk, outside the project, and holds NO TypeScript — the `no-typescript`
  // classification, which the admission filter must keep green.
  fs.mkdirSync(path.join(repoRoot, 'apps', 'assets', 'img'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'apps', 'assets', 'img', 'logo.svg'), '<svg/>\n')
  fs.writeFileSync(
    path.join(repoRoot, 'package.json'),
    JSON.stringify({ name: 'repo', private: true, workspaces: ['apps/*'] }),
  )
  fs.writeFileSync(path.join(repoRoot, 'apps', 'legacy', 'src', 'old.ts'), 'export const o = 1\n')
  fs.writeFileSync(path.join(repoRoot, 'apps', 'api', 'src', 'a.ts'), 'export const a = 1\n')
  const tsConfigPath = path.join(repoRoot, 'apps', 'api', 'tsconfig.json')
  fs.writeFileSync(
    tsConfigPath,
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  return tsConfigPath
}

/** Does each tool report anything about this rule? The comparison, not the wording. */
function verdicts(selectorGlob: string): { doctor: boolean; check: boolean } {
  const rule = modules(p)
    .that()
    .resideInFolder(selectorGlob)
    .should()
    .satisfy(notExist())
    .rule({ id: 'test/0357' })
  return { doctor: diagnose([rule]).length > 0, check: rule.violations().length > 0 }
}

/** On disk, outside the project — a broken selector. Both tools should speak. */
const ON_DISK = '**/apps/legacy/**'
/** Genuinely gone — the ratchet holding. Neither tool should speak. */
const GENUINELY_GONE = '**/apps/deleted-long-ago/**'
/** In the project — the rule fails for the ordinary reason. */
const LIVE = '**/apps/api/src/**'
/**
 * Broken by one character. `'./src/**'` matches nothing in ANY project — picomatch will not
 * cross a `./` segment — so the fault is decidable from the glob text with no filesystem.
 * The directory exists, is in the project and holds TypeScript, which is what makes the
 * silence so bad: 0357's first fix dropped every syntactic fault for cardinality rules by
 * placing the disk test after `isDeadSite`, and this went green in BOTH tools. Shipped in
 * 0.10.0; caught by a review of 0357's own fix.
 */
const TYPO = './src/**'
/** Exists on disk, outside the project, holds no TypeScript. The ratchet is holding. */
const NO_TYPESCRIPT = '**/apps/assets/**'
/**
 * The THIRD way into the cardinality branch, and the one the first fix reached by
 * accident: a `parent-dir` glob naming a FILE that is in the project. `resideInFolder`
 * reads the directory portion, so it can never match — and before the remedy was derived
 * from the diagnosis this route was told to "widen the tsconfig include", which is
 * impossible for a file the project already loaded.
 */
const FILE_NOT_FOLDER = '**/apps/api/src/a**'

/** The same repo, with `apps/legacy` inside the tsconfig — route 2's stated fix, applied. */
let widened: ArchProject

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0357-'))
  const repoRoot = path.join(base, 'repo')
  p = project(writeFixture(repoRoot))
  // A SECOND tsconfig path, because `project()` memoizes per resolved tsconfig (bug 0356)
  // — editing the first one in place would hand back the cached, un-widened project.
  const wide = path.join(repoRoot, 'apps', 'api', 'tsconfig.wide.json')
  fs.writeFileSync(
    wide,
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src', '../legacy/src'] }),
  )
  widened = project(wide)
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('bug 0357: doctor and check agree about a cardinality rule', () => {
  it('agree on all four cases', () => {
    // The invariant, asserted as an invariant. A table rather than three assertions so a
    // future reader sees the shape the two tools have to share, and so a drift in either
    // direction fails — `doctor` over-reporting (this bug) or `check` under-reporting (0355).
    expect([ON_DISK, GENUINELY_GONE, LIVE, TYPO].map((g) => verdicts(g))).toEqual([
      { doctor: true, check: true },
      { doctor: false, check: false },
      { doctor: false, check: true },
      // A syntactic fault is a property of the glob text, so BOTH tools must speak — and the
      // row sits beside GENUINELY_GONE deliberately: both match nothing, and only one is the
      // author's mistake. That is the whole discrimination this pair of bugs is about.
      { doctor: true, check: true },
    ])
  })

  it('the third row is agreement about a FAILING rule, not silence from both', () => {
    // `LIVE` is `doctor: false, check: true` and that is correct, not a disagreement:
    // `diagnose()` previews configuration faults, and a rule that fails on a real subject has
    // none. Pinned so the row above cannot be "fixed" into false/false by someone reading the
    // table as though both columns must match.
    expect(verdicts(LIVE)).toEqual({ doctor: false, check: true })
    expect(
      modules(p)
        .that()
        .resideInFolder(LIVE)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0357' })
        .violations()
        .map((v) => v.element ?? ''),
    ).toEqual(['SourceFile'])
  })

  it('the remedy matches the cause on each admission route', () => {
    // The assertion whose absence let this through TWICE. `deadSelectorViolation`'s own
    // history records "no test caught it, because no test asserted the message" — and the
    // row above it, added for the typo case, asserted booleans only. So the same class
    // shipped again one cause over: a syntactic fault reached a remedy saying "widen the
    // tsconfig include", which no `include` can satisfy for a `'./'` glob, beside a cause
    // saying "remove it and anchor instead". The impossible branch was listed first, in the
    // `Fix:` slot an agent acts on, on an unsuppressable finding.
    const found = (glob: string) =>
      modules(p)
        .that()
        .resideInFolder(glob)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0357' })
        .violations()[0]

    // Route 1 — broken glob. The tsconfig is irrelevant and must not be offered.
    const typo = found(TYPO)
    expect(typo?.suggestion).toContain('Correct the selector')
    expect(typo?.suggestion).not.toContain('tsconfig')
    expect(typo?.suggestion).not.toContain('detected the gap')
    expect(typo?.suggestion).toContain('Do not delete it')
    // …and the scope is every project, not this one — the understatement that invited the
    // tsconfig reading in the first place.
    expect(typo?.message).toContain('can never match anything in any project')

    // Route 2 — the code is on disk and unexamined. Here the tsconfig IS the lever.
    const onDisk = found(ON_DISK)
    expect(onDisk?.suggestion).toContain('Widen the tsconfig include')
    expect(onDisk?.message).toContain('can never match anything in this project')

    // Neither ever offers deletion, which is the whole point of the cardinality branch.
    for (const v of [typo, onDisk]) expect(v?.suggestion).not.toContain('remove the rule')
  })

  it('the stated fix, applied, clears the finding on both cardinality routes', () => {
    // ADR-009 rule 2's corollary: "a remedy is a claim, so rule 5 applies to it … the
    // independent derivation is BEHAVIOURAL — apply the stated fix and assert the finding
    // clears. A remedy-contains test passes on a wrong message forever." The row above is
    // a contains-test, which is the kind the ADR names as insufficient, on the one message
    // that has now been wrong twice. This is the other kind.
    const configFindings = (proj: ArchProject, glob: string) =>
      modules(proj)
        .that()
        .resideInFolder(glob)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0357' })
        .violations()
        .filter((v) => v.bypassFilters === true)

    // Route 1 says "Correct the selector". Correcting it — `'./src/**'` to a glob that
    // resolves — must leave no configuration finding behind.
    expect(configFindings(p, TYPO).length).toBe(1)
    expect(configFindings(p, LIVE)).toEqual([])

    // Route 2 says "Widen the tsconfig include to cover this path". Widening it must too.
    // If this ever reds, the remedy names a lever that does not move the finding.
    //
    // Guard the guard first (ADR-010): an empty result also happens when the widened
    // project failed to load, and a remedy that "works" because nothing was examined is
    // the vacuity this whole file is about. Assert the legacy file is actually IN it.
    expect(
      widened
        .getSourceFiles()
        .map((f) => f.getFilePath())
        .filter((f) => f.includes('/legacy/')).length,
    ).toBeGreaterThan(0)
    expect(configFindings(p, ON_DISK).length).toBe(1)
    expect(configFindings(widened, ON_DISK)).toEqual([])
  })

  it('a broken glob reads the same scope whatever the rule asserts', () => {
    // `scope` is a claim about the glob TEXT. Keying it on the rule shape made one
    // selector print two different scopes, and the weaker one is the understatement that
    // invited the tsconfig misreading in the first place.
    const cardinality = modules(p)
      .that()
      .resideInFolder(TYPO)
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0357' })
      .violations()[0]
    const positive = modules(p)
      .that()
      .resideInFolder(TYPO)
      .should()
      .notImportFrom('**/nowhere/**')
      .rule({ id: 'test/0357' })
      .violations()[0]
    for (const v of [cardinality, positive])
      expect(v?.message).toContain('can never match anything in any project')
  })

  it('the third admission route is not offered the tsconfig either', () => {
    // A `parent-dir` glob naming a file already IN the project. The disk cannot be the
    // lever — the file is loaded — so `Fix:` must not send the author to their include.
    const v = modules(p)
      .that()
      .resideInFolder(FILE_NOT_FOLDER)
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0357' })
      .violations()[0]
    expect(v?.suggestion).toContain('Correct the selector')
    expect(v?.suggestion).not.toContain('tsconfig')
    expect(v?.suggestion).not.toContain('remove the rule')
    // The input that separates the scope guard from a constant, and the only one that
    // does: this glob is broken HERE and would be fine in a project where `src/a` is a
    // directory. Test review measured the previous guard surviving all 3,893 tests in the
    // package because no fixture reached this route — an unfalsifiable guard making a
    // confidently-wrong universal claim.
    expect(v?.message).toContain('can never match anything in this project')
    expect(v?.message).not.toContain('in any project')
  })

  it('the Fix line names the edit, not just the direction', () => {
    // The remedy alone says "correct the selector" and never says to WHAT. The tool knows:
    // `FAULT_ADVICE['dot-segment']` spells the character-level edit. It rides in
    // `suggestion` because that is the `Fix:` line an agent acts on — the prose above it
    // is not what this consumer reads.
    const v = modules(p)
      .that()
      .resideInFolder(TYPO)
      .should()
      .satisfy(notExist())
      .rule({ id: 'test/0357' })
      .violations()[0]
    expect(v?.suggestion).toContain('"./src/x/**" -> "**/src/x/**"')
    expect(v?.suggestion).toContain('Correct the selector')
    // Still distinct from `message`, or `format.ts` drops the `Fix:` line entirely.
    expect(v?.suggestion).not.toEqual(v?.message)
  })

  it('only a path holding TypeScript contradicts the absence claim', () => {
    // The invariant that makes the remedy's three branches exactly three. The admission
    // filter (`cardinalityDeadSiteIsAtFault`) admits a cardinality finding on a syntactic
    // fault or `holds-typescript` and nothing else, so `absent` and `no-typescript` never
    // reach a reader — their messages are built and discarded.
    //
    // Pinned because it is what makes one mutation UNOBSERVABLE rather than unguarded:
    // widening `contradictsAbsence(diagnosis.onDisk)` to a bare `!== undefined` reddens
    // nothing, and the reason is this narrowing, not a missing test. If the filter ever
    // widens — surfacing walk exhaustion (bug 0359) is the live candidate — this reds
    // first, and the remedy branch that currently cannot tell them apart will need to.
    for (const glob of [NO_TYPESCRIPT, GENUINELY_GONE]) {
      const rule = modules(p)
        .that()
        .resideInFolder(glob)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0357' })
      // `.length`, not `toEqual([])`: the receipt array carries `examined` and
      // `declaredEmpty` as own properties (ADR-014), so it is never deeply equal to `[]`.
      expect(rule.violations().length).toBe(0)
      expect(diagnose([rule]).length).toBe(0)
    }
    // Guard the guard: the directory really is there, or this passes for the wrong reason.
    expect(fs.existsSync(path.join(base, 'repo', 'apps', 'assets', 'img'))).toBe(true)
  })

  it('CONTROL: a non-cardinality rule is untouched in both tools', () => {
    // The fix narrows a branch that every rule takes, so the shape it must not disturb is the
    // one that was always correct: a positive-assertion rule over a dead selector.
    const rule = modules(p)
      .that()
      .resideInFolder(GENUINELY_GONE)
      .should()
      .notImportFrom('**/no-such-package/**')
      .rule({ id: 'test/0357' })
    // The finding KIND, not merely that each tool speaks. A first draft asserted
    // `doctor: true` and a sabotage row that applied the new guard to EVERY rule fired
    // nothing — because `diagnose()` then reported `zero-subjects` instead of `dead-glob`
    // and the boolean could not tell them apart. The guard is load-bearing; the control
    // was not.
    expect(diagnose([rule]).map((f) => f.kind)).toEqual(['dead-glob'])
    expect(rule.violations().length).toBeGreaterThan(0)
  })
})
