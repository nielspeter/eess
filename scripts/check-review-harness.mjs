#!/usr/bin/env node
/**
 * REVIEW-HARNESS GATE (2026-08-10, dogfood).
 *
 * The review skill (.claude/skills/review/ + .claude/agents/reviewer-*.md) is a
 * copy-of-a-copy: written for a CMS-with-edge-networking project, copied into
 * ts-archunit, copied into eess — and never adapted. Its personae asserted "this
 * CMS", prescribed fastify.inject()/testcontainers/nginx/Cloudflare and a
 * tests/ai/ tier that do not exist here, and its --plan mode pointed at
 * .claude/plans/ instead of eess's work/plans/. Nothing caught the drift because
 * nothing scanned the harness against the repo it reviews.
 *
 * This gate is the fix made mechanical. It holds the review harness to eess:
 * every persona must reflect what eess actually is (a six-package spec-compiler
 * family, fixture-based Vitest), the persona roster in SKILL.md must match the
 * agents on disk, and the enforcement persona — the fail-closed lens from the
 * manifesto + ADR-008/009 — must be present. A harness that drifts from the repo
 * it reviews is the amnesiac-reader failure, committed by the tooling that was
 * supposed to prevent it.
 *
 * --root <dir> points at a distilled bad-fixture tree (scripts/nonvacuity/
 * bad-review-harness/) so check:nonvacuity can prove this gate FAILS on an
 * emptied/violating state — a green that cannot fail is a lie (ADR-009).
 *
 * Exits 0 iff checks pass. Run: `npm run check:review-harness`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const argRoot = process.argv.indexOf('--root')
const ROOT = argRoot !== -1 ? join(repoRoot, process.argv[argRoot + 1]) : join(repoRoot, '.claude')
const AGENTS = join(ROOT, 'agents')
const SKILL = join(ROOT, 'skills', 'review', 'SKILL.md')

/**
 * The concrete drift tokens that must never describe this repo (see header).
 * Each one is a real string that shipped in the unadapted copy.
 */
const FOREIGN = ['fastify', 'testcontainers', 'nginx', 'Cloudflare', 'this CMS', 'tests/ai/']

const read = (p) => readFileSync(p, 'utf8')

