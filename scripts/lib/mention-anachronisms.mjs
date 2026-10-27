#!/usr/bin/env node
/**
 * Plan 0542, Phases 2 to 8: a lane's anachronisms, as `mention-fix.rules.ts` `.excluding()` entries.
 *
 *   node scripts/lib/mention-anachronisms.mjs '<glob>' ['<glob>' …]
 *
 * An anachronism is a mention the fix would link that was first written before the record it would
 * link to existed: the number then meant something else, so the link would be wrong (plan 0550's
 * Phase 0). For each fix in the lane's globs, the mention's first commit is the oldest commit, by
 * `git log --follow`, whose added lines hold its text anywhere in the file; the record's is its
 * file's oldest commit. The mention is an anachronism when the record's commit is not an ancestor
 * of the mention's. Text copied in from another file is dated at the copy. Both readings err toward
 * calling a fix an anachronism, which leaves it to be read by hand rather than applied.
 *
 * An empty list applies every anachronism, so every way to an empty or short one stops instead,
 * with exit 1 and nothing on stdout:
 *  - a shallow clone, whose oldest commit is the graft, so nothing reads as written before its record;
 *  - a glob whose rule examined nothing, or any finding that is not a mention's (a configuration or
 *    vacuity finding: the run is not what it looks like);
 *  - a fix it cannot date or read: named, to be read by hand. A record whose file was renamed from
 *    another number is not dated (its history is another record's).
 *
 * On success prints one `'path:line', // …` entry per line on stdout, saying how many other fixes
 * the entry hides on its line, and a summary with its time on stderr.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { basename, dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { corpus } from '@nielspeter/eess-md'
import { CORPUS_ROOTS, mentionFixRule } from './record-mention.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const globs = process.argv.slice(2)
if (globs.length === 0) {
  console.error('mention-anachronisms: name the lane, one or more globs.')
  process.exit(2)
}
const stop = (lines) => {
  for (const l of lines) console.error(`mention-anachronisms: ${l}`)
  process.exit(1)
}

const git = (...args) =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1 << 30 }).trim()
if (git('rev-parse', '--is-shallow-repository') !== 'false')
  stop([
    'this is a shallow clone, so no mention can be dated before its record. ' +
      'Fetch the full history (`git fetch --unshallow`).',
  ])

const MENTION_FINDING = /^"[^"]+" is (?:not a link|in inline code, not a link)/
const t0 = Date.now()
const c = corpus({ cwd: repo, roots: CORPUS_ROOTS })
const fixes = []
const problems = []
for (const glob of globs) {
  const vs = mentionFixRule(c, glob).violations()
  if (vs.examined === 0)
    problems.push(`${glob} examined no mention: a dead glob, or an empty lane.`)
  for (const v of vs) {
    if (!MENTION_FINDING.test(v.message)) {
      problems.push(`${glob}: ${v.message}`)
      continue
    }
    if (v.fix === undefined) continue
    const rel = relative(repo, v.file).split('\\').join('/')
    const m = /link "(.*)" → <?(.*?)>?$/.exec(v.fix.describe)
    if (m === null) {
      problems.push(`${rel}:${String(v.line)}: a fix this cannot read: ${v.fix.describe}`)
      continue
    }
    const target = posix.normalize(posix.join(posix.dirname(rel), m[2].replace(/#.*$/, '')))
    fixes.push({ rel, line: v.line, text: m[1], target })
  }
}
if (problems.length > 0) stop(problems)

const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ')
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A file's commits, oldest first, each with its added lines lower-cased, following renames. */
function history(path) {
  const out = git(
    'log',
    '--follow',
    '-M',
    '-p',
    '-U0',
    '--no-color',
    '--no-ext-diff',
    '--format=@@C %H %ct',
    '--',
    path,
  )
  const commits = []
  let cur
  for (const line of out.split('\n')) {
    if (line.startsWith('@@C ')) {
      const [, h, ct] = line.split(' ')
      cur = { h, ct: Number(ct), added: [] }
      commits.push(cur)
    } else if (cur !== undefined && line.startsWith('+') && !line.startsWith('+++'))
      cur.added.push(line.slice(1).toLowerCase())
  }
  return commits.reverse()
}

