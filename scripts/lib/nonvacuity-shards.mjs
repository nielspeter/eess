/**
 * Sharding for `check:nonvacuity` (plan 0509).
 *
 * The harness runs its fixtures in series, and in CI that took 31.9 of the
 * `test` job's ~43 minutes. CI now runs the fixtures as N parallel shards and a
 * merge job; locally nothing changes: with no shard variable set the harness runs
 * the whole set exactly as before.
 *
 * The danger in splitting a gate is a fixture that runs nowhere while every
 * shard reads green, or a whole-set check that no shard can answer. So the
 * assignment and the proof are kept apart:
 *
 * - `selectShard` assigns fixture `k` (by position in the harness's own `gates`
 *   list, instruments excluded) to shard `k mod N`. Nothing is kept by hand, and a
 *   fixture added anywhere in the list lands in some shard by construction.
 * - `mergeShardReports` does NOT trust that. It reads what each shard says it
 *   ran and checks the union against the list in this checkout: every fixture in
 *   exactly one shard, every shard present once, all from the same list. It is the
 *   only place the partition is decided, so a broken selector reds there too.
 *
 * Node builtins only: the merge job runs without `npm ci`.
 */
import { createHash } from 'node:crypto'

/** The environment variables the harness reads. Named once, used by CI and tests. */
export const SHARD_ENV = 'EESS_NONVACUITY_SHARD'
export const REPORT_ENV = 'EESS_NONVACUITY_REPORT'
export const MERGE_ENV = 'EESS_NONVACUITY_MERGE'

/**
 * Parse `i/N` (1-based). Returns `{ index, total }` or an error string; a
 * malformed spec must never fall back to "run everything" or "run nothing".
 * @param {string} spec
 * @returns {{ index: number, total: number } | { error: string }}
 */
export function parseShard(spec) {
  const m = /^([1-9]\d*)\/([1-9]\d*)$/.exec(String(spec).trim())
  if (m === null) return { error: `${SHARD_ENV}="${spec}" is not of the form i/N (1-based)` }
  const index = Number(m[1])
  const total = Number(m[2])
  if (index > total) return { error: `${SHARD_ENV}="${spec}": shard ${index} of only ${total}` }
  return { index, total }
}

/**
 * The fixtures shard `index` of `total` runs: every `total`-th name, starting at
 * position `index - 1`.
 * @param {readonly string[]} names
 * @param {number} index 1-based
 * @param {number} total
 */
export function selectShard(names, index, total) {
  return names.filter((_, k) => k % total === index - 1)
}

/**
 * A digest of the fixture list, so the merge can refuse reports that were made
 * from a different list than the one it checks against.
 * @param {readonly string[]} names
 */
export function digestOf(names) {
  return createHash('sha256').update(names.join('\n')).digest('hex').slice(0, 16)
}

/** Names that occur more than once. A duplicate name makes the partition ambiguous. */
export function duplicateNames(names) {
  const seen = new Set()
  const dups = new Set()
  for (const n of names) (seen.has(n) ? dups : seen).add(n)
  return [...dups]
}

/**
 * @typedef {{ shard: number, of: number, digest: string, selected: string[], ran: string[],
 *   failed: string[], assertedRuleIds: string[], durationMs?: number }} ShardReport
 */

/**
 * Check that what the shards RAN partitions `names`. `selected` is the shard's
 * declaration and is only compared against `ran`; the partition and the count are
 * built from `ran` (ADR-010: a pass is constructed from evidence). Returns the
 * problems found, the number of fixtures that ran and fired, and the union of rule
 * ids the shards asserted on, which the whole-set rule-id audit reads.
 * @param {readonly string[]} names the fixture list of this checkout, instruments excluded
 * @param {ReadonlyArray<{ file: string, report: unknown }>} reports
 * @returns {{ problems: string[], assertedRuleIds: Set<string>, shards: number, fired: number }}
 */
