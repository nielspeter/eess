/**
 * Bug 0359 — a disk walk that gave up reported nothing, and since 0355 it decided a verdict.
 *
 * `buildDiskSet` walks with a budget. On exhaustion it returned one `UNDETERMINED` whose
 * `classify` answers `'not-determined'` for **every** glob, memoized per project. Since
 * [0355](../../../../work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md)
 * that classification decides whether a `.notExist()` rule reports — so one repository above
 * the threshold silenced the gate for every cardinality rule at once, for a reason unrelated
 * to any of their paths, and nothing said the walk gave up.
 *
 * **The remedy names directories, not the repository's size.** ADR-009 rule 2: a message whose
 * stated fix is impossible is worse than no message. "Your repository is too large" is not a
 * remedy — the adopter cannot act on it. Pruning removes 88.9% of entries in a repo with no
 * generated output at all, so a repo that exhausts is carrying directories that should never
 * have been walked
 * ([spike 0368](../../../../work/spikes/0368-what-the-exhaustion-finding-can-tell-an-adopter-to-do.md)).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { dedupeConfigFindings } from '@nielspeter/eess/internal'
import { project } from '../../src/core/project.js'
import { classes } from '../../src/builders/class-rule-builder.js'
import { modules } from '../../src/builders/module-rule-builder.js'
import { notExist } from '../../src/conditions/structural.js'
import { diskSet, setDiskWalkBudgetForTests } from '../../src/core/disk-set.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string
let p: ArchProject

/** `apps/legacy/` exists, holds TypeScript, and sits outside `apps/api`'s tsconfig. */
function writeFixture(repoRoot: string): string {
  fs.mkdirSync(path.join(repoRoot, 'apps', 'api', 'src'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'apps', 'legacy', 'src'), { recursive: true })
  // A subtree that dominates the walk, the way a generated directory does.
  for (let i = 0; i < 40; i++) {
    const d = path.join(repoRoot, 'generated-output', `chunk${i}`)
    fs.mkdirSync(d, { recursive: true })
    for (let f = 0; f < 10; f++) fs.writeFileSync(path.join(d, `f${f}.txt`), 'x\n')
  }
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

/** The ratchet: `apps/legacy` is asserted gone, and is really there, holding TypeScript. */
const RATCHET = '**/apps/legacy/**'
/**
 * Exhausts on the root's own first `readdir`, before any subtree is entered — so the
 * consumer list is the root alone. The degenerate end of the range, and it must still
 * produce a finding rather than a crash or a green.
 */
const SHALLOW_BUDGET = 1
/**
 * Enough to descend into subtrees before stopping, which is what a real exhaustion looks
 * like: the budget runs out somewhere deep, and the question is which tree ate it.
 */
const DEEP_BUDGET = 120

const ratchetViolations = (proj: ArchProject) =>
  modules(proj)
    .that()
    .resideInFolder(RATCHET)
    .should()
    .satisfy(notExist())
    .rule({ id: 'test/0359' })
    .violations()

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0359-'))
  p = project(writeFixture(path.join(base, 'repo')))
})

afterEach(() => setDiskWalkBudgetForTests(undefined))
afterAll(() => fs.rmSync(base, { recursive: true, force: true }))

