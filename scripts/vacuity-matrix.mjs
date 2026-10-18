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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
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
  // The third id needs its own probe or it is an id nothing proves can fire —
  // bug 0190's shape, in the change that closes 0190. A declaration that cannot
  // expire is not an assertion (ADR-010 §3), so the expiry IS the mechanism that
  // makes `declaredEmpty` admissible at all.
  'finishPreset(declared empty, then examined) [an expired declaration]': () =>
    kernel.finishPreset(kernel.collectResult([], { examined: 3, declaredEmpty: true })),
  // The fourth id, for the same reason as the third. `notRun` is the one flag
  // here that SUPPRESSES — it exempts a member from the merge's dead filter — so
  // an id nothing proves can fire would leave a mute button with no falsifier,
  // which is bug 0190's shape wearing the label of a fix for it.
  'finishPreset(never ran, yet examined) [a contradicted notRun]': () =>
    kernel.finishPreset(kernel.collectResult([], { examined: 5, notRun: true })),
  // The fifth id, for the same reason as the third and fourth: an id nothing
  // proves can fire is bug 0190's shape. This one is also the only cause that
  // must fire THROUGH a declaration — ADR-014 §4's "an empty source outranks any
  // declaration" — so the probe declares it away deliberately. Without that, the
  // probe would pass over a gate that had lost the precedence and kept the id.
  'finishPreset(empty source, declared away) [the precedence §4 states]': () =>
    kernel.finishPreset(
      kernel.collectResult([], { examined: 0, sourceEmpty: true, declaredEmpty: true }),
    ),
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

// --- Sibling dialects (bug 0403) ---
//
// ADR-010's row binds every rule family, and this matrix used to import eess-ts alone. Each sibling's
// check-constructors are probed bare over that dialect's own empty input. Every other exported
// function is either a re-export of a kernel function (recognised by identity; the kernel's own
// check-constructor, `correspondence()`, is probed below) or named in SIBLING_NOT_CONSTRUCTORS with
// a reason. Anything else is an unaccounted export and fails the matrix. Whether a listed export
// really is not a constructor is a reviewer's judgement, which the reason column makes checkable.
// Exported classes (a capitalised name) are skipped: each builder class is reached through its
// factory, which is probed.

// Derived from each sibling package's own exports map, so a new subpath is imported and its
// functions enumerated without anyone listing it. `./internal` is family plumbing behind ADR-011,
// not adopter surface, so it is left out.
/** The nearest `node_modules/@nielspeter` above this script: the family as installed. */
function familyScopeDir() {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = path.join(dir, 'node_modules', '@nielspeter')
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('vacuity-matrix: cannot find node_modules/@nielspeter')
    dir = parent
  }
}
// Every installed family package except the kernel and eess-ts, which the halves above probe. Listed
// from the scope directory, so a new dialect is enumerated without anyone naming it.
const SIBLING_PACKAGES = readdirSync(familyScopeDir())
  .map((d) => `@nielspeter/${d}`)
  .filter((name) => name !== '@nielspeter/eess' && name !== '@nielspeter/eess-ts')
  .sort()
/**
 * A package's own package.json, found the way Node finds the package: the nearest
 * `node_modules/<name>` above this script. Works for a copy run from elsewhere, and for a package
 * with no root (`.`) export, such as eess-crossvalidate.
 */
function packageJsonOf(name) {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name, 'package.json')
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8'))
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error(`vacuity-matrix: cannot find ${name}'s package.json`)
    dir = parent
  }
}
const SIBLING_MODULES = {}
for (const name of SIBLING_PACKAGES) {
  const pkg = packageJsonOf(name)
  for (const sub of Object.keys(pkg.exports ?? { '.': null })) {
    if (sub === './internal') continue
    const spec = sub === '.' ? name : `${name}${sub.slice(1)}`
    SIBLING_MODULES[spec] = await import(spec)
  }
}
const md = SIBLING_MODULES['@nielspeter/eess-md']
const mermaid = SIBLING_MODULES['@nielspeter/eess-mermaid']
const gherkin = SIBLING_MODULES['@nielspeter/eess-gherkin']
const cv = (sub) => SIBLING_MODULES[`@nielspeter/eess-crossvalidate/${sub}`]

