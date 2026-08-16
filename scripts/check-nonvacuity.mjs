#!/usr/bin/env node
/**
 * NON-VACUITY HARNESS (plan 0060 Phase 6).
 *
 * A dogfood gate that passes because it inspects nothing (green-but-empty) is
 * worse than no gate: it manufactures false confidence. This harness proves that
 * every FIXTURE below fails when fed deliberately-violating input (bug 0127:
 * "every gate actually FAILS" over-claimed — most fixtures prove their own
 * condition fires or a shipped preset fires over a hand-built fixture corpus,
 * not that the real `check:*` invocation invokes it. `arch`, `internal arch`,
 * `baseline`, `release/gate-fails-the-build` (bug 0106), and — since bug 0127
 * — `corpus/links/*` and `corpus/pointers` genuinely drive the production
 * script or CLI; everything else is one tier weaker. Neither the per-row
 * output nor "N fixtures fired" below distinguishes the two — read the tier
 * from this list, not from a fixture having exited 1).
 * Each gate is run against a hand-crafted bad input and asserted to exit 1 (and,
 * where possible, to name the specific rule that fired).
 *
 * Gate → violating input → rule that must fire:
 *   arch          packages/core/src/__nonvacuity_probe__.ts imports the raw
 *                 `typescript` compiler API → eess/adr002-no-raw-typescript.
 *   internal arch packages/core/src/__nonvacuity_probe_catch__.ts has a silent
 *                 `catch {}` → eess/no-silent-catch. (This gate has in-flight
 *                 violations from other agents; the clean direction is reported
 *                 informationally, not asserted.)
 *   baseline      packages/core/src/__nonvacuity_probe_eval__.ts has a function
 *                 calling `eval()` → preset/recommended/no-eval (the shipped
 *                 `recommended` preset run against our source by check:baseline).
 *   diagram       scripts/nonvacuity/bad-diagram.mmd has a class with no
 *                 <<kernel>> stereotype → diagram/kernel-stereotype.
 *   spec          scripts/nonvacuity/bad-spec.rules.ts → spec/nonvacuity-probe.
 *   crossval      scripts/nonvacuity/ghost-diagram.mmd declares a class absent
 *                 from the kernel code → crossval/diagram-completeness, in the
 *                 diagram→code direction specifically.
 *   crossval/gk   the gherkin-ts `red` fixture project cites scenarios absent
 *                 from the feature set → crossval/scenario-tests-resolve.
 *   crossval/md-gherkin (plan 0096)
 *                 scripts/nonvacuity/bad-md-gherkin/cites-missing-scenario.md
 *                 cites a real feature file with a scenario title absent from
 *                 it → crossval/scenario-citations-resolve, the title-missing
 *                 submode specifically.
 *   crossval/md-mermaid (plan 0096)
 *                 scripts/nonvacuity/bad-md-mermaid/{drifted,emptied}-diagram.md
 *                 declare a class absent from packages/core and a content-free
 *                 classDiagram fence respectively → crossval/embedded-diagram,
 *                 the leftUnmatched and rightUnmatched submodes.
 *   corpus/adr    scripts/nonvacuity/bad-adr/adr/999-bad.md declares tier 9 →
 *                 adr/valid-tiers.
 *   corpus/links/site, corpus/links/repo-native (production script — bug 0127)
 *                 a probe planted under docs/ and under work/bugs/ respectively
 *                 links a missing file, and the PRODUCTION `scripts/check-corpus.mjs`
 *                 is run BOTH ways — `--format json` for `firedOn`'s rule+file
 *                 identity, and the real no-flags invocation CI runs, asserted
 *                 on its exit code too (not just the JSON branch's own separate
 *                 exit) — → corpus/broken-links, one row per routing region bug
 *                 0086 split `broken` into.
 *   corpus/pointers (production script — bug 0127)
 *                 a probe cites a line that does not exist and the PRODUCTION
 *                 `scripts/check-corpus.mjs` is run both ways, same as above →
 *                 corpus/pointers-resolve.
 *   corpus/proposal-plan-linkage, corpus/proposal-ruling-unparseable,
 *   corpus/proposal-implements-discriminates, corpus/plan-implements-unparseable,
 *   corpus/plan-implements-unresolved (production script — bug 0141 / plan 0142)
 *                 ephemeral probes under work/proposals/ and work/plans/, the
 *                 real `scripts/check-corpus.mjs` run both ways, same shape as
 *                 corpus/links/pointers above → corpus/accepted-proposal-uncited,
 *                 corpus/proposal-ruling-unparseable, the prose-vs-declared
 *                 discrimination, corpus/plan-implements-unparseable,
 *                 corpus/plan-implements-unresolved. (Omitted from this table
 *                 when first added — found again, fixed here, plan 0145.)
 *   corpus/proposal-ruling-module (bug 0141 / plan 0142)
 *                 direct assertions on scripts/lib/proposal-ruling.mjs's own
 *                 exports — one tier weaker (proves the module, not that
 *                 check-corpus.mjs invokes it; the five rows above cover that).
 *   crossval/scenario-exemption-stale, crossval/scenarios-covered-e2e
 *   (production script — proposal 005 / plan 0145)
 *                 a throwaway specs/ directory per scenario, the real
 *                 `scripts/check-crossval.mjs` pointed at it via
 *                 EESS_CROSSVAL_GHERKIN_ROOT and run both ways, same shape as
 *                 corpus/links/pointers above → crossval/scenario-exemption-stale,
 *                 crossval/scenarios-covered (closing one of bug 0112's three
 *                 named rows).
 *   review-harness  scripts/nonvacuity/bad-review-harness/ carries foreign-project
 *                 tokens → check-review-harness.mjs.
 *   work/numbers  scripts/nonvacuity/bad-numbers/ claims one number in two lanes
 *                 → kit/scripts/next-number.mjs --check.
 *   release       scripts/nonvacuity/bad-release.mjs drives the release gate's
 *                 pure core with a changed-but-undeclared package and a
 *                 changeset naming a package that does not exist →
 *                 release/changed-package-needs-changeset +
 *                 release/changeset-names-real-package. Synthetic inputs, no git:
 *                 the diff half is the impure shell in check-release.mjs, and its
 *                 failure mode is a hard error on an unresolvable base ref rather
 *                 than a silent green.
 *   vacuity-matrix (plan 0088 Phase 4a)
 *                 scripts/nonvacuity/bad-vacuity-matrix.mjs runs a mutated COPY
 *                 of the real scripts/vacuity-matrix.mjs with its KNOWN_FAIL_OPEN
 *                 ratchet stripped to `[]`, turning schemaFromSDL()'s already-
 *                 real, already-ratcheted fail-open into an unratcheted one →
 *                 the mutated matrix must exit 1 naming exactly that export.
 *
 * THE FIXTURE CONTRACT (bug 0109). A node fixture must print its own
 * `bad-<name>:` sentinel on EVERY exit path, and exit 1 only for the specific
 * violation its gate is named for — 2 for any unexpected error, 0 when it found
 * nothing. `gateNode` disbelieves an exit code that arrives without the
 * sentinel, because node also exits 1 on an unhandled throw, a syntax error and
 * a failed module resolution; and a top-level import resolves before the
 * fixture's own try/catch, so only the harness can prove the fixture ran. Where
 * a preset bundles several checks, "it threw" is not enough either: assert the
 * violation's `ruleId` (and, for a two-directional check, its direction), or the
 * gate stays green when the rule it names is deleted.
 *
 * The fixture must also PRINT that identifier — `gateNode`'s second argument is
 * asserted against the output, not just displayed (bug 0110), so a fixture that
 * exits 1 for some other reason cannot answer for the gate it is listed under.
 *
 * `harness self-check` and `gate coverage` are instruments, not measurements.
 * The first feeds gateNode four bad stubs — three that crash without printing a
 * sentinel, one that runs cleanly and exits 1 for the WRONG rule — and requires
 * every one to be REJECTED (liveness and identity, proven separately). The
 * second asserts that every `check:*` in package.json has a gate row or a stated
 * waiver, so deleting a row can no longer be a silent, green change. Both are
 * excluded from the gate count so the denominator stays honest.
 *
 * The four probe files are ephemeral: created just before their run, deleted in a
 * finally block, and swept at startup so a prior crash can never leave one in
 * packages/core/src or scripts/nonvacuity/. Everything else is a committed
 * fixture under scripts/nonvacuity/. Uses only node builtins + the workspace
 * packages.
 *
 * Run: `node scripts/check-nonvacuity.mjs` (`npm run check:nonvacuity`, and in
 * the `validate` chain). Exits 0 iff every fixture fired on its violating input.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const EESS_TS = join(repoRoot, 'node_modules', '.bin', 'eess-ts')
const EESS_MERMAID = join(repoRoot, 'node_modules', '.bin', 'eess-mermaid')

const PROBE_ARCH = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe__.ts')
const PROBE_CATCH = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe_catch__.ts')
const PROBE_EVAL = join(repoRoot, 'packages', 'core', 'src', '__nonvacuity_probe_eval__.ts')
// Bug 0127: corpus/links must prove BOTH routing regions (bug 0086's
// site-vs-repo-native split), and corpus/pointers must drive the production
// script — not a private rebuilt copy. One probe per region/rule, planted in
// real corpus roots (never packages/*/src, so these never collide with the
// three probes above). Distinct basenames per probe (review found on this fix
// itself, 2026-08-14): with a shared basename, `firedOn`'s fragment match
// can't tell which region a violation came from — sound only because the two
// probes are never co-present, a fact three separate reviewers independently
// flagged as circumstantial rather than structural.
const PROBE_CORPUS_LINK_SITE = join(repoRoot, 'docs', '__nonvacuity_probe_site__.md')
const PROBE_CORPUS_LINK_REPO = join(repoRoot, 'work', 'bugs', '__nonvacuity_probe_repo__.md')
const PROBE_CORPUS_POINTER = join(repoRoot, 'docs', '__nonvacuity_probe_pointer__.md')
// Plan 0142 (closing bug 0141): no leading digits in the basename — unlike
// the real 001-005 proposals, so proposalNumberFromPath() can never collide
// with a real proposal number (testing review's fixture-numbering finding).
const PROBE_CORPUS_PROPOSAL_UNCITED = join(
  repoRoot,
  'work',
  'proposals',
  '__nonvacuity_probe_proposal__.md',
)
const PROBE_CORPUS_RULING_UNPARSEABLE = join(
  repoRoot,
  'work',
  'proposals',
  '__nonvacuity_probe_ruling__.md',
)
// A second pair, digit-bearing on purpose (9001) — unlike the two probes
// above, this one must exercise the real number-keyed join, not the
// null-key fallback (branch review, architect M7).
const PROBE_CORPUS_PROPOSAL_MATCHED = join(
  repoRoot,
  'work',
  'proposals',
  '__nonvacuity_probe_9001-matched__.md',
)
const PROBE_CORPUS_PLAN_IMPLEMENTS = join(
  repoRoot,
  'work',
  'plans',
  '__nonvacuity_probe_implements__.md',
)
// Second-round branch review (architect, customer, enforcement — all three,
// enforcement by mutation): the two checks added in the FIRST fix round
// (corpus/plan-implements-unparseable, corpus/plan-implements-unresolved)
// shipped with no non-vacuity coverage at all — gateCoverage() asserts
// per-script, not per-rule-id, so a new rule inside an already-covered
// script is invisible to it. Deleting either check's spread from `problems`
// left check:nonvacuity green. These two probes close that.
const PROBE_CORPUS_PLAN_IMPLEMENTS_UNPARSEABLE = join(
  repoRoot,
  'work',
  'plans',
  '__nonvacuity_probe_implements_unparseable__.md',
)
const PROBE_CORPUS_PLAN_IMPLEMENTS_UNRESOLVED = join(
  repoRoot,
  'work',
  'plans',
  '__nonvacuity_probe_implements_unresolved__.md',
)

