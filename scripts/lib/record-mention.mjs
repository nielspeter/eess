/**
 * Plan 0542: this repository's record-mention rule, one owner. `check:corpus` judges with it and
 * `mention-fix.rules.ts` fixes with it, so the gate and the fix cannot read a mention differently.
 *
 *  - `RECORD_MENTION`: a bug, plan, spike, proposal or ADR named by number (plan 0541), except a
 *    number written right after `ts-archunit` or `ts-archunit's`, which is that project's own
 *    numbering and never linked (Decision 2). The lookbehind is on every alternative.
 *  - `LEFT_OUT`: the seven done fold-era records, which describe ts-archunit in its own numbering
 *    and are not edited again (Decision 3): eight files, since spike 0001 holds two. Each is pinned
 *    by its text's hash, so an edit is red rather than exempt.
 *  - `recordsOf`: the records a mention can be fixed to, eess's own (Decision 1).
 *
 * `record-mention.test.mjs` pins the patterns' sources and the list, so a widened word or a swapped
 * entry is red.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import picomatch from 'picomatch'
import { areSelfMentions, inDocuments, mentions, not, or, resideInFile } from '@nielspeter/eess-md'
import { LANE_KINDS, recordKey, recordKeyOfPath } from './record-key.mjs'

/** The corpus roots the gate, the fix and the anachronism instrument read. */
export const CORPUS_ROOTS = ['work/**', 'adr/**', 'docs/**']

/** What a number written after it is ts-archunit's: the project's name, or its possessive. */
const TS_ARCHUNIT_BEFORE = String.raw`ts-archunit(?:'s)?\s+`

/** A number written right after `ts-archunit` is ts-archunit's, so the pattern skips it. */
export const TS_ARCHUNIT_LOOKBEHIND = `(?<!${TS_ARCHUNIT_BEFORE})`

const ALTERNATIVES = [
  String.raw`\b(?<kind>bug|plan|spike)s?\s+(?<n>\d{4})\b`,
  String.raw`\b(?<kind>proposal)s?\s+(?<n>\d{3})\b`,
  String.raw`\b(?<kind>ADR)-(?<n>\d{3})\b`,
]

export const RECORD_MENTION = new RegExp(
  ALTERNATIVES.map((a) => TS_ARCHUNIT_LOOKBEHIND + a).join('|'),
  'gi',
)

/** What the lookbehind skips, so the gate can say how many it did (plan 0542, Phase 1). */
export const SKIPPED_AFTER_TS_ARCHUNIT = new RegExp(
  ALTERNATIVES.map((a) => TS_ARCHUNIT_BEFORE + a).join('|'),
  'gi',
)

/**
 * Each left-out file and its pin: the SHA-256 of its text with link destinations blanked and CRLF
 * read as LF (`textHash`), as of 2026-10-27.
 */
export const LEFT_OUT = [
  {
    path: 'work/plans/completed/0071-ts-archunit-parity.md',
    sha256: '1152ca8ac0a6591c13735f9627ff3b9a6bb80246c044f9a3d02a6099f90617eb',
  },
  {
    path: 'work/plans/completed/0088-fold-ts-archunit-into-eess.md',
    sha256: '5cfd6fc3da3818b296bbc2ac966ecede748e522672bb6c69872724b6f9ca08ea',
  },
  {
    path: 'work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md',
    sha256: '5980eddaad524e7b6bd1e999fefef1d19e6ffe50305fa6569837407c4dedc19f',
  },
  {
    path: 'work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md',
    sha256: 'c960dc939817e9a359466cc544001a6f0484ccffa9f2e37c1b92421f13c023b3',
  },
  {
    path: 'work/fold-audit-2026-08-19.md',
    sha256: '918db6cb2b4ce170959cf2241d210546f90e06050f50e03f7bcb5ce451577306',
  },
  {
    path: 'work/spikes/0001-eess-over-ts-archunit/README.md',
    sha256: '3376c5e9a5f6ae9011d25271f3b62af2f5184f3377708eea74b2bc859db46308',
  },
  {
    path: 'work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md',
    sha256: 'ec12a467f4761218a276794c536e9117f4c33f30477069f7e9cda5ca2365a658',
  },
  {
    path: 'work/bugs/fixed/0198-no-migration-path-from-ts-archunit.md',
    sha256: 'f43c1ee666f51209de188284d7373d5ddda373ed02b10be247c73eb5ffd948a5',
  },
]

export const LEFT_OUT_REASON =
  'a done fold-era record: it describes ts-archunit in its own numbering and is not edited again'

/**
 * A left-out file's pin. The premise is that its prose is not edited again, not that its bytes are
 * frozen: `/close` repairs a link into a record that moved, and that must not unpin the file. So the
 * hash reads the text with every link destination blanked (an inline `](…)` as `]()`, a reference
 * definition's as nothing) and CRLF as LF. Any other edit, a link's text included, changes it, and
 * no mention can sit inside a destination.
 */
export const textHash = (text) =>
  createHash('sha256')
    .update(
      text
        .replace(/\r\n/g, '\n')
        .replace(/\]\([^)\n]*\)/g, ']()')
        .replace(/^( {0,3}\[[^\]\n]+\]:)[^\n]*$/gm, '$1'),
    )
    .digest('hex')

