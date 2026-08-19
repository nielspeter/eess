// Unit tests for reExportsWhatBodyUsesWithAllowlist (plan 0089), using
// Node's built-in test runner — no vitest precedent exists for scripts/*.mjs
// in this repo (only packages/*/tests are vitest-driven), so this follows
// the file's own execution convention (`node scriptname.mjs`, no build
// step) rather than inventing a new root-level test harness.
//
// Run: `node --test scripts/lib/family-re-exports.test.mjs`
//
// Each case writes a REAL temp file into a real package's `src/` (not an
// in-memory ts-morph project — `@nielspeter/eess` doesn't resolve there,
// confirmed the hard way) and removes it in `finally`, mirroring
// scripts/check-nonvacuity.mjs's own probe discipline.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { Project } from 'ts-morph'
import { reExportsWhatBodyUsesWithAllowlist, KERNEL_INTERNAL } from './family-re-exports.mjs'

const MD_TSCONFIG = 'packages/md/tsconfig.build.json'
const CROSSVALIDATE_TSCONFIG = 'packages/crossvalidate/tsconfig.build.json'
const TS_TSCONFIG = 'packages/ts/tsconfig.build.json'

/** Write real temp files, run `fn(project, entrySourceFile)`, always clean up. */
function withPackageFiles(tsConfigFilePath, files, entryPath, fn) {
  const paths = Object.keys(files)
  for (const [path, contents] of Object.entries(files)) writeFileSync(path, contents)
  try {
    // skipAddingFilesFromTsConfig: without it, the Project eagerly loads
    // every real file the tsconfig includes (the whole live package), and
    // packageSourceFiles' whole-package aggregation would pick those up
    // too — polluting an isolated test with the real repo's own imports.
    const project = new Project({ tsConfigFilePath, skipAddingFilesFromTsConfig: true })
    for (const path of paths) project.addSourceFileAtPath(path)
    const entry = project.getSourceFileOrThrow(entryPath)
    return fn(project, entry)
  } finally {
    for (const path of paths) unlinkSync(path)
  }
}

function violationNames(entry) {
  const cond = reExportsWhatBodyUsesWithAllowlist()
  return cond
    .evaluate([entry], { rule: 'test', because: 'test' })
    .map((v) => v.message.match(/does not re-export "([^"]+)"/)?.[1])
}

test('missing re-export (index.ts shape) reds, naming the symbol', () => {
  const body = 'packages/md/src/__test_probe_body1__.ts'
  const entry = 'packages/md/src/__test_probe_entry1__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { RuleBuilder } from '@nielspeter/eess'\nexport function use(x: RuleBuilder<never, never>): void {}\n",
      [entry]: 'export {}\n',
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), ['RuleBuilder'])
    },
  )
})

test('missing re-export (crossvalidate flat-file shape) reds, naming the symbol', () => {
  const entry = 'packages/crossvalidate/src/__test_probe_entry2__.ts'
  withPackageFiles(
    CROSSVALIDATE_TSCONFIG,
    {
      [entry]:
        "import { correspondence } from '@nielspeter/eess'\nexport function use(): typeof correspondence { return correspondence }\n",
    },
    entry,
    (_project, entrySf) => {
      // crossvalidate has no allowlist entry — correspondence is required here
      // even though it's exempt for `ts`.
      assert.deepEqual(violationNames(entrySf), ['correspondence'])
    },
  )
})

test('aliased re-export satisfies the requirement (no false positive)', () => {
  const body = 'packages/md/src/__test_probe_body3__.ts'
  const entry = 'packages/md/src/__test_probe_entry3__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { RuleBuilder } from '@nielspeter/eess'\nexport function use(x: RuleBuilder<never, never>): void {}\n",
      [entry]: "export { RuleBuilder as MdRuleBuilder } from '@nielspeter/eess'\n",
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), [])
    },
  )
})

test('forwarding re-export (export ... from, no direct import) is detected as needed', () => {
  // body FORWARDS a kernel symbol via `export ... from` only — never a
  // literal `import`. If kernelImportsOf only scanned getImportDeclarations()
  // (the pre-fix shape), this symbol would never register as "needed" at
  // all, and this test would see zero violations even with the entry's own
  // re-export absent — silently wrong in the safe direction, which is worse:
  // it means the whole-package scan is blind to a real, in-use symbol.
  const body = 'packages/md/src/__test_probe_body4__.ts'
  const entry = 'packages/md/src/__test_probe_entry4__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]: "export { generateCodeFrame } from '@nielspeter/eess'\n",
      [entry]: 'export {}\n', // entry's own re-export of generateCodeFrame is absent
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), ['generateCodeFrame'])
    },
  )
})

test('whole-package aggregation: a non-entry file usage is caught, named on the entry', () => {
  // The exact shape bug this session's own review found circular in the
  // shipped fixtures: the missing symbol is used in a THIRD file, not the
  // entry and not directly re-exported anywhere — proves `packageSourceFiles`
  // genuinely aggregates the whole package, not just the entry file's own
  // imports/exports.
  const other = 'packages/md/src/__test_probe_other5__.ts'
  const entry = 'packages/md/src/__test_probe_entry5__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [other]:
        "import { not } from '@nielspeter/eess'\nexport function use(): typeof not { return not }\n",
      [entry]: 'export {}\n',
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), ['not'])
      assert.match(entrySf.getFilePath(), /__test_probe_entry5__\.ts$/)
    },
  )
})