/** Run a command from the repo root and capture combined stdout+stderr + exit code. */
function sh(cmd, args) {
  // Force deterministic terminal-format output from the child CLIs: under
  // GitHub Actions, `--format auto` switches to `::error` annotations whose
  // text differs from the terminal renderer (e.g. it never contains the
  // literal "silent catch" phrase gateInternalArch greps for), so this
  // meta-check failed in CI while passing locally. The gates assert on output
  // substrings, so the child format must not vary by environment.
  const env = { ...process.env }
  delete env.GITHUB_ACTIONS
  delete env.CI
  const r = spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', env })
  if (r.error) return { code: 2, out: String(r.error.message), stdout: '', stderr: '' }
  // status is null when the process was killed by a signal — treat as harness error.
  const stdout = r.stdout ?? ''
  const stderr = r.stderr ?? ''
  // `out` is the merged view (for prose assertions); stdout is kept separate so a
  // gate can JSON.parse it — the CLIs put machine output on stdout and their
  // scan summaries on stderr (bug 0110).
  return { code: r.status ?? 2, out: stdout + stderr, stdout, stderr }
}

/**
 * Violations from a CLI run with `--format json`.
 *
 * `eess-ts check --format json` emits ONE pretty-printed document per failing
 * rule, concatenated — a JSON *stream*, not a document, so `JSON.parse` on the
 * whole of stdout throws as soon as two rules fail. Accumulate lines and parse
 * at each top-level `}`. Returns [] when nothing parses, which fails the
 * caller's assertion — the safe direction.
 */
