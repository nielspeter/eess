/**
 * The PRODUCER census for [bug 0171](../../../../work/bugs/0171-a-metric-unit-change-silently-loosens-every-baselined-ratchet.md).
 *
 * The baseline refuses to compare measurements whose units disagree, but that
 * mechanism is inert unless the rules actually stamp a unit. `metrics.test.ts`
 * proves five named conditions do — behaviourally, by running them. This proves
 * the OTHER half, the one a behavioural test cannot reach: that no producer
 * exists which those five do not cover.
 *
 * **Why a census and not a longer list.** The behavioural test enumerates its
 * producers by hand and claimed in its own docstring to be "written over the
 * real conditions … so a metric added later is covered on the day it is added".
 * It was not: the list is five literals, and `haveMaxExports` — a real metric
 * condition, and the only one that hand-writes its unit rather than delegating —
 * was absent from it. This repo's own `scripts/vacuity-matrix.mjs` states the
 * doctrine that catch violated: "A hand-maintained list of constructors is
 * exactly the empty-green the ADR exists to prevent, so this derives the list
 * mechanically."
 *
 * **What it checks.** Every object literal in `src/` that builds a metric
 * finding — one carrying `measured:` alongside an `identity:` or `message:` —
 * must either stamp `measuredUnit:` itself, or be the options argument to
 * `metricViolation`, which derives the unit from `unit ?? metric`.
 *
 * **Measured.** Deleting `measuredUnit: 'named-exports'` from
 * `src/conditions/exports.ts` left the entire suite green before this file
 * existed. It reddens here.
 */
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Node, Project, SyntaxKind } from 'ts-morph'
import type { ObjectLiteralExpression } from 'ts-morph'

const REPO = path.resolve(import.meta.dirname, '../..')

/** How a metric finding gets the unit its ratchet is denominated in. */
type Route = 'stamped' | 'delegated'

interface MetricProducer {
  readonly file: string
  readonly line: number
  readonly route: Route | 'unstamped'
}

function loadSource(): Project {
  return new Project({ tsConfigFilePath: path.join(REPO, 'tsconfig.json') })
}

function has(literal: ObjectLiteralExpression, name: string): boolean {
  return literal.getProperty(name) !== undefined
}

/**
 * Whether this literal is the options argument to `metricViolation(...)`.
 *
 * Those call sites legitimately carry no `measuredUnit` — the helper writes it
 * from `unit ?? metric`, which is the single source of truth the hand-stamped
 * site bypasses.
 */
function isMetricViolationArgument(literal: ObjectLiteralExpression): boolean {
  const parent = literal.getParent()
  if (parent === undefined || !Node.isCallExpression(parent)) return false
  return parent.getExpression().getText() === 'metricViolation'
}

/**
 * Every object literal in `src/` that builds a metric finding.
 *
 * A literal qualifies when it carries `measured:` **and** looks like a
 * violation — `identity:` or `message:`. That second condition is what keeps the
 * baseline's own re-serialization sites out: `{ measured: v.measured }` in
 * `helpers/baseline.ts` copies a measurement that was already stamped at its
 * producer, and demanding a unit there would be demanding it twice.
 */
function metricProducers(project: Project): MetricProducer[] {
  const found: MetricProducer[] = []
  for (const sourceFile of project.getSourceFiles()) {
    const rel = path.relative(REPO, sourceFile.getFilePath())
    if (!rel.startsWith('src/')) continue
    for (const assignment of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (assignment.getName() !== 'measured') continue
      const literal = assignment.getParent()
      if (!Node.isObjectLiteralExpression(literal)) continue
      if (!has(literal, 'identity') && !has(literal, 'message')) continue

      const route: Route | 'unstamped' = has(literal, 'measuredUnit')
        ? 'stamped'
        : isMetricViolationArgument(literal)
          ? 'delegated'
          : 'unstamped'
      found.push({ file: rel, line: assignment.getStartLineNumber(), route })
    }
  }
  return found
}

describe('every metric-finding producer supplies the unit its ratchet uses', () => {
  it('VACUITY: the scan finds producers by BOTH routes', () => {
    // A walk that matched nothing would pass the census row below. Both routes
    // must be represented, because a scan that silently stopped seeing one of
    // them is the failure that lets an unstamped producer through: if
    // `isMetricViolationArgument` started returning true for everything, every
    // site would read as 'delegated' and nothing would ever be unstamped.
    const found = metricProducers(loadSource())
    expect(found.length).toBeGreaterThanOrEqual(9)
    expect(found.filter((p) => p.route === 'stamped').length).toBeGreaterThanOrEqual(2)
    expect(found.filter((p) => p.route === 'delegated').length).toBeGreaterThanOrEqual(7)
  })

  it('no metric finding is produced without a unit', () => {
    // The row that makes this a census rather than a list. A new metric
    // condition that hand-builds its violation fails here on the day it is
    // written, not on the day a ratchet silently loosens under it.
    const unstamped = metricProducers(loadSource())
      .filter((p) => p.route === 'unstamped')
      .map((p) => `${p.file}:${String(p.line)}`)
      .sort()
    expect(
      unstamped,
      `metric findings with no unit:\n  ${unstamped.join('\n  ')}\n` +
        'Either stamp `measuredUnit:` on the literal, or build it through `metricViolation`.',
    ).toEqual([])
  })

  it('the one hand-stamped producer is the one we think it is', () => {
    // `haveMaxExports` reports against a FILE, so it has no `Node` to derive an
    // element name from and cannot use `metricViolation`. Pinned by identity so
    // that a SECOND hand-stamped producer is a deliberate decision someone makes
    // here, rather than a quiet copy of the exception.
    const stamped = metricProducers(loadSource())
      .filter((p) => p.route === 'stamped')
      .map((p) => p.file)
      .sort()
    expect(stamped).toEqual(['src/conditions/exports.ts', 'src/core/metric-violation.ts'])
  })
})
