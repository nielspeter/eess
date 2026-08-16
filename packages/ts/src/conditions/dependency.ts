import picomatch from 'picomatch'
import type { SourceFile, ImportDeclaration } from 'ts-morph'
import type { Condition, ConditionContext } from '@nielspeter/eess'
import { byCodepoint, recordEdgeCoverage } from '@nielspeter/eess'
import type { ArchViolation } from '../core/violation.js'
import type { ImportOptions } from '../core/import-options.js'
import { splitGlobArgs } from '../core/import-options.js'
import { candidatesFor, matchedCandidate } from '../core/import-candidates.js'
import { rootOf } from '../core/project-relative.js'
import {
  edgeTypeOnlyRemedy,
  edgeDiscriminator,
  edgeValuePhrase,
  edgeTypeOnlyNoun,
  edgeStream,
  edgeVerb,
  edgesOf,
  FORWARD_EDGE_KINDS,
  type ModuleEdge,
  type ModuleEdgeKind,
} from '../core/module-edges.js'

export type { ImportOptions } from '../core/import-options.js'

/**
 * Which edge kinds a forward dependency condition reports on.
 *
 * **An exhaustive `Record`, not an allowlist filter.** "Each site filters to
 * the kinds it handles" is fail-open for a sixth kind: one added later would
 * be silently excluded everywhere. A full `Record<ModuleEdgeKind, boolean>`
 * makes a new union member a compile error here.
 *
 * `require` is **false at every site**. The kind exists so a 4-way branch
 * cannot mark a CJS runtime dependency as erased, not to enforce CJS — that
 * is a different, unrelated concern whose reds would land in interop and
 * generated `.d.ts`, where the remedy is usually "nothing you can do".
 */
const DEPENDENCY_KINDS = FORWARD_EDGE_KINDS

/**
 * Which kinds `onlyHaveTypeImportsFrom` reports on.
 *
 * Excludes `dynamic`: the condition's remedy is "make the dependency
 * erased", and there is **no** way to do that for `await import(…)`. A
 * finding whose remedy cannot be followed is not a finding.
 *
 * Keeps `reexport`, where a remedy does exist but is not purely local — see
 * {@link edgeTypeOnlyRemedy}. Excludes `type-expression` because it is
 * already erased and can never violate a type-only rule, so the row is
 * unreachable rather than a judgement.
 */
const TYPE_IMPORT_KINDS: Record<ModuleEdgeKind, boolean> = {
  import: true,
  reexport: true,
  dynamic: false,
  'type-expression': false,
  require: false,
}

/**
 * The strings this edge's globs may be matched against, primary first.
 *
 * The IMPORTING file's root. In a workspace the target may live in another
 * package, whose absolute path is not under this root — then no relative
 * candidate is produced and matching falls back to the absolute form, which
 * is the honest answer: `'src/shared/**'` written in one package means that
 * package's `src/shared`.
 */
function edgeCandidates(
  edge: ModuleEdge,
  sourceFile: SourceFile,
): ReturnType<typeof candidatesFor> {
  return candidatesFor(edge.specifier, edge.resolvedPath, rootOf(sourceFile))
}

/**
 * Create a violation for one module edge.
 *
 * `line` comes from the edge, which is the **statement** line.
 */
function edgeViolation(
  sourceFile: SourceFile,
  edge: ModuleEdge,
  message: string,
  context: ConditionContext,
): ArchViolation {
  return {
    rule: context.rule,
    element: sourceFile.getBaseName(),
    file: sourceFile.getFilePath(),
    line: edge.line,
    message,
    because: context.because,
    // `identity` — the canonical form that supersedes `element::message` in
    // the baseline hash.
    //
    // The message carries the basename and the resolved target and nothing
    // else, so two edges from one file to one module are byte-identical and
    // share a hash. Measured on a real barrel file: one export statement
    // re-exporting several names produced multiple findings sharing one
    // identity — you could not accept one and keep failing on its sibling,
    // and a re-export added later was silently pre-accepted by an entry
    // written before it existed.
    //
    // **`names` is the discriminator, and the line is not.** An accepted
    // violation has to survive its code moving — the same reason the
    // baseline never hashes the line.
    //
    // **A residual, stated.** For `kind === 'import'` `names` is the INWARD
    // name, so `import { X } from 'm'` and `import { X as Y } from 'm'` in
    // one file both carry `['X']` and still share an identity. Separating
    // them needs the local binding, which `ModuleEdge` deliberately does not
    // carry. That shape is legal and unusual; the shape this fixes is the
    // barrel, where re-exports use the OUTWARD name and aliases therefore
    // differ.
    identity: [
      // The FULL PATH, not the basename. Every other component here is a
      // property of the EDGE, so the basename was the only thing
      // identifying the file, and it does not: two sibling folders each
      // with an `index.ts` importing the same target produce ONE identity
      // for TWO violations, and one baseline entry accepts both.
      //
      // An absolute path is not a new bet: `edgeCandidates(edge, sourceFile)[0]`
      // below is already the resolved absolute path of the TARGET, and
      // `hashViolation` normalises the repository root out of identity text.
      sourceFile.getFilePath(),
      edge.kind,
      // `[0]` is the primary candidate regardless of root — a relative
      // candidate is only ever appended as an alternate, never prepended —
      // and this string is a baseline identity, so root-awareness here would
      // rewrite every existing dependency entry for no gain.
      edgeCandidates(edge, sourceFile)[0],
      // See `edgeDiscriminator`. The first edge of each `kind::specifier`
      // group emits `''`, which is byte-for-byte what the pre-ordinal
      // formula produced; only the second and later siblings gain `#n`.
      edgeDiscriminator(edge),
    ].join('::'),
  }
}