function violationsOf(r) {
  const out = []
  let buf = ''
  for (const line of (r.stdout ?? '').split('\n')) {
    if (buf === '' && line.trim() === '') continue
    buf += buf === '' ? line : '\n' + line
    if (line === '}') {
      try {
        const doc = JSON.parse(buf)
        out.push(...(Array.isArray(doc) ? doc : (doc?.violations ?? [])))
        buf = ''
      } catch {
        // not a complete document yet — keep accumulating
      }
    }
  }
  return out
}

/** True when ONE violation carries both the rule and (optionally) the file. */
function firedOn(r, ruleId, fileFragment) {
  return violationsOf(r).some(
    (v) =>
      v?.ruleId === ruleId &&
      (fileFragment === undefined || String(v?.file ?? '').includes(fileFragment)),
  )
}

/** Write a probe file, run `fn`, and always delete the probe afterward. */
function withProbe(path, contents, fn) {
  try {
    writeFileSync(path, contents)
    return fn()
  } finally {
    rmSync(path, { force: true })
  }
}

// Sweep any leftover probes before doing anything — they must never survive.
rmSync(PROBE_ARCH, { force: true })
rmSync(PROBE_CATCH, { force: true })
rmSync(PROBE_EVAL, { force: true })
rmSync(PROBE_CORPUS_LINK_SITE, { force: true })
rmSync(PROBE_CORPUS_LINK_REPO, { force: true })
rmSync(PROBE_CORPUS_POINTER, { force: true })
rmSync(PROBE_CORPUS_PROPOSAL_UNCITED, { force: true })
rmSync(PROBE_CORPUS_RULING_UNPARSEABLE, { force: true })
rmSync(PROBE_CORPUS_PROPOSAL_MATCHED, { force: true })
rmSync(PROBE_CORPUS_PLAN_IMPLEMENTS, { force: true })
rmSync(PROBE_CORPUS_PLAN_IMPLEMENTS_UNPARSEABLE, { force: true })
rmSync(PROBE_CORPUS_PLAN_IMPLEMENTS_UNRESOLVED, { force: true })

// --- Gate: arch (root cross-package rules) ---
function gateArch() {
  const bad = withProbe(
    PROBE_ARCH,
    "import ts from 'typescript'\nexport const k = ts.SyntaxKind.ClassDeclaration\n",
    () => sh(EESS_TS, ['check', 'arch.rules.ts', '--format', 'json']),
  )
  // ONE violation must carry both the probe file and the rule. Two independent
  // substrings anywhere in the output could come from different findings — an
  // unrelated ADR-002 violation elsewhere would have satisfied the old check
  // (bug 0110).
  const ok = bad.code === 1 && firedOn(bad, 'eess/adr002-no-raw-typescript', '__nonvacuity_probe__')
  // Clean direction is a bonus proof that the gate is not always-red (informational).
  const clean = sh(EESS_TS, ['check', 'arch.rules.ts'])
  const cleanNote = clean.code === 0 ? 'clean → green' : `clean → exit ${clean.code} (in-flight)`
  return { ok, detail: `bad → exit ${bad.code} (eess/adr002-no-raw-typescript) · ${cleanNote}` }
}

// --- Gate: internal arch (intra-package rules) ---
function gateInternalArch() {
  const bad = withProbe(
    PROBE_CATCH,
    "export function probe() {\n  try {\n    JSON.parse('x')\n  } catch {}\n}\n",
    () => sh(EESS_TS, ['check', 'arch.internal.rules.ts', '--format', 'json']),
  )
  // Exit 1 alone is weak here (in-flight violations exist), so require the rule
  // to have fired ON THE PROBE — one record with both. Was a grep for the rule's
  // rendered description, which any rewording would have broken (bug 0110).
  const ok = bad.code === 1 && firedOn(bad, 'eess/no-silent-catch', '__nonvacuity_probe_catch__')
  const clean = sh(EESS_TS, ['check', 'arch.internal.rules.ts'])
  const cleanNote =
    clean.code === 0
      ? 'clean → green (both directions proven)'
      : 'clean → in-flight (other agents still fixing violations)'
  return { ok, detail: `bad → exit ${bad.code} (eess/no-silent-catch on probe) · ${cleanNote}` }
}

