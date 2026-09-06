#!/usr/bin/env node
/**
 * PROFILE — where `eess-ts check` spends its time on this repository.
 *
 * Not a gate. It exists because proposal 010's first draft pinned a block of
 * performance numbers none of which was reproducible from the document, and
 * the review's first correction was to the coordinator's own re-measurement,
 * taken on the wrong tsconfigs. A number this repo states about its own speed
 * is either printed by a script beside its denominator, or it is a projection
 * and says so.
 *
 * Two projects, by argument:
 *   `node scripts/profile-ts-check.mjs`        → `packages/*\/tsconfig.build.json`,
 *                                                 the SAME project `arch.rules.ts`
 *                                                 loads, so the numbers describe
 *                                                 the run `check:arch` pays for;
 *   `node scripts/profile-ts-check.mjs test`   → `packages/*\/tsconfig.json`, the
 *                                                 test-inclusive variant — the
 *                                                 second heap data point proposal
 *                                                 010 cites.
 *
 * Every timing is printed next to the count it was taken over; a timing with
 * no denominator is the shape `CLAUDE.md` warns about. Milliseconds move with
 * machine load; the counts and the ratios are the numbers to trust.
 *
 * What it measures, in this order — and the order is load-bearing:
 *   1. ts-morph `Project` construction — files loaded, whether they were parsed
 *      eagerly, wall time, heap delta.
 *   2. `collectFunctions` over every file, then over `packages/core/src` only —
 *      the population a pre-selection would narrow.
 *   3. The first real semantic query — `getTypeAtLocation` on one node —
 *      taken BEFORE the edge walk, because `getTypeChecker()` itself is lazy and
 *      costs nothing, and whichever step first resolves a symbol pays the
 *      program build. Measured after the edge walk this prints 0 and lies; the
 *      first version of this script did exactly that.
 *   4. `moduleEdges` cold, and the reverse graph built from it, with two routing
 *      counts for an unused-export index (see ceilings).
 *   5. `haveNoUnusedExports`'s per-export cost: LanguageService reference finding
 *      over every own-declaration export in `packages/core/src`, against the
 *      import-only name index, with the FIRST call timed separately and both
 *      disagreement directions counted — a faster instrument that answers
 *      differently is a different rule.
 *
 * Ceilings, stated so they are not read as coverage:
 *   - `collectFunctions(sf, undefined)` is the default population; a builder
 *     constructed with collection options walks a different one.
 *   - Section 5 checks OWN-DECLARATION exports only. The shipped
 *     `findUnusedExportsInFile` iterates `getExportedDeclarations()`, which also
 *     yields declarations that live in other files (barrel re-exports); those
 *     are counted as `foreignDeclarationsSkipped` and the shipped loop pays
 *     `exportsChecked + foreignDeclarationsSkipped` LanguageService calls. That
 *     skipped class is where bugs 0243 and 0265 live.
 *   - The index consults `import` edges only, because a `reexport` edge's
 *     `names` are the OUTWARD names (`export { a as b } from` records `b`, and
 *     `export * as NS from` records `NS`), which are not the target's export
 *     names, and `names` cannot change in place — it feeds finding identity.
 *     `filesRoutedToFallback.importOnlyIndex` counts the files that rule sends
 *     to the LanguageService (any non-`import` importer edge, or an `import`
 *     edge carrying no names). `filesRoutedToFallback.boundNamesField` counts
 *     what a target-side bound-names field on the edge would still have to
 *     route (only edges that bind every export: star, namespace, default,
 *     dynamic, require, type-expression) — computed here as `names.length === 0
 *     || kind not in {import, reexport}`, which under-counts `export * as NS`
 *     by the number of such statements in the corpus (one, in
 *     `packages/ts/src/predicates/index.ts`).
 *   - Zero disagreements on a corpus whose own `eess/no-unused-exports` gate is
 *     green is a CONTROL, not equivalence evidence: both instruments report zero
 *     unused, and so would an index that returned "used" unconditionally.
 *   - Measured on whatever Node runs it (printed); ADR-001 pins CI to Node 24.
 *   - `scripts/` is outside `npm run lint`'s globs (an existing convention, not
 *     this file's choice); prettier covers it. `project._project` is a public
 *     `readonly` field the script reads for the checker and language service.
 *
 * Requires `packages/ts/dist` — a profile of source that was not built would
 * measure the wrong thing, so a missing build is an error here, not a fallback.
 */
