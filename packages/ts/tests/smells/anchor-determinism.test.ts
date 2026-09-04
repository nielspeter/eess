import { describe, expect, it } from 'vitest'
import { join, dirname } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { ArchViolation } from '@nielspeter/eess'
import { anchorIndex } from '../../src/smells/duplicate-report.js'
import type { DuplicateBodiesBuilder } from '../../src/smells/duplicate-bodies.js'
import { project, smells } from '../../src/index.js'

/**
 * Run the duplicate detector over a fixture, capturing the enumeration it was
 * actually handed.
 *
 * `handed` is read from the very array the detector received, and `reads`
 * counts how often it asked. Both exist because of what testing review measured
 * about the first version of this file: its CONTROL built a SECOND, fresh
 * project and asserted that ts-morph had loaded more than one distinctly-named
 * file. That is true whatever the `reverse` switch does — neuter the switch and
 * the control still passed, while four properties guarded only by these tests
 * became invisible to all 3600 tests.
 *
 * So the precondition is asserted from the object under test, not from a
 * re-derivation beside it.
 */
interface WalkRun {
  readonly violations: readonly ArchViolation[]
  /** Basenames, in the order the detector received them. */
  readonly handed: readonly string[]
  /** How many times the detector asked for the enumeration. */
  readonly reads: number
}

function runDetector(
  files: Record<string, string>,
  reverse: boolean,
  configure: (builder: DuplicateBodiesBuilder) => DuplicateBodiesBuilder,
): WalkRun {
  const dir = mkdtempSync(join(tmpdir(), 'eess-0242-'))
  try {
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), body)
    }
    const tsconfig = join(dir, 'tsconfig.json')
    writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' },
        include: ['**/*.ts'],
      }),
    )
    const base = project(tsconfig)
    const files0 = base.getSourceFiles()
    const ordered = reverse ? [...files0].reverse() : files0
    let reads = 0
    const walked = {
      ...base,
      getSourceFiles: () => {
        reads += 1
        return ordered
      },
    }
    const violations = configure(smells.duplicateBodies(walked)).violations()
    return { violations, handed: ordered.map((f) => f.getBaseName()), reads }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * The precondition every reversed-walk test below depends on: the two runs were
 * handed opposite orders, and the detector asked for them.
 *
 * Both halves matter. Without the read count a test proves only that the FIXTURE
 * built a reversed array — its own input. Without the order comparison a
 * detector could be handed the same order twice and every comparison would pass
 * for the boring reason.
 *
 * **What it does NOT prove, stated because the first version of this comment
 * overstated it.** A detector that reads the injected enumeration and then
 * re-sorts it internally satisfies both halves while no reversed order reaches
 * the decision under test — testing review built exactly that mutation and
 * watched every reversed-walk test go quietly vacuous. There is no end-to-end
 * derivation that closes it, because the fix's whole purpose is to remove every
 * observable that varies with walk order. So the pure-data tests on
 * `anchorIndex` above remain the primary guard for the ORDERING rule; these
 * end-to-end tests guard that the ordering is actually wired into each producer,
 * which is the half a unit test cannot reach.
 */
function expectOppositeWalks(forward: WalkRun, reverse: WalkRun): void {
  expect(forward.reads, 'the detector never read the injected enumeration').toBeGreaterThan(0)
  expect(reverse.reads, 'the detector never read the injected enumeration').toBeGreaterThan(0)
  expect(forward.handed.length, 'a one-file fixture cannot be walked backwards').toBeGreaterThan(1)
  expect(reverse.handed, 'the two runs were handed the same order').toEqual(
    [...forward.handed].reverse(),
  )
}

/**
 * A finding's message with the temp directory removed.
 *
 * Only the directory: member names, their line numbers, the `+N more` elision
 * and the quoted axes all survive, so this compares everything a reader would.
 * If a future fixture used a basename the pattern does not match, the strip
 * fails and the comparison REDS — the safe direction.
 */