test('per-package allowlist: ts is exempt from correspondence, crossvalidate is not', () => {
  const tsBody = 'packages/ts/src/__test_probe_body6__.ts'
  const tsEntry = 'packages/ts/src/__test_probe_entry6__.ts'
  withPackageFiles(
    TS_TSCONFIG,
    {
      [tsBody]:
        "import { correspondence } from '@nielspeter/eess'\nexport function use(): typeof correspondence { return correspondence }\n",
      [tsEntry]: 'export {}\n',
    },
    tsEntry,
    (_project, entrySf) => {
      // ts's own ALLOWLIST exempts correspondence — no violation expected.
      assert.deepEqual(violationNames(entrySf), [])
    },
  )

  const cvEntry = 'packages/crossvalidate/src/__test_probe_entry7__.ts'
  withPackageFiles(
    CROSSVALIDATE_TSCONFIG,
    {
      [cvEntry]:
        "import { correspondence } from '@nielspeter/eess'\nexport function use(): typeof correspondence { return correspondence }\n",
    },
    cvEntry,
    (_project, entrySf) => {
      // crossvalidate has NO allowlist entry — the same symbol IS required.
      assert.deepEqual(violationNames(entrySf), ['correspondence'])
    },
  )
})

test('KERNEL_INTERNAL symbols are exempt everywhere', () => {
  const body = 'packages/md/src/__test_probe_body8__.ts'
  const entry = 'packages/md/src/__test_probe_entry8__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { selectionMemo } from '@nielspeter/eess'\nexport function use(): typeof selectionMemo { return selectionMemo }\n",
      [entry]: 'export {}\n',
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), [])
    },
  )
})

test('wildcard export * chain resolves the original name (no false positive)', () => {
  // Mirrors packages/mermaid/src/index.ts's real shape (`export * from
  // './core/index.js'`) — a single-hop alias is not the only shape
  // reachableExportNames must resolve. A prior fix attempt (scanning only
  // direct `export { X as Y }` re-exports) broke exactly this chain against
  // the real repo (16 false positives) before landing correctly; this pins
  // the case that broke it as a permanent regression test.
  const wildcardSource = 'packages/md/src/__test_probe_wildcard9__.ts'
  const body = 'packages/md/src/__test_probe_body9__.ts'
  const entry = 'packages/md/src/__test_probe_entry9__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { RuleBuilder } from '@nielspeter/eess'\nexport function use(x: RuleBuilder<never, never>): void {}\n",
      [wildcardSource]: "export { RuleBuilder } from '@nielspeter/eess'\n",
      [entry]: "export * from './__test_probe_wildcard9__.js'\n",
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), [])
    },
  )
})

test('doubly-aliased re-export chain resolves the original name (no false positive)', () => {
  // A kernel symbol re-exported under one alias, then re-exported AGAIN
  // under a second alias one hop further — the alias resolution must
  // survive more than one hop, not just the single-hop case the original
  // finding demonstrated.
  const body = 'packages/md/src/__test_probe_body10__.ts'
  const mid = 'packages/md/src/__test_probe_mid10__.ts'
  const entry = 'packages/md/src/__test_probe_entry10__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { RuleBuilder } from '@nielspeter/eess'\nexport function use(x: RuleBuilder<never, never>): void {}\n",
      [mid]: "export { RuleBuilder as AliasA } from '@nielspeter/eess'\n",
      [entry]: "export { AliasA as AliasB } from './__test_probe_mid10__.js'\n",
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), [])
    },
  )
})

test('wildcard chain still catches a genuinely missing symbol (not blanket-satisfied)', () => {
  // The negative control for the wildcard case above — a wildcard
  // re-export existing at all must not make every possible symbol look
  // satisfied; only the ones actually reachable through it.
  const wildcardSource = 'packages/md/src/__test_probe_wildcard11__.ts'
  const body = 'packages/md/src/__test_probe_body11__.ts'
  const entry = 'packages/md/src/__test_probe_entry11__.ts'
  withPackageFiles(
    MD_TSCONFIG,
    {
      [body]:
        "import { RuleBuilder, not } from '@nielspeter/eess'\nexport function use(x: RuleBuilder<never, never>, y: typeof not): void {}\n",
      [wildcardSource]: "export { RuleBuilder } from '@nielspeter/eess'\n", // not re-exported here
      [entry]: "export * from './__test_probe_wildcard11__.js'\n",
    },
    entry,
    (_project, entrySf) => {
      assert.deepEqual(violationNames(entrySf), ['not'])
    },
  )
})

test('the exclusion lists have ONE source — standalone-surface.test.ts restates nothing', () => {
  // Supersedes the old sync guard, which compared two hand-kept copies by
  // scraping the sibling's source text. Plan 0165 Phase 2 removed the second
  // copy instead: both consumers now import `scripts/lib/kernel-surface.mjs`.
  //
  // So the thing to guard changed. There is no drift to detect any more; what
  // can regress is someone re-introducing a local list, and then the gate and
  // the test would disagree again with nothing watching. This asserts the
  // single-source property directly, in both directions.
  const siblingSrc = readFileSync('packages/ts/tests/standalone-surface.test.ts', 'utf8')
  assert.ok(
    /from '\.\.\/\.\.\/\.\.\/scripts\/lib\/kernel-surface\.mjs'/.test(siblingSrc),
    'standalone-surface.test.ts no longer imports scripts/lib/kernel-surface.mjs — the two ' +
      'exclusion lists are free to drift again',
  )
  for (const name of [
    'KERNEL_INTERNAL',
    'FAMILY_ONLY',
    'ANSI_INTERNAL',
    'KERNEL_PRIVATE_BEFORE_THE_SPLIT',
  ]) {
    assert.ok(
      !new RegExp(`const ${name} = new Set\\(`).test(siblingSrc),
      `standalone-surface.test.ts declares its own ${name} again — import it instead`,
    )
  }
  // And this file reads the shared module rather than a copy of its own.
  assert.ok(
    KERNEL_INTERNAL.size > 0,
    'KERNEL_INTERNAL is empty — the shared import resolved to nothing',
  )
})