import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'packages/ts/dist')
if (!fs.existsSync(path.join(DIST, 'index.js'))) {
  console.error('profile-ts-check: packages/ts/dist is missing — run `npm run build` first')
  process.exit(2)
}
// Arguments. `build` (default) and `test` name this repo's two variants. An
// EXTERNAL project is profiled with `--tsconfig a.json,b.json` — never by name
// in this file or in anything committed here: this repo carries no consumer
// identities, so an adopter measurement is recorded as "an adopter project,
// N files" and nothing else. `--scope <substring>` selects the subset section 5
// walks (default: the directory of the first tsconfig); `--exports <n>` caps the
// LanguageService sample so a large project finishes (default 300; the cap is
// printed beside the count so a capped run cannot read as a full one).
const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const VARIANT =
  argv.find(
    (a) =>
      !a.startsWith('--') &&
      a !== flag('--tsconfig') &&
      a !== flag('--scope') &&
      a !== flag('--exports'),
  ) ?? 'build'
const EXTERNAL = flag('--tsconfig')
const TSCONFIG = { build: 'tsconfig.build.json', test: 'tsconfig.json' }[VARIANT]
if (EXTERNAL === undefined && TSCONFIG === undefined) {
  console.error(
    `profile-ts-check: unknown variant "${VARIANT}" — use "build" (default), "test", or --tsconfig a,b`,
  )
  process.exit(2)
}
const EXPORT_CAP = Number(flag('--exports') ?? 300)
const { workspace } = await import(path.join(DIST, 'index.js'))
const { collectFunctions } = await import(path.join(DIST, 'models/arch-function.js'))
const { moduleEdges } = await import(path.join(DIST, 'core/module-edges.js'))

const configs =
  EXTERNAL !== undefined
    ? EXTERNAL.split(',').map((f) => path.resolve(f))
    : fs
        .readdirSync(path.join(ROOT, 'packages'))
        .map((dir) => path.join(ROOT, 'packages', dir, TSCONFIG))
        .filter((file) => fs.existsSync(file))
        .sort()
for (const c of configs) {
  if (!fs.existsSync(c)) {
    console.error(`profile-ts-check: tsconfig not found: ${c}`)
    process.exit(2)
  }
}
const SCOPE =
  flag('--scope') ??
  (EXTERNAL !== undefined ? path.dirname(configs[0]) + '/src/' : '/packages/core/src/')

const heapMB = () => Math.round(process.memoryUsage().heapUsed / 1e6)
const ms = (t) => Math.round(t)

// 1. Project construction.
const heapBefore = heapMB()
let t = performance.now()
const project = workspace(configs)
const files = project.getSourceFiles()
const initMs = performance.now() - t
const parsedEagerly = files.every((sf) => Array.isArray(sf.compilerNode.statements))
const heapAfterInit = heapMB() - heapBefore

// 2. Function population, full and narrowed.
t = performance.now()
const allFunctions = files.flatMap((sf) => collectFunctions(sf, undefined))
const collectAllMs = performance.now() - t
const coreFiles = files.filter((sf) => sf.getFilePath().includes(SCOPE))
t = performance.now()
const coreFunctions = coreFiles.flatMap((sf) => collectFunctions(sf, undefined))
const collectCoreMs = performance.now() - t

// 3. First semantic query, before anything resolves a symbol.
const firstCoreFile = coreFiles[0] ?? files[0]
const firstNode = firstCoreFile?.getFunctions()[0] ?? firstCoreFile?.getClasses()[0]
t = performance.now()
const lazyChecker = project._project.getTypeChecker()
const lazyGetTypeCheckerMs = performance.now() - t
t = performance.now()
if (firstNode !== undefined) lazyChecker.getTypeAtLocation(firstNode)
const firstSemanticQueryMs = performance.now() - t
const heapAfterSemantic = heapMB() - heapBefore

// 4. Module edges, the reverse graph, and the two routing counts.
t = performance.now()
const byFile = moduleEdges(files)
const edgesMs = performance.now() - t
let edgeCount = 0
const reverse = new Map()
const importNameIndex = new Map()
const fallbackImportOnly = new Set()
const fallbackBoundNames = new Set()
t = performance.now()
for (const [, edges] of byFile) {
  for (const edge of edges) {
    edgeCount++
    if (edge.resolvedPath === undefined) continue
    reverse.set(edge.resolvedPath, (reverse.get(edge.resolvedPath) ?? 0) + 1)
    const named = edge.names.length > 0
    if (edge.kind === 'import' && named) {
      let names = importNameIndex.get(edge.resolvedPath)
      if (names === undefined) {
        names = new Set()
        importNameIndex.set(edge.resolvedPath, names)
      }
      for (const name of edge.names) names.add(name)
    } else {
      fallbackImportOnly.add(edge.resolvedPath)
    }
    const bindsEverything = !named || (edge.kind !== 'import' && edge.kind !== 'reexport')
    if (bindsEverything) fallbackBoundNames.add(edge.resolvedPath)
  }
}
const reverseGraphMs = performance.now() - t
const routed = (set, subset) => subset.filter((sf) => set.has(sf.getFilePath())).length

