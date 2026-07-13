import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { features } from '../src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

const load = () => features({ cwd: FIXTURES, roots: ['**/*.feature'] })

describe('features() loading', () => {
  it('loads every feature file under the roots with a real denominator', () => {
    const set = load()
    expect(set.features()).toHaveLength(3)
    expect(set.scenarios().length).toBeGreaterThanOrEqual(6)
  })

  it('parses feature title, scenario titles, keywords, and 1-indexed lines', () => {
    const set = load()
    const jm = set.features().find((f) => f.relPath === 'job-management.feature')
    expect(jm).toBeDefined()
    expect(jm?.title).toBe('Job management')
    const titles = jm?.scenarios.map((s) => `${s.keyword}:${s.title}`)
    expect(titles).toEqual([
      'Scenario:View job schedules',
      'Scenario Outline:Trigger job manually',
      'Example:Delete job schedule',
    ])
    const first = jm?.scenarios[0]
    expect(first?.line).toBe(8)
    expect(first?.feature).toBe('Job management')
  })

  it('attaches tags to the following scenario, not to steps or Examples tables', () => {
    const set = load()
    const outline = set.scenarios().find((s) => s.title === 'Trigger job manually')
    expect(outline?.tags).toEqual(['slow', 'integration'])
    const del = set.scenarios().find((s) => s.title === 'Delete job schedule')
    expect(del?.tags).toEqual([])
  })

  it('does not read Background or Examples: as scenarios', () => {
    const set = load()
    const titles = set.scenarios().map((s) => s.title)
    expect(titles).not.toContain('') // Background produces nothing
    const jm = set.features().find((f) => f.relPath === 'job-management.feature')
    expect(jm?.scenarios).toHaveLength(3)
  })

  it('guards doc strings — keyword lines inside """ are not parsed', () => {
    const set = load()
    const guard = set.features().find((f) => f.relPath === 'docstring-guard.feature')
    expect(guard?.scenarios.map((s) => s.title)).toEqual(['Real scenario'])
    expect(set.features().map((f) => f.title)).not.toContain('Not a real feature')
  })
})
