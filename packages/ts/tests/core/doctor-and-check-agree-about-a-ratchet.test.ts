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

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0357-'))
  p = project(writeFixture(path.join(base, 'repo')))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('bug 0357: doctor and check agree about a cardinality rule', () => {
  it('agree on all three cases', () => {
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
