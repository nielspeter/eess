import { describe, expect, it } from 'vitest'
import { parseErDiagram, collectEntities, collectErRelationships } from '../src/index.js'
import { MermaidUnitParseError } from '../src/parser/parse-class-diagram.js'

const SAMPLE = `erDiagram
    JobSchedule ||--o{ JobExecutionLog : "triggers"
    JobSchedule {
        UUID id PK
        String groupName UK "job identifier"
        String cronExpression
    }
    JobExecutionLog {
        UUID id PK
        String result
    }
`

describe('parseErDiagram()', () => {
  it('parses entities with typed attributes, keys, and comments', () => {
    const entities = collectEntities(parseErDiagram(SAMPLE))
    const js = entities.find((e) => e.name === 'JobSchedule')
    expect(js?.declared).toBe(true)
    expect(js?.attributes).toEqual([
      { type: 'UUID', name: 'id', keys: ['PK'] },
      { type: 'String', name: 'groupName', keys: ['UK'], comment: 'job identifier' },
      { type: 'String', name: 'cronExpression', keys: [] },
    ])
  })

  it('parses relationships with cardinality and quoted label', () => {
    const rels = collectErRelationships(parseErDiagram(SAMPLE))
    expect(rels).toEqual([
      { lhs: 'JobSchedule', rhs: 'JobExecutionLog', cardinality: '||--o{', label: 'triggers' },
    ])
  })

  it('declares implicit entities from relationship endpoints', () => {
    const entities = collectEntities(parseErDiagram('erDiagram\n  A ||--|| B : linked\n'))
    expect(entities.map((e) => `${e.name}:${e.declared}`).sort()).toEqual(['A:false', 'B:false'])
  })

  it('supports non-identifying lines and multiple keys', () => {
    const ast = parseErDiagram('erDiagram\n  X }o..o| Y\n  X { int a PK, FK }\n')
    const x = collectEntities(ast).find((e) => e.name === 'X')
    expect(x?.attributes[0]?.keys).toEqual(['PK', 'FK'])
    expect(collectErRelationships(ast)[0]?.cardinality).toBe('}o..o|')
  })

  it('throws MermaidUnitParseError on malformed input', () => {
    expect(() => parseErDiagram('erDiagram\n  X {{ nope')).toThrow(MermaidUnitParseError)
  })
})

describe('erDiagram notes', () => {
  it('parses note-for lines alongside relationships', () => {
    const ast = parseErDiagram(
      'erDiagram\n  A ||--o{ B : "x"\n  note for A "A is optional"\n  note "floating"\n',
    )
    expect(collectErRelationships(ast)).toHaveLength(1)
  })
})
