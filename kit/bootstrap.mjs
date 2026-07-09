#!/usr/bin/env node
// Working-method kit — bootstrap.
//
// Drops the kit into a project: the agent-callable skills, a cold-start work/
// corpus skeleton (boards + seed templates), the method doc, and the agent-entry
// nudge. Zero-dependency. Idempotent and non-destructive: it never overwrites a
// file that already exists — a second run only fills in what's missing.
//
// Usage, from the target project's root:
//   node <path-to-kit>/bootstrap.mjs           # dry run — prints the plan, writes nothing
//   node <path-to-kit>/bootstrap.mjs --apply   # perform it
//
// "Corpus is the template": the seed item templates are scaffolding — delete them
// once real items exist to imitate.

import { fileURLToPath } from 'node:url'
import { cpSync, existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const KIT = dirname(fileURLToPath(import.meta.url))
const DEST = process.cwd()
const APPLY = process.argv.includes('--apply')

const actions = [] // { verb, path, run }
const skipped = [] // strings

function plan(verb, absPath, run) {
  actions.push({ verb, path: relative(DEST, absPath) || '.', run })
}
function skip(msg) {
  skipped.push(msg)
}

// 1. Skills → .claude/skills/ (one dir per skill; skip any that already exist).
const SKILLS = ['plan', 'plan-ready', 'plan-build', 'bug', 'close', 'refine', 'case']
for (const s of SKILLS) {
  const src = join(KIT, 'skills', s)
  const dst = join(DEST, '.claude', 'skills', s)
  if (existsSync(dst)) skip(`.claude/skills/${s} (exists)`)
  else plan('skill', dst, () => cpSync(src, dst, { recursive: true }))
}

// 2. Cold-start work/ skeleton (boards + lane README). Per-file, never clobber.
const WORK_SEED = join(KIT, 'templates', 'work')
for (const rel of ['README.md', 'plans/ROADMAP.md', 'bugs/BUGS.md']) {
  const src = join(WORK_SEED, rel)
  const dst = join(DEST, 'work', rel)
  if (existsSync(dst)) skip(`work/${rel} (exists)`)
  else plan('corpus', dst, () => copyFile(src, dst))
}

// 3. Seed item templates (delete once real examples exist).
for (const [src, dst] of [
  [join(KIT, 'templates', 'plan.md'), join(DEST, 'work', 'plans', '_TEMPLATE.md')],
  [join(KIT, 'templates', 'bug.md'), join(DEST, 'work', 'bugs', '_TEMPLATE.md')],
]) {
  if (existsSync(dst)) skip(`${relative(DEST, dst)} (exists)`)
  else plan('template', dst, () => copyFile(src, dst))
}

// 4. Method doc → docs/working-method.md. Sourced from the sibling docs/ dir when
//    run from inside the eess repo; if the kit was vendored without it, we say so.
const METHOD_SRC = join(KIT, '..', 'docs', 'working-method.md')
const METHOD_DST = join(DEST, 'docs', 'working-method.md')
if (existsSync(METHOD_DST)) skip('docs/working-method.md (exists)')
else if (existsSync(METHOD_SRC)) plan('method', METHOD_DST, () => copyFile(METHOD_SRC, METHOD_DST))
else skip('docs/working-method.md — method doc not found beside the kit; copy it in manually')

// 5. Agent-entry nudge → append to AGENTS.md / CLAUDE.md (whichever exists; else
//    AGENTS.md), unless already present.
const nudge = readFileSync(join(KIT, 'AGENTS.snippet.md'), 'utf8')
const entry =
  ['AGENTS.md', 'CLAUDE.md'].map((f) => join(DEST, f)).find(existsSync) ?? join(DEST, 'AGENTS.md')
const entryRel = relative(DEST, entry)
if (existsSync(entry) && readFileSync(entry, 'utf8').includes('## Working method')) {
  skip(`${entryRel} (already has a "## Working method" section)`)
} else {
  plan('nudge', entry, () => {
    if (existsSync(entry)) appendFileSync(entry, '\n' + nudge)
    else writeFileSync(entry, nudge)
  })
}

// --- report + (optionally) execute -----------------------------------------

function copyFile(src, dst) {
  mkdirSync(dirname(dst), { recursive: true })
  cpSync(src, dst)
}

console.log(`\nworking-method kit → ${DEST}\n`)
if (actions.length === 0) {
  console.log('  Nothing to do — everything is already in place.')
} else {
  console.log(`  ${APPLY ? 'Installing' : 'Would install'} ${actions.length} item(s):`)
  for (const a of actions) console.log(`    + ${a.path}   (${a.verb})`)
}
if (skipped.length) {
  console.log(`\n  Skipped ${skipped.length} (present or manual):`)
  for (const s of skipped) console.log(`    · ${s}`)
}

if (APPLY) {
  for (const a of actions) a.run()
  console.log(`\n✓ Installed. Next: review the seed templates, wire the gates`)
  console.log(`  (check:corpus, check:ledger) into package.json + CI, then /plan your first item.`)
} else if (actions.length) {
  console.log(`\n  Dry run — nothing written. Re-run with --apply to perform it.`)
}
console.log()
