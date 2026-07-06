import type { Diagram } from './generated/ast.js'

export interface ReferenceDiagnostic {
  level: 'error' | 'warning'
  kind: 'unresolved-reference' | 'duplicate-class'
  message: string
  refText: string
  declaredOn: 'relationship' | 'stereotypeAssignment' | 'note'
  line?: number
}

export function validateReferences(ast: Diagram): ReferenceDiagnostic[] {
  const declared = new Set(ast.classes.map((c) => c.name))
  const diagnostics: ReferenceDiagnostic[] = []

  // Duplicate class declarations
  const seen = new Set<string>()
  for (const c of ast.classes) {
    if (seen.has(c.name)) {
      diagnostics.push({
        level: 'error',
        kind: 'duplicate-class',
        message: `class ${c.name} is declared more than once`,
        refText: c.name,
        declaredOn: 'relationship',
        line: c.$cstNode?.range.start.line,
      })
    }
    seen.add(c.name)
  }

  for (const r of ast.relationships) {
    if (!declared.has(r.lhs.$refText)) {
      diagnostics.push({
        level: 'error',
        kind: 'unresolved-reference',
        message: `relationship references undeclared class '${r.lhs.$refText}'`,
        refText: r.lhs.$refText,
        declaredOn: 'relationship',
        line: r.$cstNode?.range.start.line,
      })
    }
    if (!declared.has(r.rhs.$refText)) {
      diagnostics.push({
        level: 'error',
        kind: 'unresolved-reference',
        message: `relationship references undeclared class '${r.rhs.$refText}'`,
        refText: r.rhs.$refText,
        declaredOn: 'relationship',
        line: r.$cstNode?.range.start.line,
      })
    }
  }

  for (const a of ast.stereotypeAssignments) {
    if (!declared.has(a.classRef.$refText)) {
      diagnostics.push({
        level: 'error',
        kind: 'unresolved-reference',
        message: `stereotype <<${a.stereotype.name}>> references undeclared class '${a.classRef.$refText}'`,
        refText: a.classRef.$refText,
        declaredOn: 'stereotypeAssignment',
        line: a.$cstNode?.range.start.line,
      })
    }
  }

  for (const n of ast.notes) {
    if (n.target && !declared.has(n.target.$refText)) {
      diagnostics.push({
        level: 'error',
        kind: 'unresolved-reference',
        message: `note targets undeclared class '${n.target.$refText}'`,
        refText: n.target.$refText,
        declaredOn: 'note',
        line: n.$cstNode?.range.start.line,
      })
    }
  }

  return diagnostics
}