// --- Gate: baseline (the shipped `recommended` preset via check:baseline) ---
function gateBaseline() {
  const bad = withProbe(PROBE_EVAL, "export function probe() {\n  return eval('1 + 1')\n}\n", () =>
    sh(process.execPath, [join('scripts', 'check-baseline.mjs'), '--format', 'json']),
  )
  // One record carrying both the probe file and the rule id. This used to assert
  // the rule's rendered *description* ("call to 'eval'") because check-baseline
  // had no --format flag; it now has one (bug 0110), so no gate keys on prose.
  const ok =
    bad.code === 1 && firedOn(bad, 'preset/recommended/no-eval', '__nonvacuity_probe_eval__')
  // Clean direction is a bonus proof the gate is not always-red, and it is
  // DELIBERATELY informational: `cleanNote` never enters `ok`, so a genuine
  // `recommended` violation in packages/*/src leaves this row green. That is
  // correct division of labour and stated rather than discovered (bug 0129) —
  // this row's job is "the gate can fail"; catching a real violation is
  // `check:baseline`'s, and that runs in CI as of 0129's fix.
  const clean = sh(process.execPath, [join('scripts', 'check-baseline.mjs')])
  const cleanNote = clean.code === 0 ? 'clean → green' : `clean → exit ${clean.code}`
  return {
    ok,
    detail: `bad → exit ${bad.code} (preset/recommended/no-eval on probe) · ${cleanNote}`,
  }
}

// --- Gate: diagram (eess-mermaid) ---
function gateDiagram() {
  // --format json so the ruleId is literally present: `/violation/i` matched any
  // output containing the word, and never checked which rule fired (bug 0109).
  const r = sh(EESS_MERMAID, [
    'check',
    'scripts/nonvacuity/bad-diagram.rules.ts',
    '--format',
    'json',
  ])
  const ok = r.code === 1 && firedOn(r, 'diagram/kernel-stereotype')
  return { ok, detail: `exit ${r.code} (diagram/kernel-stereotype)` }
}

// --- Gate: spec (eess-ts running a cross-dialect spec↔code correspondence) ---
function gateSpec() {
  // --format json so the ruleId is literally present (terminal format prints the
  // rule description, not the id).
  const r = sh(EESS_TS, ['check', 'scripts/nonvacuity/bad-spec.rules.ts', '--format', 'json'])
  const ok = r.code === 1 && firedOn(r, 'spec/nonvacuity-probe')
  return { ok, detail: `exit ${r.code} (spec/nonvacuity-probe)` }
}

// --- Gate: corpus/links (both regions) and corpus/pointers ---
// Bug 0127: `bad-links.mjs`/`bad-pointers.mjs` rebuilt their own rule with
// their own id, proving only that the underlying condition fires over a
// fixture corpus built by hand — nothing bound it to the production script.
// These plant a probe in the real corpus and run `scripts/check-corpus.mjs`
// itself.
//
// Two runs, not one — found on THIS fix by three independent reviewers,
// 2026-08-14. `--format json` returns through its own early exit
// (`check-corpus.mjs:141-145`); the terminal path CI actually runs
// (`"check:corpus": "node scripts/check-corpus.mjs"`, no flags) computes
// failure separately and exits at `:201`. A gate that only ever passes
// `--format json` proves the violation-collection logic, never the exit
// statement that makes the script a gate — the exact shell/core split bug
// 0106 already named on `check:release` (see `release/gate-fails-the-build`
// below). Measured: deleting `check-corpus.mjs:201` alone left all three
// corpus rows green while `npm run check:corpus` printed a real violation and
// exited 0. So the json run is for `firedOn`'s machine-readable rule+file
// identity; the terminal run is the one that actually asserts CI's exit code
// — it replaces the old purely-informational `clean` direction, since a
// second real assertion is worth more than a decorative one.
function gateCorpusProbe(probePath, probeContent, ruleId, fileFragment) {
  const { json, terminal } = withProbe(probePath, probeContent, () => ({
    json: sh(process.execPath, [join('scripts', 'check-corpus.mjs'), '--format', 'json']),
    terminal: sh(process.execPath, [join('scripts', 'check-corpus.mjs')]),
  }))
  const ok = json.code === 1 && firedOn(json, ruleId, fileFragment) && terminal.code === 1
  return {
    ok,
    detail: `bad → json exit ${json.code}, terminal exit ${terminal.code} (${ruleId}, ${fileFragment})`,
  }
}

const CORPUS_PROBE_LINK_MD =
  '# Non-vacuity probe\n\nSee the [missing page](./__nonvacuity_does_not_exist__.md).\n'

function gateCorpusLinksSite() {
  return gateCorpusProbe(
    PROBE_CORPUS_LINK_SITE,
    CORPUS_PROBE_LINK_MD,
    'corpus/broken-links',
    'docs/__nonvacuity_probe_site__.md',
  )
}

// The other half of the same split — `broken` unions two independently
// filtered spreads (`scripts/check-corpus.mjs:115-118`), so a probe in only
// one region cannot prove the other branch is wired. Two rows, not one,
// mirroring the `corpus/ledger/*` precedent for a single fixture proving
// several rules. Known limitation, not a hole: this fragment can tell "site
// probe's violation is present" from "repo-native probe's violation is
// present," but not which *spread* caught it — a corrupted `isRepoNativeLink`
// that misroutes without dropping anything would leave both rows green,
// caught instead by the separate `corpus/link-routing` gate, which asserts
// the classifier directly.
function gateCorpusLinksRepoNative() {
  return gateCorpusProbe(
    PROBE_CORPUS_LINK_REPO,
    CORPUS_PROBE_LINK_MD,
    'corpus/broken-links',
    'work/bugs/__nonvacuity_probe_repo__.md',
  )
}