export function mergeShardReports(names, reports) {
  const problems = []
  const assertedRuleIds = new Set()
  if (reports.length === 0) {
    problems.push('no shard report found, so no fixture is known to have run')
    return { problems, assertedRuleIds, shards: 0, fired: 0 }
  }
  const digest = digestOf(names)
  const totals = new Set()
  const seenShards = new Map()
  const ranIn = new Map()
  let fired = 0
  for (const { file, report } of reports) {
    if (!isReport(report)) {
      problems.push(`${file} is not a shard report`)
      continue
    }
    totals.add(report.of)
    if (report.digest !== digest) {
      problems.push(
        `${file} (shard ${report.shard}/${report.of}) was made from a different fixture list ` +
          `(digest ${report.digest}, this checkout ${digest})`,
      )
    }
    if (seenShards.has(report.shard)) {
      problems.push(
        `shard ${report.shard} reported twice (${seenShards.get(report.shard)}, ${file})`,
      )
    }
    seenShards.set(report.shard, file)
    if (report.selected.length === 0) problems.push(`shard ${report.shard} selected no fixture`)
    const notRun = report.selected.filter((n) => !report.ran.includes(n))
    const unselected = report.ran.filter((n) => !report.selected.includes(n))
    if (
      notRun.length > 0 ||
      unselected.length > 0 ||
      report.ran.length !== report.selected.length
    ) {
      problems.push(
        `shard ${report.shard} selected ${report.selected.length} fixtures and ran ` +
          `${report.ran.length}` +
          (notRun.length > 0 ? `; selected but not run: ${notRun.join(', ')}` : '') +
          (unselected.length > 0 ? `; run but not selected: ${unselected.join(', ')}` : ''),
      )
    }
    for (const f of report.failed) {
      problems.push(`shard ${report.shard}: fixture "${f}" did not fire on its violating input`)
    }
    for (const n of report.ran) {
      const where = ranIn.get(n) ?? []
      where.push(report.shard)
      ranIn.set(n, where)
    }
    for (const id of report.assertedRuleIds) assertedRuleIds.add(id)
    fired += report.ran.filter((n) => !report.failed.includes(n)).length
  }
  if (totals.size > 1) problems.push(`shard reports disagree on N: ${[...totals].join(', ')}`)
  const total = Math.max(0, ...totals)
  for (let s = 1; s <= total; s++) {
    if (!seenShards.has(s)) problems.push(`shard ${s} of ${total} sent no report`)
  }
  for (const n of names) {
    const where = ranIn.get(n)
    if (where === undefined) problems.push(`fixture "${n}" ran in no shard`)
    else if (where.length > 1) problems.push(`fixture "${n}" ran in shards ${where.join(', ')}`)
  }
  const known = new Set(names)
  for (const n of ranIn.keys()) {
    if (!known.has(n)) problems.push(`a shard ran "${n}", which is not in this checkout's list`)
  }
  return { problems, assertedRuleIds, shards: seenShards.size, fired }
}

function isReport(r) {
  return (
    typeof r === 'object' &&
    r !== null &&
    Number.isInteger(r.shard) &&
    Number.isInteger(r.of) &&
    typeof r.digest === 'string' &&
    Array.isArray(r.selected) &&
    Array.isArray(r.ran) &&
    Array.isArray(r.failed) &&
    Array.isArray(r.assertedRuleIds)
  )
}

/**
 * Read the CI workflow for the shard and merge jobs. The merge is the only place
 * the partition and the whole-set checks run, so a workflow that drops it, lets
 * it be skipped, or lets its failure pass would leave every shard green over an
 * unchecked split. Same technique as `checkBunLoadJob` (plan 0448).
 * @param {string} ciText
 */
export function checkNonvacuityJobs(ciText) {
  const shard = jobLines(ciText, 'nonvacuity-shard')
  const merge = jobLines(ciText, 'nonvacuity')
  const problems = []
  if (shard === undefined) problems.push('ci.yml has no `nonvacuity-shard` job')
  else {
    if (!shard.some((l) => l.includes(`${SHARD_ENV}:`))) {
      problems.push(`the \`nonvacuity-shard\` job does not set ${SHARD_ENV}`)
    }
    if (!shard.some((l) => l.includes(`${REPORT_ENV}:`))) {
      problems.push(`the \`nonvacuity-shard\` job does not set ${REPORT_ENV}`)
    }
    if (!shard.some((l) => /run:\s*npm run check:nonvacuity\s*$/.test(l))) {
      problems.push('the `nonvacuity-shard` job does not run `npm run check:nonvacuity`')
    }
  }
  if (merge === undefined) {
    problems.push('ci.yml has no `nonvacuity` merge job, so the shard partition is never checked')
    return problems
  }
  if (!merge.some((l) => l.includes(`${MERGE_ENV}:`))) {
    problems.push(`the \`nonvacuity\` job does not set ${MERGE_ENV}`)
  }
  if (!merge.some((l) => /run:\s*npm run check:nonvacuity\s*$/.test(l))) {
    problems.push('the `nonvacuity` job does not run `npm run check:nonvacuity`')
  }
  if (!merge.some((l) => /^ {4}needs:\s*nonvacuity-shard\s*$/.test(l))) {
    problems.push('the `nonvacuity` job does not wait for `nonvacuity-shard` (`needs:`)')
  }
  if (!merge.some((l) => /^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}\s*$/.test(l))) {
    problems.push(
      'the `nonvacuity` job is not `if: ${{ !cancelled() }}`, so a failed shard skips the merge',
    )
  }
  if (merge.some((l) => /^ {6,}-?\s*if:/.test(l))) {
    problems.push('a step of the `nonvacuity` job has an `if:`, so it does not always run')
  }
  if ([...(shard ?? []), ...merge].some((l) => /^\s*-?\s*continue-on-error:/.test(l))) {
    problems.push(
      'a nonvacuity job or step sets `continue-on-error`, so its failure need not fail the run',
    )
  }
  return problems
}

function jobLines(ciText, name) {
  const lines = ciText.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^ {2}${name}:\\s*(#.*)?$`).test(l))
  if (start === -1) return undefined
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start + 1, end).filter((l) => !/^\s*#/.test(l))
}
