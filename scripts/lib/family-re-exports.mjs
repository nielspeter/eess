/**
 * Plan 0089 — the re-export-completeness guard behind `family.rules.ts`'s
 * `family/re-export-complete` rule.
 *
 * Two subject shapes reach this condition (see `family.rules.ts`'s own
 * predicate): a package's single `src/index.ts` barrel (md/mermaid/gherkin/ts),
 * or one of crossvalidate's flat, independent per-subpath entry files (it has
 * no `index.ts` at all — confirmed at freeze, 2026-08-16). Each is scored
 * differently:
 *
 * - **`index.ts` shape**: compare against the kernel symbols the WHOLE
 *   package's own `src/**` imports — any file in the package may need
 *   something re-exported through the one barrel.
 * - **crossvalidate shape**: compare each entry file against only ITS OWN
 *   kernel imports — each subpath is independently a complete surface, not
 *   a slice of one shared barrel.
 *
 * Checks both type and value imports (unlike `standalone-surface.test.ts`'s
 * runtime `import * as ns` approach, which can only see values at runtime —
 * this is a static AST check, so it has no such blind spot).
 */

/** Package name -> kernel symbols legitimately exempt from re-export there,
 * even though something in the family touches them. Mirrors the pattern
 * `family.rules.ts`'s own docstring names for eess-ts. crossvalidate has no
 * entry here — it is the family's binding tool and must re-export
 * everything its own body imports, per plan 0089's Problem section. */
const ALLOWLIST = {
  ts: new Set(['correspondence', 'CorrespondenceBuilder', 'matchSelections', 'applyFixes']),
}

/** Kernel-internal plumbing, exempt on every package — the same set
 * `packages/ts/tests/standalone-surface.test.ts` already carries (0088's
 * own ratified decision: "implementation detail, not part of the surface a
 * standalone consumer builds against"). Kept in sync with that file by
 * hand; a genuinely new internal-only symbol needs adding to both. */
export const KERNEL_INTERNAL = new Set([
  'applyFilters',
  'escapeGitHub',
  'hashViolation',
  'writeStderr',
  'registerCacheReset',
  'clearRegisteredCaches',
  'selectionMemo',
])

const PACKAGE_SRC_RE = /\/packages\/([^/]+)\/src\//

/** @param {import('ts-morph').SourceFile} sf */
function packageNameFor(sf) {
  const m = PACKAGE_SRC_RE.exec(sf.getFilePath())
  return m?.[1]
}

/**
 * @param {import('ts-morph').SourceFile} entry
 * @param {string} pkg
 * @returns {import('ts-morph').SourceFile[]}
 */
function packageSourceFiles(entry, pkg) {
  return entry
    .getProject()
    .getSourceFiles()
    .filter((f) => packageNameFor(f) === pkg)
}

/**
 * Kernel symbols (type AND value) a set of files imports OR re-exports
 * from `@nielspeter/eess` directly.
 *
 * Both `import { X } from '@nielspeter/eess'` (an `ImportDeclaration`) and
 * `export { X } from '@nielspeter/eess'` (an `ExportDeclaration` — a
 * forwarding re-export, a genuinely different AST node) count: found during
 * this plan's own build — `packages/ts/src/presets/shared.ts` forwards
 * `dispatchRule`/`validateOverrides`/`finishPreset`/`PresetBaseOptions`
 * straight from the kernel via `export { ... } from '@nielspeter/eess'`,
 * never a literal `import`, so scanning only `getImportDeclarations()`
 * silently missed them — the exact "one AST shape covered, a second one
 * invisible" class of gap this session's own bug 0131/plan 0101 arc kept
 * finding elsewhere.
 * @param {import('ts-morph').SourceFile[]} files
 * @returns {Set<string>}
 */
