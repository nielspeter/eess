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

  /** Type names a root export mentions in its own surface — never in a body. */
  function surfaceTypeNames(decls: ReturnType<typeof rootExports.get>): string[] {
    const out: string[] = []
    for (const decl of decls ?? []) {
      for (const ref of decl.getDescendantsOfKind(SyntaxKind.TypeReference)) {
        let parent: Node | undefined = ref.getParent()
        let insideBody = false
        while (parent !== undefined) {
          if (Node.isBlock(parent)) {
            insideBody = true
            break
          }
          parent = parent.getParent()
        }
        if (!insideBody) out.push(ref.getTypeName().getText().split('.')[0] ?? '')
      }
    }
    return out
  }

  it('no root export names a type that only @nielspeter/eess/internal provides', () => {
    const internalOnly = new Set(
      [...internalExports.keys()].filter((name) => !rootExports.has(name)),
    )
    const leaks: string[] = []
    for (const [name, decls] of rootExports) {
      for (const referenced of surfaceTypeNames(decls)) {
        if (internalOnly.has(referenced)) leaks.push(`${name} names ${referenced}`)
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
