/**
 * Bug 0349 — a path-shaped dependency ban passed silently under pnpm and Yarn's cache.
 *
 * `notImportFrom('**\/node_modules/knex/**')` is the spelling an adopter reaches for when they
 * mean "this package, however it is imported". It matches the **resolved target path**, and under
 * pnpm that path is `node_modules/.pnpm/knex@3/node_modules/knex/…` while under Yarn's cache it is
 * `.yarn/cache/knex-npm-3/…`. Both carry a dot segment, picomatch's default `dot: false` will not
 * let `**` cross one, so the rule matched nothing and reported a **pass**.
 *
 * No dot-directory checkout is involved: the dot segment is in the package manager's own layout,
 * inside an ordinary tree. Banning a dependency is an advertised use of this tool.
 *
 * **The layouts are built on disk rather than faked**, because the defect is in what ts-morph
 * RESOLVES an import to. A fixture that asserted against a hand-written path would pass whatever
 * the resolver did, which is the shape of the measurement 0349's own record warned was not enough
 * ("reproduced end-to-end through `notImportFrom`, not picomatch alone").
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from 'ts-morph'
import { modules } from '../../src/builders/module-rule-builder.js'
import { notImportFrom, onlyImportFrom, dependOn } from '../../src/conditions/dependency.js'
import * as modulePredicates from '../../src/predicates/module.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string

/**
 * A project importing `knex`, with the package installed at `installedAt` — a path relative to the
 * project root, so each layout differs only in where the resolver lands.
 */
function fixture(installedAt: string): ArchProject {
  const root = fs.mkdtempSync(path.join(base, 'p-'))
  const pkgDir = path.join(root, installedAt)
  fs.mkdirSync(pkgDir, { recursive: true })
  fs.writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'knex', types: 'index.d.ts' }),
  )
  fs.writeFileSync(path.join(pkgDir, 'index.d.ts'), 'export declare function knex(): void\n')

  // The resolvable entry point. pnpm and Yarn both leave a link at node_modules/<name>; what
  // differs is where it points, which is exactly what this test varies.
  const link = path.join(root, 'node_modules', 'knex')
  if (path.resolve(pkgDir) !== path.resolve(link)) {
    fs.mkdirSync(path.dirname(link), { recursive: true })
    fs.symlinkSync(pkgDir, link, 'dir')
  }

  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'src', 'a.ts'),
    "import { knex } from 'knex'\nexport function use(): void {\n  knex()\n}\n",
  )
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { strict: true, moduleResolution: 'node', preserveSymlinks: false },
      include: ['src'],
    }),
  )
  const tsConfigPath = path.join(root, 'tsconfig.json')
  const tsm = new Project({ tsConfigFilePath: tsConfigPath })
  return { tsConfigPath, _project: tsm, getSourceFiles: () => tsm.getSourceFiles() }
}

/** Where the resolver actually landed — reported on failure so a miss is diagnosable. */
function resolvedTarget(p: ArchProject): string {
  const sf = p.getSourceFiles().find((f) => f.getFilePath().endsWith('/src/a.ts'))
  return (
    sf?.getImportDeclarations()[0]?.getModuleSpecifierSourceFile()?.getFilePath() ?? '<unresolved>'
  )
}

/** Findings any import-glob condition reports, excluding ADR-010 configuration findings. */
function findings(
  p: ArchProject,
  condition: Parameters<ReturnType<typeof modules>['satisfy']>[0],
): string[] {
  return modules(p)
    .should()
    .satisfy(condition)
    .rule({ id: 'test/0349' })
    .violations()
    .filter((v) => v.bypassFilters !== true)
    .map((v) => v.element ?? '')
}

/**
 * Findings a path-shaped ban reports, excluding ADR-010 configuration findings.
 *
 * The CONDITION `notImportFrom`, from `conditions/dependency.ts` — not the same-named
 * PREDICATE in `predicates/module.ts`. `.satisfy()` dispatches structurally, so handing it the
 * predicate filters the subject set and asserts nothing: the first draft of this file did that
 * and every row went green-by-vacuity, including its own controls.
 */