// Each dialect's empty input: the zero-file project's own directory, which holds a tsconfig and no
// Markdown or feature file. Derived from VACUITY_TSCONFIG so a mutated copy run from elsewhere
// (scripts/nonvacuity/) reads the same directory.
const EMPTY_DIR = path.dirname(VACUITY_TSCONFIG)
const emptyCorpus = md.corpus({ cwd: EMPTY_DIR, roots: ['**/*.md'] })
const emptyDiagram = mermaid.diagram('classDiagram\n')
const emptyFeatures = gherkin.features({ cwd: EMPTY_DIR, roots: ['**/*.feature'] })
/** A preset that returns a receipt is reported the way a caller reports it. */
const reported = (result) => kernel.finishPreset(result)

/** `export name` → the bare probe. Keys are `package::export`. */
const SIBLING_PROBES = {
  // The kernel's own check-constructor, re-exported by eess-md and eess-crossvalidate: a join of two
  // empty selections. Bug 0477.
  '@nielspeter/eess::correspondence': () => {
    const side = (label) =>
      md.docs(emptyCorpus).select({ label, identify: (d) => ({ name: d.relPath }) })
    kernel
      .correspondence({ left: side('left'), right: side('right') })
      .should()
      .beComplete()
      .check()
  },
  '@nielspeter/eess-md::docs': () => md.docs(emptyCorpus).check(),
  '@nielspeter/eess-md::links': () => md.links(emptyCorpus).check(),
  '@nielspeter/eess-md::pointers': () => md.pointers(emptyCorpus).check(),
  '@nielspeter/eess-md::rows': () => md.rows(emptyCorpus, { columns: { name: /Name/ } }).check(),
  '@nielspeter/eess-md::taskItems': () => md.taskItems(emptyCorpus).check(),
  '@nielspeter/eess-md::terms': () => md.terms(emptyCorpus, { label: /Term:/ }).check(),
  '@nielspeter/eess-md/rules/adr::adrEnforcement': () =>
    SIBLING_MODULES['@nielspeter/eess-md/rules/adr'].adrEnforcement(emptyCorpus),
  '@nielspeter/eess-md/rules/ledger::honestyAtClose': () =>
    SIBLING_MODULES['@nielspeter/eess-md/rules/ledger'].honestyAtClose(emptyCorpus),
  '@nielspeter/eess-mermaid::classes': () => mermaid.classes(emptyDiagram).check(),
  '@nielspeter/eess-gherkin::scenarios': () => gherkin.scenarios(emptyFeatures).check(),
  '@nielspeter/eess-crossvalidate/mermaid-ts::diagramMatchesCode': () =>
    cv('mermaid-ts').diagramMatchesCode(emptyDiagram, zeroFileProject),
  '@nielspeter/eess-crossvalidate/md-ts::adrCitationsResolve': () =>
    cv('md-ts').adrCitationsResolve(emptyCorpus, zeroFileProject),
  '@nielspeter/eess-crossvalidate/md-mermaid::embeddedDiagramsMatchCode': () =>
    reported(cv('md-mermaid').embeddedDiagramsMatchCode(emptyCorpus, zeroFileProject)),
  '@nielspeter/eess-crossvalidate/md-gherkin::scenarioCitationsResolve': () =>
    reported(cv('md-gherkin').scenarioCitationsResolve(emptyCorpus, emptyFeatures)),
  '@nielspeter/eess-crossvalidate/gherkin-ts::scenarioTestsResolve': () =>
    reported(cv('gherkin-ts').scenarioTestsResolve(zeroFileProject, emptyFeatures)),
  '@nielspeter/eess-crossvalidate/gherkin-ts::scenariosCovered': () =>
    reported(cv('gherkin-ts').scenariosCovered(zeroFileProject, emptyFeatures)),
  '@nielspeter/eess-crossvalidate/gherkin-ts::scenarioExemptionsCurrent': () =>
    reported(
      cv('gherkin-ts').scenarioExemptionsCurrent(zeroFileProject, emptyFeatures, {
        isExempt: () => false,
      }),
    ),
  '@nielspeter/eess-crossvalidate/md-mermaid-er::tableErAgree': () =>
    reported(
      cv('md-mermaid-er').tableErAgree(emptyCorpus, {
        table: { section: /Properties/, name: /Name/ },
        entity: () => undefined,
      }),
    ),
}