function kernelImportsOf(files) {
  const names = new Set()
  for (const f of files) {
    for (const decl of f.getImportDeclarations()) {
      if (decl.getModuleSpecifierValue() !== '@nielspeter/eess') continue
      for (const named of decl.getNamedImports()) {
        names.add(named.getName())
      }
    }
    for (const decl of f.getExportDeclarations()) {
      if (decl.getModuleSpecifierValue() !== '@nielspeter/eess') continue
      for (const named of decl.getNamedExports()) {
        names.add(named.getName())
      }
    }
  }
  return names
}

/**
 * Names under which this entry file's exports are reachable — BOTH the
 * local/alias name a consumer imports it as (`entry.getExportedDeclarations()`'s
 * own map key) AND, where available, each exported declaration's own true
 * name. Plain `entry.getExportedDeclarations().keys()` (the obvious first
 * choice) is keyed post-alias only: `export { RuleBuilder as MdRuleBuilder }
 * from '@nielspeter/eess'` keys as `MdRuleBuilder`, so a lookup for
 * `RuleBuilder` misses it and reports a symbol as absent that a standalone
 * consumer can, in fact, already reach — just under a different name, which
 * fully satisfies this rule's own intent ("never need a second kernel
 * install"). Found live during review: a synthetic aliased re-export
 * produced a false-positive violation under the key-only approach.
 *
 * `getExportedDeclarations()` (not a narrower scan of this file's own
 * `getExportDeclarations()`) is deliberate: it resolves `export * from
 * './local.js'` chains transitively (mermaid's `index.ts` reaches several
 * kernel symbols this way, through `core/index.js`), which a same-file-only
 * scan would miss entirely — confirmed the hard way when an earlier version
 * of this fix, scoped to direct re-exports only, produced 16 NEW false
 * positives against the real repo. Adding each declaration's own `.getName()`
 * (when it has one — interfaces/classes/functions/type aliases/variables
 * all do; declarations without a stable name, e.g. an `export default`, are
 * skipped) recovers the pre-alias name on top of what `getExportedDeclarations()`
 * already resolves, without losing its transitive-chain resolution.
 * @param {import('ts-morph').SourceFile} entry
 * @returns {Set<string>}
 */
function reachableExportNames(entry) {
  const names = new Set()
  for (const [localName, decls] of entry.getExportedDeclarations()) {
    names.add(localName)
    for (const decl of decls) {
      const ownName = typeof decl.getName === 'function' ? decl.getName() : undefined
      if (ownName !== undefined) names.add(ownName)
    }
  }
  return names
}

/** @returns {import('@nielspeter/eess').Condition<import('ts-morph').SourceFile>} */
export function reExportsWhatBodyUsesWithAllowlist() {
  return {
    description:
      "re-export what its own body imports from the kernel, minus its package's declared allowlist",
    /**
     * @param {import('ts-morph').SourceFile[]} elements
     * @param {import('@nielspeter/eess').ConditionContext} context
     */
    evaluate(elements, context) {
      const violations = []
      for (const entry of elements) {
        const pkg = packageNameFor(entry)
        if (pkg === undefined) continue
        const isCrossvalidateEntry = pkg === 'crossvalidate'
        const bodyFiles = isCrossvalidateEntry ? [entry] : packageSourceFiles(entry, pkg)
        const needed = kernelImportsOf(bodyFiles)
        const allowed = ALLOWLIST[pkg] ?? new Set()
        const exported = reachableExportNames(entry)
        for (const name of needed) {
          if (KERNEL_INTERNAL.has(name)) continue
          if (allowed.has(name)) continue
          if (exported.has(name)) continue
          violations.push({
            rule: context.rule,
            element: entry.getBaseName(),
            file: entry.getFilePath(),
            line: 1,
            message:
              `${entry.getBaseName()} does not re-export "${name}", which ` +
              (isCrossvalidateEntry
                ? 'this file itself imports'
                : `@nielspeter/eess-${pkg}'s own sources import`) +
              ' from @nielspeter/eess — a standalone consumer would need a second kernel install to reach it.',
            because: context.because,
          })
        }
      }
      return violations
    },
  }
}