const shape = (v: ArchViolation | undefined): string =>
  (v?.message ?? '').replace(/\/[^\s(]*\/(?=[a-z]+\.ts)/g, '')

/**
 * Bug 0242 — where a waiver must go must not depend on the filesystem.
 *
 * A duplicate finding is reported AT one of its members, and that location is
 * what an author reads when placing `// eess-exclude`. The identity beside it is
 * sorted on purpose — its own comment says it must "survive a filesystem walking
 * the members in a different order" — but the anchor was `members[0]`, which IS
 * that walk order.
 *
 * So the same duplicate could report at `a.ts` on one machine and `b.ts` on
 * another, and a waiver committed against the first would silently stop
 * suppressing on the second. Durable identity beside a non-durable location, in
 * one finding.
 *
 * This tests the choice as pure data, deliberately. An end-to-end test cannot
 * tell "sorted" from "walk order" when the walk is already alphabetical — it
 * would pass against the very bug it was written for.
 */
describe('a duplicate finding anchors deterministically, not on walk order', () => {
  it('picks the same member however the members are ordered', () => {
    const members = [
      { file: '/repo/src/zebra.ts', line: 10 },
      { file: '/repo/src/alpha.ts', line: 99 },
      { file: '/repo/src/middle.ts', line: 1 },
    ]
    const forward = members[anchorIndex(members)]
    const reversed = [...members].reverse()
    const backward = reversed[anchorIndex(reversed)]

    // The same member, by value — not merely "some member", which any
    // implementation satisfies.
    expect(forward).toEqual({ file: '/repo/src/alpha.ts', line: 99 })
    expect(backward).toEqual(forward)
  })

  it('breaks a same-file tie by line, so two bodies in one file still agree', () => {
    const members = [
      { file: '/repo/src/same.ts', line: 40 },
      { file: '/repo/src/same.ts', line: 12 },
    ]
    expect(members[anchorIndex(members)]).toEqual({ file: '/repo/src/same.ts', line: 12 })
    const reversed = [...members].reverse()
    expect(reversed[anchorIndex(reversed)]).toEqual({ file: '/repo/src/same.ts', line: 12 })
  })

  it('CONTROL — a single member is its own anchor', () => {
    // What this rules out, stated correctly after testing review took the first
    // version apart: an implementation returning a NONZERO constant, or an index
    // outside the list. It does NOT rule out a constant 0 — measured, that reds
    // both tests above, because each already asserts two orderings. Keeping the
    // control is right; justifying it by something untrue is how a control gets
    // deleted later by a reader who checks the claim.
    expect(anchorIndex([{ file: '/repo/only.ts', line: 3 }])).toBe(0)
  })
})

/**
 * The same bug's residue, found by review of the fix above.
 *
 * Normalising the anchor left three other parts of a finding reading in walk
 * order: the members a cluster shows before `+N more` elides the rest, the pair
 * whose varying axes are quoted as evidence, and the direction those axes read.
 * None of them moves the identity or `relatedFiles`, so no waiver breaks and no
 * baseline shifts — but two machines print different evidence for the same
 * finding, and one of them hides a different member. Same class as the anchor,
 * in the same function, and a reader comparing a local run to CI has no way to
 * tell it from a real change.
 *
 * End-to-end on purpose, and it works here where it would not for the anchor:
 * the walk is genuinely reversed rather than merely observed, so "sorted" and
 * "walk order" give different answers.
 */
describe('a finding reads the same whichever way the walk runs', () => {
  const cluster: Record<string, string> = {}
  for (const [i, name] of ['alpha', 'bravo', 'charlie', 'delta', 'echo'].entries()) {
    cluster[`${String.fromCharCode(97 + i)}.ts`] =
      `export function handle_${name}(items: string[]): string {\n` +
      `  const label = '${name} payload'\n` +
      `  let total = 0\n` +
      `  for (const each of items) {\n` +
      `    total = total + each.length\n` +
      `  }\n` +
      `  return label + String(total)\n` +
      `}\n`
  }

  const configure = (b: DuplicateBodiesBuilder): DuplicateBodiesBuilder =>
    b.minDistinctVocabulary(0).minLines(2).rule({ id: 'smells/walk' })

  it('a CLUSTER shows the same members and the same evidence in either direction', () => {
    const forward = runDetector(cluster, false, configure)
    const reverse = runDetector(cluster, true, configure)
    expectOppositeWalks(forward, reverse)

    // Vacuity guards: no finding makes every comparison trivially true, and a
    // cluster is what this is about — a pair renders differently.
    expect(forward.violations).toHaveLength(1)
    expect(forward.violations[0]?.message).toContain('other bodies')
    // Mapped on both sides, not `[0]` against `[0]`: a mutation producing a
    // second finding on one side only would slip past an index comparison.
    expect(reverse.violations.map(shape)).toEqual(forward.violations.map(shape))

    // The members are shown in PATH order, not merely in a stable order.
    // Enforcement review measured the difference: reverse the comparator, or
    // sort by function name instead, and forward and reverse still agree, so a
    // determinism-only comparison stays green. `MAX_SHOWN` elides the rest, so
    // this comparator decides which member a reader never sees — and the
    // changeset sells it as path order, which is the claim that has to hold.
    const shown = [...(forward.violations[0]?.message ?? '').matchAll(/\(([^)]*\.ts):\d+\)/g)]
      .map((m) => (m[1] ?? '').split('/').pop() ?? '')
      .slice(1)
    expect(shown.length).toBeGreaterThan(1)
    expect(shown).toEqual([...shown].sort())
    expect(shown).toEqual(['b.ts', 'c.ts', 'd.ts'])
  })

  it('a PAIR reads the same in either direction, axes included', () => {
    // The cluster test above cannot see the pair path: a two-member group is
    // routed to `pairViolation`, which orients its own axes. Measured by testing
    // review — reverting the pair message to an un-oriented variance summary
    // left all 3600 tests green.
    const pair = { 'a.ts': cluster['a.ts'] ?? '', 'b.ts': cluster['b.ts'] ?? '' }
    const forward = runDetector(pair, false, configure)
    const reverse = runDetector(pair, true, configure)
    expectOppositeWalks(forward, reverse)

    expect(forward.violations).toHaveLength(1)
    // A pair, not a cluster — otherwise this duplicates the test above.
    expect(forward.violations[0]?.message).toContain('% similar to')
    expect(forward.violations[0]?.message).not.toContain('other bodies')
    // The axes clause is the part orientation decides, so require one.
    expect(forward.violations[0]?.message).toContain('varying')
    expect(reverse.violations.map(shape)).toEqual(forward.violations.map(shape))

    // `relatedFiles` is keyed on the ANCHOR, in both directions. Enforcement
    // review measured that reverting this one expression to the walk-order
    // endpoint left the whole suite green — and it reintroduces bug 0239: when
    // the anchor swaps, the finding names its OWN file as related and never
    // names the other, so `--changed` drops it from the file a developer just
    // edited. Presence was guarded; the keying was not.
    for (const run of [forward, reverse]) {
      const v = run.violations[0]
      const related = (v?.relatedFiles ?? []).map((f) => f.split('/').pop() ?? '')
      expect(related).toEqual(['b.ts'])
      // Never its own file: `relatedFiles` means the OTHERS, and a finding that
      // repeats its own path makes the field ambiguous to any consumer reading
      // the two together.
      expect(related).not.toContain(v?.file.split('/').pop() ?? '')
    }
  })

  it('REPORT ORDER is the same in either direction, with no grouping asked for', () => {
    // `orderedClusters` sorts by `clusterRank`, which returns one of four
    // values, with a stable sort — so equal-ranked findings kept walk order and
    // the SEQUENCE of a report moved between machines. Found by architecture
    // review; the branch had disclosed it in a test comment and nowhere else.
    const twoGroups: Record<string, string> = {
      'a.ts': cluster['a.ts'] ?? '',
      'b.ts': cluster['b.ts'] ?? '',
      'y.ts':
        `export function tally_one(rows: string[]): string {\n` +
        `  const kept = rows.filter((r) => r.startsWith('x'))\n` +
        `  const upper = kept.map((r) => r.toUpperCase())\n` +
        `  return upper.join(',').trim()\n` +
        `}\n`,
      'z.ts':
        `export function tally_two(rows: string[]): string {\n` +
        `  const kept = rows.filter((r) => r.startsWith('x'))\n` +
        `  const upper = kept.map((r) => r.toUpperCase())\n` +
        `  return upper.join(',').trim()\n` +
        `}\n`,
    }
    const forward = runDetector(twoGroups, false, configure)
    const reverse = runDetector(twoGroups, true, configure)
    expectOppositeWalks(forward, reverse)

    // Two findings of EQUAL rank is the case at issue; one finding, or two of
    // different ranks, would order the same either way for the boring reason.
    expect(forward.violations).toHaveLength(2)
    // Sequence, not set — `map` preserves order and `toEqual` on arrays is
    // order-sensitive, which is the whole point here.
    expect(reverse.violations.map((v) => v.element)).toEqual(
      forward.violations.map((v) => v.element),
    )
  })

  it('a duplicate WITHIN one file shows its members in line order', () => {
    // No fixture in this file had ever put two bodies in one file, so the
    // same-file leg of every comparator was unexercised — measured by testing
    // review, which dropped the tie-break and watched 3600 tests stay green.
    // The lines are deliberately single- and double-digit: a comparator that
    // ordered lines as TEXT rather than numbers puts ":17" before ":9".
    const body = (n: string, v: string): string =>
      `export function ${n}(items: string[]): number {\n` +
      `  let ${v} = 0\n` +
      `  for (const each of items) {\n` +
      `    ${v} = ${v} + each.length\n` +
      `  }\n` +
      `  return ${v}\n` +
      `}\n`
    const oneFile = {
      'solo.ts':
        '// pad\n'.repeat(8) + body('earlyBody', 'sum') + '\n' + body('laterBody', 'total'),
      // A second file so the fixture can still be walked backwards; its body is
      // a different shape, so it forms no pair with the two above.
      'other.ts': `export const untouched = (n: number): number => n * 2\n`,
    }
    const run = runDetector(oneFile, false, configure)
    expect(run.violations).toHaveLength(1)
    const v = run.violations[0]
    // The declarations really are at a single- and a double-digit line, which is
    // what makes a text-ordering comparator visible here.
    const lines = (oneFile['solo.ts'] ?? '').split('\n')
    const at = (name: string): number => lines.findIndex((l) => l.includes(`function ${name}`)) + 1
    expect(at('earlyBody')).toBeLessThan(10)
    expect(at('laterBody')).toBeGreaterThan(9)
    // Reported at the EARLIER body, and reading from it.
    expect(v?.line).toBe(at('earlyBody'))
    expect(v?.element).toBe('earlyBody')
    expect(v?.message.startsWith('earlyBody')).toBe(true)
    // And the axes read from the anchor outwards, not the other way.
    expect(v?.message.indexOf('sum')).toBeLessThan(v?.message.indexOf('total') ?? -1)
  })
})

