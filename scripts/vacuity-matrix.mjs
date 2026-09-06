#!/usr/bin/env node
/**
 * vacuity-matrix.mjs — ADR-010 Enforcement row 1's mechanical proof
 * (plan 0088 Phase 4a): "every published check-constructor is non-vacuous."
 *
 * A hand-maintained list of constructors is exactly the empty-green the ADR
 * exists to prevent, so this derives the list mechanically, three steps
 * (adopted from ts-archunit's plan 0095):
 *
 *   1. Enumerate every check-constructor from @nielspeter/eess-ts's own
 *      published exports map — dist-imported, exactly as a real consumer
 *      resolves the package, not from source. The `./rules/*` subpaths
 *      export bare `Condition` factories (no `.check()`), so they're
 *      correctly skipped by the shape test below, not by a hand-picked
 *      exclusion list — a new subpath added to package.json's exports map
 *      is picked up automatically.
 *   2. Probe each bare — the minimal type-correct call, `.check()` with no
 *      further chaining for builders, the minimal required options for
 *      presets — over a project that loaded zero source files. Three-way
 *      verdict: `fail-open` (passed silently), `other-throw` (threw for an
 *      unrelated reason), `config-finding` (the ADR-010 evidence gate
 *      fired, `bypassFilters: true`). A probe that only distinguishes two of
 *      these would satisfy the self-check below for the wrong reason, so
 *      three control fakes prove each cell.
 *   3. `KNOWN_FAIL_OPEN` — any constructor landing in `fail-open` is either a
 *      real bug (fix it) or a named, dated, tracked debt. It may only
 *      shrink; every entry expires and must be renewed with a fresh reason
 *      or removed.
 *
 * Exit codes:
 *   0 = every non-`KNOWN_FAIL_OPEN` constructor is provably non-vacuous
 *   1 = a constructor landed in fail-open with no ratchet entry, or a
 *       KNOWN_FAIL_OPEN entry has expired
 *   2 = the harness itself is broken (a control fake misclassified) —
 *       nothing about real exports below this point can be trusted
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
// Override lets scripts/nonvacuity/bad-vacuity-matrix.mjs run a mutated COPY
// of this file from a temp directory (a stripped KNOWN_FAIL_OPEN list — real,
// different script content, the same pattern bad-release-e2e.mjs uses with a
// throwaway git repo) while still pointing at the real, co-located fixture.
const VACUITY_TSCONFIG =
  process.env.VACUITY_TSCONFIG_OVERRIDE ??
  path.join(repoRoot, 'packages/ts/tests/fixtures/vacuity/tsconfig.json')

const tsRoot = await import('@nielspeter/eess-ts')
const tsPresets = await import('@nielspeter/eess-ts/presets')
const tsGraphql = await import('@nielspeter/eess-ts/graphql')
// The kernel itself: ADR-014's emitters are the seam the probes below exercise.
const kernel = await import('@nielspeter/eess')
const { project, ArchRuleError } = tsRoot

// --- Classification ---

/**
 * A `.check()` that throws also reports (prints) the violations before
 * throwing — real, useful behavior for an actual consumer, just noise for a
 * probe that only wants the verdict. Silenced for the duration of the call.
 *
 * @returns {'fail-open'|'other-throw'|'config-finding'}
 */
function classify(thunk) {
  const real = {
    error: console.error,
    warn: console.warn,
    stdoutWrite: process.stdout.write,
    stderrWrite: process.stderr.write,
  }
  console.error = () => {}
  console.warn = () => {}
  process.stdout.write = () => true
  process.stderr.write = () => true
  try {
    thunk()
    return 'fail-open'
  } catch (err) {
    if (err instanceof ArchRuleError && err.violations.some((v) => v.bypassFilters === true)) {
      return 'config-finding'
    }
    return 'other-throw'
  } finally {
    console.error = real.error
    console.warn = real.warn
    process.stdout.write = real.stdoutWrite
    process.stderr.write = real.stderrWrite
  }
}

// --- Step 0: harness self-check — three control fakes, one per verdict cell.
// If the classifier can't tell these three apart, nothing below is trustworthy.