function findings() {
  const out = []
  let scanned = 0
  // Incremented INSIDE each loop, not derived from the same inputs afterwards.
  // The first version of this fix computed the counts from `agentFiles` and the
  // LENS map at the end — so deleting a whole check left its number at 7, which
  // is the identical over-claim one level down from the one being fixed.
  const tally = { rosterCompared: 0, tokensScanned: 0, namesChecked: 0, lensesChecked: 0 }
  // The three single-assertion checks below have no loop to count, so they record
  // that they ran. Without this the zero-guard covers four checks of seven, and
  // the summary would keep claiming "enforcement + method required · --plan →
  // work/plans/" after those lines were deleted — the same over-claim, narrowed.
  const ran = { requiredPersonas: false, planLane: false }
  try {
    statSync(AGENTS)
  } catch {
    return { findings: [`agents dir missing: ${AGENTS}`], scanned }
  }

  const agentFiles = readdirSync(AGENTS)
    .filter((f) => /^reviewer-.*\.md$/.test(f))
    .sort()
  scanned = agentFiles.length
  const agentNames = new Set(agentFiles.map((f) => f.replace(/\.md$/, '')))
  const skillText = read(SKILL)

  // 1. No foreign vocabulary — the exact drift that occurred.
  for (const token of FOREIGN) {
    tally.tokensScanned += 1
    const inSkill = skillText.includes(token)
    const inAgents = agentFiles.filter((f) => read(join(AGENTS, f)).includes(token))
    if (inSkill || inAgents.length > 0) {
      const where = [...(inSkill ? ['SKILL.md'] : []), ...inAgents.map((f) => `agents/${f}`)].join(
        ', ',
      )
      out.push(
        `foreign-project token \`${token}\` present in ${where} — the harness describes a project that is not this repo`,
      )
    }
  }

  // 2. Roster (SKILL.md) matches agents on disk, both directions.
  // Scoped to the DISPATCH TABLE, not to any backticked mention anywhere in the
  // file. Enforcement review of bug 0250 measured why: the old pattern scanned
  // the whole document, so a persona named in prose counted as rostered, and the
  // table row a coordinator actually reads to spawn it could be deleted with the
  // gate still reporting "roster matches". That was already true for
  // `reviewer-enforcement` on main; 0250's own change doubled it by adding prose
  // mentions of both mandatory personas. The table is the roster; prose is prose.
  const roster = new Set(
    [...skillText.matchAll(/^\|\s*`[a-z-]+`\s*\|\s*`(reviewer-[a-z-]+)`\s*\|/gm)].map((m) => m[1]),
  )
  if (roster.size === 0)
    out.push(
      'SKILL.md has no persona dispatch table this check can read — the table shape has ' +
        'drifted, so the roster comparison below is asserting nothing (ADR-010)',
    )
  for (const a of agentNames) {
    tally.rosterCompared += 1
    if (!roster.has(a)) out.push(`agent ${a} exists on disk but SKILL.md roster omits it`)
  }
  for (const r of roster)
    if (!agentNames.has(r)) out.push(`SKILL.md roster names \`${r}\` but no such agent file exists`)

  // 2b. The frontmatter `name:` is what the dispatcher binds; the filename is what
  // this gate binds. They were never compared. A one-character typo in `name:`
  // makes a persona undispatchable while the gate reports "roster matches" —
  // enforcement review of bug 0250 measured it, and called it the
  // highest-probability real-world break. Free to add: all seven currently agree.
  for (const f of agentFiles) {
    tally.namesChecked += 1
    const declared = /^name:\s*(\S+)\s*$/m.exec(read(join(AGENTS, f)))?.[1]
    const expected = f.replace(/\.md$/, '')
    if (declared !== expected)
      out.push(
        `agents/${f} declares \`name: ${declared ?? '(none)'}\` — the dispatcher binds that ` +
          `name and this roster binds the filename, so the persona is unreachable while ` +
          `everything here reads consistent`,
      )
  }

  // 2c. A persona must still CLAIM its lens.
  //
  // The floor exists because enforcement review asked what this gate buys and
  // measured the answer: a `reviewer-*.md` truncated to ZERO BYTES passed,
  // reporting "7 reviewer agents, roster matches". So the guarantee was a
  // filename. Drift back to a generic "review the code" prompt — the exact drift
  // this gate's header says it exists to prevent — was undetectable.
  //
  // This is still a Tier-1 static check standing in for a Tier-4 semantic
  // property, and it cannot be otherwise: you cannot unit-test a prompt. What it
  // converts is "the file exists" into "the file still claims its lens". Several
  // alternatives per persona, so rewording is allowed and gutting is not.
  const LENS = {
    'reviewer-architect': ['placement', 'kernel', 'ADR'],
    'reviewer-customer': ['adopter', 'install', 'onboarding'],
    'reviewer-devops': ['release', 'CI', 'publish'],
    'reviewer-enforcement': ['fail-closed', 'break class', 'go red', 'non-vacuity'],
    'reviewer-product': ['generic', 'naming', 'scope'],
    'reviewer-testing': ['coverage', 'sabotage', 'non-vacuity', 'edge case'],
    'reviewer-method': ['closab', 'ledger', 'freeze discipline', 'measured'],
  }
  for (const f of agentFiles) {
    tally.lensesChecked += 1
    const name = f.replace(/\.md$/, '')
    const body = read(join(AGENTS, f))
    if (body.trim().length < 400)
      out.push(
        `agents/${f} is ${body.trim().length} bytes — too short to carry a brief; an emptied ` +
          `persona used to pass this gate reporting "roster matches"`,
      )
    const want = LENS[name]
    if (want && !want.some((t) => body.toLowerCase().includes(t.toLowerCase())))
      out.push(
        `agents/${f} mentions none of ${want.map((t) => `"${t}"`).join(', ')} — it no longer ` +
          `claims the lens the roster promises for it`,
      )
    if (!want)
      out.push(
        `agents/${f} has no lens vocabulary declared in check-review-harness.mjs — add one, or ` +
          `a new persona joins the roster with nothing asserting what it is about`,
      )
  }

  // 3. Enforcement persona — the fail-closed lens — present in both.
  ran.requiredPersonas = true
  if (!agentNames.has('reviewer-enforcement'))
    out.push('reviewer-enforcement agent missing — the ADR-008/009 lens is required')
  if (!roster.has('reviewer-enforcement'))
    out.push(
      "SKILL.md roster omits the enforcement persona — reviews of this repo's gates/plans must include it",
    )

  // 3b. Working-method persona — the lens over the RECORD rather than the code.
  //
  // Added with bug 0250, and added ONLY because its own reviewer found the hole:
  // the skill declares two personas non-optional, but the roster check is a
  // correspondence, so deleting an agent AND its roster row together left the
  // gate green at six. Of the two "mandatory" lenses, one was hard-required by
  // name and one survived a coordinated deletion — and the skill's prose leaned
  // on this gate for both.
  //
  // What this still does NOT do, said plainly so nobody reads more into it:
  // nothing here can check that a review actually RAN the persona. It checks the
  // roster promises it. That is the same limit the enforcement clause above has.
  if (!agentNames.has('reviewer-method'))
    out.push(
      'reviewer-method agent missing — the working-method lens (records, ledgers, ' +
        'boards, measured-vs-asserted claims) is required',
    )
  if (!roster.has('reviewer-method'))
    out.push(
      'SKILL.md roster omits the method persona — reviews touching work/, adr/ or docs/ must include it',
    )

  // 4. --plan mode points at eess's real plan lane.
  ran.planLane = true
  if (!/work\/plans\//.test(skillText))
    out.push("SKILL.md --plan mode must reference work/plans/ (eess's plan lane)")
  if (/\.claude\/plans\//.test(skillText))
    out.push('SKILL.md --plan mode refers to .claude/plans/ — the wrong plan lane for this repo')

  // What the summary is allowed to say, derived rather than asserted.
  //
  // Enforcement review of bug 0250 removed three of the four checks and watched
  // the green line print all four claims verbatim — "roster matches, no
  // foreign-project drift, enforcement present, --plan → work/plans/" — from a
  // single `findings.length === 0`. A summary naming properties it did not
  // evaluate is the shape ADR-009/010 exist to refuse, printed by the gate that
  // exists to catch drift.
  //
  // These are counts of work done, so deleting a check moves its number to 0 and
  // the line says so.
  // ADR-010, applied to this gate's own tallies. Degrading the summary to a zero
  // was the first half of the fix; a zero beside the word OK is still a pass
  // constructed from nothing. With agents on disk, every one of these must have
  // done work.
  for (const [what, did] of Object.entries(ran)) {
    if (!did)
      out.push(`the ${what} check did not run — the summary must not report it as passed (ADR-010)`)
  }
  if (agentFiles.length > 0) {
    for (const [what, n] of Object.entries(tally)) {
      if (n === 0)
        out.push(
          `${what} examined 0 of ${agentFiles.length} agents — that check did not run, so the ` +
            `summary must not report it as passed`,
        )
    }
  }

  return { findings: out, scanned, counts: { ...tally, rostered: roster.size } }
}

const res = findings()
const ok = res.findings.length === 0
for (const f of res.findings) console.log(`review-harness: ${f}`)
const c = res.counts ?? {}
console.log(
  ok
    ? `\nreview-harness: OK — ${res.scanned} reviewer agents · ${c.rostered} in the dispatch ` +
        `table, ${c.rosterCompared} compared both ways · ${c.namesChecked} frontmatter names ` +
        `bound to filenames · ${c.lensesChecked} lens vocabularies still claimed · ` +
        `${c.tokensScanned} foreign tokens absent · enforcement + method required · ` +
        `--plan → work/plans/.`
    : `\nreview-harness: ${res.findings.length} finding(s) — the review harness drifted from eess.`,
)
process.exit(ok ? 0 : 1)
