import { describe, it, expect } from 'vitest'
import { diagram } from '../../src/core/diagram.js'
import { fromDiagram } from '../../src/bridge/from-diagram.js'

const ARCH = [
  'classDiagram',
  'class Route',
  '<<route>> Route',
  'class Service',
  '<<service>> Service',
  'class Repository',
  '<<repository>> Repository',
  'Route --> Service',
  'Service --> Repository',
].join('\n')

describe('fromDiagram', () => {
  it('emits an allowed-edge rule for each dependency relationship', () => {
    const d = diagram(ARCH)
    const out = fromDiagram(d, {
      stereotypeToFolder: {
        route: 'src/routes/**',
        service: 'src/services/**',
        repository: 'src/repositories/**',
      },
    })

    const allowed = out.rules.filter((r) => r.kind === 'allowed-edge')
    expect(allowed).toHaveLength(2)
    expect(allowed.map((r) => `${r.source.stereotype}->${r.target.stereotype}`)).toEqual([
      'route->service',
      'service->repository',
    ])
  })

  it('emits forbidden-edge rules for unmapped pairs', () => {
    const d = diagram(ARCH)
    const out = fromDiagram(d, {
      stereotypeToFolder: {
        route: 'src/routes/**',
        service: 'src/services/**',
        repository: 'src/repositories/**',
      },
    })

    const forbidden = out.rules.filter((r) => r.kind === 'forbidden-edge')
    const pairs = forbidden.map((r) => `${r.source.stereotype}->${r.target.stereotype}`)
    expect(pairs).toContain('repository->service')
    expect(pairs).toContain('repository->route')
    expect(pairs).toContain('service->route')
    expect(pairs).not.toContain('route->service')
    expect(pairs).not.toContain('service->repository')
  })

  it('emits an inheritance rule for each <|-- relationship', () => {
    const src = [
      'classDiagram',
      'class BaseService',
      '<<base>> BaseService',
      'class OrderService',
      '<<service>> OrderService',
      'BaseService <|-- OrderService',
    ].join('\n')

    const out = fromDiagram(diagram(src), {
      stereotypeToFolder: {
        base: 'src/base/**',
        service: 'src/services/**',
      },
    })

    const inherit = out.rules.filter((r) => r.kind === 'inheritance')
    expect(inherit).toHaveLength(1)
    expect(inherit[0]!.sub.class).toBe('OrderService')
    expect(inherit[0]!.sup.class).toBe('BaseService')
  })

  it('reports allowed pairs in the layers + allowed summary', () => {
    const out = fromDiagram(diagram(ARCH), {
      stereotypeToFolder: {
        route: 'src/routes/**',
        service: 'src/services/**',
        repository: 'src/repositories/**',
      },
    })

    expect(out.layers).toMatchObject({
      route: 'src/routes/**',
      service: 'src/services/**',
      repository: 'src/repositories/**',
    })
    expect(out.allowed).toEqual([
      ['route', 'service'],
      ['service', 'repository'],
    ])
  })

  it('skips edges where either side has no folder mapping', () => {
    const src = ['classDiagram', 'class A', '<<service>> A', 'class Mystery', 'A --> Mystery'].join(
      '\n',
    )

    const out = fromDiagram(diagram(src), {
      stereotypeToFolder: { service: 'src/services/**' },
    })
    expect(out.rules.filter((r) => r.kind === 'allowed-edge')).toHaveLength(0)
  })
})