/**
 * Exported functions that are not check-constructors, each with why it is not probed here. A
 * constructor listed here to dodge the matrix would be a hand-picked exemption, so each reason says
 * what the export is, and where its emptiness is proven if it can be empty at all.
 */
const SIBLING_NOT_CONSTRUCTORS = {
  '@nielspeter/eess-md::corpus': 'input loader: the empty corpus the probes above use',
  '@nielspeter/eess-md::parseCodeBlocks': 'input loader for codeBlocks()',
  '@nielspeter/eess-md::codeBlocks':
    'needs a parser with canaries to construct; its zero-blocks case is check:nonvacuity corpus/code-block-parse/zero-blocks',
  '@nielspeter/eess-md::collectTaskItems': 'model reader, returns task items',
  '@nielspeter/eess-md::haveSection': 'condition factory, used inside a builder',
  '@nielspeter/eess-md::haveTable': 'condition factory, used inside a builder',
  '@nielspeter/eess-md::haveTableRowsSatisfying': 'condition factory, used inside a builder',
  '@nielspeter/eess-md::matchTableRows': 'model reader',
  '@nielspeter/eess-md::presentExternalRoots': 'option helper for pointers().resolve()',
  '@nielspeter/eess-md::resolveLink': 'model reader',
  '@nielspeter/eess-md::vocabulary': 'data builder, returns a term set',
  '@nielspeter/eess-md/rules/ledger::findState': 'model reader',
  '@nielspeter/eess-md/rules/ledger::ledgerStats': 'statistics, not a verdict',
  '@nielspeter/eess-mermaid::diagram': 'input loader: the empty diagram the probes above use',
  '@nielspeter/eess-mermaid::fromDiagram': 'bridge, returns selections for correspondence()',
  '@nielspeter/eess-mermaid::collectClasses': 'model reader',
  '@nielspeter/eess-mermaid::collectEntities': 'model reader',
  '@nielspeter/eess-mermaid::collectErRelationships': 'model reader',
  '@nielspeter/eess-mermaid::collectRelationships': 'model reader',
  '@nielspeter/eess-mermaid::diagramKind': 'model reader',
  '@nielspeter/eess-mermaid::findDirective': 'model reader',
  '@nielspeter/eess-mermaid::mermaidParser': 'parser for eess-md parseCodeBlocks()',
  '@nielspeter/eess-mermaid::parseClassDiagram': 'parser',
  '@nielspeter/eess-mermaid::parseDirectives': 'parser',
  '@nielspeter/eess-mermaid::parseErDiagram': 'parser',
  '@nielspeter/eess-mermaid::validateReferences': 'parser diagnostics over a parsed diagram',
  '@nielspeter/eess-mermaid::createViolation': 'finding constructor for custom conditions',
  '@nielspeter/eess-mermaid::defineConfig': 'CLI configuration helper (identity)',
  '@nielspeter/eess-gherkin::features': 'input loader: the empty feature set the probes above use',
  '@nielspeter/eess-gherkin::parseFeature': 'parser',
  '@nielspeter/eess-crossvalidate/md-ts::adrCitationStats': 'statistics, not a verdict',
  '@nielspeter/eess-crossvalidate/md-mermaid::embeddedDiagramStats': 'statistics, not a verdict',
  '@nielspeter/eess-crossvalidate/files::files': 'selection source for correspondence()',
  '@nielspeter/eess-crossvalidate/md-gherkin::defaultExtract': 'option helper',
  '@nielspeter/eess-crossvalidate/md-gherkin::scenarioCitationStats': 'statistics, not a verdict',
  '@nielspeter/eess-crossvalidate/gherkin-ts::citedScenarioSites': 'model reader',
  '@nielspeter/eess-crossvalidate/gherkin-ts::defaultExtract': 'option helper',
  '@nielspeter/eess-crossvalidate/gherkin-ts::scenarioTestStats': 'statistics, not a verdict',
  '@nielspeter/eess-crossvalidate/md-mermaid-er::tableErStats': 'statistics, not a verdict',
}

