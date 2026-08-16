import type { Condition, ConditionContext } from '@nielspeter/eess'
import { byCodepoint } from '@nielspeter/eess'
import type { ArchViolation } from '../core/violation.js'
import type { Slice } from '../models/slice.js'
import type { ImportOptions } from '../core/import-options.js'
import { splitGlobArgs } from '../core/import-options.js'
import type { SliceDependencySite } from '../helpers/slice-graph.js'
import { edgeDiscriminator, edgeVerb } from '../core/module-edges.js'
import { sliceGraph, buildFileToSliceMap } from '../helpers/slice-graph.js'
import { tarjanSCC, type AdjacencyList } from '../helpers/tarjan.js'

/**
 * Every slice must be free of dependency cycles.
 *
 * **The graph counts eager static dependencies: `import` declarations AND
 * re-exports.** `export { x } from './b.js'` and `export * from './b.js'`
 * are edges — they emit an import of the module, so it is evaluated —
 * which means a **barrel cycle** (`a → barrel → a`) is detected, and that is
 * the commonest cycle shape there is.
 *
 * Not counted, each for a reason: **dynamic `import()`** (lazy, so it
 * cannot deadlock initialization, and it is usually the deliberate *fix*
 * for a cycle), **`require()`** (CJS; this is an ESM-only package, ADR-004),
 * and **type positions** like `type X = import('./b.js').Y` (erased).
 *
 * Type-only imports and re-exports are dropped by default — see
 * `ignoreTypeImports` below, and note the default differs from
 * `notDependOn`/`respectLayerOrder` on purpose: a cycle asks whether the
 * module is *evaluated*, those ask whether the code is *coupled*.
 *
 * @example
 * slices(project)
 *   .matching('src/features/*\/')
 *   .should().beFreeOfCycles()
 *   .check()
 */