/**
 * `.groupByFolder()` must group by the folder a finding is REPORTED in.
 *
 * Found by enforcement review of the fix above, and made false by it. The sort
 * key was the walk-order endpoint (`pair.a`, `members[0]`), which agreed with
 * the reported location only for as long as the anchor WAS that endpoint. Moving
 * the anchor to path-then-line silently broke the agreement: a finding reported
 * in one folder could sort into another folder's group — the single thing this
 * option exists to prevent.
 *
 * The test that named this property asserted only that `check()` throws
 * (`coverage-gaps.test.ts`), so deleting the sort entirely left it green. A
 * titled property with no instrument is the shape ADR-009 rule 1 is about.
 */
describe('groupByFolder orders findings by the folder each is reported in', () => {
  // The layout has to make FOLDER order disagree with the default RANK order,
  // or the test cannot tell `.groupByFolder()` from the default path.
  //
  // The first version could not. Its two findings had equal rank, so the default
  // ordering's anchor tie-break already produced folder order and deleting the
  // `groupByFolder` branch entirely left the test green — enforcement review's
  // finding, and the same "titled property with no instrument" shape this
  // describe's docstring accuses `coverage-gaps.test.ts` of.
  //
  // So: one pair of same-named bodies in different files (`clusterRank` 3) in
  // folder `z`, and one pair of differently-named bodies (rank 1) in folder `a`.
  // Default order is z then a; folder order is a then z.
  const sameName = (fn: string): string =>
    `export function ${fn}(items: string[]): number {\n` +
    `  let sum = 0\n` +
    `  for (const each of items) {\n` +
    `    sum = sum + each.length\n` +
    `  }\n` +
    `  return sum\n` +
    `}\n`
  const otherShape = (fn: string): string =>
    `export function ${fn}(rows: string[]): string {\n` +
    `  const kept = rows.filter((r) => r.startsWith('x'))\n` +
    `  const upper = kept.map((r) => r.toUpperCase())\n` +
    `  const joined = upper.join(',')\n` +
    `  return joined.trim()\n` +
    `}\n`
  const files: Record<string, string> = {
    'z/one.ts': sameName('shared'),
    'z/two.ts': sameName('shared'),
    'a/one.ts': otherShape('alphaSide'),
    'a/two.ts': otherShape('betaSide'),
  }
  const base = (b: DuplicateBodiesBuilder): DuplicateBodiesBuilder =>
    b.minDistinctVocabulary(0).minLines(2).rule({ id: 'smells/folders' })
  const folders = (run: WalkRun): string[] =>
    run.violations.map((v) => dirname(v.file).split('/').pop() ?? '')

  it('CONTROL — without grouping, the two findings do NOT come out folder-sorted', () => {
    // This is what makes the test below mean something: it establishes that
    // folder order is not what the default path produces, so a green there is
    // `.groupByFolder()` doing work rather than the ordering it shares.
    const run = runDetector(files, false, base)
    expect(run.violations).toHaveLength(2)
    expect(folders(run)).toEqual(['z', 'a'])
  })

  it('the reported folders come out in order, whichever way the walk runs', () => {
    const configure = (b: DuplicateBodiesBuilder): DuplicateBodiesBuilder => base(b).groupByFolder()
    const forward = runDetector(files, false, configure)
    const reverse = runDetector(files, true, configure)
    expectOppositeWalks(forward, reverse)

    for (const run of [forward, reverse]) {
      const seen = folders(run)
      // Vacuity guards, both needed: one finding, or all findings in one folder,
      // makes "sorted" true of anything.
      expect(seen.length).toBeGreaterThan(1)
      expect(new Set(seen).size).toBeGreaterThan(1)
      expect(seen).toEqual(['a', 'z'])
    }
  })
})