/** Every exported function of every sibling subpath, as `package::export`, minus kernel re-exports. */
const kernelFunctions = new Set(Object.values(kernel).filter((v) => typeof v === 'function'))
const siblingExports = Object.entries(SIBLING_MODULES).flatMap(([pkg, mod]) =>
  Object.entries(mod)
    .filter(([, v]) => typeof v === 'function' && !/^[A-Z]/.test(v.name ?? ''))
    .filter(([, v]) => !kernelFunctions.has(v))
    .map(([name]) => `${pkg}::${name}`),
)

/**
 * Known, tracked, dated debt. An entry here suppresses a `fail-open`
 * finding for exactly the named export — every other export must be
 * provably non-vacuous or the matrix fails the build. Remove an entry (or
 * let it expire) the moment the underlying gap is fixed; renew it with a
 * fresh reason if it's still real and still accepted.
 */
const KNOWN_FAIL_OPEN = [
  {
    name: '@nielspeter/eess::correspondence',
    reason: 'bug 0477: a join of two empty selections passes',
    expires: '2026-12-31',
  },
  // Both found the day the matrix first probed the sibling dialects (bug 0403), and both for one
  // reason: `correspondence().beComplete()` carries the cardinality mark, so a join of two empty
  // sides examines nothing and passes. Recorded as bug 0477.
  {
    name: '@nielspeter/eess-crossvalidate/mermaid-ts::diagramMatchesCode',
    reason: 'bug 0477: an empty diagram against a zero-file project passes',
    expires: '2026-12-31',
  },
  {
    name: '@nielspeter/eess-crossvalidate/md-ts::adrCitationsResolve',
    reason: 'bug 0477: an empty corpus against a zero-file project passes',
    expires: '2026-12-31',
  },
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
for (const [name, thunk] of Object.entries(SIBLING_PROBES)) {
  results.push({ name, kind: 'sibling', verdict: classify(thunk) })
}

const today = new Date().toISOString().slice(0, 10)
const knownByName = new Map(KNOWN_FAIL_OPEN.map((e) => [e.name, e]))
const findings = []

// Completeness over the siblings: an export neither probed nor accounted for is a finding, and so is
// an entry in either table that names no export (a stale entry hides nothing, but it lies).
// A sibling probe that throws for an unrelated reason (an option renamed, an input that no longer
// loads) has stopped testing its constructor. That is a finding, not a pass.
for (const r of results.filter((x) => x.kind === 'sibling' && x.verdict === 'other-throw')) {
  findings.push(
    `${r.name} (sibling) threw for a reason other than a configuration finding — the probe no longer reaches its check; fix the probe`,
  )
}
const accounted = new Set(
  [...Object.keys(SIBLING_PROBES), ...Object.keys(SIBLING_NOT_CONSTRUCTORS)].filter(
    (name) => !name.startsWith('@nielspeter/eess::'),
  ),
)
for (const name of siblingExports) {
  if (!accounted.has(name)) {
    findings.push(
      `${name} is exported and neither probed nor listed in SIBLING_NOT_CONSTRUCTORS — probe it if it builds a check, or list it with a reason`,
    )
  }
}
const exported = new Set(siblingExports)
for (const name of accounted) {
  if (!exported.has(name)) findings.push(`${name} is listed but not exported — a stale entry`)
}

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
  "vacuity-matrix · every published check-constructor, probed bare over its dialect's empty input",
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
  `✓ vacuity matrix — ${results.length} exports probed (${Object.keys(BUILDER_PROBES).length} builders + ${Object.keys(PRESET_PROBES).length} presets + ${Object.keys(EMITTER_PROBES).length} emitters + ${Object.keys(SIBLING_PROBES).length} sibling-dialect constructors, ${siblingExports.length} sibling exports accounted for), ${KNOWN_FAIL_OPEN.length} tracked KNOWN_FAIL_OPEN entr${KNOWN_FAIL_OPEN.length === 1 ? 'y' : 'ies'}, 0 unaccounted fail-open`,
)
