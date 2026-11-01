import {
  finishPreset,
  type CollectResult,
  type Direction,
  type PresetReportOptions,
} from '@nielspeter/eess'
import { correspondence } from '@nielspeter/eess'
import { classes as mmdClasses, type ArchProject as MermaidDiagram } from '@nielspeter/eess-mermaid'
import { classes as tsClasses, type ArchProject } from '@nielspeter/eess-ts'
import { identifyTsClass } from './shared.js'

// Kernel re-exports (plan 0089 — standalone sufficiency): crossvalidate is
// the family's binding tool, so unlike the other dialects it MUST re-export
// what its own body imports — a caller composing a custom cross-dialect
// binding needs these same primitives.
export { correspondence, finishPreset } from '@nielspeter/eess'
export type { ArchViolation, CollectResult, Direction, PresetReportOptions } from '@nielspeter/eess'

// The rule's reason, also the thrown error's: `.check()` put it there, and `finishPreset` does when
// told (bug 0097), so a caller matching the message sees what it saw before.
const BECAUSE = 'the diagram and the code must agree on which classes exist'

export interface DiagramMatchesCodeOptions extends PresetReportOptions {
  /** Glob (matched against a class's directory) restricting which TS classes
   * participate. Defaults to a `src` folder anywhere in the tree. */
  readonly scope?: string
  /**
   * Completeness direction. `both` (default) = every diagram class has a TS
   * class and vice versa — the walkthrough stage-7 property.
   */
  readonly completeness?: Direction
}

/**
 * Cross-validate a Mermaid class diagram against TypeScript code: every class in
 * the diagram has a matching TS class and vice versa. Built on the kernel
 * `correspondence()` primitive (class-level, both directions) — the correct
 * generalization of the deprecated `fromDiagram()` bridge.
 *
 * ```ts
 * diagramMatchesCode(diagram('docs/architecture.mmd'), project('tsconfig.json'))
 * ```
 *
 * It finishes as every preset does, through `finishPreset` (ADR-008, bug 0097): by default it
 * prints the findings and throws `ArchRuleError`; `{ report: 'return' }` hands them back instead.
 */
export function diagramMatchesCode(
  diagram: MermaidDiagram,
  project: ArchProject,
  options: DiagramMatchesCodeOptions = {},
): CollectResult {
  const scope = options.scope ?? '**/src/**'

  const left = mmdClasses(diagram).select({
    label: 'diagram class',
    identify: (c) => ({ name: c.name }),
  })

  const right = tsClasses(project).that().resideInFolder(scope).select({
    label: 'TS class',
    identify: identifyTsClass,
  })

  const violations = correspondence({ left, right })
    .should()
    .beComplete({ direction: options.completeness ?? 'both' })
    .rule({
      id: 'crossval/diagram-completeness',
      because: BECAUSE,
    })
    .violations()
  return finishPreset(violations, { ...options, reason: options.reason ?? BECAUSE })
}
