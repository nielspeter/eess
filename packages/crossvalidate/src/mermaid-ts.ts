import { correspondence, type Direction } from '@nielspeter/eess'
import { classes as mmdClasses, type ArchProject as MermaidDiagram } from '@nielspeter/eess-mermaid'
import { classes as tsClasses, type ArchProject } from '@nielspeter/eess-ts'

export interface DiagramMatchesCodeOptions {
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
 */
export function diagramMatchesCode(
  diagram: MermaidDiagram,
  project: ArchProject,
  options: DiagramMatchesCodeOptions = {},
): void {
  const scope = options.scope ?? '**/src/**'

  const left = mmdClasses(diagram).select({
    label: 'diagram class',
    identify: (c) => ({ name: c.name }),
  })

  const right = tsClasses(project)
    .that()
    .resideInFolder(scope)
    .select({
      label: 'TS class',
      identify: (c) => ({
        name: c.getName() ?? '<anonymous>',
        file: c.getSourceFile().getFilePath(),
        line: c.getStartLineNumber(),
      }),
    })

  correspondence({ left, right })
    .should()
    .beComplete({ direction: options.completeness ?? 'both' })
    .rule({
      id: 'crossval/diagram-completeness',
      because: 'the diagram and the code must agree on which classes exist',
    })
    .check()
}
