import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createJiti } from 'jiti'
import { ArchRuleError, isArchRuleError } from '@nielspeter/eess'

/**
 * What actually decides whether a rule file shares the kernel with its CLI.
 *
 * ADR-015 rests on one fact about module identity, and the first version of that
 * ADR got it wrong. It said a rule file loaded through `jiti` "gets jiti's own
 * module registry, so the copy of the dialect it imports is a different instance
 * from the CLI's", and used that to reject widening the jiti fallback. An
 * architecture review measured it and the premise was false, so this file pins
 * what is true instead of repeating what was assumed.
 *
 * **The split is a property of installation topology, not of the loader.** Under
 * `jiti` 2.7.0 the transpiled rule file is jiti's; every bare specifier it names
 * resolves to the same instance the host already holds. A second physical copy
 * of the kernel — a nested or duplicated install — splits it, and would split it
 * just as thoroughly under a native `import()`.
 *
 * That matters for two decisions. It removes the registry from the reasons to
 * prefer native loading (the durable reason is that the loader decides which
 * PROGRAMS are valid rule files — jiti accepts TypeScript syntax Node's
 * strip-only mode refuses). And it keeps `isArchRuleError` in
 * `packages/core/src/errors.ts` justified, because the duplicate-install case is
 * real and no loader choice fixes it.
 *
 * If `jiti` ever changes, the first case here reds, and ADR-015's reasoning has
 * to be re-derived rather than silently drifting.
 */

const dirs = []
function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), 'eess-registry-'))
  dirs.push(dir)
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'probe', type: 'module' }))
  mkdirSync(path.join(dir, 'node_modules/@nielspeter'), { recursive: true })
  const repo = path.resolve(import.meta.dirname, '../..')
  symlinkSync(path.join(repo, 'node_modules/jiti'), path.join(dir, 'node_modules/jiti'))
  symlinkSync(path.join(repo, 'packages/core'), path.join(dir, 'node_modules/@nielspeter/eess'))
  return dir
}

test.after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

test('jiti does not split the kernel — one install, one instance', async () => {
  const dir = scratch()
  writeFileSync(
    path.join(dir, 'rules.ts'),
    "import { ArchRuleError } from '@nielspeter/eess'\nexport const Theirs = ArchRuleError\n",
  )
  const mod = await createJiti(import.meta.url).import(path.join(dir, 'rules.ts'))
  // Both-undefined would satisfy `equal`; assert it is a class first.
  assert.equal(typeof mod.Theirs, 'function', 'the rule file exported no class')
  assert.equal(
    mod.Theirs,
    ArchRuleError,
    'a jiti-loaded rule file resolved the kernel to a different instance — ' +
      "ADR-015's reasoning about which loader to prefer was re-derived on the " +
      'opposite finding and must be revisited, not patched',
  )
  assert.ok(new mod.Theirs([]) instanceof ArchRuleError, 'instanceof must hold across jiti')
})

test('fresh mode does not split it either — the watch path', async () => {
  // `load-rules.ts` and `import-rule-module.ts` both pass these options when
  // watching, and a per-run registry there would be the same hazard by another
  // route.
  const dir = scratch()
  writeFileSync(
    path.join(dir, 'rules.ts'),
    "import { ArchRuleError } from '@nielspeter/eess'\nexport const Theirs = ArchRuleError\n",
  )
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  const mod = await jiti.import(path.join(dir, 'rules.ts'))
  assert.equal(typeof mod.Theirs, 'function', 'the rule file exported no class')
  assert.equal(mod.Theirs, ArchRuleError, 'fresh mode split the kernel')
})

test('a duplicate install DOES split it, whatever the loader', async () => {
  // The control, and the reason `isArchRuleError` is structural rather than an
  // `instanceof`. Without this the case above could pass because the probe was
  // incapable of observing a split at all.
  const dir = scratch()
  const nested = path.join(dir, 'rules/node_modules/@nielspeter')
  mkdirSync(nested, { recursive: true })
  cpSync(path.resolve(import.meta.dirname, '../../packages/core'), path.join(nested, 'eess'), {
    recursive: true,
  })
  writeFileSync(
    path.join(dir, 'rules/r.ts'),
    "import { ArchRuleError } from '@nielspeter/eess'\nexport const Theirs = ArchRuleError\n",
  )
  const mod = await createJiti(import.meta.url).import(path.join(dir, 'rules/r.ts'))
  // Positively, BEFORE the inequality: `assert.notEqual(undefined, X)` passes,
  // so a failed copy or a throwing import would otherwise read as a genuine
  // split and this control would certify a probe that observed nothing.
  assert.equal(typeof mod.Theirs, 'function', 'the nested copy did not load a class')
  assert.notEqual(mod.Theirs, ArchRuleError, 'a second physical copy resolved to the same instance')
  const foreign = new mod.Theirs([])
  assert.ok(
    foreign instanceof mod.Theirs && !(foreign instanceof ArchRuleError),
    'the two classes are distinct objects but instanceof does not separate them',
  )
  // The point of the whole case: this object is exactly what `isArchRuleError`
  // is structural FOR, and a testing review noticed the case built it and threw
  // it away without ever asking the predicate. `instanceof` says no above; the
  // predicate must say yes, or the kernel's reason for being structural is
  // asserted nowhere in the repository.
  assert.equal(
    isArchRuleError(foreign),
    true,
    'isArchRuleError did not recognise an error from a second physical copy of ' +
      'the kernel — which is the one case it is structural for',
  )
})