/**
 * Create a violation for a source file with a specific offending import.
 */
function importViolation(
  sourceFile: SourceFile,
  importDecl: ImportDeclaration,
  message: string,
  context: ConditionContext,
  /**
   * What distinguishes this finding from a sibling, WITHOUT the file — the
   * caller knows, this function adds the path.
   */
  subject: string,
): ArchViolation {
  return {
    rule: context.rule,
    element: sourceFile.getBaseName(),
    file: sourceFile.getFilePath(),
    line: importDecl.getStartLineNumber(),
    // The path, then what the caller says distinguishes it. Not the
    // message: a message is prose and may be reworded, which is the whole
    // reason `identity` exists.
    identity: `${sourceFile.getFilePath()}::${subject}`,
    message,
    because: context.because,
  }
}

/**
 * Every import in the module must match at least one of the globs — against
 * its resolved path or, for a non-relative specifier, the specifier as
 * written.
 * Imports that match no glob produce violations.
 *
 * @example
 * modules(p)
 *   .that().resideInFolder('** /domain/** ')
 *   .should().onlyImportFrom('** /domain/** ', '** /shared/** ')
 *   .check()
 */
export function onlyImportFrom(globs: string[], options: ImportOptions): Condition<SourceFile>
export function onlyImportFrom(...globs: string[]): Condition<SourceFile>
export function onlyImportFrom(
  ...args: [string[], ImportOptions] | string[]
): Condition<SourceFile> {
  const { globs, options } = splitGlobArgs(args)
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  const quotedGlobs = globs.map((g) => `"${g}"`).join(', ')
  return {
    description: `only import from ${quotedGlobs}`,
    evaluate(sourceFiles: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      // An allowlist constrains EDGES, so a subject with none passes
      // however broken the allowlist. Counted after the same filters the
      // check applies — including `ignoreType`, since an edge this rule
      // skips is an edge it did not test.
      let tested = 0
      // Counted separately so the disclosure can name the right cause: a
      // subject whose imports were all filtered by `ignoreTypeImports` is
      // NOT a dependency-free module, and saying so sends the reader to a
      // folder full of imports to look for the ones the tool says are
      // missing.
      let seen = 0
      for (const sf of sourceFiles) {
        for (const edge of edgesOf(sf)) {
          if (!DEPENDENCY_KINDS[edge.kind]) continue
          seen++
          if (ignoreType && edge.typeOnly) continue
          tested++
          const candidates = edgeCandidates(edge, sf)
          const importPath = candidates[0]
          if (matchedCandidate(candidates, matchers) === undefined) {
            violations.push(
              edgeViolation(
                sf,
                edge,
                `${sf.getBaseName()} ${edgeVerb(edge.kind)} "${importPath}" which does not match any of [${globs.join(', ')}]`,
                context,
              ),
            )
          }
        }
      }
      recordEdgeCoverage(
        context.rule,
        sourceFiles.length,
        tested,
        seen > 0 ? 'all-filtered' : 'no-edges',
      )
      return violations
    },
  }
}

/**
 * No import in the module may match any of the globs — against its resolved
 * path or, for a non-relative specifier, the specifier as written.
 * Imports that match a glob produce violations.
 *
 * @example
 * modules(p)
 *   .that().resideInFolder('** /features/** ')
 *   .should().notImportFrom('** /legacy/** ')
 *   .check()
 */
