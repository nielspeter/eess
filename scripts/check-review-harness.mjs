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
  const roster = new Set(
    [...skillText.matchAll(/`reviewer-[a-z-]+`/g)]
      .map((m) => m[0].replace(/`/g, ''))
      .filter((n) => n !== 'reviewer'),
  )
  for (const a of agentNames)
    if (!roster.has(a)) out.push(`agent ${a} exists on disk but SKILL.md roster omits it`)
  for (const r of roster)
    if (!agentNames.has(r)) out.push(`SKILL.md roster names \`${r}\` but no such agent file exists`)

  // 3. Enforcement persona — the fail-closed lens — present in both.
  if (!agentNames.has('reviewer-enforcement'))
    out.push('reviewer-enforcement agent missing — the ADR-008/009 lens is required')
  if (!roster.has('reviewer-enforcement'))
    out.push(
      "SKILL.md roster omits the enforcement persona — reviews of this repo's gates/plans must include it",
    )

  // 4. --plan mode points at eess's real plan lane.
  if (!/work\/plans\//.test(skillText))
    out.push("SKILL.md --plan mode must reference work/plans/ (eess's plan lane)")
  if (/\.claude\/plans\//.test(skillText))
    out.push('SKILL.md --plan mode refers to .claude/plans/ — the wrong plan lane for this repo')

  return { findings: out, scanned }
}

const res = findings()
const ok = res.findings.length === 0
for (const f of res.findings) console.log(`review-harness: ${f}`)
console.log(
  ok
    ? `\nreview-harness: OK — ${res.scanned} reviewer agents, roster matches, no foreign-project drift, enforcement present, --plan → work/plans/.`
    : `\nreview-harness: ${res.findings.length} finding(s) — the review harness drifted from eess.`,
)
process.exit(ok ? 0 : 1)