export function beFreeOfCycles(options?: ImportOptions): Condition<Slice> {
  // Resolved PER FIELD, once, and passed down as a complete object.
  //
  // A whole-object default — `options: ImportOptions = { ignoreTypeImports: true }`
  // — paired with a read of `options?.ignoreTypeImports === true` downstream would
  // mean ANY object defeats it: `beFreeOfCycles({})` typechecks, because the field
  // is optional, and would silently give the pre-fix graph. It gets worse with a
  // second field, which is the point of a shared options bag:
  // `beFreeOfCycles({ someOtherOption: true })` would revert a documented default
  // while the caller's intent was unrelated.
  const resolved: ImportOptions = { ignoreTypeImports: options?.ignoreTypeImports ?? true }
  return {
    description: 'be free of cycles',
    evaluate(slices: Slice[], context: ConditionContext): ArchViolation[] {
      const fileToSlice = buildFileToSliceMap(slices)
      // 'module-request': a cycle is a deadlock in module-initialization order, so
      // what matters is whether the target is EVALUATED, not whether the bindings are
      // type-level. Under `verbatimModuleSyntax`, `import { type X } from 's'` emits
      // `import {} from 's'` and can close a cycle.
      const graph = sliceGraph(slices, fileToSlice, resolved, 'module-request')
      const edges = graph.edges

      // Map slice names to indices for Tarjan's
      const sliceNames = slices.map((s) => s.name)
      const nameToIndex = new Map(sliceNames.map((name, i) => [name, i]))

      const adjacency: AdjacencyList = new Map()
      for (const edge of edges) {
        const fromIdx = nameToIndex.get(edge.from)
        const toIdx = nameToIndex.get(edge.to)
        if (fromIdx === undefined || toIdx === undefined) continue

        const existing = adjacency.get(fromIdx)
        if (existing) {
          existing.push(toIdx)
        } else {
          adjacency.set(fromIdx, [toIdx])
        }
      }

      const sccs = tarjanSCC(slices.length, adjacency)

      const violations: ArchViolation[] = []
      for (const scc of sccs) {
        // **SORTED, not the raw traversal order.** `tarjanSCC` returns membership
        // in DFS-pop order, so the sequence is an artefact of traversal:
        // reordering two imports could move the element from `[a, c, b]` to
        // `[a, b, c]`, reddening CI on a cosmetic edit. `members`/sorting serves
        // the MESSAGE only — identity and element are per-edge, below — but the
        // order-independence this sort buys still matters there too
        // (`internalEdges` is itself sorted the same way).
        const members = [...new Set(scc.map((i) => sliceNames[i] ?? ''))].sort(byCodepoint)
        const inCycle = new Set(members)

        // **Every internal edge, not just one.** Provably meaningful, not a
        // heuristic: for a strongly connected component, any edge `u -> v` where
        // both `u` and `v` are members lies on SOME cycle, because the
        // component's own connectivity supplies a return path `v -> ... -> u`.
        // So every edge this filter finds is a real, substantiated
        // cycle-membership fact. SORTED for the same portability reason:
        // `edges` is built by walking the file list, so an unsorted iteration
        // order would make which edge is "first" depend on filesystem order.
        //
        // INVARIANT: every `scc` reaching this point has 2+ members
        // (`tarjanSCC` only returns components of size > 1) and `adjacency` is
        // built from the same `edges` array this filter reads, so
        // `internalEdges` is never empty here — a size-2+ strongly connected
        // component always has at least one internal edge by construction. Not
        // asserted at runtime: an empty result would silently emit zero
        // violations for a real cycle, so if this invariant is ever wrong it
        // fails open rather than throwing.
        const internalEdges = edges
          .filter((e) => inCycle.has(e.from) && inCycle.has(e.to))
          .sort((a, b) => byCodepoint(a.from, b.from) || byCodepoint(a.to, b.to))

        for (const edge of internalEdges) {
          // Through the graph, so the question and the options cannot diverge
          // from the ones it was built with. Passing 'type-bindings' here would
          // turn this finding into "dynamically imports ... at line 1" —
          // pointing the reader at the construct that FIXES cycles. Called once
          // per edge rather than once per SCC: each call walks
          // `fromSlice.files`, which is cheap — the AST work underneath is
          // cached per file by `edgesOf` (module-edges.ts) regardless of call
          // count.
          const details = graph.detailsFor(edge.from, edge.to)
          // `details` follows the slice's file order, and each edge computes
          // its OWN site — never a hoisted one shared across edges in the same
          // SCC, which would silently reintroduce a shared-location
          // regression.
          const site = [...details].sort(
            (a, b) =>
              byCodepoint(a.sourceFile.getFilePath(), b.sourceFile.getFilePath()) ||
              a.importLine - b.importLine,
          )[0]

          violations.push({
            rule: context.rule,
            // The edge ITSELF, not the component. `.excluding('helpers -> builders')`
            // now names exactly this fact and nothing else in the component.
            // Deliberately NOT decorated with the member list: folding
            // membership in here would move every edge's element whenever the
            // component's shape changes, even for edges that did not
            // themselves change.
            element: `${edge.from} -> ${edge.to}`,
            file: site ? site.sourceFile.getFilePath() : 'unknown',
            line: site ? site.importLine : 0,
            // A pure function of the two slice names — no path, no line, no
            // message text.
            identity: `cycle-edge::${edge.from}->${edge.to}`,
            message: site
              ? `Cycle detected: "${edge.from}" ${edgeVerb(site.edge.kind)} "${edge.to}" at ` +
                `${site.sourceFile.getBaseName()}:${String(site.importLine)}, part of a cycle with: ` +
                `${members.join(', ')}`
              : // Unreachable given `graph`'s options/question binding — kept as a
                // defensive fallback.
                `Cycle detected: "${edge.from}" depends on "${edge.to}", part of a cycle with: ` +
                `${members.join(', ')} (location unknown)`,
            because: context.because,
          })
        }
      }

      return violations
    },
  }
}