export function notImportFrom(globs: string[], options: ImportOptions): Condition<SourceFile>
export function notImportFrom(...globs: string[]): Condition<SourceFile>
export function notImportFrom(
  ...args: [string[], ImportOptions] | string[]
): Condition<SourceFile> {
  const { globs, options } = splitGlobArgs(args)
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  const quotedGlobs = globs.map((g) => `"${g}"`).join(', ')
  return {
    description: `not import from ${quotedGlobs}`,
    evaluate(sourceFiles: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of sourceFiles) {
        for (const edge of edgesOf(sf)) {
          if (!DEPENDENCY_KINDS[edge.kind]) continue
          if (ignoreType && edge.typeOnly) continue
          const importPath = matchedCandidate(edgeCandidates(edge, sf), matchers)
          if (importPath !== undefined) {
            violations.push(
              edgeViolation(
                sf,
                edge,
                `${sf.getBaseName()} ${edgeVerb(edge.kind)} "${importPath}" which matches forbidden [${globs.join(', ')}]`,
                context,
              ),
            )
          }
        }
      }
      return violations
    },
  }
}

/**
 * Module must import from at least one path matching a glob.
 * Completes the import-condition family: onlyImportFrom (all),
 * notImportFrom (none), dependOn (at least one).
 *
 * **Sees every kind of module edge**, not just static imports: `import`,
 * `export … from`, `import()` and `type X = import('…').Y`. (CJS `require`
 * is classified and deliberately not enforced — see `DEPENDENCY_KINDS`.)
 *
 * **What counts as a dependency differs per kind, and the asymmetry is
 * deliberate.** This is the only condition in the library where it does:
 *
 * | edge                              | satisfies `dependOn`?              |
 * | --------------------------------- | ----------------------------------- |
 * | `import { x } from '…'`           | yes                                 |
 * | `import type { X } from '…'`      | **yes** — unchanged; opt out with `{ ignoreTypeImports: true }` |
 * | `export { x } from '…'`           | yes                                 |
 * | `export type { X } from '…'`      | **no** — erased, so nothing loads   |
 * | `await import('…')`               | yes                                 |
 * | `type X = import('…').Y`          | **no** — erased                     |
 *
 * For `kind === 'import'` the behaviour is: an `import type` of the target
 * satisfies the rule by default, and `{ ignoreTypeImports: true }` is the
 * opt-in that makes it fail — requiring runtime there would be a green→red
 * change to a contract that already has an opt-out.
 *
 * For the other kinds it requires **runtime**, because the alternative
 * creates a false green: `export type { SecurityConfig } from
 * './security.js'` would satisfy `dependOn('**\/security/**')` while the
 * server installs nothing — and on the baseline side that reads as "the
 * violation was fixed".
 *
 * @example
 * modules(p)
 *   .that().resideInFolder('** /services/** ')
 *   .should().satisfy(dependOn('** /logging/** '))
 *   .check()
 */
export function dependOn(globs: string[], options: ImportOptions): Condition<SourceFile>
export function dependOn(...globs: string[]): Condition<SourceFile>
export function dependOn(...args: [string[], ImportOptions] | string[]): Condition<SourceFile> {
  const { globs, options } = splitGlobArgs(args)
  const ignoreType = options?.ignoreTypeImports === true
  const matchers = globs.map((g) => picomatch(g))
  const quotedGlobs = globs.map((g) => `"${g}"`).join(', ')
  return {
    description:
      globs.length === 1 ? `depend on ${quotedGlobs}` : `depend on at least one of ${quotedGlobs}`,
    evaluate(sourceFiles: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of sourceFiles) {
        // A `for … of` over `edgeStream`, not `edgesOf(sf).some(...)`.
        //
        // `edgesOf` builds and RESOLVES every edge in the file before
        // returning, so `.some()` on its result pays a `getSymbol()` per
        // literal even when the first one answers the question — 100
        // checker calls on a 100-import file where a short-circuiting walk
        // makes 1.
        let hasMatch = false
        for (const edge of edgeStream(sf)) {
          if (!DEPENDENCY_KINDS[edge.kind]) continue
          // `typeOnly` means something DIFFERENT per kind on this one
          // condition, and that asymmetry is deliberate.
          //
          // For `import`, behaviour is exactly as documented above: an
          // `import type` of the target SATISFIES `dependOn`, and
          // `{ ignoreTypeImports: true }` is the opt-in that makes it fail.
          //
          // For the new kinds it must require runtime, or this widening
          // CREATES a false green: `export type { SecurityConfig } from
          // './security.js'` would satisfy `dependOn('**/security/**')`
          // while the server installs nothing.
          if (edge.kind === 'import' ? ignoreType && edge.typeOnly : edge.typeOnly) continue
          if (matchedCandidate(edgeCandidates(edge, sf), matchers) !== undefined) {
            hasMatch = true
            break
          }
        }
        if (!hasMatch) {
          violations.push({
            rule: context.rule,
            element: sf.getBaseName(),
            file: sf.getFilePath(),
            line: 1,
            // An identity: this finding had none, so it fell back to
            // `element::message`; the element is a basename and the message
            // never names the file, so two sibling folders each with an
            // `index.ts` were one finding to the baseline.
            //
            // The globs are part of it because this finding is about a
            // REQUIREMENT not met, not about an edge: the same file failing
            // two different `dependOn` rules is two findings, and `rule`
            // alone would not separate them if one rule carried both.
            identity: `${sf.getFilePath()}::depends-on::${[...globs].sort(byCodepoint).join(',')}`,
            message: `${sf.getBaseName()} does not import from any path matching [${globs.join(', ')}]`,
            because: context.because,
          })
        }
      }
      return violations
    },
  }
}