function banned(p: ArchProject, glob: string): string[] {
  return modules(p)
    .should()
    .satisfy(notImportFrom(glob))
    .rule({ id: 'test/0349' })
    .violations()
    .filter((v) => v.bypassFilters !== true)
    .map((v) => v.element ?? '')
}

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0349-'))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

describe('bug 0349: a path-shaped dependency ban sees every package-manager layout', () => {
  const LAYOUTS: [string, string][] = [
    ['npm / Yarn hoisted', 'node_modules/knex'],
    ['pnpm virtual store', 'node_modules/.pnpm/knex@3.1.0/node_modules/knex'],
    ['Yarn cache', '.yarn/cache/knex-npm-3.1.0/node_modules/knex'],
  ]

  it.each(LAYOUTS)('reports the banned import under %s', (_label, installedAt) => {
    const p = fixture(installedAt)
    // Non-vacuity: the import must actually resolve, or the rule has nothing to match and a
    // "pass" would mean nothing. This is the assertion that makes the rows below evidence.
    expect(resolvedTarget(p)).toContain('knex')
    expect(banned(p, '**/node_modules/knex/**')).toEqual(['a.ts'])
  })

  it('CONTROL: a bare-specifier ban is unaffected by the layout', () => {
    // `candidatesFor` offers the raw specifier when it is non-relative, so this spelling never
    // touches a path. It is the workaround an adopter can use today, and it must keep working.
    for (const [, installedAt] of LAYOUTS) {
      expect(banned(fixture(installedAt), 'knex')).toEqual(['a.ts'])
    }
  })

  /** Every import-glob surface, so a fix that reached one and missed five cannot pass. */
  const SURFACES: [string, (p: ArchProject, glob: string) => string[]][] = [
    ['notImportFrom (condition)', (p, g) => findings(p, notImportFrom(g))],
    ['dependOn (condition)', (p, g) => findings(p, dependOn(g))],
    // The ALLOWLIST. Its glob names what is PERMITTED, so a layout it cannot see
    // makes the allowance vanish and every import is reported — the opposite
    // direction from the ban, and the one the reasoning for this fix turns on.
    ['onlyImportFrom (condition)', (p, g) => findings(p, onlyImportFrom(g))],
    [
      'importFrom (predicate)',
      (p, g) =>
        modules(p)
          .that()
          .satisfy(modulePredicates.importFrom(g))
          .subjects()
          .map((sf) => sf.getBaseName()),
    ],
  ]

  it.each(SURFACES)('%s agrees across every layout', (_name, run) => {
    const verdicts = LAYOUTS.map(([, installedAt]) =>
      run(fixture(installedAt), '**/node_modules/knex/**').join(','),
    )
    // The denominator, stated. Without it `new Set([x]).size === 1` is trivially
    // true and this row passes having compared one layout with itself — measured,
    // by a sabotage row that reduced LAYOUTS to its first element and stayed green.
    expect(verdicts).toHaveLength(LAYOUTS.length)
    expect(new Set(verdicts).size, `layouts disagreed: ${JSON.stringify(verdicts)}`).toBe(1)
  })

  it('gives the same verdict whatever the package manager did', () => {
    // The property the fix is actually for, and the reason 0339's rejection of
    // `{ dot: true }` does not transfer to an import target: today the SAME rule
    // gives different answers for the same dependency depending only on how
    // node_modules was laid out. That is 0339's own defect — a verdict decided by
    // where things sit on disk rather than by the code — one population over.
    //
    // Asserted across the layouts rather than per layout, so a fix that repaired
    // pnpm while breaking npm could not pass.
    const verdicts = LAYOUTS.map(([, installedAt]) =>
      banned(fixture(installedAt), '**/node_modules/knex/**').join(','),
    )
    expect(new Set(verdicts).size, `layouts disagreed: ${JSON.stringify(verdicts)}`).toBe(1)
    expect(verdicts[0]).toBe('a.ts')
  })

  it('CONTROL: a ban that should not match still does not', () => {
    // Without this, "make everything match" would pass every row above.
    for (const [, installedAt] of LAYOUTS) {
      expect(banned(fixture(installedAt), '**/node_modules/bullmq/**')).toEqual([])
      expect(banned(fixture(installedAt), 'bullmq')).toEqual([])
    }
  })
})