/**
 * A dependency site's identity, following the scheme the dependency
 * conditions already use.
 *
 * `basename::kind::specifier::sorted-names`, prefixed with the slice pair —
 * and **deliberately no line number**: `ArchViolation.identity` exists
 * precisely to survive "a coordinate — `at line 12` moves when anything
 * above it is edited". Copying the scheme rather than inventing a second
 * one is the point: these two families report the same underlying edges.
 *
 * Why this distinguishes what a count could not: a barrel with thirty
 * re-exports into one forbidden slice would otherwise produce thirty
 * findings sharing ONE hash, because `element` was the basename and the
 * message named only the slice pair — so one baseline entry accepted all
 * thirty. Each edge carries different `names`, so each site is now its own
 * finding.
 */
function siteIdentity(from: string, to: string, site: SliceDependencySite): string {
  return [
    `${from}->${to}`,
    // The FULL PATH, not the basename. `getBaseName()` collides: two sibling
    // feature folders each with an `index.ts` re-exporting the same name
    // from the same specifier would produce one identity for two distinct
    // violations — so one baseline entry accepts both, the commonest layout
    // there is.
    //
    // An absolute path is safe here — `hashViolation` normalises the
    // repository root out of identity text, which is what makes a baseline
    // portable between a laptop and CI.
    site.sourceFile.getFilePath(),
    site.edge.kind,
    site.edge.specifier,
    // Names when the edge carries them, the source-order ordinal when it
    // does not — see `edgeDiscriminator`. It is the SPELLING that carries
    // names, not the kind: two default imports of one module from one file
    // give two findings and, without this, one identity — as do two bare
    // side-effect imports.
    edgeDiscriminator(site.edge),
  ].join('::')
}

/**
 * Assert that slices respect a layered dependency order.
 *
 * **Which edges count:** every kind — plain imports, re-exports,
 * `import('…')` and `type X = import('…').Y` — because this is a
 * **coupling** question and a lazy import of a forbidden slice is still a
 * forbidden dependency. `require()` is not counted (ESM-only package,
 * ADR-004). Contrast `beFreeOfCycles`, which counts only the eager kinds
 * because a cycle is a deadlock in initialization order.
 *
 * Given layers ['presentation', 'application', 'persistence', 'domain'],
 * layer N may depend on layers N+1, N+2, ... but NOT on layers N-1, N-2, ...
 * That is, dependencies must flow downward (toward higher indices) only.
 *
 * A layer not present in the slice set is silently skipped.
 *
 * @param layers - Ordered layer names, from highest (e.g., UI) to lowest (e.g., domain)
 *
 * @example
 * slices(project)
 *   .assignedFrom(layers)
 *   .should().respectLayerOrder('presentation', 'application', 'persistence', 'domain')
 *   .check()
 */