/**
 * No import in the module may use an aliased named specifier (`import { x as y }`).
 * Each aliased specifier produces a violation.
 * Does not flag namespace imports (`import * as Foo`) — only named specifier aliases.
 *
 * To scope the check to specific import sources, filter with
 * `.that().importFrom(...)` predicates.
 *
 * @example
 * modules(p)
 *   .that().resideInFolder('** /src/** ')
 *   .should().notHaveAliasedImports()
 *   .because('aliases hide API design problems')
 *   .check()
 */
export function notHaveAliasedImports(): Condition<SourceFile> {
  return {
    description: 'not have aliased imports',
    evaluate(sourceFiles: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      for (const sf of sourceFiles) {
        for (const decl of sf.getImportDeclarations()) {
          for (const specifier of decl.getNamedImports()) {
            const alias = specifier.getAliasNode()
            if (alias) {
              violations.push(
                importViolation(
                  sf,
                  decl,
                  `${sf.getBaseName()} aliases "${specifier.getName()}" as "${alias.getText()}"`,
                  context,
                  // The aliased name and the alias — the two things that
                  // make one aliased specifier different from another in
                  // the same file.
                  `aliased::${specifier.getName()}::${alias.getText()}`,
                ),
              )
            }
          }
        }
      }
      return violations
    },
  }
}

/**
 * Imports from paths matching the given globs must use `import type`, not `import`.
 * Non-matching imports are ignored. Matching imports that are not type-only produce violations.
 *
 * @example
 * modules(p)
 *   .that().resideInFolder('** /api/** ')
 *   .should().onlyHaveTypeImportsFrom('** /domain/entities/** ')
 *   .check()
 */
export function onlyHaveTypeImportsFrom(...globs: string[]): Condition<SourceFile> {
  const matchers = globs.map((g) => picomatch(g))
  const quotedGlobs = globs.map((g) => `"${g}"`).join(', ')
  return {
    description: `only have type imports from ${quotedGlobs}`,
    evaluate(sourceFiles: SourceFile[], context: ConditionContext): ArchViolation[] {
      const violations: ArchViolation[] = []
      // Same shape as `onlyImportFrom` — the allowlist scopes which imports
      // must be type-only, so a subject with no matching import tests
      // nothing.
      let tested = 0
      // Same distinction as `onlyImportFrom`, for the other reason: here an
      // edge is out of scope because the GLOB did not name it, and that is
      // the case worth surfacing — the glob may be a typo.
      let seen = 0
      for (const sf of sourceFiles) {
        for (const edge of edgesOf(sf)) {
          if (!TYPE_IMPORT_KINDS[edge.kind]) continue
          seen++
          const importPath = matchedCandidate(edgeCandidates(edge, sf), matchers)
          // In scope only when the allowlist matched it: an edge the glob
          // does not name is one this rule never had an opinion about.
          if (importPath !== undefined) tested++
          if (importPath !== undefined && !edge.typeOnly) {
            const violation = edgeViolation(
              sf,
              edge,
              `${sf.getBaseName()} has ${edgeValuePhrase(edge.kind)} "${importPath}" which should be a type-only ${edgeTypeOnlyNoun(edge.kind)}`,
              context,
            )
            // A producer-set `suggestion` WINS over the rule author's — a
            // per-kind suggestion is set only for the kinds this widening
            // introduces, where no remedy existed before and a per-kind one
            // is strictly better.
            //
            // NOT for `kind === 'import'`: that would silently discard any
            // consumer's own `.rule({ suggestion })`, and a one-option
            // remedy loses "or move the value you need into a layer this
            // one is allowed to depend on" — the only followable action
            // when the value is needed at runtime.
            violations.push(
              edge.kind === 'import'
                ? violation
                : { ...violation, suggestion: edgeTypeOnlyRemedy(edge) },
            )
          }
        }
      }
      recordEdgeCoverage(
        context.rule,
        sourceFiles.length,
        tested,
        seen > 0 ? 'none-matched' : 'no-edges',
      )
      return violations
    },
  }
}
