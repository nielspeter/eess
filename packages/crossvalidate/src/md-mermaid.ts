import {
  correspondence,
  finishPreset,
  type ArchViolation,
  type Direction,
  type PresetReportOptions,
} from '@nielspeter/eess'
import type { Corpus } from '@nielspeter/eess-md'
import { diagram, classes as mmdClasses } from '@nielspeter/eess-mermaid'
import { classes as tsClasses, type ArchProject } from '@nielspeter/eess-ts'

export interface EmbeddedDiagramsMatchCodeOptions extends PresetReportOptions {
  /** Glob (matched against a class's directory) restricting which TS classes participate. */
  readonly scope?: string
  /**
   * Completeness direction. Default `left-to-right` — every class named in an
   * embedded diagram must exist in code (a diagram fragment in an ADR need not
   * list every code class).
   */
  readonly completeness?: Direction
}

/**
 * Cross-validate Mermaid diagrams embedded as fenced ```mermaid blocks in the
 * markdown corpus against TypeScript code — each embedded diagram is validated
 * exactly like a standalone `.mmd` file, with violations pointing at the
 * markdown file and the fence line. Composed from the kernel `correspondence()`.
 */
export function embeddedDiagramsMatchCode(
  corpus: Corpus,
  project: ArchProject,
  options: EmbeddedDiagramsMatchCodeOptions = {},
): ArchViolation[] {
  const scope = options.scope ?? '**/src/**'
  const direction = options.completeness ?? 'left-to-right'

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

  const violations: ArchViolation[] = []
  for (const doc of corpus.documents()) {
    for (const block of doc.codeBlocks) {
      if (block.lang !== 'mermaid') continue
      const d = diagram(block.value)
      const left = mmdClasses(d).select({
        label: `diagram class (in ${doc.relPath})`,
        // point violations at the markdown file + fence line, not the parsed diagram
        identify: (c) => ({ name: c.name, file: doc.file, line: block.line }),
      })
      violations.push(
        ...correspondence({ left, right })
          .should()
          .beComplete({ direction })
          .rule({ id: 'crossval/embedded-diagram' })
          .violations(),
      )
    }
  }
  return finishPreset(violations, options)
}