/** For a mention: its document is not one the list leaves out. */
export const notLeftOut = inDocuments(not(or(...LEFT_OUT.map((e) => resideInFile(e.path)))))

/**
 * Each left-out file that is gone or has changed since it was pinned, under `root`: `{ path, cause }`
 * with `cause` `'missing'` or `'changed'`. Either breaks the premise the file is left out on.
 */
export function leftOutFaults(root) {
  const faults = []
  for (const { path, sha256 } of LEFT_OUT) {
    const file = join(root, path)
    if (!existsSync(file)) faults.push({ path, cause: 'missing' })
    else if (textHash(readFileSync(file, 'utf8')) !== sha256)
      faults.push({ path, cause: 'changed' })
  }
  return faults
}

/** A mention's record key, or `undefined` for a match without one. */
export const mentionKey = (m) =>
  m.groups.kind === undefined || m.groups.n === undefined
    ? undefined
    : recordKey(m.groups.kind, m.groups.n)

/**
 * Every record mention outside the list, a record naming itself excluded (plan 0541). The caller
 * adds its own predicates and its condition.
 */
export function recordMentions(corp) {
  return mentions(corp, { pattern: RECORD_MENTION })
    .that()
    .satisfy(
      not(areSelfMentions({ mention: mentionKey, document: (d) => recordKeyOfPath(d.relPath) })),
    )
    .and()
    .satisfy(notLeftOut)
}

// --- The lanes' fix (Phases 2 to 8), removed in Phase 9 ---

/**
 * The fix refuses a mention with another project named around it. `upstream` stays here though the
 * lookbehind dropped it (Decision 2): this only refuses a fix, so it hides nothing from the gate.
 */
export const FOREIGN = /\b(?:ts-archunit|upstream)\b/i

/** Throws when a path in `paths` lies under two of the lane's globs: two rules would fix it. */
export function assertLaneDisjoint(lane, paths) {
  const matchers = lane.map((g) => [g, picomatch(g)])
  for (const path of paths) {
    const hits = matchers.filter(([, match]) => match(path)).map(([g]) => g)
    if (hits.length > 1)
      throw new Error(`mention-fix: ${path} is under two of LANE's globs, ${hits.join(' and ')}.`)
  }
}

/**
 * The lane's anachronism entries (`path:line`), split by the glob each falls under, matched as
 * `resideInFile` matches. Each rule then holds only entries it can match, so an "Unused exclusion"
 * line is a real one. An entry under no glob, or under two, throws: the first would be dropped
 * without that line, the second excluded from one rule and fixed by the other.
 */
export function anachronismsByGlob(lane, entries) {
  const byGlob = new Map(lane.map((g) => [g, []]))
  const matchers = lane.map((g) => [g, picomatch(g)])
  for (const entry of entries) {
    const path = entry.replace(/:\d+$/, '')
    const hits = matchers.filter(([, match]) => match(path))
    if (hits.length !== 1)
      throw new Error(
        `mention-fix: the anachronism ${entry} is under ${hits.length === 0 ? 'none' : 'more than one'} of LANE's globs.`,
      )
    byGlob.get(hits[0][0]).push(entry)
  }
  return byGlob
}

/** One lane glob's rule: each record mention there is linked, with the fix to eess's records. */
export function mentionFixRule(corp, glob) {
  return recordMentions(corp)
    .and()
    .resideInFile(glob)
    .should()
    .beLinked({
      fix: {
        records: {
          elements: recordsOf(corp.fileIndex),
          label: 'eess records',
          identify: (r) => ({ name: r.key }),
        },
        key: { mention: mentionKey, record: (r) => r.key },
        target: (r) => r.target,
        foreign: FOREIGN,
      },
    })
}

const NUMBERED = /^\d{3,4}-/
const NUMBERED_FILE = /^(\d{3,4})-[^/]*\.md$/

/**
 * eess's records (Decision 1): a numbered file in a lane folder (`adr/` directly, a `work/` lane at
 * any depth below), or a numbered folder there, read through its `README.md`; a numbered file inside
 * a numbered folder is not one. Each is `{ key, target }`, `target` its repo-relative file.
 */
export function recordsOf(paths) {
  const records = []
  for (const rel of paths) {
    const s = rel.split('/')
    let kind
    let rest
    if (s[0] === 'adr' && s.length === 2) {
      kind = 'adr'
      rest = [s[1]]
    } else if (s[0] === 'work' && LANE_KINDS[s[1] ?? ''] !== undefined) {
      kind = LANE_KINDS[s[1]]
      rest = s.slice(2)
    } else continue
    const last = rest[rest.length - 1] ?? ''
    const file = NUMBERED_FILE.exec(last)
    if (file !== null && !rest.slice(0, -1).some((x) => NUMBERED.test(x))) {
      records.push({ key: recordKey(kind, file[1]), target: rel })
      continue
    }
    const folder =
      rest.length >= 2 && last === 'README.md' ? NUMBERED.exec(rest[rest.length - 2]) : null
    if (folder !== null && !rest.slice(0, -2).some((x) => NUMBERED.test(x)))
      records.push({ key: recordKey(kind, folder[0].slice(0, -1)), target: rel })
  }
  return records
}
