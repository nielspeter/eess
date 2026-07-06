import type { Predicate } from '@nielspeter/eess'
import type { ArchClass } from '../models/arch-class.js'

export function haveStereotype(name: string): Predicate<ArchClass> {
  return {
    description: `have stereotype <<${name}>>`,
    test: (c) => c.stereotypes.includes(name),
  }
}

export function haveNameMatching(pattern: RegExp): Predicate<ArchClass> {
  return {
    description: `have name matching ${pattern.toString()}`,
    test: (c) => pattern.test(c.name),
  }
}

export function haveNameStartingWith(prefix: string): Predicate<ArchClass> {
  return {
    description: `have name starting with '${prefix}'`,
    test: (c) => c.name.startsWith(prefix),
  }
}

export function haveNameEndingWith(suffix: string): Predicate<ArchClass> {
  return {
    description: `have name ending with '${suffix}'`,
    test: (c) => c.name.endsWith(suffix),
  }
}

export function haveMemberNamed(name: string): Predicate<ArchClass> {
  return {
    description: `have member named '${name}'`,
    test: (c) => c.memberNames.includes(name),
  }
}

export function haveMethodNamed(name: string): Predicate<ArchClass> {
  return {
    description: `have method named '${name}'`,
    test: (c) => c.methodNames.includes(name),
  }
}

export function areAbstract(): Predicate<ArchClass> {
  return {
    description: 'are abstract',
    test: (c) => c.stereotypes.includes('abstract'),
  }
}

export function haveAtLeastOneMethod(): Predicate<ArchClass> {
  return {
    description: 'have at least one method',
    test: (c) => c.methodNames.length > 0,
  }
}

export function haveNoMembers(): Predicate<ArchClass> {
  return {
    description: 'have no members',
    test: (c) => c.memberNames.length === 0,
  }
}

export function extendName(superName: string): Predicate<ArchClass> {
  return {
    description: `extend ${superName}`,
    test: (c) => {
      const project = c.project
      for (const r of project.ast.relationships) {
        if (r.arrow !== '<|--' && r.arrow !== '<|..' && r.arrow !== '--|>' && r.arrow !== '..|>') {
          continue
        }
        const sub = r.arrow === '<|--' || r.arrow === '<|..' ? r.rhs.$refText : r.lhs.$refText
        const sup = r.arrow === '<|--' || r.arrow === '<|..' ? r.lhs.$refText : r.rhs.$refText
        if (sub === c.name && sup === superName) return true
      }
      return false
    },
  }
}
