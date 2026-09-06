#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — `preset/agent/no-verdict-outside-rules` (plan 0237).
 *
 * **Why this drives its own project instead of planting a probe under
 * `packages/*​/src`, the way every other `check:guardrails` row does.** This
 * repo's dialect source _is_ eess: measured at plan 0237's freeze, 55 of 141
 * `eess-ts` source files, 10 of 24 in `eess-md`, 8 of 29 in `eess-mermaid` and
 * 7 of 9 in `eess-crossvalidate` import the kernel at runtime, by design. The
 * rule examines every module there and can legitimately fire on none of them,
 * so a `ruleFiles` list wide enough to make `check:guardrails` green over that
 * source would exempt every module that could ever fire — and the green would
 * be a tautology presented as dogfood.
 *
 * So the subject is an ADOPTER-shaped project, built here and driven BOTH ways:
 * clean it must be green, and with one module planted in the "walked around the
 * pipeline" shape it must red **naming the rule id**. Identity, not exit code —
 * a rule that reds for some other reason has proven nothing about this one.
 *
 * The ceiling, stated because an unstated one reads as coverage: the caller is
 * synthetic (this file, not the CLI). It exercises the real preset, the real
 * builder and the real conditions; it does not prove the CLI wires them.
 * `packages/ts/tests/presets/no-verdict-outside-rules.test.ts` is the suite that
 * covers discrimination between the two conditions.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = clean was green AND planted reds naming the rule id — OK
 *   0 = planted stayed green, or reported some other rule — the gate is vacuous
 *   2 = the fixture's own premise broke, not the gate proven
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { project, resetProjectCache } from '../../packages/ts/dist/index.js'
import { agentGuardrails } from '../../packages/ts/dist/presets/index.js'

const SENTINEL = 'bad-verdict-outside-rules:'
const RULE = 'preset/agent/no-verdict-outside-rules'
const DEAD_ENTRY = 'preset/agent/rule-files-matches-nothing'
// Two scenarios, one per finding this preset arm can produce — bug 0240's
// lesson, which this repo learned when ONE row stood for four guardrails rules
// and three of them could be emptied with the gate still green. A QA review
// measured exactly that here: `ruleFilesFindings` patched to `return []` left
// this fixture exiting 1, because the single scenario only exercised the rule.
const SCENARIO = process.argv[2] ?? 'rule'
const dir = mkdtempSync(join(tmpdir(), 'eess-0237-nv-'))

/** The offending shape: eess at runtime in an ordinary module. */
const PLANTED =
  "import { docs } from '@nielspeter/eess-md'\n" +
  'export function countDocs(d) {\n' +
  '  let n = 0\n' +
  '  for (const doc of docs(d)) n += 1\n' +
  '  return n\n' +
  '}\n'

function ruleIdsFrom(dirPath, ruleFiles = ['**/gates/**']) {
  resetProjectCache()
  const p = project(join(dirPath, 'tsconfig.json'))
  const violations = agentGuardrails(p, {
    src: '**/src/**/*.ts',
    noVerdictOutsideRules: true,
    ruleFiles,
    report: 'return',
  })
  return [...violations].map((v) => v.ruleId)
}

try {
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'gates'), { recursive: true })
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'Node16',
          moduleResolution: 'Node16',
          noEmitOnError: false,
        },
        include: ['src', 'gates'],
      },
      null,
      2,
    ),
  )
  // An ordinary adopter module: no eess anywhere.
  writeFileSync(
    join(dir, 'src', 'orders.ts'),
    'export function total(items: { price: number }[]): number {\n' +
      '  return items.reduce((sum, i) => sum + i.price, 0)\n' +
      '}\n',
  )
  // A rule file — exempt by the DEFAULT list, no `ruleFiles` entry needed.
  writeFileSync(
    join(dir, 'src', 'arch.rules.ts'),
    "import { modules } from '@nielspeter/eess-ts'\n" +
      "export default [modules('**/src/**').that().resideInFile('**/*.ts')]\n",
  )
  // A gate script that finishes through an emitter — exempt only because the
  // caller named `**/gates/**`. This is the shape this repo ships five of.
  writeFileSync(
    join(dir, 'gates', 'check-arch.ts'),
    "import { reportViolations } from '@nielspeter/eess'\n" +
      'export const run = (v: unknown[]): void => reportViolations(v)\n',
  )

  if (SCENARIO === 'dead-entry') {
    // The second finding this arm produces. A caller glob that matches nothing
    // must be REPORTED, and one that matches must not be — both halves, because
    // a producer that always fires is as useless as one that never does.
    const named = ruleIdsFrom(dir, ['**/gates/**'])
    if (named.includes(DEAD_ENTRY)) {
      console.error(
        `${SENTINEL} a ruleFiles entry that DOES match reported ${DEAD_ENTRY} — ` +
          `the finding fires unconditionally, so it discriminates nothing`,
      )
      process.exit(2)
    }
    const bogus = ruleIdsFrom(dir, ['**/gates/**', '**/no-such-directory/**'])
    if (!bogus.includes(DEAD_ENTRY)) {
      console.error(
        `${SENTINEL} a ruleFiles entry matching NO file was not reported — ` +
          `${DEAD_ENTRY} never fired, so the list can rot in silence`,
      )
      process.exit(0)
    }
    console.error(
      `${SENTINEL} ${DEAD_ENTRY} red on a glob matching nothing and silent on one that matches`,
    )
    process.exit(1)
  }

  const clean = ruleIdsFrom(dir)
  if (clean.includes(RULE)) {
    console.error(
      `${SENTINEL} the CLEAN adopter project already reds ${RULE} — the fixture's own ` +
        `premise is broken, so a red on the planted run would prove nothing. Reported: ` +
        `${[...new Set(clean)].join(', ')}`,
    )
    process.exit(2)
  }

  writeFileSync(join(dir, 'src', 'hand-rolled-gate.ts'), PLANTED)
  const planted = ruleIdsFrom(dir)

  if (!planted.includes(RULE)) {
    console.error(
      `${SENTINEL} a module using eess at runtime outside a rule file did NOT red — ` +
        `${RULE} never fired. Reported: ${[...new Set(planted)].join(', ') || '(nothing)'}`,
    )
    process.exit(0)
  }
  console.error(`${SENTINEL} ${RULE} red on the planted module and silent on the clean project`)
  process.exit(1)
} catch (error) {
  console.error(`${SENTINEL} the fixture itself threw: ${String(error)}`)
  process.exit(2)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
