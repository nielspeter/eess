import { readFileSync, existsSync } from 'node:fs'
import { parseClassDiagram } from '../parser/parse-class-diagram.js'
import type { ArchProject } from './project.js'

const HEADER_PATTERN = /^\s*classDiagram\b/

export function diagram(input: string): ArchProject {
  if (!HEADER_PATTERN.test(input) && existsSync(input)) {
    const source = readFileSync(input, 'utf-8')
    return {
      source,
      filePath: input,
      ast: parseClassDiagram(source),
    }
  }
  return {
    source: input,
    ast: parseClassDiagram(input),
  }
}
