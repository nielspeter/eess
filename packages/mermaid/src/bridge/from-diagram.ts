import type { ArchProject } from '../core/project.js'
import { collectClasses, collectRelationships } from '../models/arch-class.js'

const INHERITANCE_ARROWS = new Set(['<|--', '<|..', '--|>', '..|>'])
const DEPENDENCY_ARROWS = new Set(['-->', '..>', '*--', 'o--', '--'])

export interface BridgeOptions {
  classToFolder?: Record<string, string>
  stereotypeToFolder?: Record<string, string>
}

export interface BridgeRuleAllowedEdge {
  id: string
  kind: 'allowed-edge'
  source: { class: string; folder: string; stereotype?: string }
  target: { class: string; folder: string; stereotype?: string }
  arrow: string
  because: string
}

export interface BridgeRuleForbiddenEdge {
  id: string
  kind: 'forbidden-edge'
  source: { folder: string; stereotype?: string }
  target: { folder: string; stereotype?: string }
  because: string
}

export interface BridgeRuleInheritance {
  id: string
  kind: 'inheritance'
  sub: { class: string; folder: string; stereotype?: string }
  sup: { class: string; folder: string; stereotype?: string }
  because: string
}

export type BridgeRule = BridgeRuleAllowedEdge | BridgeRuleForbiddenEdge | BridgeRuleInheritance

export interface BridgeOutput {
  version: 1
  layers: Record<string, string>
  allowed: Array<[string, string]>
  rules: BridgeRule[]
}

function resolveFolder(
  className: string,
  stereotypes: readonly string[],
  options: BridgeOptions,
): string | undefined {
  const classMap = options.classToFolder ?? {}
  if (classMap[className]) return classMap[className]
  if (options.stereotypeToFolder) {
    for (const s of stereotypes) {
      const folder = options.stereotypeToFolder[s]
      if (folder) return folder
    }
  }
  return undefined
}

export function fromDiagram(project: ArchProject, options: BridgeOptions): BridgeOutput {
  const classes = collectClasses(project)
  const classByName = new Map(classes.map((c) => [c.name, c]))
  const relationships = collectRelationships(project)

  const layers: Record<string, string> = { ...(options.classToFolder ?? {}) }
  if (options.stereotypeToFolder) {
    for (const [stereotype, folder] of Object.entries(options.stereotypeToFolder)) {
      layers[stereotype] = folder
    }
  }

  const rules: BridgeRule[] = []
  const allowedPairs = new Set<string>()

  for (const r of relationships) {
    const lhs = classByName.get(r.source)
    const rhs = classByName.get(r.target)
    if (!lhs || !rhs) continue
    const lhsFolder = resolveFolder(lhs.name, lhs.stereotypes, options)
    const rhsFolder = resolveFolder(rhs.name, rhs.stereotypes, options)
    if (!lhsFolder || !rhsFolder) continue

    if (INHERITANCE_ARROWS.has(r.arrow)) {
      const subClass = r.arrow === '<|--' || r.arrow === '<|..' ? rhs : lhs
      const supClass = r.arrow === '<|--' || r.arrow === '<|..' ? lhs : rhs
      const subFolder = resolveFolder(subClass.name, subClass.stereotypes, options)
      const supFolder = resolveFolder(supClass.name, supClass.stereotypes, options)
      if (!subFolder || !supFolder) continue
      rules.push({
        id: `diagram/inherit/${subClass.name}-extends-${supClass.name}`,
        kind: 'inheritance',
        sub: {
          class: subClass.name,
          folder: subFolder,
          stereotype: subClass.stereotypes[0],
        },
        sup: {
          class: supClass.name,
          folder: supFolder,
          stereotype: supClass.stereotypes[0],
        },
        because: `Diagram declares ${subClass.name} extends ${supClass.name}`,
      })
      continue
    }

    if (DEPENDENCY_ARROWS.has(r.arrow)) {
      rules.push({
        id: `diagram/edge/${lhs.name}-${r.arrow}-${rhs.name}`,
        kind: 'allowed-edge',
        source: {
          class: lhs.name,
          folder: lhsFolder,
          stereotype: lhs.stereotypes[0],
        },
        target: {
          class: rhs.name,
          folder: rhsFolder,
          stereotype: rhs.stereotypes[0],
        },
        arrow: r.arrow,
        because: `Diagram declares ${lhs.name} ${r.arrow} ${rhs.name}`,
      })
      const lhsKey = lhs.stereotypes[0] ?? lhs.name
      const rhsKey = rhs.stereotypes[0] ?? rhs.name
      allowedPairs.add(`${lhsKey}|${rhsKey}`)
    }
  }

  // Closure rule: any folder pair NOT in allowed set is forbidden
  const layerEntries = Object.entries(layers)
  for (const [a, aFolder] of layerEntries) {
    for (const [b, bFolder] of layerEntries) {
      if (a === b) continue
      if (allowedPairs.has(`${a}|${b}`)) continue
      rules.push({
        id: `diagram/forbid/${a}-${b}`,
        kind: 'forbidden-edge',
        source: { folder: aFolder, stereotype: a },
        target: { folder: bFolder, stereotype: b },
        because: `Diagram does not declare any edge from ${a} to ${b}`,
      })
    }
  }

  const allowed: Array<[string, string]> = Array.from(allowedPairs).map((p): [string, string] => {
    const idx = p.indexOf('|')
    return [p.slice(0, idx), p.slice(idx + 1)]
  })

  return {
    version: 1,
    layers,
    allowed,
    rules,
  }
}
