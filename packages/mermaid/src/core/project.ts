import type { Diagram } from '../parser/generated/ast.js'

export interface ArchProject {
  readonly source: string
  readonly filePath?: string
  readonly ast: Diagram
}