function fakeViolation() {
  return { rule: 'fake', element: 'fake', file: '', line: 0, message: 'fake' }
}

const SELF_CHECK = [
  ['fail-open control', () => {}, 'fail-open'],
  [
    'other-throw control',
    () => {
      throw new TypeError('unrelated crash, not an ArchRuleError')
    },
    'other-throw',
  ],
  [
    'config-finding control',
    () => {
      throw new ArchRuleError([{ ...fakeViolation(), bypassFilters: true }])
    },
    'config-finding',
  ],
  [
    // A fourth, adversarial control: an ArchRuleError WITHOUT bypassFilters
    // must NOT be misread as a config-finding — an ordinary rule violation
    // is not evidence the honest-gate fired.
    'ordinary ArchRuleError (no bypassFilters) is other-throw, not config-finding',
    () => {
      throw new ArchRuleError([fakeViolation()])
    },
    'other-throw',
  ],
]

let selfCheckFailed = false
for (const [label, thunk, want] of SELF_CHECK) {
  const got = classify(thunk)
  if (got !== want) {
    console.error(
      `vacuity-matrix: harness self-check FAILED — "${label}" classified as ${got}, wanted ${want}`,
    )
    selfCheckFailed = true
  }
}
if (selfCheckFailed) {
  console.error(
    'vacuity-matrix: the classifier itself is broken — refusing to report on real exports.',
  )
  process.exit(2)
}
console.error(
  `vacuity-matrix: harness self-check — OK (${SELF_CHECK.length} control fakes classified correctly)`,
)

// --- Step 1 + 2: enumerate + probe ---
//
// Declarative, not reflective: each factory has its own minimal-arg shape
// (a project, a project+glob, a bare SDL string, a project+options), so a
// signature-blind auto-caller isn't feasible. The enumeration IS mechanical
// in the sense the ADR asks for — every export in every subpath below is
// accounted for, and the shape test (does the constructed value have
// `.check()`, or is the export itself a preset function) is what decides
// whether something is probed, not a hand-picked "these are the important
// ones" list.

const zeroFileProject = project(VACUITY_TSCONFIG)

/**
 * A NON-EMPTY project — bug 0155's second derivation.
 *
 * Every probe above runs bare over `zeroFileProject`, so each short-circuits
 * at `sourceEmpty` and never reaches the assertion-less gate, which fires only
 * when subjects were actually selected. Probing it needs a corpus with
 * something in it; otherwise that gate's only guard is its own unit-test file.
 */
const nonEmptyProject = project(
  process.env.VACUITY_NONEMPTY_TSCONFIG_OVERRIDE ??
    path.join(repoRoot, 'packages/ts/tests/fixtures/vacuity-nonempty/tsconfig.json'),
)

/** Builder factories: call → get a TerminalBuilder-shaped value → `.check()` bare. */
const BUILDER_PROBES = {
  'classes()': () => tsRoot.classes(zeroFileProject),
  'functions()': () => tsRoot.functions(zeroFileProject),
  'modules()': () => tsRoot.modules(zeroFileProject),
  'calls()': () => tsRoot.calls(zeroFileProject),
  'types()': () => tsRoot.types(zeroFileProject),
  'jsxElements()': () => tsRoot.jsxElements(zeroFileProject),
  'slices()': () => tsRoot.slices(zeroFileProject),
  'resolvers()': () => tsGraphql.resolvers(zeroFileProject, 'src/**/*.resolver.ts'),
  'schema()': () => tsGraphql.schema(zeroFileProject, 'src/**/*.graphql'),
  'schemaFromSDL()': () => tsGraphql.schemaFromSDL('type Query { x: String }'),
  // Bug 0155 — reaches the assertion-less gate, which every zero-file probe
  // above short-circuits past. Bare `.should()` over a corpus that HAS
  // subjects: the rule selects something and asserts nothing.
  'classes() bare .should() over a non-empty corpus': () =>
    tsRoot.classes(nonEmptyProject).that().haveNameEndingWith('Subject').should(),
}

