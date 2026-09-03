import type { LoadedSchema, GraphQLObjectTypeLike, GraphQLTypeLike } from './schema-loader.js'
import type { SchemaElement } from './schema-predicates.js'
import {
  queries as queriesPredicate,
  mutations as mutationsPredicate,
  typesNamed as typesNamedPredicate,
  returnListOf as returnListOfPredicate,
} from './schema-predicates.js'
import {
  haveFields as haveFieldsCondition,
  acceptArgs as acceptArgsCondition,
  haveMatchingResolver as haveMatchingResolverCondition,
} from './schema-conditions.js'
import { GraphqlRuleBuilder } from './graphql-rule-builder.js'

/**
 * Structural type guard: check if a GraphQL type has `getFields()`.
 * Only GraphQLObjectType, GraphQLInterfaceType, and GraphQLInputObjectType have getFields.
 * Scalars, enums, and unions do not.
 */
function isObjectType(type: GraphQLTypeLike): type is GraphQLObjectTypeLike {
  if (typeof type !== 'object' || type === null) return false
  if (!('getFields' in type)) return false
  // At this point TypeScript knows type has 'getFields', verify it's a function
  const candidate: { getFields?: unknown } = type
  return typeof candidate.getFields === 'function'
}

/**
 * Fluent rule builder for GraphQL schema architecture rules.
 *
 * Operates on SchemaElements extracted from .graphql files.
 * Follows the same builder pattern as SliceRuleBuilder (standalone, not extending RuleBuilder).
 *
 * @example
 * ```typescript
 * schema(p, 'src/schema/*.graphql')
 *   .typesNamed(/Collection$/)
 *   .should()
 *   .haveFields('total', 'skip', 'limit', 'items')
 *   .check()
 * ```
 */
export class SchemaRuleBuilder extends GraphqlRuleBuilder<SchemaElement> {
  constructor(private readonly loaded: LoadedSchema) {
    super()
  }

  // --- Predicate methods ---

  /**
   * Filter to only Query root type fields.
   */
  queries(): this {
    const next = this.copy()
    next._predicates.push(queriesPredicate())
    return next
  }

  /**
   * Filter to only Mutation root type fields.
   */
  mutations(): this {
    const next = this.copy()
    next._predicates.push(mutationsPredicate())
    return next
  }

  /**
   * Filter to object types matching the given name pattern.
   */
  typesNamed(pattern: RegExp | string): this {
    const next = this.copy()
    next._predicates.push(typesNamedPredicate(pattern))
    return next
  }

  /**
   * Filter to fields returning a list of the given type.
   */
  returnListOf(typeName: string | RegExp): this {
    const next = this.copy()
    next._predicates.push(returnListOfPredicate(typeName))
    return next
  }

  // --- Condition methods ---

  /**
   * Assert that types have all listed fields.
   */
  haveFields(...names: string[]): this {
    const next = this.copy()
    next._conditions.push(haveFieldsCondition(...names))
    return next
  }

  /**
   * Assert that fields accept all listed arguments.
   */
  acceptArgs(...names: string[]): this {
    const next = this.copy()
    next._conditions.push(acceptArgsCondition(...names))
    return next
  }

  /**
   * Assert that schema fields have matching resolver implementations.
   *
   * @param resolverFileTexts - Map of file paths to source text
   */
  haveMatchingResolver(resolverFileTexts: ReadonlyMap<string, string>): this {
    const next = this.copy()
    next._conditions.push(haveMatchingResolverCondition(resolverFileTexts))
    return next
  }

  // --- Evaluation ---

  /**
   * This family counts schema types — the SDL types it selected.
   *
   * Plan 0099: `CollectResult.examined` is unit-typed per family (ADR-009 part
   * 1), and the zero-examined message prints the noun. Inheriting the base
   * `'subjects'` is a category error in a sentence whose whole job is naming what
   * was and was not looked at.
   */
  protected override examinedUnitNoun(): string {
    return 'schema types'
  }

  protected override descriptionSubject(): string {
    return 'schema'
  }

  protected override conditionExamples(): string {
    return 'haveFields(...) or acceptArgs(...)'
  }

  protected override getElements(): SchemaElement[] {
    const elements: SchemaElement[] = []
    const typeMap = this.loaded.schema.getTypeMap()
    const firstFile = this.loaded.documents[0]?.filePath

    for (const [typeName, typeObj] of Object.entries(typeMap)) {
      // Skip introspection types (start with __)
      if (typeName.startsWith('__')) continue

      // Skip scalar types that don't have getFields — use structural type guard
      if (!isObjectType(typeObj)) continue

      const objectType = typeObj

      // Add type-level element
      elements.push({
        typeName,
        objectType,
        filePath: firstFile,
      })

      // Add field-level elements
      const fields = objectType.getFields()
      for (const [fieldName, field] of Object.entries(fields)) {
        elements.push({
          typeName,
          fieldName,
          objectType,
          field,
          filePath: firstFile,
        })
      }
    }

    return elements
  }
}
