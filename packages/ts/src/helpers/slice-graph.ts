import type { SourceFile } from 'ts-morph'
import type { Slice } from '../models/slice.js'
import type { ImportOptions } from '../core/import-options.js'
import type { ModuleEdge, ModuleEdgeKind } from '../core/module-edges.js'
import { edgesOf, FORWARD_EDGE_KINDS } from '../core/module-edges.js'

/**
 * An edge in the slice dependency graph.
 * Represents: a file in `from` depends on a file in `to`.
 */
// eess-exclude eess/no-unused-exports: parameter/return type of the exported slice-graph APIs (must stay exported for declaration emit)
export interface SliceEdge {
  from: string
  to: string
}

/**
 * Build a reverse lookup map: file path -> slice name.
 * Shared by buildSliceDependencyGraph and findSliceDependencyDetails.
 */
export function buildFileToSliceMap(slices: Slice[]): Map<string, string> {
  const fileToSlice = new Map<string, string>()
  for (const slice of slices) {
    for (const file of slice.files) {
      fileToSlice.set(file.getFilePath(), slice.name)
    }
  }
  return fileToSlice
}

/**
 * The edge kinds a **cycle** question counts: the eager static ones.
 *
 * A cycle question asks "what does this slice depend on when the program
 * starts", which is what makes a cycle a cycle. Of `module-edges.ts`'s five
 * kinds, two qualify — and each exclusion is a decision with a reason, not
 * an omission:
 *
 * - `import` and `reexport` — **counted.** Both are eager: `export { x } from
 *   './b.js'` emits an import of `./b.js`, so that module is evaluated
 *   whether or not anything reads `x`. A barrel file is built out of
 *   re-exports, and `a → barrel → a` is the cycle real codebases actually
 *   have.
 * - `dynamic` — **not counted.** `import('./b.js')` is lazy, so it cannot
 *   deadlock module initialization, and it is most often the *deliberate*
 *   fix for a cycle. Reporting it as one would fail the rule for applying
 *   its own remedy.
 * - `require` — **not counted.** CJS, and this is an ESM-only package
 *   (ADR-004). Named here rather than left implicit, so the next reader
 *   knows it was considered. The surviving gap is `require` in an `allowJs`
 *   project: recorded, not fixed.
 * - `type-expression` — **not counted**, and excluded by *kind* rather than
 *   by `typeOnly`. `type X = import('./b.js').Y` is erased, so it must stay
 *   out even under `ignoreTypeImports: false` — filtering it on the flag
 *   alone would make that option add a class of edge this graph has never
 *   had.
 *
 * **This set is the cycle question's answer and nothing else's.** A version
 * of this graph that let the cycle rationale also govern `notDependOn`/
 * `respectLayerOrder` produced a false negative on those two — they are not
 * about cycles, and a dependency that a lazy `import()` reaches is still a
 * real, forbidden coupling. See `QUESTIONS` below.
 */
const EAGER_STATIC_KINDS: ReadonlySet<ModuleEdgeKind> = new Set<ModuleEdgeKind>([
  'import',
  'reexport',
])

/**
 * Which erasure question a condition is asking.
 *
 * Both live on this graph and they are **not the same question**:
 *
 * - `'module-request'` — will importing this file cause the target to be
 *   *evaluated*? That is what a **cycle** is: a deadlock in
 *   module-initialization order. Used by `beFreeOfCycles`.
 * - `'type-bindings'` — does this file *reference* the target's types? That
 *   is **coupling**, which is what `notDependOn` and `respectLayerOrder` are
 *   about, and it matches what `dependOn`/`notImportFrom` have always meant
 *   by `ignoreTypeImports`.
 *
 * They diverge for exactly two spellings, and only under
 * `verbatimModuleSyntax: true`: `import { type X } from 's'` and
 * `export { type X } from 's'` emit `import {} from 's'` / `export {} from
 * 's'`. Those are eager edges — so a cycle question must count them — while
 * the bindings crossing them are still purely type-level, so a coupling
 * question told to ignore type imports must not.
 *
 * Getting this backwards is a false positive on one side and a false
 * negative on the other, in the same release.
 */
// eess-exclude eess/no-unused-exports: parameter type of the exported sliceGraph API (must stay exported for declaration emit)
export type ErasureQuestion = 'module-request' | 'type-bindings'

