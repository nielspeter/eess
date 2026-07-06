import type { Diagram } from './generated/ast.js'

const RECOGNIZED_DIRECTIVES = new Set(['schema', 'stereotype', 'id'])

export interface DirectiveSchema {
  kind: 'schema'
  path: string
  raw: string
}

export interface DirectiveStereotype {
  kind: 'stereotype'
  name: string
  body: string
  raw: string
}

export interface DirectiveId {
  kind: 'id'
  className: string
  id: string
  raw: string
}

export interface DirectiveUnknown {
  kind: 'unknown'
  name: string
  raw: string
}

export type ParsedDirective = DirectiveSchema | DirectiveStereotype | DirectiveId | DirectiveUnknown

export interface DirectiveDiagnostic {
  level: 'warning' | 'error'
  message: string
  raw: string
}

export interface DirectiveParseResult {
  directives: ParsedDirective[]
  diagnostics: DirectiveDiagnostic[]
}

const HEADER_PATTERN = /^%%\s*@(\w+)\s*(.*)$/

function stripBlock(rest: string): { name: string; body: string } | undefined {
  const match = /^(\S+)\s*\{(.*)\}\s*$/.exec(rest)
  if (!match) return undefined
  const [, name, body] = match
  if (name === undefined || body === undefined) return undefined
  return { name, body: body.trim() }
}

function parseOne(raw: string): { directive: ParsedDirective; diagnostic?: DirectiveDiagnostic } {
  const m = HEADER_PATTERN.exec(raw.trim())
  if (!m) {
    return {
      directive: { kind: 'unknown', name: '', raw },
      diagnostic: {
        level: 'warning',
        message: `malformed directive: ${raw}`,
        raw,
      },
    }
  }
  const name = m[1] ?? ''
  const rest = (m[2] ?? '').trim()

  if (name === 'schema') {
    if (!rest) {
      return {
        directive: { kind: 'schema', path: '', raw },
        diagnostic: {
          level: 'warning',
          message: '@schema directive requires a path',
          raw,
        },
      }
    }
    return { directive: { kind: 'schema', path: rest, raw } }
  }

  if (name === 'stereotype') {
    const block = stripBlock(rest)
    if (!block) {
      return {
        directive: { kind: 'stereotype', name: rest, body: '', raw },
        diagnostic: {
          level: 'warning',
          message: '@stereotype directive expects `<name> { ... }`',
          raw,
        },
      }
    }
    return { directive: { kind: 'stereotype', name: block.name, body: block.body, raw } }
  }

  if (name === 'id') {
    const parts = rest.split(/\s+/)
    if (parts.length < 2) {
      return {
        directive: { kind: 'id', className: parts[0] ?? '', id: '', raw },
        diagnostic: {
          level: 'warning',
          message: '@id directive expects `<ClassName> <stable-id>`',
          raw,
        },
      }
    }
    return {
      directive: { kind: 'id', className: parts[0] ?? '', id: parts.slice(1).join(' '), raw },
    }
  }

  if (!RECOGNIZED_DIRECTIVES.has(name)) {
    return {
      directive: { kind: 'unknown', name, raw },
      diagnostic: {
        level: 'warning',
        message: `unknown directive @${name} — accepted as-is, but no semantics applied`,
        raw,
      },
    }
  }

  // Recognized but unhandled — defensive.
  return { directive: { kind: 'unknown', name, raw } }
}

export function parseDirectives(ast: Diagram): DirectiveParseResult {
  const directives: ParsedDirective[] = []
  const diagnostics: DirectiveDiagnostic[] = []
  for (const d of ast.directives) {
    const { directive, diagnostic } = parseOne(d.text)
    directives.push(directive)
    if (diagnostic) diagnostics.push(diagnostic)
  }
  return { directives, diagnostics }
}

export function findDirective<K extends ParsedDirective['kind']>(
  result: DirectiveParseResult,
  kind: K,
): Extract<ParsedDirective, { kind: K }>[] {
  return result.directives.filter(
    (d): d is Extract<ParsedDirective, { kind: K }> => d.kind === kind,
  )
}
