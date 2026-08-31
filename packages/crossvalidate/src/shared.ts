import type { ClassDeclaration } from 'ts-morph'
import type { ElementInfo } from '@nielspeter/eess'
import type { FeatureSet } from '@nielspeter/eess-gherkin'

// Kernel re-exports (plan 0089 — standalone sufficiency): see mermaid-ts.ts.
// Every source file in this package re-exports what it imports from the kernel,
// so installing eess-crossvalidate alone never requires a second, direct
// @nielspeter/eess install.
export type { ElementInfo }

/**
 * Conventions every binding in this package shares.
 *
 * Each of these was duplicated byte-for-byte across two bindings, which
 * `no-copy-paste` reported at 100%. They are conventions rather than
 * coincidences: how a TS class is named in a finding, and how a cited feature
 * path is resolved, must be the same answer in every binding or two gates
 * disagree about the same file.
 */

/**
 * How a TS class appears in a correspondence finding.
 *
 * `<anonymous>` rather than omitting the name: a nameless class still occupies a
 * position in the diagram comparison, and a finding that names nothing cannot be
 * acted on.
 */
export function identifyTsClass(c: ClassDeclaration): ElementInfo {
  return {
    name: c.getName() ?? '<anonymous>',
    file: c.getSourceFile().getFilePath(),
    line: c.getStartLineNumber(),
  }
}

/**
 * The feature files a cited path refers to.
 *
 * An exact `relPath` wins outright. Otherwise the citation is treated as a
 * SUFFIX — `login.feature` matches `specs/auth/login.feature` — so a document
 * can cite a feature without repeating the corpus root it already declared.
 *
 * Returns every match rather than the first, so an ambiguous citation is
 * reported as ambiguous by the caller instead of being silently resolved to
 * whichever file the walk happened to reach first.
 */
export function resolveFeature(path: string, set: FeatureSet): readonly string[] {
  const all = set.features().map((f) => f.relPath)
  if (all.includes(path)) return [path]
  return all.filter((rel) => rel.endsWith(`/${path}`))
}