/**
 * The edges leaving one file, as a slice graph counts them.
 *
 * Reads `edgesOf()` — the one definition of a module edge. The slice graph
 * previously collected edges itself (static import + re-export only), which
 * disagreed with a forward dependency condition built on a different
 * collector: `export { x } from './banned.js'` could be a dependency to
 * `notImportFrom` and invisible to `beFreeOfCycles` **in the same run**.
 * `edgesOf()` is cached per file and invalidated on modification, so this
 * also replaces a per-call resolution walk.
 *
 * `ignoreTypeImports` drops the erased edges. A type-only import or
 * re-export creates no runtime dependency, so counting it invents cycles
 * that cannot exist at runtime.
 *
 * Which erasure the filter reads depends on the `question`:
 * `'module-request'` reads `erasesModuleRequest`, `'type-bindings'` reads
 * `typeOnly`. Those differ for two spellings under
 * `verbatimModuleSyntax: true` — `import { type X } from 's'` emits
 * `import {} from 's'`, so the specifiers are erased and the module request
 * is not.
 */
function sliceEdgesOf(
  file: SourceFile,
  options: ImportOptions | undefined,
  question: ErasureQuestion,
): readonly ModuleEdge[] {
  const ignoreErased = options?.ignoreTypeImports === true
  const { counts, erased } = QUESTIONS[question]
  return edgesOf(file).filter((edge) => counts(edge.kind) && !(ignoreErased && erased(edge)))
}

/**
 * Which edge kinds the question counts.
 *
 * The erasure predicate is already a function of the question; the KIND set
 * must be too, or one answer — the cycle one — ends up serving both
 * questions.
 *
 * - `'module-request'` → the eager static kinds above. A cycle is a deadlock
 *   in initialization order, and `import('./b.js')` is lazy: it cannot
 *   deadlock, and it is most often the deliberate *fix* for a cycle.
 *   Reporting it would fail the rule for applying its own remedy.
 * - `'type-bindings'` → whatever `FORWARD_EDGE_KINDS` says, which is the
 *   constant `notImportFrom` and `dependOn` already read. A lazy import of
 *   `legacy` is still a forbidden dependency: it is coupling, it breaks
 *   when `legacy` is deleted, and nobody is applying a remedy by writing it.
 *
 * **Reusing `FORWARD_EDGE_KINDS` rather than writing a second list is the
 * point.** It is what makes the two families agree *by construction*
 * instead of by two lists someone must keep in step. That constant is a
 * total `Record<ModuleEdgeKind, boolean>`, so a sixth edge kind is a
 * compile error there rather than a silent omission here.
 */
const QUESTIONS: Record<
  ErasureQuestion,
  { counts: (kind: ModuleEdgeKind) => boolean; erased: (edge: ModuleEdge) => boolean }
> = {
  'module-request': {
    counts: (kind) => EAGER_STATIC_KINDS.has(kind),
    erased: (edge) => edge.erasesModuleRequest,
  },
  'type-bindings': {
    counts: (kind) => FORWARD_EDGE_KINDS[kind],
    erased: (edge) => edge.typeOnly,
  },
}

/**
 * Collect unique slice edges from a single file's dependencies.
 */
function collectEdgesFromFile(
  file: SourceFile,
  sliceName: string,
  fileToSlice: Map<string, string>,
  edgeSet: Set<string>,
  edges: SliceEdge[],
  options: ImportOptions | undefined,
  question: ErasureQuestion,
): void {
  for (const edge of sliceEdgesOf(file, options, question)) {
    // A local `export { x }` with no `from` has no specifier, and a specifier the
    // compiler could not resolve points outside the program.
    if (edge.resolvedPath === undefined) continue

    const targetSlice = fileToSlice.get(edge.resolvedPath)
    if (targetSlice && targetSlice !== sliceName) {
      const edgeKey = `${sliceName}->${targetSlice}`
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        edges.push({ from: sliceName, to: targetSlice })
      }
    }
  }
}

