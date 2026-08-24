import { describe, it, expect } from 'vitest'
import { Project, SyntaxKind, Node } from 'ts-morph'
import path from 'node:path'

/**
 * ADR-011 clause 1, the half no gate was watching: a symbol on the kernel ROOT
 * must be NAMEABLE by a consumer who only has the root.
 *
 * The split classified symbols by "is it taught, or reachable from something
 * taught". That question is about the symbol; it is not about the symbol's
 * SIGNATURE. `correspondence()` shipped public with its options type
 * `CorrespondenceOptions` behind `/internal`, so a consumer could call it and
 * could not annotate the argument — object-literal call sites still infer, which
 * is exactly why nothing failed and review had to find it.
 *
 * The root cause is procedural and will recur: ADR-011's classification closes
 * transitively over the taught seed, and THEN applies manual reversals. Any
 * reversal re-opens the closure, and re-running it is a step a human forgets.
 * This test is that step, made mechanical.
 */
describe('the kernel root is nameable from the kernel root (ADR-011 clause 1)', () => {
  const repoRoot = path.resolve(__dirname, '../../..')
  const project = new Project({
    tsConfigFilePath: path.join(repoRoot, 'packages/core/tsconfig.build.json'),
  })
  const rootExports = project
    .getSourceFileOrThrow(path.join(repoRoot, 'packages/core/src/index.ts'))
    .getExportedDeclarations()
  const internalExports = project
    .getSourceFileOrThrow(path.join(repoRoot, 'packages/core/src/internal.ts'))
    .getExportedDeclarations()

  /** Every type name this package declares anywhere in its own src. */
  const declaredHere = new Set<string>()
  for (const sf of project.getSourceFiles()) {
    if (!sf.getFilePath().includes('/packages/core/src/')) continue
    for (const d of [
      ...sf.getInterfaces(),
      ...sf.getTypeAliases(),
      ...sf.getClasses(),
      ...sf.getEnums(),
    ]) {
      const n = d.getName()
      if (n) declaredHere.add(n)
    }
  }

  /** Type names a root export mentions in its own surface — never in a body. */
  function surfaceTypeNames(decls: ReturnType<typeof rootExports.get>): string[] {
    const out: string[] = []
    for (const decl of decls ?? []) {
      for (const ref of decl.getDescendantsOfKind(SyntaxKind.TypeReference)) {
        // Skip a function BODY (implementation, not surface) and skip anything
        // under a `private`/`protected` member — tsc emits those into the .d.ts,
        // but a caller cannot reach them, so they are not a nameability problem.
        let parent: Node | undefined = ref.getParent()
        let hidden = false
        while (parent !== undefined) {
          if (Node.isBlock(parent)) {
            hidden = true
            break
          }
          if (Node.isModifierable(parent)) {
            const mods = parent
              .getModifiers()
              .map((m) => m.getText())
              .join(' ')
            if (/\b(?:private|protected)\b/.test(mods)) {
              hidden = true
              break
            }
          }
          parent = parent.getParent()
        }
        if (!hidden) out.push(ref.getTypeName().getText().split('.')[0] ?? '')
      }
    }
    return out
  }

  // The predicate is "not reachable from the ROOT", not "provided by /internal".
  // The first version asked the narrower question and therefore could not see the
  // strictly worse case: a type exported from NEITHER entry point. `dispatchRule`
  // is documented consumer API and its parameter type `Dispatchable` was exactly
  // that — callable, unnameable, and invisible to a test written for the defect
  // it is an instance of. Found in review of that test.
  it('no root export names a type a consumer cannot get from the root', () => {
    const nameable = new Set(rootExports.keys())
    // Structural/utility names that are not nominal types a consumer imports.
    const BUILTIN =
      /^(?:Array|Readonly|Record|Partial|Promise|Map|Set|WeakSet|WeakMap|Iterable|Omit|Pick|Exclude|Extract|NonNullable|ReturnType|Parameters|RegExp|Error|Date|Function|Object|String|Number|Boolean|Symbol|BigInt|unknown|any|never|void|this|T|L|R|P|V|K|E|U)$/
    const leaks: string[] = []
    for (const [name, decls] of rootExports) {
      for (const referenced of surfaceTypeNames(decls)) {
        if (!referenced || BUILTIN.test(referenced)) continue
        // Only names this package DECLARES — a ts-morph or lib.d.ts type is not
        // ours to re-export.
        if (!declaredHere.has(referenced)) continue
        if (!nameable.has(referenced)) leaks.push(`${name} names ${referenced}`)
      }
    }
    expect([...new Set(leaks)]).toEqual([])
  })

  it('VACUITY: the scan really reads type references off the root surface', () => {
    // Without this, an empty `rootExports`, a wrong SyntaxKind, or a body-filter
    // that swallowed everything would make the assertion above pass over nothing.
    expect(rootExports.size).toBeGreaterThan(50)
    expect(internalExports.size).toBeGreaterThan(50)
    const seen = [...rootExports].flatMap(([, decls]) => surfaceTypeNames(decls))
    expect(seen.length).toBeGreaterThan(20)
    // and it can see a name that IS internal-only, proving the lookup is live
    expect([...internalExports.keys()].some((n) => !rootExports.has(n))).toBe(true)
  })
})