/** Presets: call bare with the minimal required options → they run+report internally. */
/**
 * **Probed BARE, so the probe asks about the DEFAULT.** This is the mode an
 * adopter gets by copying the docs, and it is the mode that silently stopped
 * enforcing.
 *
 * These probes used to pass `report: 'throw'` explicitly, and the reason was
 * recorded here as reasoning: the engine adopted in plan 0165 returned
 * un-executed builders by default, so a bare call constructed rules and ran
 * none — it could not throw, and `classify()` scored all five presets
 * `fail-open`.
 *
 * **The gate was right and was reconfigured to stop saying so.** All five
 * `fail-open` verdicts were correct findings about a real defect; naming the
 * mode made them go away, and plan 0165 booked the silencing as the fix
 * (`check:vacuity ✗ 5 presets fail-open → green`). The defect then shipped and
 * survived until two reviewers found it by hand in PR #72. Commit `9695ce7`
 * restored the default; this probe was not restored with it, so the gate stayed
 * blind to a recurrence of the branch's own headline bug — measured: byte-identical
 * green with the regression fully reintroduced. Found by the enforcement review.
 *
 * **A preset that constructs NOTHING no longer scores `fail-open` here**, and
 * the history is worth keeping. This paragraph used to read "`finishPreset([],
 * …)` has nothing to throw about … that is `presetConstructsNothingViolation`'s
 * case and it must stay detectable" — of a kernel constructor that had **no call
 * site anywhere** (bug 0190). The sentence asserted a mechanism nothing ran.
 *
 * It is now true rather than aspirational: the constructor was deleted (plan
 * 0235 Phase 0) and ADR-014 makes the emitter itself refuse an evidence-free
 * verdict, so `finishPreset([])` throws a configuration finding. The
 * `EMITTER_PROBES` below assert exactly that, which is what moved this from a
 * claim to a check.
 *
 * One explicit-mode probe is kept below so `report: 'throw'` does not become
 * untested by moving the others onto the default.
 */
/**
 * The EMITTER probes — plan 0235 / ADR-014.
 *
 * The matrix's other probes call a published constructor and ask what it reports
 * over a zero-file project. These ask a different question, at the seam ADR-014
 * added: what does an emitter do with a value nobody minted?
 *
 * Added because this file's own comment said the case "must stay detectable" of
 * a helper that had no call site at all (bug 0190) — a claim the matrix could
 * not check, because `finishPreset` is a REPORTER and the enumeration walks
 * check-CONSTRUCTORS. Proposal 009's field failure came through exactly that
 * gap: a consumer importing eess's types and its printer and never a builder.
 *
 * `classify()` reads a thrown `ArchRuleError` as `fails`, which is what these
 * must do — an evidence-free verdict is a configuration finding on every path.
 */
const EMITTER_PROBES = {
  'finishPreset(bare array) [hand-assembled, no evidence]': () => kernel.finishPreset([]),
  'reportViolations(bare array) [hand-assembled, no evidence]': () => kernel.reportViolations([]),
  'finishPreset(receipt examining zero) [the loop that never ran]': () =>
    kernel.finishPreset(kernel.collectResult([], { examined: 0 })),
}

const PRESET_PROBES = {
  'recommended() [default delivery]': () => tsPresets.recommended(zeroFileProject, {}),
  'agentGuardrails() [default delivery]': () =>
    tsPresets.agentGuardrails(zeroFileProject, { src: 'src/**' }),
  'layeredArchitecture() [default delivery]': () =>
    tsPresets.layeredArchitecture(zeroFileProject, {
      layers: { outer: 'src/outer/**', inner: 'src/inner/**' },
    }),
  'dataLayerIsolation() [default delivery]': () =>
    tsPresets.dataLayerIsolation(zeroFileProject, { repositories: 'src/repositories/**' }),
  'strictBoundaries() [default delivery]': () =>
    tsPresets.strictBoundaries(zeroFileProject, { folders: 'src/*' }),
  // The named mode, so moving the five above onto the default does not leave
  // `report: 'throw'` untested.
  "recommended() [report: 'throw']": () =>
    tsPresets.recommended(zeroFileProject, { report: 'throw' }),
}

