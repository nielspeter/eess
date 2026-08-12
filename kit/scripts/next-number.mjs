#!/usr/bin/env node
/**
 * Work-item number allocator and collision gate — the single definition of the
 * corpus's numbering rule (bug 0107).
 *
 * THE RULE. A corpus runs **one number sequence per width, shared across every
 * lane**. `work/plans/0100-…md` and `work/bugs/0100-…md` are the *same* item
 * number claimed twice, not two independent counters — so an allocator that
 * scans only its own lane will hand out a number the other lane already holds.
 * That is precisely what happened here on 2026-08-12: the bug lane's highest was
 * 0099, so `/bug` proposed 0100, while the plan lane already held 0100 and 0101.
 *
 * Width matters, because a corpus legitimately runs more than one sequence:
 * plans and bugs share 4-digit numbers, while `work/proposals/` numbers its own
 * 3-digit sequence (as `adr/` does outside `work/`). Items are therefore grouped
 * by digit width, and only same-width numbers can collide.
 *
 * Usage:
 *   node next-number.mjs                    # next free 4-digit number
 *   node next-number.mjs --width 3          # next free 3-digit number
 *   node next-number.mjs --check            # exit 1 if any number is claimed twice
 *   node next-number.mjs --root DIR         # scan DIR instead of cwd
 *   node next-number.mjs --list             # show every number and its claimant
 *
 * Scans `<root>/work/<lane>/` and one level of terminal folders beneath it
 * (`completed/`, `fixed/`, `wont-do/`, `archived/`, …), so a closed item still
 * holds its number. Zero dependencies — node builtins only.
 *
 * Exit codes: 0 = OK · 1 = duplicate found (`--check` only) · 2 = bad usage.
 * All output is prefixed `next-number:` so a caller can tell a real result from
 * a crash — an exit code alone cannot.
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const ROOT = value('--root', process.cwd())
const WIDTH = Number(value('--width', '4'))
const WORK = join(ROOT, 'work')

if (!Number.isInteger(WIDTH) || WIDTH < 1 || WIDTH > 9) {
  console.error(`next-number: --width must be an integer 1-9, got "${value('--width', '')}"`)
  process.exit(2)
}

const ITEM_RE = /^(\d+)-.+\.md$/

function dirsIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

function itemsIn(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Every numbered item under `work/`, as { num, width, path }. Lanes are
 * discovered, never hardcoded — a lane added later joins the sequence without
 * editing this file.
 */
function collect() {
  const out = []
  const record = (dir, name) => {
    const m = ITEM_RE.exec(name)
    if (m === null) return
    const digits = m[1]
    out.push({
      num: Number(digits),
      width: digits.length,
      path: relative(ROOT, join(dir, name)),
    })
  }
  for (const lane of dirsIn(WORK)) {
    const laneDir = join(WORK, lane)
    for (const name of itemsIn(laneDir)) record(laneDir, name)
    // One level down: terminal folders (completed/, fixed/, wont-do/, …). A
    // closed item still owns its number, so history must be scanned too.
    for (const sub of dirsIn(laneDir)) {
      const subDir = join(laneDir, sub)
      for (const name of itemsIn(subDir)) record(subDir, name)
    }
  }
  return out
}

let items
try {
  statSync(WORK)
  items = collect()
} catch {
  console.error(`next-number: no work/ directory under "${ROOT}"`)
  process.exit(2)
}

// ---------- --check: no number claimed twice at the same width ----------

if (flag('--check')) {
  const byKey = new Map()
  for (const it of items) {
    const key = `${it.width}:${it.num}`
    const list = byKey.get(key)
    if (list) list.push(it)
    else byKey.set(key, [it])
  }
  const dupes = [...byKey.values()].filter((l) => l.length > 1)

  if (dupes.length > 0) {
    console.error(`next-number: ${dupes.length} number(s) claimed more than once`)
    for (const list of dupes.sort((a, b) => a[0].num - b[0].num)) {
      const n = String(list[0].num).padStart(list[0].width, '0')
      console.error(`  ✗ ${n} claimed by ${list.length} items:`)
      for (const it of list) console.error(`      ${it.path}`)
    }
    console.error(
      `\n  One sequence per width is shared across every lane. Renumber all but one, ` +
        `then re-run.\n  The next free number: node kit/scripts/next-number.mjs\n`,
    )
    process.exit(1)
  }

  const widths = [...new Set(items.map((i) => i.width))].sort()
  const summary = widths
    .map((w) => `${items.filter((i) => i.width === w).length} × ${w}-digit`)
    .join(' · ')
  console.error(
    `next-number: OK — ${items.length} numbered items (${summary || 'none'}), no number claimed twice.`,
  )
  process.exit(0)
}

// ---------- --list ----------

if (flag('--list')) {
  console.error(`next-number: ${items.length} numbered items under work/`)
  for (const it of items.sort((a, b) => a.width - b.width || a.num - b.num)) {
    console.log(`${String(it.num).padStart(it.width, '0')}  ${it.path}`)
  }
  process.exit(0)
}

// ---------- default: allocate ----------

const sameWidth = items.filter((i) => i.width === WIDTH)
const highest = sameWidth.reduce((max, i) => (i.num > max ? i.num : max), 0)
const next = String(highest + 1).padStart(WIDTH, '0')

console.error(
  `next-number: ${sameWidth.length} existing ${WIDTH}-digit items across ` +
    `${new Set(sameWidth.map((i) => i.path.split('/')[1])).size} lane(s); highest is ` +
    `${String(highest).padStart(WIDTH, '0')}.`,
)
console.log(next)