/**
 * A built graph, and the only way to ask it for the sites behind one of its
 * edges.
 *
 * `question` and `options` must be the same for the graph and for the
 * details walk. The failure if they diverge is silent and specific: the
 * conditions emit **one violation per detail**, so a graph that counts an
 * edge the details walk cannot see reports nothing at all, and a details
 * walk that counts more reports the wrong site — e.g. a cycle condition
 * whose graph asked `'module-request'` but whose details walk asked
 * `'type-bindings'` would name a dynamic import (which cannot cause the
 * cycle) as the cause, pointing the reader at the one construct that BREAKS
 * cycles and telling them to remove it.
 *
 * So the pairing is not left to convention: `detailsFor` reads what the
 * graph was built with.
 */
// eess-exclude eess/no-unused-exports: return type of the exported sliceGraph API (must stay exported for declaration emit)
export interface SliceGraph {
  readonly edges: SliceEdge[]
  detailsFor(fromSliceName: string, toSliceName: string): SliceDependencySite[]
}

/**
 * Build the graph, and bind the details walk to the same question and
 * options.
 *
 * Prefer this over the two loose functions; they remain exported for direct
 * use with an explicit question.
 */
export function sliceGraph(
  slices: Slice[],
  fileToSlice: Map<string, string> | undefined,
  options: ImportOptions | undefined,
  question: ErasureQuestion,
): SliceGraph {
  const map = fileToSlice ?? buildFileToSliceMap(slices)
  return {
    edges: buildSliceDependencyGraph(slices, map, options, question),
    detailsFor: (from, to) => findSliceDependencyDetails(slices, from, to, map, options, question),
  }
}

function buildSliceDependencyGraph(
  slices: Slice[],
  fileToSlice: Map<string, string> | undefined,
  options: ImportOptions | undefined,
  question: ErasureQuestion,
): SliceEdge[] {
  const map = fileToSlice ?? buildFileToSliceMap(slices)

  // Collect unique edges
  const edgeSet = new Set<string>()
  const edges: SliceEdge[] = []

  for (const slice of slices) {
    for (const file of slice.files) {
      collectEdgesFromFile(file, slice.name, map, edgeSet, edges, options, question)
    }
  }

  return edges
}

/**
 * Find which specific files cause a dependency from one slice to another.
 * Used for detailed violation messages.
 *
 * **`options` must be the options the graph was built with**, and that is
 * not a style preference. `respectLayerOrder` and `notDependOn` push one
 * violation *per detail*, so a graph that counts an edge this function
 * cannot see finds the dependency and reports **nothing** — a false green
 * produced by two filters disagreeing rather than by either one being
 * absent. `beFreeOfCycles` fails differently and more quietly: it still
 * reports the cycle, at `unknown:0`, which is a finding whose remedy nobody
 * can act on.
 *
 * @param slices - The resolved slices
 * @param fromSliceName - Source slice name
 * @param toSliceName - Target slice name
 * @param fileToSlice - Pre-built file-to-slice map (optional, built internally if not provided)
 * @param options - Must match the options passed to `buildSliceDependencyGraph`
 * @returns Array of { sourceFile, importPath, importLine, edge }
 */
export interface SliceDependencySite {
  readonly sourceFile: SourceFile
  readonly importPath: string
  readonly importLine: number
  /**
   * The edge itself, so a caller can build an identity and a message from
   * what the dependency *is* rather than from where it sits.
   *
   * The dependency conditions identify a finding by
   * `basename::kind::specifier::names` and deliberately **not** by line,
   * because a line moves when anything above it is edited (see
   * `ArchViolation.identity`). Also unblocks naming the offending edge's
   * KIND in the message via `edgeVerb()`.
   */
  readonly edge: ModuleEdge
}

function findSliceDependencyDetails(
  slices: Slice[],
  fromSliceName: string,
  toSliceName: string,
  fileToSlice: Map<string, string> | undefined,
  options: ImportOptions | undefined,
  question: ErasureQuestion,
): SliceDependencySite[] {
  const map = fileToSlice ?? buildFileToSliceMap(slices)

  const fromSlice = slices.find((s) => s.name === fromSliceName)
  if (!fromSlice) return []

  const details: SliceDependencySite[] = []
  for (const file of fromSlice.files) {
    for (const edge of sliceEdgesOf(file, options, question)) {
      if (edge.resolvedPath === undefined) continue

      if (map.get(edge.resolvedPath) === toSliceName) {
        details.push({
          sourceFile: file,
          importPath: edge.resolvedPath,
          importLine: edge.line,
          edge,
        })
      }
    }
  }

  return details
}