/**
 * Known, tracked, dated debt. An entry here suppresses a `fail-open`
 * finding for exactly the named export — every other export must be
 * provably non-vacuous or the matrix fails the build. Remove an entry (or
 * let it expire) the moment the underlying gap is fixed; renew it with a
 * fresh reason if it's still real and still accepted.
 */
const KNOWN_FAIL_OPEN = [
  // Empty — and it should stay that way. The single entry that lived here,
  // `schemaFromSDL()`, described bug 0155 verbatim: called bare it "hits
  // RuleBuilder's own 'predicates but no conditions' assertion-less path
  // (console.warn'd, not silent, but not a thrown finding either) and passes",
  // filed as no bug and dated to expire 2026-11-15. Bug 0155 filed it and
  // fixed it — an assertion-less rule is now a configuration finding in every
  // builder — so the exemption is retired rather than renewed.
]

function checkExpiry(entry, today) {
  return entry.expires < today
}

// --- Run ---

const results = []
for (const [name, thunk] of Object.entries(BUILDER_PROBES)) {
  results.push({ name, kind: 'builder', verdict: classify(() => thunk().check()) })
}
for (const [name, thunk] of Object.entries(PRESET_PROBES)) {
  results.push({ name, kind: 'preset', verdict: classify(thunk) })
}
for (const [name, thunk] of Object.entries(EMITTER_PROBES)) {
  results.push({ name, kind: 'emitter', verdict: classify(thunk) })
}

const today = new Date().toISOString().slice(0, 10)
const knownByName = new Map(KNOWN_FAIL_OPEN.map((e) => [e.name, e]))
const findings = []

for (const r of results) {
  if (r.verdict !== 'fail-open') continue
  const known = knownByName.get(r.name)
  if (!known) {
    findings.push(
      `${r.name} (${r.kind}) is fail-open with no KNOWN_FAIL_OPEN entry — a rule that cannot fail is worth less than no rule`,
    )
    continue
  }
  if (checkExpiry(known, today)) {
    findings.push(
      `${r.name} (${r.kind}) is fail-open and its KNOWN_FAIL_OPEN entry expired ${known.expires} — renew with a fresh reason or fix it`,
    )
  }
}

// A KNOWN_FAIL_OPEN entry naming an export that ISN'T actually fail-open
// (or doesn't exist at all) is exactly the stale-exclusion hazard this
// repo's own arch gates already watch for — the ratchet must only shrink
// against real, current fail-open findings, never accumulate dead weight.
const probedNames = new Set(results.map((r) => r.name))
for (const known of KNOWN_FAIL_OPEN) {
  if (!probedNames.has(known.name)) {
    findings.push(
      `KNOWN_FAIL_OPEN entry "${known.name}" does not match any probed export — stale ratchet entry`,
    )
    continue
  }
  const r = results.find((x) => x.name === known.name)
  if (r.verdict !== 'fail-open') {
    findings.push(
      `KNOWN_FAIL_OPEN entry "${known.name}" is stale — it is now ${r.verdict}, not fail-open. Remove the entry.`,
    )
  }
}

console.error('')
console.error(
  'vacuity-matrix · every published eess-ts check-constructor, probed bare over a zero-file project',
)
console.error('')
for (const r of results) {
  const marker = r.verdict === 'config-finding' ? '✓' : r.verdict === 'fail-open' ? '✗' : '·'
  console.error(`  ${marker} ${r.name.padEnd(24)} ${r.kind.padEnd(8)} ${r.verdict}`)
}
console.error('')

if (findings.length > 0) {
  console.error(
    `✗ vacuity matrix — ${findings.length} finding(s) across ${results.length} probed exports`,
  )
  for (const f of findings) console.error(`  - ${f}`)
  process.exit(1)
}

console.error(
  `✓ vacuity matrix — ${results.length} exports probed (${Object.keys(BUILDER_PROBES).length} builders + ${Object.keys(PRESET_PROBES).length} presets + ${Object.keys(EMITTER_PROBES).length} emitters), ${KNOWN_FAIL_OPEN.length} tracked KNOWN_FAIL_OPEN entr${KNOWN_FAIL_OPEN.length === 1 ? 'y' : 'ies'}, 0 unaccounted fail-open`,
)