const histories = new Map()
const firstWritten = (rel, text) => {
  if (!histories.has(rel)) histories.set(rel, history(rel))
  const re = new RegExp(`(?<![\\w])${esc(norm(text)).replace(/ /g, '\\s+')}(?![\\w])`, 'i')
  return histories.get(rel).find((commit) => commit.added.some((l) => re.test(l)))
}

/** A record's number: its file's, or its folder's for a `README.md`. */
const numberOf = (path) => {
  const name = basename(path) === 'README.md' ? basename(dirname(path)) : basename(path)
  return /^(\d+)-/.exec(name)?.[1]
}
const recordFirst = new Map()
/** The record file's oldest commit, or why there is none: not found, or renamed from another number. */
const firstOfRecord = (target) => {
  if (!recordFirst.has(target)) {
    const out = git('log', '--follow', '-M', '--name-only', '--format=@@C %H %ct', '--', target)
    const commits = []
    for (const line of out.split('\n')) {
      if (line.startsWith('@@C ')) {
        const [, h, ct] = line.split(' ')
        commits.push({ h, ct: Number(ct), names: [] })
      } else if (line !== '' && commits.length > 0) commits[commits.length - 1].names.push(line)
    }
    const own = numberOf(target)
    const renamed = commits.some((cm) => cm.names.some((n) => numberOf(n) !== own))
    const oldest = commits[commits.length - 1]
    recordFirst.set(
      target,
      renamed
        ? { why: 'its file was renamed from another number' }
        : oldest === undefined
          ? { why: 'its file has no history' }
          : oldest,
    )
  }
  return recordFirst.get(target)
}

const isAncestor = (a, b) =>
  a === b || spawnSync('git', ['-C', repo, 'merge-base', '--is-ancestor', a, b]).status === 0

const day = (ct) => new Date(ct * 1000).toISOString().slice(0, 10)
const onLine = new Map()
for (const f of fixes) onLine.set(`${f.rel}:${f.line}`, (onLine.get(`${f.rel}:${f.line}`) ?? 0) + 1)
const undated = []
const entries = []
for (const f of fixes) {
  const mention = firstWritten(f.rel, f.text)
  const record = firstOfRecord(f.target)
  const at = `${f.rel}:${String(f.line)} "${f.text}" → ${f.target}`
  if (mention === undefined) undated.push(`${at}: its text is in no commit of the file`)
  else if ('why' in record) undated.push(`${at}: the record is not dated, ${record.why}`)
  else if (!isAncestor(record.h, mention.h)) {
    const others = (onLine.get(`${f.rel}:${f.line}`) ?? 1) - 1
    entries.push(
      `'${f.rel}:${String(f.line)}', // "${f.text}" written ${day(mention.ct)} (${mention.h.slice(0, 10)}), ` +
        `${f.target} first ${day(record.ct)} (${record.h.slice(0, 10)})` +
        (others > 0 ? `; hides ${String(others)} other fix(es) on its line` : ''),
    )
  }
}
const took = `${((Date.now() - t0) / 1000).toFixed(1)}s`
if (undated.length > 0)
  stop([
    ...undated.map((u) => `not dated, read by hand: ${u}`),
    `${String(undated.length)} fix(es) not dated over ${globs.join(' ')}; nothing printed (${took}).`,
  ])
// An entry per line: two anachronisms on one line are one exclusion.
const unique = [...new Map(entries.map((e) => [e.slice(0, e.indexOf(',')), e])).values()]
for (const e of unique) console.log(e)
console.error(
  `mention-anachronisms: ${String(entries.length)} anachronism(s) on ${String(unique.length)} line(s) ` +
    `in ${String(fixes.length)} fix(es) over ${globs.join(' ')} (${took})`,
)