// Pointer resolution isn't region-split (unlike links), so one probe suffices.
function gateCorpusPointers() {
  return gateCorpusProbe(
    PROBE_CORPUS_POINTER,
    '# Non-vacuity probe\n\nA live claim about code that does not exist: `src/__nonvacuity_does_not_exist__.ts:12`\n',
    'corpus/pointers-resolve',
    'docs/__nonvacuity_probe_pointer__.md',
  )
}

// Plan 0142 (closing bug 0141): an accepted proposal with no plan declaring
// it — planted directly in work/proposals/ so a fixture rebuilding the rule
// elsewhere can't stand in for proving the production script's own parser
// and correspondence are wired (bug 0127's lesson, applied on day one this
// time rather than found by review — see the bug's own Review section).
function gateCorpusProposalUncited() {
  return gateCorpusProbe(
    PROBE_CORPUS_PROPOSAL_UNCITED,
    '# Non-vacuity probe\n\n## Review — 2026-01-01\n\n**Ruling: Ship as-is**\n\n' +
      'Accepted, on purpose, with no implementing plan — the probe.\n',
    'corpus/accepted-proposal-uncited',
    'work/proposals/__nonvacuity_probe_proposal__.md',
  )
}

// A Review section whose Ruling doesn't parse to the closed vocabulary must
// be its own finding, not silently "not accepted" — the exact failure mode
// bug 0141's own first draft committed against its own reproduction (a
// four-reviewer-independent find, 2026-08-14).
function gateCorpusRulingUnparseable() {
  return gateCorpusProbe(
    PROBE_CORPUS_RULING_UNPARSEABLE,
    '# Non-vacuity probe\n\n## Review — 2026-01-01\n\n' +
      '**Ruling: ship as-is — old-style free prose, garbled on purpose.**\n\nThe probe.\n',
    'corpus/proposal-ruling-unparseable',
    'work/proposals/__nonvacuity_probe_ruling__.md',
  )
}

// Branch review (testing + enforcement, independently, both by mutation):
// the two probes above are both unmatched-left probes. Neutering
// declaredImplements() to always return null, or loosening IMPLEMENTS_RE to
// a prose-matching pattern that reproduces the exact 0089/0101 false-
// positive shape bug 0141 exists to prevent, left every fixture above still
// green — nothing ever asserted that a REAL match makes the check pass, or
// that a prose-only mention (this repo's only real citation shape today)
// still fails it. This closes both directions with one probe pair: plant an
// accepted proposal, first cite it only in prose (must stay red), then swap
// to a real **Implements:** line (must go green), asserted both ways in one
// run so a regression in either direction fails this row.
function gateCorpusProposalImplementsDiscriminates() {
  const proposalMd =
    '# Non-vacuity probe\n\n## Review — 2026-01-01\n\n**Ruling: Ship as-is**\n\n' +
    'Accepted — the discrimination probe.\n'
  // Deliberately contains the word "implements" near "proposal 9001", in a
  // negating sentence — a loose prose-matching regex (testing review's
  // mutation: /[Ii]mplements[^\n]*?proposal\s+(\d+)/) reads this as a match
  // despite the negation; a probe that merely avoids the word "implements"
  // wouldn't exercise that specific, demonstrated vulnerability.
  const proseOnlyPlanMd =
    '# Non-vacuity probe plan\n\n## Status\n\n' +
    'This plan implements nothing from proposal 9001; it is explicitly out of scope.\n'
  const declaredPlanMd =
    '# Non-vacuity probe plan\n\n## Status\n\n- **Implements:** proposal 9001\n'
  try {
    writeFileSync(PROBE_CORPUS_PROPOSAL_MATCHED, proposalMd)
    writeFileSync(PROBE_CORPUS_PLAN_IMPLEMENTS, proseOnlyPlanMd)
    const proseRun = sh(process.execPath, [join('scripts', 'check-corpus.mjs')])
    const proseStillRed = proseRun.code === 1

    writeFileSync(PROBE_CORPUS_PLAN_IMPLEMENTS, declaredPlanMd)
    const matchedRun = sh(process.execPath, [join('scripts', 'check-corpus.mjs')])
    const matchedGoesGreen = matchedRun.code === 0

    const ok = proseStillRed && matchedGoesGreen
    return {
      ok,
      detail:
        `discriminates cited-in-prose from declared · prose-only exit ${proseRun.code} ` +
        `(want 1), declared exit ${matchedRun.code} (want 0)`,
    }
  } finally {
    rmSync(PROBE_CORPUS_PROPOSAL_MATCHED, { force: true })
    rmSync(PROBE_CORPUS_PLAN_IMPLEMENTS, { force: true })
  }
}

// A plan with an "**Implements:**"-shaped line that doesn't parse (garbled
// number, wrong keyword) is its own finding — mirrors the Ruling side's
// probe above, closing the coverage gap the second review round found.
function gateCorpusPlanImplementsUnparseable() {
  return gateCorpusProbe(
    PROBE_CORPUS_PLAN_IMPLEMENTS_UNPARSEABLE,
    '# Non-vacuity probe plan\n\n## Status\n\n- **Implements:** prop 004\n',
    'corpus/plan-implements-unparseable',
    'work/plans/__nonvacuity_probe_implements_unparseable__.md',
  )
}