export function respectLayerOrder(layers: string[], options: ImportOptions): Condition<Slice>
export function respectLayerOrder(...layers: string[]): Condition<Slice>
export function respectLayerOrder(...args: [string[], ImportOptions] | string[]): Condition<Slice> {
  const { globs: layers, options } = splitGlobArgs(args)
  // `?? false` explicitly, not "undefined is falsy". Layering is a COUPLING
  // question, so type edges count by default — the opposite of
  // `beFreeOfCycles`, and stated so a future default change is a one-line
  // edit rather than an audit.
  const resolved: ImportOptions = { ignoreTypeImports: options?.ignoreTypeImports ?? false }
  return {
    description: `respect layer order [${layers.join(' -> ')}]`,
    evaluate(slices: Slice[], context: ConditionContext): ArchViolation[] {
      const fileToSlice = buildFileToSliceMap(slices)
      // 'type-bindings': layering and isolation are about COUPLING, so
      // `ignoreTypeImports` here means what it means on
      // `dependOn`/`notImportFrom` — ignore type-level references.
      // Deliberately NOT the cycle question.
      const graph = sliceGraph(slices, fileToSlice, resolved, 'type-bindings')
      const edges = graph.edges

      // Map layer names to their position (lower index = higher layer)
      const layerIndex = new Map(layers.map((name, i) => [name, i]))

      const violations: ArchViolation[] = []

      for (const edge of edges) {
        const fromIdx = layerIndex.get(edge.from)
        const toIdx = layerIndex.get(edge.to)

        // Skip edges involving non-layer slices
        if (fromIdx === undefined || toIdx === undefined) continue

        // Violation: depending on a higher layer (lower index)
        if (toIdx < fromIdx) {
          const details = graph.detailsFor(edge.from, edge.to)
          for (const detail of details) {
            violations.push({
              rule: context.rule,
              element: detail.sourceFile.getBaseName(),
              file: detail.sourceFile.getFilePath(),
              line: detail.importLine,
              identity: siteIdentity(edge.from, edge.to, detail),
              message: `Layer "${edge.from}" ${edgeVerb(detail.edge.kind)} higher layer "${edge.to}" (allowed: ${layers.slice(fromIdx + 1).join(', ') || 'none'})`,
              because: context.because,
            })
          }
        }
      }

      return violations
    },
  }
}

/**
 * Assert that no slice depends on any of the listed slices.
 *
 * **Which edges count:** every kind — plain imports, re-exports,
 * `import('…')` and `type X = import('…').Y` — because this is a
 * **coupling** question: a lazy import of a forbidden slice is still a
 * forbidden dependency. `require()` is not counted (ESM-only, ADR-004).
 * Contrast `beFreeOfCycles`, which counts only the eager kinds because a
 * cycle is a deadlock in initialization order.
 *
 * Use for explicit isolation rules, e.g., "no slice may depend on legacy".
 *
 * @param forbiddenSlices - Names of slices that must not be depended upon
 *
 * @example
 * slices(project)
 *   .matching('src/features/*\/')
 *   .should().notDependOn('legacy', 'deprecated')
 *   .check()
 */
export function notDependOn(forbiddenSlices: string[], options: ImportOptions): Condition<Slice>
export function notDependOn(...forbiddenSlices: string[]): Condition<Slice>
export function notDependOn(...args: [string[], ImportOptions] | string[]): Condition<Slice> {
  const { globs: forbiddenSlices, options } = splitGlobArgs(args)
  // `?? false` — see `respectLayerOrder` above. Isolation is a coupling question.
  const resolved: ImportOptions = { ignoreTypeImports: options?.ignoreTypeImports ?? false }
  const forbiddenSet = new Set(forbiddenSlices)
  return {
    description: `not depend on [${forbiddenSlices.join(', ')}]`,
    evaluate(slices: Slice[], context: ConditionContext): ArchViolation[] {
      const fileToSlice = buildFileToSliceMap(slices)
      // 'type-bindings': layering and isolation are about COUPLING, so
      // `ignoreTypeImports` here means what it means on
      // `dependOn`/`notImportFrom` — ignore type-level references.
      // Deliberately NOT the cycle question.
      const graph = sliceGraph(slices, fileToSlice, resolved, 'type-bindings')
      const edges = graph.edges

      const violations: ArchViolation[] = []

      for (const edge of edges) {
        if (forbiddenSet.has(edge.to)) {
          const details = graph.detailsFor(edge.from, edge.to)
          for (const detail of details) {
            violations.push({
              rule: context.rule,
              element: detail.sourceFile.getBaseName(),
              file: detail.sourceFile.getFilePath(),
              line: detail.importLine,
              identity: siteIdentity(edge.from, edge.to, detail),
              message: `Slice "${edge.from}" ${edgeVerb(detail.edge.kind)} forbidden slice "${edge.to}"`,
              because: context.because,
            })
          }
        }
      }

      return violations
    },
  }
}
