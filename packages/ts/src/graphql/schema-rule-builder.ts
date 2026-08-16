import type { ArchViolation } from '../core/violation.js'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import { TerminalBuilder, type CollectResult } from '@nielspeter/eess'
import type { Predicate } from '@nielspeter/eess'
import { writeStderr } from '@nielspeter/eess'
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
export class SchemaRuleBuilder extends TerminalBuilder {
  private _predicates: Predicate<SchemaElement>[] = []
  private _conditions: Condition<SchemaElement>[] = []

  constructor(private readonly loaded: LoadedSchema) {
    super()
  }

  /**
   * Independent copy of `_predicates`/`_conditions` — see
   * `SliceRuleBuilder.copy()` for why this override is required: without it,
   * two branches derived from the same held selection via the inherited
   * `.because()`/`.excluding()`/`.rule()`/`.expectEmpty()` would share one
   * mutable array by reference.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._predicates = [...this._predicates]
    clone._conditions = [...this._conditions]
    return clone
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

  // --- Chain methods ---

  /**
   * Begin the predicate phase. Purely a readability marker.
   */
  that(): this {
    return this
  }

  /**
   * Add another predicate (AND).
   */
  and(): this {
    return this
  }

  /**
   * Begin the condition phase.
   */
  should(): this {
    return this
  }

  /**
   * Add another condition (AND).
   */
  andShould(): this {
    return this
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

  protected collectViolations(): CollectResult {
    const allElements = this.getElements()

    const filtered = allElements.filter((element) =>
      this._predicates.every((predicate) => predicate.test(element)),
    )

    if (filtered.length === 0) {
      // Deliberately not claiming sourceEmpty: SchemaRuleBuilder can be built
      // from a raw SDL string (schemaFromSDL()) with no ArchProject at all,
      // and even the project-backed path (schema()) narrows by glob before
      // construction — the same ambiguity that broke JsxRuleBuilder's
      // .notExist() case when this was tried against getElements().length.
      return { violations: [], examined: 0 }
    }

    if (this._conditions.length === 0) {
      const ruleId = this._metadata?.id ?? 'unnamed'
      writeStderr(
        `[eess] Schema rule '${ruleId}' has predicates but no conditions. ` +
          `Did you forget to add a condition after .should()?`,
      )
      return { violations: [], examined: filtered.length }
    }

    const context: ConditionContext = {
      rule: this.buildRuleDescription(),
      because: this._reason,
      ruleId: this._metadata?.id,
      suggestion: this._metadata?.suggestion,
      docs: this._metadata?.docs,
    }

    const violations: ArchViolation[] = []
    for (const condition of this._conditions) {
      violations.push(...condition.evaluate(filtered, context))
    }
    return { violations, examined: filtered.length }
  }

  private getElements(): SchemaElement[] {
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

  private buildRuleDescription(): string {
    const predicateDesc = this._predicates.map((p) => p.description).join(' and ')
    const conditionDesc = this._conditions.map((c) => c.description).join(' and ')
    const parts: string[] = ['schema']
    if (predicateDesc) parts.push(`that ${predicateDesc}`)
    if (conditionDesc) parts.push(`should ${conditionDesc}`)
    return parts.join(' ')
  }
}