// A plan declaring "**Implements:** proposal N" where no proposal N exists —
// the dangling-target check found uncovered in the same review round.
function gateCorpusPlanImplementsUnresolved() {
  return gateCorpusProbe(
    PROBE_CORPUS_PLAN_IMPLEMENTS_UNRESOLVED,
    '# Non-vacuity probe plan\n\n## Status\n\n- **Implements:** proposal 88888\n',
    'corpus/plan-implements-unresolved',
    'work/plans/__nonvacuity_probe_implements_unresolved__.md',
  )
}

// --- Node-script gates (crossval / adr / links / review-harness): exit 1 = expected violation ---
function gateNode(script, mustSay) {
  const r = sh(process.execPath, [join('scripts', 'nonvacuity', script)])
  // Exit 1 is NOT sufficient on its own (bug 0109): node also exits 1 on an
  // unhandled throw, a syntax error, and a failed module resolution — and a
  // top-level import is resolved before the fixture's own try/catch can run, so
  // no amount of care inside the fixture closes that hole. Require the
  // fixture's own sentinel (`bad-<name>:`, which every fixture prints) as proof
  // it actually reached its reporting path.
  const sentinel = `${script.replace(/\.mjs$/, '')}:`
  const spoke = r.out.includes(sentinel)
  if (!spoke) {
    return {
      ok: false,
      code: r.code,
      detail: `exit ${r.code} but no "${sentinel}" output — the fixture never printed its sentinel`,
    }
  }
  // The fixture scripts exit 1 only on the intended violation (2 = unexpected
  // error, 0 = vacuous), so require exactly 1.
  if (r.code !== 1) {
    return { ok: false, code: r.code, detail: `exit ${r.code} (${mustSay})` }
  }
  // ...and it must name the rule the gate claims. Proving the fixture RAN is not
  // proving the RIGHT rule fired: where a preset bundles several checks, any of
  // them satisfies "it exited 1", so the named rule could be deleted with the
  // gate still green (bug 0110). `mustSay` used to be display-only.
  if (!r.out.includes(mustSay)) {
    return {
      ok: false,
      code: r.code,
      detail: `exit 1 but never named "${mustSay}" — the fixture failed for some other reason`,
    }
  }
  return { ok: true, code: r.code, detail: `exit ${r.code} (${mustSay})` }
}

// --- Harness self-check: a crashed fixture must NOT read as a detected violation ---
// The harness proves every gate; this proves the harness.
//
// Each stub below dies a *different* way, and all three exit 1 without printing a
// sentinel — the exact three modes bug 0109 names. `gateNode` must reject every
// one. Rejection alone is not enough to assert: a stub that exits 0 is also
// rejected, so an emptied stub would "pass" while proving nothing (that was this
// self-check's own first defect, found in review). The stub must be shown to have
// really crashed — `code === 1` — *and* been rejected. That makes the stub
// contents load-bearing: empty one and this goes red.
const SELFTEST = join(repoRoot, 'scripts', 'nonvacuity', '__selftest_crash__.mjs')
const SELFTEST_STUBS = [
  // Relative, so no published-package name can ever accidentally satisfy it.
  ['unresolvable import', "import x from './__selftest_absent__.mjs'\nconsole.log(x)\n"],
  ['syntax error', 'const = = =\n'],
  ['top-level throw', "throw new Error('selftest')\n"],
]
// A stub that runs perfectly, prints its sentinel and exits 1 — but for a
// different rule than the gate names. It must be rejected too: liveness is not
// identity (bug 0110). This one exits 1 on purpose, so it is asserted separately
// from the three crash stubs above.
const SELFTEST_WRONG_RULE =
  "console.error('__selftest_crash__: detected something, but not what was asked')\nprocess.exit(1)\n"
function gateHarnessSelfCheck() {
  const bad = []
  // Liveness: three crash modes, each exiting 1 without ever printing a sentinel.
  for (const [label, source] of SELFTEST_STUBS) {
    const res = withProbe(SELFTEST, source, () =>
      gateNode('__selftest_crash__.mjs', 'self-check stub'),
    )
    if (res.ok !== false || res.code !== 1) {
      bad.push(`${label} → ok=${String(res.ok)} exit=${String(res.code)}`)
    }
  }
  // Identity: a stub that runs, speaks and exits 1 — for the wrong rule.
  const wrong = withProbe(SELFTEST, SELFTEST_WRONG_RULE, () =>
    gateNode('__selftest_crash__.mjs', 'the/rule-that-was-asked-for'),
  )
  if (wrong.ok !== false || wrong.code !== 1) {
    bad.push(`wrong rule → ok=${String(wrong.ok)} exit=${String(wrong.code)}`)
  }
  const modes = SELFTEST_STUBS.length + 1
  return {
    ok: bad.length === 0,
    status:
      bad.length === 0
        ? 'OK (rejects a crashed or mis-firing fixture)'
        : 'FAILED (accepted a crashed or mis-firing fixture)',
    detail:
      bad.length === 0
        ? `all ${modes} modes rejected — 3 crashes with no sentinel, 1 exiting 1 for the wrong rule`
        : `ACCEPTED a bad stub — the gateNode assertions are broken (bugs 0109/0110): ${bad.join(' · ')}`,
  }
}
rmSync(SELFTEST, { force: true })

