import type { ClassDeclaration } from 'ts-morph'
import type { Predicate } from '@nielspeter/eess'
import { decoratorNames, extendsByName, implementsByName } from '../helpers/heritage.js'

/**
 * Matches classes whose direct base is the named class — written as its name, or through an
 * aliased import, a namespace member or a mixin call. `class Foo extends Bar` matches
 * `extend('Bar')`. A class that reaches `Bar` through an intermediate class is not matched.
 */
export function extend(className: string): Predicate<ClassDeclaration> {
  return {
    description: `extend "${className}"`,
    test: (cls) => extendsByName(cls, className),
  }
}

/**
 * Matches classes whose own `implements` clause names the interface — as written, or through
 * an aliased import.
 */
export function implement(interfaceName: string): Predicate<ClassDeclaration> {
  return {
    description: `implement "${interfaceName}"`,
    test: (cls) => implementsByName(cls, interfaceName),
  }
}

/**
 * Matches classes that have a decorator with the given name — as written, or imported under
 * an alias.
 *
 * @example haveDecorator('Controller') matches `@Controller class Foo {}`
 */
export function haveDecorator(name: string): Predicate<ClassDeclaration> {
  return {
    description: `have decorator @${name}`,
    test: (cls) => cls.getDecorators().some((d) => decoratorNames(d).includes(name)),
  }
}

/**
 * Matches classes that have a decorator whose name — as written, or the name an aliased
 * import stands for — matches the regex.
 */
export function haveDecoratorMatching(regex: RegExp): Predicate<ClassDeclaration> {
  return {
    description: `have decorator matching ${String(regex)}`,
    test: (cls) => cls.getDecorators().some((d) => decoratorNames(d).some((n) => regex.test(n))),
  }
}

/**
 * Matches abstract classes.
 */
export function areAbstract(): Predicate<ClassDeclaration> {
  return {
    description: 'are abstract',
    test: (cls) => cls.isAbstract(),
  }
}

/**
 * Matches classes that have a method with the given name.
 */
export function haveMethodNamed(name: string): Predicate<ClassDeclaration> {
  return {
    description: `have method named "${name}"`,
    test: (cls) => cls.getMethod(name) !== undefined,
  }
}

/**
 * Matches classes that have a method whose name matches the regex.
 */
export function haveMethodMatching(regex: RegExp): Predicate<ClassDeclaration> {
  return {
    description: `have method matching ${String(regex)}`,
    test: (cls) =>
      cls.getMethods().some((m) => {
        const name = m.getName()
        return regex.test(name)
      }),
  }
}

/**
 * Matches classes that have a property with the given name.
 */
export function havePropertyNamed(name: string): Predicate<ClassDeclaration> {
  return {
    description: `have property named "${name}"`,
    test: (cls) => cls.getProperty(name) !== undefined,
  }
}
