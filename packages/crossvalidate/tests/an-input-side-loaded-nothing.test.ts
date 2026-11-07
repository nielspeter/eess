import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { features } from '@nielspeter/eess-gherkin'
import { corpus, corpusFromText } from '@nielspeter/eess-md'
import { diagram } from '@nielspeter/eess-mermaid'
import { project } from '@nielspeter/eess-ts'
import { adrCitationsResolve } from '../src/md-ts.js'
import { diagramMatchesCode } from '../src/mermaid-ts.js'
import { embeddedDiagramsMatchCode } from '../src/md-mermaid.js'
import { scenarioCitationsResolve } from '../src/md-gherkin.js'
import { tableErAgree } from '../src/md-mermaid-er.js'
import { files } from '../src/files.js'
import {
  scenarioExemptionsCurrent,
  scenariosCovered,
  scenarioTestsResolve,
} from '../src/gherkin-ts.js'

// Spike 0640, bugs 0477, 0584 and 0594: a check whose input loaded nothing reports it, once,
// rather than passing over nothing. Driven through each preset, as an adopter calls it.
const here = dirname(fileURLToPath(import.meta.url))
const EMPTY = join(here, 'fixtures/empty-project')
const empty = () => project(join(EMPTY, 'tsconfig.json'))
const ghk = join(here, 'fixtures/gherkin-ts')
const set = () => features({ cwd: ghk, roots: ['features/**'] })
const ids = (r: readonly { ruleId?: string; rule: string }[]) => r.map((v) => v.ruleId ?? v.rule)
const SOURCE_EMPTY = /source loaded zero units/

describe('a correspondence preset over an input that loaded nothing (bug 0477)', () => {
  it('CONTROL: the empty project loads no source file', () => {
    expect(empty().getSourceFiles()).toHaveLength(0)
  })

  it('diagramMatchesCode over an empty diagram and an empty project reports the empty source, once', () => {
    const r = diagramMatchesCode(diagram('classDiagram\n'), empty(), { report: 'return' })
    expect(r.map((v) => v.message)).toEqual([expect.stringMatching(SOURCE_EMPTY)])
    expect(ids(r)).toEqual(['crossval/diagram-completeness'])
    expect(r[0]?.bypassFilters).toBe(true)
  })

  it('adrCitationsResolve over an empty corpus and an empty project reports the empty source, once', () => {
    const r = adrCitationsResolve(corpus({ cwd: EMPTY, roots: ['**/*.md'] }), empty(), {
      report: 'return',
    })
    expect(r.map((v) => v.message)).toEqual([expect.stringMatching(SOURCE_EMPTY)])
  })
})

describe('one input that loaded nothing beside one that loaded (bug 0477)', () => {
  it('adrCitationsResolve over an empty corpus and a project that loads reports the empty corpus', () => {
    const loaded = project(join(here, 'fixtures/citations/tsconfig.json'))
    expect(loaded.getSourceFiles().length).toBeGreaterThan(0)
    const r = adrCitationsResolve(corpus({ cwd: EMPTY, roots: ['**/*.md'] }), loaded, {
      report: 'return',
    })
    expect(r.map((v) => v.message)).toEqual([expect.stringMatching(SOURCE_EMPTY)])
  })

  it('embeddedDiagramsMatchCode reports an empty project once, however many diagram blocks', () => {
    const block = '```mermaid\nclassDiagram\nclass Calculator\n```\n'
    const c = corpusFromText({ 'docs/a.md': `# A\n\n${block}\n${block}` })
    const r = embeddedDiagramsMatchCode(c, empty(), { report: 'return' })
    expect(r.filter((v) => /source that loaded zero units/.test(v.message))).toHaveLength(1)
  })
})