describe('bug 0359: a walk that gave up says so', () => {
  it('CONTROL: with the walk completing, the ratchet reports — 0355 working', () => {
    // Guard the guard. If this is silent the fixture is wrong and every
    // assertion below would pass over a rule that never had a finding to lose.
    expect(diskSet(p).exhaustion).toBeUndefined()
    expect(ratchetViolations(p).length).toBeGreaterThan(0)
  })

  it('a rule silenced by exhaustion reports the exhaustion instead of going green', () => {
    // THE DEFECT. One entry of budget: the walk cannot finish, `classify` answers
    // `not-determined` for every glob, and before this fix the rule stayed green
    // with nothing said — a gate switched off for the whole project.
    setDiskWalkBudgetForTests(SHALLOW_BUDGET)
    const found = ratchetViolations(p)
    expect(found.length).toBeGreaterThan(0)
    expect(found[0]?.bypassFilters).toBe(true)
  })

  it('the finding names what consumed the walk, not the size of the repository', () => {
    // ADR-009 rule 2. The directory that dominated the walk is nameable and
    // actionable; "too large" is neither.
    setDiskWalkBudgetForTests(DEEP_BUDGET)
    const v = ratchetViolations(p)[0]
    expect(v?.message).toContain('gave up')
    expect(v?.suggestion ?? '').not.toContain('too large')
    // NOT `/generated-output|apps/`, which was the first draft: `apps` exists in this
    // fixture, so a wrong attribution would have satisfied the alternation. Validation
    // caught it. The dominant subtree is the one that must be named, and it must be
    // named FIRST, or "largest first" is decoration.
    expect(v?.message).toContain('generated-output')
    const named = /Largest first, what the walk read under [^:]+: ([^(]+)/.exec(v?.message ?? '')
    expect(named?.[1]?.trim()).toBe('generated-output')
  })

  it('the stated remedy, applied, clears the finding', () => {
    // ADR-009 rule 2's corollary: a remedy is a claim, so assert it BEHAVIOURALLY —
    // apply the stated fix and check the finding goes. The remedy says to remove the
    // directories the message names, so that is what this does. A remedy-contains
    // test would pass on a remedy that does not work.
    // Its OWN fixture: this test mutates the tree, and the shared one is used by
    // siblings that need the walk to still exhaust. A first draft deleted from the
    // shared fixture and reddened a later test — the kind of coupling that makes a
    // suite order-dependent.
    const ownRoot = path.join(base, 'remedy')
    const own = project(writeFixture(ownRoot))

    setDiskWalkBudgetForTests(DEEP_BUDGET)
    const before = ratchetViolations(own).filter((v) => v.rule === 'eess-ts: disk walk')
    expect(before.length).toBe(1)

    // The named directory really is what dominated the walk.
    expect(before[0]?.message).toContain('generated-output')

    fs.rmSync(path.join(ownRoot, 'generated-output'), { recursive: true, force: true })
    setDiskWalkBudgetForTests(DEEP_BUDGET) // re-walk: the override clears the memo

    const after = ratchetViolations(own)
    expect(after.filter((v) => v.rule === 'eess-ts: disk walk').length).toBe(0)
    expect(diskSet(own).exhaustion).toBeUndefined()
    // …and the rule goes back to doing its job rather than going quiet: the ratchet
    // still reports, because `apps/legacy` is still there holding TypeScript.
    expect(after.length).toBeGreaterThan(0)
  })

  it('three rules that all lost the check collapse to one report', () => {
    // The claim the docstring makes, measured rather than asserted — I have already
    // been wrong once this round about how many findings a producer yields, by reading
    // a function's name instead of running it.
    //
    // Identity is the WALK, not the rule: `rule` and `element` are constant per project,
    // so `dedupeConfigFindings` — the CLI's collapse, keyed on `(ruleId ?? rule, element)`
    // — reduces N to one and appends its own count of how many were affected.
    setDiskWalkBudgetForTests(DEEP_BUDGET)
    const mk = (id: string) =>
      modules(p)
        .that()
        .resideInFolder(RATCHET)
        .should()
        .satisfy(notExist())
        .rule({ id })
        .violations()
    const raw = [mk('r/one'), mk('r/two'), mk('r/three')].flat()
    const exhaustion = raw.filter((v) => v.rule === 'eess-ts: disk walk')
    // One per rule BEFORE the collapse, which is correct: each of those rules really
    // did lose its floor, and a direct `violations()` consumer should see that.
    expect(exhaustion.length).toBe(3)
    // `ruleId` too, not just `rule`: the builder stamps `ruleId` with each rule's own
    // id, and `dedupeConfigFindings` keys on `ruleId ?? rule` — so a constant `rule`
    // alone does NOT collapse. Pinned because that is exactly how the first draft of
    // this got it wrong.
    expect(new Set(exhaustion.map((v) => v.ruleId))).toEqual(new Set(['eess-ts: disk walk']))

    // …and exactly one after it, with the fan-out stated rather than hidden.
    const collapsed = dedupeConfigFindings(raw).filter((v) => v.rule === 'eess-ts: disk walk')
    expect(collapsed.length).toBe(1)
    expect(collapsed[0]?.message).toMatch(/\b3\b/)
  })

  it('a rule with no path glob is neither walked for nor blamed', () => {
    // Found by independent validation of ADR-016, not by me. The exhaustion lookup ran for
    // EVERY zero-examined cardinality rule, including one that selects by name — which has
    // no path glob, so the disk was never going to decide it. Two consequences, both wrong:
    //
    //   1. it triggered a whole-repo walk for a rule that cannot use the answer, falsifying
    //      `diskSet`'s own "lazy, only from an already-firing fault" docstring;
    //   2. on exhaustion it told that rule "the absence it asserts was never actually
    //      checked", which is false — the walk's failure changed nothing for it.
    //
    // The 0.10 changeset already admits this shape is uncovered ("a ratchet whose selector
    // is not a path glob"). Uncovered is honest; blamed is not.
    setDiskWalkBudgetForTests(SHALLOW_BUDGET)
    const spy = vi.spyOn(fs, 'readdirSync')
    try {
      const vs = classes(p)
        .that()
        .haveNameMatching(/^NoSuchClass$/)
        .should()
        .satisfy(notExist())
        .rule({ id: 'test/0359-globless' })
        .violations()
      expect(vs.filter((v) => v.rule === 'eess-ts: disk walk').length).toBe(0)
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('a project with no repository above it is not walked at all', () => {
    // Found BY this fix. `discoverIdentityRoot` returns its own argument when it
    // finds no marker, so a tsconfig path with nothing above it resolved to `/` and
    // the walk read the entire filesystem — always, invisibly, because exhaustion
    // returned the silent `UNDETERMINED`. `not-determined` was always the right
    // answer; now it arrives without the walk.
    const tsm = new Project({ useInMemoryFileSystem: true })
    const orphan: ArchProject = {
      tsConfigPath: '/tsconfig.json',
      _project: tsm,
      getSourceFiles: () => tsm.getSourceFiles(),
    }
    // Assert the WALK, not its absence of output. `not-determined` with no exhaustion is
    // also what a walk that ran and found nothing produces, so the original assertions
    // could not tell "did not walk" from "walked in vain" — the title claimed more than
    // they checked, which validation called out. Spying on `readdirSync` is the
    // difference: zero reads is the claim.
    const spy = vi.spyOn(fs, 'readdirSync')
    try {
      expect(diskSet(orphan).classify('**/anything/**')).toBe('not-determined')
      expect(diskSet(orphan).exhaustion).toBeUndefined()
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('the exhaustion fact is on the DiskSet, so the classification is not the only signal', () => {
    setDiskWalkBudgetForTests(DEEP_BUDGET)
    const ex = diskSet(p).exhaustion
    expect(ex?.budget).toBe(DEEP_BUDGET)
    expect(ex?.consumers.length).toBeGreaterThan(0)
    // Largest first — the finding names the top few, so the order is load-bearing.
    const counts = (ex?.consumers ?? []).map((c) => c.entries)
    expect([...counts].sort((a, b) => b - a)).toEqual(counts)
    // Still honest about what it cannot say — and this is the assertion that matters,
    // because `not-determined` alone was ALSO the pre-fix answer. What must never happen
    // is a confident answer after giving up: `absent` would assert the path is not there
    // and `holds-typescript`/`no-typescript` would assert what is in it, and a walk that
    // stopped early has grounds for none of the three. Validation pointed out that the
    // single `not-determined` check could not fail on the old code.
    for (const glob of [
      RATCHET,
      '**/generated-output/**',
      '**/never-existed/**',
      '**/apps/api/src/**',
    ]) {
      expect(diskSet(p).classify(glob)).toBe('not-determined')
      expect(['absent', 'holds-typescript', 'no-typescript']).not.toContain(
        diskSet(p).classify(glob),
      )
    }
  })
})