/**
 * A finding's `file`, `line` and `element` must describe the SAME body.
 *
 * Found by testing review of bug 0242, which measured that taking `line` from
 * the wrong endpoint left all 3600 tests green. A stability test cannot see it:
 * forward and reverse both take the wrong endpoint, so the two agree and the
 * comparison passes. This is the correctness half, and it is the half a waiver
 * depends on — `isExcludedByComment` keys a single-line directive on the
 * violation's file AND on `line === comment.line + 1`, so a line borrowed from
 * the other body sends an author to write the directive above a function that
 * is not the one being reported.
 */
describe('a duplicate finding points at the body it names', () => {
  it('the reported file and line locate the reported element', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eess-0242-site-'))
    try {
      // Deliberately far apart in the file, so borrowing the other endpoint's
      // line cannot land on the right declaration by coincidence.
      writeFileSync(
        join(dir, 'a.ts'),
        `export function alphaOne(items: string[]): number {\n` +
          `  let sum = 0\n` +
          `  for (const each of items) {\n` +
          `    sum = sum + each.length\n` +
          `  }\n` +
          `  return sum\n` +
          `}\n`,
      )
      writeFileSync(
        join(dir, 'b.ts'),
        `// padding\n`.repeat(20) +
          `export function bravoTwo(items: string[]): number {\n` +
          `  let sum = 0\n` +
          `  for (const each of items) {\n` +
          `    sum = sum + each.length\n` +
          `  }\n` +
          `  return sum\n` +
          `}\n`,
      )
      const tsconfig = join(dir, 'tsconfig.json')
      writeFileSync(
        tsconfig,
        JSON.stringify({
          compilerOptions: { strict: true, target: 'ES2022', module: 'ESNext' },
          include: ['*.ts'],
        }),
      )
      const violations = smells
        .duplicateBodies(project(tsconfig))
        .minDistinctVocabulary(0)
        .minLines(2)
        .rule({ id: 'smells/site' })
        .violations()

      expect(violations).toHaveLength(1)
      for (const v of violations) {
        const text = readFileSync(v.file, 'utf-8').split('\n')[v.line - 1] ?? ''
        // The declaration itself, by name — not merely "some non-empty line",
        // which any in-range number satisfies.
        expect(text, `${v.file}:${String(v.line)} should declare ${v.element}`).toContain(v.element)

        // And the MESSAGE leads with that same body. Measured by testing review:
        // swapping the message to name the other endpoint first, while `file`,
        // `line` and `element` still name this one, left all 3600 tests green —
        // a finding whose prose contradicts its own coordinates.
        expect(v.message.startsWith(v.element), `message should lead with ${v.element}`).toBe(true)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