describe('the gherkin↔ts presets over a project that loaded no source file (bugs 0584, 0594)', () => {
  it('scenarioTestsResolve under expectEmpty reports the empty source, not green', () => {
    const r = scenarioTestsResolve(empty(), set(), { report: 'return', expectEmpty: true })
    expect(r.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
    expect(r.examined).toBe(0)
  })

  it('under the default mode, it throws', () => {
    expect(() => scenarioTestsResolve(empty(), set(), { expectEmpty: true })).toThrow()
  })

  it('CONTROL: over a project that loads files, the declaration expires on citations and holds over none', () => {
    const covered = project(join(ghk, 'covered', 'tsconfig.json'))
    const cited = scenarioTestsResolve(covered, set(), { report: 'return', expectEmpty: true })
    expect(ids(cited)).toEqual(['emitter/expired-declaration'])
    const none = scenariosCovered(covered, set(), {
      report: 'return',
      include: () => false,
      expectEmpty: true,
    })
    expect(none).toHaveLength(0)
  })

  it('scenariosCovered under expectEmpty, with nothing in scope, reports the empty source', () => {
    const r = scenariosCovered(empty(), set(), {
      report: 'return',
      include: () => false,
      expectEmpty: true,
    })
    expect(r.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
  })

  it('scenarioExemptionsCurrent reports the empty test side beside the exemptions it counted', () => {
    const r = scenarioExemptionsCurrent(empty(), set(), {
      report: 'return',
      isExempt: (s) => s.tags.includes('wip'),
    })
    expect(r.examined).toBeGreaterThan(0)
    expect(ids(r)).toEqual(['emitter/source-empty'])
  })

  it('CONTROL: over a project that loads files, the declaration and the counts behave as before', () => {
    const p = project(join(ghk, 'covered', 'tsconfig.json'))
    expect(p.getSourceFiles().length).toBeGreaterThan(0)
    const r = scenarioExemptionsCurrent(p, set(), {
      report: 'return',
      isExempt: (s) => s.tags.includes('wip'),
    })
    expect(ids(r)).not.toContain('emitter/source-empty')
  })
})

describe('the other doors over an input that loaded nothing (bug 0642)', () => {
  const emptyCorpus = () => corpus({ cwd: EMPTY, roots: ['**/*.md'] })
  const emptyFeatures = () => features({ cwd: EMPTY, roots: ['**/*.feature'] })
  // A project that loads files, none of which cites a scenario.
  const loaded = () => project(join(here, 'fixtures/citations/tsconfig.json'))

  it('CONTROL: the empty inputs are empty, and the loaded project loads', () => {
    expect(emptyCorpus().documents()).toHaveLength(0)
    expect(emptyFeatures().features()).toHaveLength(0)
    expect(loaded().getSourceFiles().length).toBeGreaterThan(0)
  })

  it('scenarioCitationsResolve over an empty corpus and feature set, under expectEmpty, reports it', () => {
    const r = scenarioCitationsResolve(emptyCorpus(), emptyFeatures(), {
      report: 'return',
      expectEmpty: true,
    })
    expect(r.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
  })

  it('scenariosCovered and scenarioTestsResolve over an empty feature set, under expectEmpty, report it', () => {
    const covered = scenariosCovered(loaded(), emptyFeatures(), {
      report: 'return',
      expectEmpty: true,
    })
    expect(covered.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
    const resolved = scenarioTestsResolve(loaded(), emptyFeatures(), {
      report: 'return',
      expectEmpty: true,
    })
    expect(resolved.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
  })

  it('tableErAgree over an empty corpus, under expectEmpty, reports it', () => {
    const r = tableErAgree(emptyCorpus(), {
      table: { section: /Properties/, name: /Name/ },
      entity: () => undefined,
      report: 'return',
      expectEmpty: true,
    })
    expect(r.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
  })

  it('embeddedDiagramsMatchCode over an empty corpus, under expectEmpty, reports it', () => {
    const r = embeddedDiagramsMatchCode(emptyCorpus(), loaded(), {
      report: 'return',
      expectEmpty: true,
    })
    expect(r.map((v) => v.message)).toEqual([
      expect.stringMatching(/source that loaded zero units/),
    ])
  })

  it('files() over a tree with no file says its source is empty; a dead glob over a loaded tree does not', () => {
    const tree = mkdtempSync(join(tmpdir(), 'eess-0642-'))
    const none = files({ cwd: tree, glob: '**/*', label: 'f', identify: (f) => ({ name: f.path }) })
    rmSync(tree, { recursive: true, force: true })
    expect(none.sourceEmpty).toBe(true)
    const dead = files({
      cwd: here,
      glob: 'no-such/**',
      label: 'f',
      identify: (f) => ({ name: f.path }),
    })
    expect(dead.elements).toHaveLength(0)
    expect('sourceEmpty' in dead).toBe(false)
  })
})