// 5. Unused-export cost and agreement, own declarations in packages/core/src.
const languageService = project._project.getLanguageService()
let exportsChecked = 0
let foreignDeclarations = 0
let lsUnused = 0
let indexUnused = 0
let indexSaysUsedLsSaysUnused = 0
let indexSaysUnusedLsSaysUsed = 0
let lsFirstCallMs = 0
let lsRestMs = 0
let indexLookupMs = 0
let capped = false
sample: for (const sf of coreFiles) {
  const filePath = sf.getFilePath()
  for (const [name, declarations] of sf.getExportedDeclarations()) {
    if (exportsChecked >= EXPORT_CAP) {
      capped = true
      break sample
    }
    if (name === 'default') continue
    const [declaration] = declarations
    if (declaration === undefined) continue
    if (declaration.getSourceFile().getFilePath() !== filePath) {
      foreignDeclarations++
      continue
    }
    exportsChecked++
    const t0 = performance.now()
    let lsReferenced = false
    try {
      for (const ref of languageService.findReferencesAsNodes(declaration)) {
        if (ref.getSourceFile().getFilePath() !== filePath) {
          lsReferenced = true
          break
        }
      }
    } catch {
      lsReferenced = true
    }
    const elapsed = performance.now() - t0
    if (exportsChecked === 1) lsFirstCallMs = elapsed
    else lsRestMs += elapsed
    const t1 = performance.now()
    const indexReferenced =
      (importNameIndex.get(filePath)?.has(name) ?? false) || fallbackImportOnly.has(filePath)
    indexLookupMs += performance.now() - t1
    if (!lsReferenced) lsUnused++
    if (!indexReferenced) indexUnused++
    if (indexReferenced && !lsReferenced) indexSaysUsedLsSaysUnused++
    if (!indexReferenced && lsReferenced) indexSaysUnusedLsSaysUsed++
  }
}
const steadyStateExports = Math.max(exportsChecked - 1, 1)

console.log(
  JSON.stringify(
    {
      measuredOn: new Date().toISOString().slice(0, 10),
      node: process.version,
      variant: EXTERNAL !== undefined ? 'external (--tsconfig)' : VARIANT,
      tsconfig: EXTERNAL !== undefined ? '(external, not named here)' : TSCONFIG,
      tsconfigs: configs.length,
      scope: EXTERNAL !== undefined ? '(first tsconfig dir)/src/' : SCOPE,
      project: {
        files: files.length,
        parsedEagerly,
        initMs: ms(initMs),
        heapAfterInitMB: heapAfterInit,
      },
      functions: {
        all: allFunctions.length,
        allMs: ms(collectAllMs),
        scopeOnly: coreFunctions.length,
        scopeOnlyMs: ms(collectCoreMs),
        scopeFiles: coreFiles.length,
        collectionShareOfInit: `${((collectAllMs / initMs) * 100).toFixed(1)}%`,
      },
      semantic: {
        lazyGetTypeCheckerMs: +lazyGetTypeCheckerMs.toFixed(2),
        firstSemanticQueryMs: ms(firstSemanticQueryMs),
        heapAfterFirstQueryMB: heapAfterSemantic,
      },
      edges: {
        count: edgeCount,
        buildMs: ms(edgesMs),
        reverseGraphTargets: reverse.size,
        reverseGraphMs: ms(reverseGraphMs),
        filesRoutedToFallback: {
          importOnlyIndex: {
            scope: routed(fallbackImportOnly, coreFiles),
            all: routed(fallbackImportOnly, files),
          },
          boundNamesField: {
            scope: routed(fallbackBoundNames, coreFiles),
            all: routed(fallbackBoundNames, files),
          },
          of: { scope: coreFiles.length, all: files.length },
        },
      },
      unusedExports: {
        exportsChecked,
        exportSampleCap: EXPORT_CAP,
        exportSampleCapped: capped,
        foreignDeclarationsSkipped: foreignDeclarations,
        shippedLoopCalls: exportsChecked + foreignDeclarations,
        languageServiceFirstCallMs: ms(lsFirstCallMs),
        languageServiceRestMs: ms(lsRestMs),
        languageServiceSteadyMsPerExport: +(lsRestMs / steadyStateExports).toFixed(2),
        importNameIndexLookupMs: +indexLookupMs.toFixed(2),
        lsUnused,
        indexUnused,
        indexSaysUsedLsSaysUnused,
        indexSaysUnusedLsSaysUsed,
        control: 'zero unused on both sides is a control, not equivalence evidence',
      },
    },
    null,
    2,
  ),
)