const gates = [
  ['harness self-check', gateHarnessSelfCheck],
  ['gate coverage', () => gateCoverage()],
  ['arch (root rules)', gateArch],
  ['internal arch', gateInternalArch],
  ['baseline', gateBaseline],
  ['diagram', gateDiagram],
  ['spec', gateSpec],
  ['crossval', () => gateNode('bad-crossval.mjs', 'crossval/diagram-completeness')],
  ['crossval/gherkin-ts', () => gateNode('bad-gherkin-ts.mjs', 'crossval/scenario-tests-resolve')],
  ['crossval/md-ts', () => gateNode('bad-md-ts.mjs', 'crossval/adr-citations-resolve')],
  // Plan 0096: md↔gherkin/md↔mermaid dogfood bindings. Both presets share one
  // ruleId across multiple failure submodes, so each fixture asserts on
  // message, not just ruleId — mustSay here is still the ruleId (gateNode's
  // own substring check), the submode discrimination happens inside the
  // fixture itself, matching bad-crossval.mjs's precedent.
  [
    'crossval/md-gherkin',
    () => gateNode('bad-md-gherkin.mjs', 'crossval/scenario-citations-resolve'),
  ],
  ['crossval/md-mermaid', () => gateNode('bad-md-mermaid.mjs', 'crossval/embedded-diagram')],
  // Plan 0145 (proposal 005): strong tier from day one — drives the real
  // check-crossval.mjs via EESS_CROSSVAL_GHERKIN_ROOT, not a rebuilt copy.
  // One fixture, three rule ids (its own row count below matches).
  [
    'crossval/scenario-exemption-stale',
    () => gateNode('bad-crossval-gherkin-e2e.mjs', 'crossval/scenario-exemption-stale'),
  ],
  [
    'crossval/scenarios-covered-e2e',
    () => gateNode('bad-crossval-gherkin-e2e.mjs', 'crossval/scenarios-covered'),
  ],
  ['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')],
  // Three rows, one per rule the fixture must make fire. The fixture exits 0
  // unless ALL three do, so any one of them going quiet reddens all three rows —
  // and the gate list NAMES what is proven, instead of one row standing in for a
  // preset with three findings (bug 0110's lesson, applied to its own waiver).
  ['corpus/ledger/box', () => gateNode('bad-ledger.mjs', 'ledger/silent-open-box')],
  ['corpus/ledger/placement', () => gateNode('bad-ledger.mjs', 'ledger/state-folder-mismatch')],
  ['corpus/ledger/state', () => gateNode('bad-ledger.mjs', 'ledger/unknown-state')],
  // The reverse check (bug 0121): a work/ subdirectory no LANES entry claims,
  // but which carries State:-shaped records, must fail loudly — not silently
  // widen the "not scanned" gap the way work/proposals/** did for two rounds.
  [
    'corpus/ledger/uncovered-lane',
    () => gateNode('bad-lane-coverage.mjs', 'ledger/uncovered-lane'),
  ],
  // Bug 0127: converted from a rebuilt-rule fixture to driving the
  // production `scripts/check-corpus.mjs` directly. Two rows, one per
  // routing region bug 0086 split `broken` into — a single probe cannot
  // prove the other region's spread is still wired.
  ['corpus/links/site', gateCorpusLinksSite],
  ['corpus/links/repo-native', gateCorpusLinksRepoNative],
  // Bug 0086's review round: check-corpus.mjs's directory-link routing
  // (which region gets resolveDirectories) must fail closed on an
  // unclassified root and default-deny an unrecognised one — both were
  // demonstrated live to fail open under the previous design.
  [
    'corpus/link-routing',
    () => gateNode('bad-corpus-link-routing.mjs', 'corpus/link-routing-fails-closed'),
  ],
  // Bug 0127: converted from a rebuilt-rule fixture to driving the
  // production script, matching the links gates above.
  ['corpus/pointers', gateCorpusPointers],
  // Plan 0142 (closing bug 0141): proposal→plan linkage, built on the
  // gateCorpusProbe shape from day one.
  ['corpus/proposal-plan-linkage', gateCorpusProposalUncited],
  ['corpus/proposal-ruling-unparseable', gateCorpusRulingUnparseable],
  ['corpus/proposal-implements-discriminates', gateCorpusProposalImplementsDiscriminates],
  ['corpus/plan-implements-unparseable', gateCorpusPlanImplementsUnparseable],
  ['corpus/plan-implements-unresolved', gateCorpusPlanImplementsUnresolved],
  // Second-round branch review's own mutation matrix: several of
  // proposal-ruling.mjs's exported behaviors (last-Ruling-wins scoping, the
  // markdown-link Implements form, fence-blindness, multi-Implements
  // rejection) survived being mutated away with all the end-to-end probes
  // above still green — none of them individually exercises every shape.
  // Direct module-level assertions, the corpus-link-routing.mjs shape.
  [
    'corpus/proposal-ruling-module',
    () => gateNode('bad-proposal-ruling.mjs', 'proposal-ruling/module-behavior'),
  ],
  // One row per release rule, asserting rule AND element as an exact set:
  // neutering the changed-package correspondence still emits its rule id (for the
  // ghost declaration instead of the undeclared package), so a rule-name
  // assertion passes a gate that no longer checks anything.
  //
  // Plus a fourth row for the impure SHELL, which the pure fixture cannot see.
  // Measured while fixing 0106: the core caught 11 of 11 mutations and the shell
  // 0 of 7 — including deleting its `process.exit(1)`, leaving a gate that
  // reports every violation and fails no build.
  [
    'release/needs-changeset',
    () => gateNode('bad-release.mjs', 'release/changed-package-needs-changeset'),
  ],
  [
    'release/names-real-package',
    () => gateNode('bad-release.mjs', 'release/changeset-names-real-package'),
  ],
  ['release/unparseable', () => gateNode('bad-release.mjs', 'release/unparseable-changeset')],
  [
    'release/gate-fails-the-build',
    () => gateNode('bad-release-e2e.mjs', 'release/changed-package-needs-changeset'),
  ],
  ['review-harness', () => gateNode('bad-review-harness.mjs', 'foreign-project token')],
  ['work/numbers', () => gateNode('bad-numbers.mjs', 'duplicate number across lanes')],
  [
    'vacuity-matrix',
    () =>
      gateNode(
        'bad-vacuity-matrix.mjs',
        'schemaFromSDL() (builder) is fail-open with no KNOWN_FAIL_OPEN entry',
      ),
  ],
]

