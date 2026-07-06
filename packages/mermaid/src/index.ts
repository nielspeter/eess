// Core kernel
export * from './core/index.js'
export type { CheckOptions, OutputFormat, BaselineFilter, DiffFilterLike } from '@nielspeter/eess'
export { formatViolationsJson } from '@nielspeter/eess'
export { formatViolationsGitHub } from '@nielspeter/eess'
export { detectFormat, isCI } from '@nielspeter/eess'
export { parseExclusionComments, isExcludedByComment } from '@nielspeter/eess'
export type { ExclusionComment, ExclusionWarning, ParseResult } from '@nielspeter/eess'
export { silent } from '@nielspeter/eess'
export type { SilentExclusion } from '@nielspeter/eess'
export { TerminalBuilder } from '@nielspeter/eess'
export type { RuleMetadata } from '@nielspeter/eess'
export type { RuleDescription } from '@nielspeter/eess'
export { not, and, or } from '@nielspeter/eess'

// Project / diagram loader
export type { ArchProject } from './core/project.js'
export { diagram } from './core/diagram.js'

// Parser
export { parseClassDiagram, MermaidUnitParseError } from './parser/parse-class-diagram.js'

// Class entry point
export { classes, ClassRuleBuilder } from './builders/class-rule-builder.js'
export type { ArchClass, ArchRelationship } from './models/arch-class.js'
export { collectClasses, collectRelationships } from './models/arch-class.js'

// Predicates
export {
  haveStereotype as predicateHaveStereotype,
  haveNameMatching,
  haveNameStartingWith,
  haveNameEndingWith,
  haveMemberNamed,
  haveMethodNamed,
  areAbstract,
  haveAtLeastOneMethod,
  haveNoMembers,
  extendName,
} from './predicates/class.js'

// Conditions
export {
  notExtendStereotype,
  extendClass,
  notExist,
  haveStereotype as conditionHaveStereotype,
  notHaveStereotype,
  dependOn,
  notDependOn,
  notDependOnStereotype,
} from './conditions/class.js'

// Directive parsing
export { parseDirectives, findDirective } from './parser/parse-directives.js'
export type {
  ParsedDirective,
  DirectiveSchema,
  DirectiveStereotype,
  DirectiveId,
  DirectiveUnknown,
  DirectiveDiagnostic,
  DirectiveParseResult,
} from './parser/parse-directives.js'

// Reference validation
export { validateReferences } from './parser/validate-diagram.js'
export type { ReferenceDiagnostic } from './parser/validate-diagram.js'

// CLI config (for eess-mermaid.config.ts authoring)
export { defineConfig } from './cli/config.js'
export type { CliConfig } from './cli/config.js'

// Bridge to eess-ts
export { fromDiagram } from './bridge/from-diagram.js'
export type {
  BridgeOptions,
  BridgeRule,
  BridgeRuleAllowedEdge,
  BridgeRuleForbiddenEdge,
  BridgeRuleInheritance,
  BridgeOutput,
} from './bridge/from-diagram.js'
