/**
 * Plan 0541: which record a corpus document is, read from its path. `recordKeyOfPath` is the record
 * a document belongs to, so a record naming itself is not a mention: a numbered file, or any file
 * inside a numbered record directory (`work/spikes/0001-eess-over-ts-archunit/README.md` is
 * `spike:1`).
 *
 * A record keeps its key when it moves to a done folder, so nothing reads git's rename detection.
 * Modelled on `proposalNumberFromPath` (`./proposal-ruling.mjs`). Kinds are lower-case, and a
 * number is compared as a number, so `0338` and `338` are one key.
 */

/** The lane folders under `work/` and the kind of record each holds. */
export const LANE_KINDS = { bugs: 'bug', plans: 'plan', spikes: 'spike', proposals: 'proposal' }

const NUMBERED = /^(\d+)-/
const NUMBERED_FILE = /^(\d+)-[^/]*\.md$/

/** `bug:338` from `bug`, `0338`; `adr:9` from `ADR`, `009`. */
export function recordKey(kind, number) {
  return `${kind.toLowerCase()}:${String(Number(number))}`
}

/** The path's segments after its lane folder, with the lane's kind, or `undefined` outside one. */
function laneOf(relPath) {
  const segments = relPath.split('/')
  if (segments[0] === 'adr') return { kind: 'adr', rest: segments.slice(1) }
  if (segments[0] !== 'work') return undefined
  const kind = LANE_KINDS[segments[1] ?? '']
  return kind === undefined ? undefined : { kind, rest: segments.slice(2) }
}

/** The record a document belongs to, or `undefined` when it belongs to none. */
export function recordKeyOfPath(relPath) {
  const lane = laneOf(relPath)
  if (lane === undefined) return undefined
  // ADRs are flat: only a file directly in `adr/` is one.
  const segments = lane.kind === 'adr' && lane.rest.length !== 1 ? [] : lane.rest
  for (const [i, segment] of segments.entries()) {
    const m = (i === segments.length - 1 ? NUMBERED_FILE : NUMBERED).exec(segment)
    if (m !== null) return recordKey(lane.kind, m[1])
  }
  return undefined
}