// --- Coverage: every check:* in the validate chain has a gate, or a stated waiver ---
// The gate list is hand-maintained, so deleting a row was a silent, green change
// — the same class as a vacuous gate, one level up (bug 0110). Waivers are
// explicit and must say why.
const NO_GATE_NEEDED = {
  'check:fast': 'an alias — runs corpus + spec + arch, each gated on its own',
  'check:nonvacuity': 'this harness',
  'check:integrity': 'no-gate-yet — npm workspace guardrails, see 0110',
  'check:examples':
    'no-gate-yet — tsc over the single-dialect templates + vitest over cross-dialect.*.test.ts (plan 0091 made the latter half real: it runs eess-crossvalidate presets with genuine red fixtures), see 0110',
  'check:docs-code': 'no-gate-yet — doc fences compile, see 0110',
}
// A check:* script may run several presets, and one gate row proves only the one
// preset its fixture violates. Mapping a script to a single row therefore
// over-claims: `check:crossval` ran five presets against one row and printed
// "every check:* accounted for" while the ADR↔test direction — the subject of
// bug 0104 — could be emptied and stay green. So the value is a LIST, and it is
// the list a reader can audit against the script. Bug 0112 tracks the three
// presets still uncovered.
const GATE_FOR = {
  // `eess-ts check arch.rules.ts arch.internal.rules.ts` — two rule files, two rows.
  'check:arch': ['arch (root rules)', 'internal arch'],
  'check:baseline': ['baseline'],
  'check:diagram': ['diagram'],
  'check:spec': ['spec'],
  'check:vacuity': ['vacuity-matrix'],
  'check:crossval': [
    'crossval',
    'crossval/gherkin-ts',
    'crossval/md-ts',
    'crossval/scenario-exemption-stale',
    'crossval/scenarios-covered-e2e',
    'crossval/md-gherkin',
    'crossval/md-mermaid',
  ],
  'check:corpus': [
    'corpus/adr',
    'corpus/links/site',
    'corpus/links/repo-native',
    'corpus/link-routing',
    'corpus/pointers',
    'corpus/proposal-plan-linkage',
    'corpus/proposal-ruling-unparseable',
    'corpus/proposal-implements-discriminates',
    'corpus/plan-implements-unparseable',
    'corpus/plan-implements-unresolved',
    'corpus/proposal-ruling-module',
  ],
  'check:review-harness': ['review-harness'],
  'check:numbers': ['work/numbers'],
  'check:ledger': [
    'corpus/ledger/box',
    'corpus/ledger/placement',
    'corpus/ledger/state',
    'corpus/ledger/uncovered-lane',
  ],
  'check:release': [
    'release/needs-changeset',
    'release/names-real-package',
    'release/unparseable',
    'release/gate-fails-the-build',
  ],
}
// Rows that measure the harness itself rather than a check:* script. They are
// excluded from the count for the reason stated at the run loop below.
const INSTRUMENTS = new Set(['harness self-check', 'gate coverage'])
function gateCoverage() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const checks = Object.keys(pkg.scripts ?? {}).filter((k) => k.startsWith('check:'))
  const names = new Set(gates.map(([n]) => n))
  const problems = []
  for (const c of checks) {
    if (NO_GATE_NEEDED[c] !== undefined) continue
    const g = GATE_FOR[c]
    if (g === undefined) problems.push(`${c} has no gate and no waiver`)
    else if (g.length === 0) problems.push(`${c} maps to an empty gate list`)
    else
      for (const one of g) {
        if (!names.has(one)) problems.push(`${c} maps to gate "${one}", which is not in the list`)
      }
  }
  // Every gate row must be claimed by some check:*, or the list has grown a row
  // nothing runs — the same silent drift one level over.
  const claimed = new Set(Object.values(GATE_FOR).flat())
  for (const [n] of gates) {
    if (typeof n === 'string' && !claimed.has(n) && !INSTRUMENTS.has(n)) {
      problems.push(`gate "${n}" is in the list but no check:* claims it`)
    }
  }
  const waived = Object.keys(NO_GATE_NEEDED).filter((k) => checks.includes(k)).length
  return {
    ok: problems.length === 0,
    status:
      problems.length === 0
        ? 'OK (every check:* accounted for)'
        : 'FAILED (a check:* is unaccounted for)',
    detail:
      problems.length === 0
        ? `${checks.length} check:* scripts — ${Object.keys(GATE_FOR).length} gated by ` +
          `${Object.values(GATE_FOR).flat().length} fixtures, ${waived} waived`
        : problems.join(' · '),
  }
}

let allOk = true
// The self-check is the instrument, not a measurement: it does not "fail on
// violating input", it rejects a crashed fixture. Counting it among the gates
// would inflate the denominator — the exact over-claim this harness exists to
// prevent — so it carries its own status wording and is excluded from the count.
let gateCount = 0
for (const [name, run] of gates) {
  let res
  try {
    res = run()
  } catch (err) {
    res = { ok: false, detail: `harness error: ${err.message}` }
  }
  if (!res.ok) allOk = false
  if (res.status === undefined) gateCount++
  const status =
    res.status ??
    (res.ok ? 'OK (fails on violating input)' : 'FAILED (did not fail on violating input)')
  console.log(`nonvacuity: ${name} — ${status} · ${res.detail}`)
}

// Bug 0127: "gates each failed" over-claimed — most fixtures prove their own
// condition fires, not that the production gate script invokes it. State
// what was actually measured.
console.log(
  allOk
    ? `\nnonvacuity: ${gateCount} fixtures each fired on their violating input — no fixture is silently green.`
    : '\nnonvacuity: at least one fixture did NOT fire on its violating input — see above.',
)
process.exit(allOk ? 0 : 1)
