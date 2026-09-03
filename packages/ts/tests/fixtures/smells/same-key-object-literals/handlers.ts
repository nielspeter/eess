// Several duplicate findings from ONE rule in ONE file — the shape a collision
// guard needs. A fixture with a single finding cannot detect a collision at
// all, because one finding never collides with anything.
//
// `routeA.handler` and `routeB.handler` share a key name. Before the owning
// binding was included in the qualified name, both were reported as `handler`
// and their duplicate identities merged: accepting one accepted the other.
//
// **Three shapes, not one.** The fixture used to be three byte-identical
// bodies, which reported as three PAIRS. Once findings report per CLUSTER, three
// mutually-identical bodies are one observation and one finding — and a guard
// against identity collision that only ever sees one finding has no teeth, which
// is the failure this fixture's own header warns about.
//
// So the same-named keys now sit in DIFFERENT clusters: `routeA.handler` pairs
// with `routeC.process` (shape 1) and `routeB.handler` pairs with
// `routeD.process` (shape 2). That is a sharper test of the original bug than
// the old fixture was — the two `handler` keys are now reported as two separate
// findings whose identities must not merge, which is exactly the collision.
//
// Each shape is byte-identical within its own pair, so they pair at 100%, and
// the shapes differ enough in statement count and structure to stay below the
// 0.8 threshold across pairs. Vocabulary is padded past the floor (plan 0103,
// Phase 0 Problem A).

const OFFSET = 1
const MULTIPLIER = 3
const BONUS = 2
const LIMIT = 100

// ---- shape 1: a linear arithmetic pipeline ----

export const routeA = {
  handler: async (n: number) => {
    const scaled = n * MULTIPLIER
    const shifted = scaled + OFFSET
    const boosted = shifted + BONUS
    const capped = boosted > LIMIT ? LIMIT : boosted
    const rounded = Math.round(capped)
    const flagged = rounded > 0
    const label = flagged ? 'active' : 'inactive'
    return { value: rounded, ok: flagged, extra: label, note: 'done' }
  },
}

export const routeC = {
  process: async (n: number) => {
    const scaled = n * MULTIPLIER
    const shifted = scaled + OFFSET
    const boosted = shifted + BONUS
    const capped = boosted > LIMIT ? LIMIT : boosted
    const rounded = Math.round(capped)
    const flagged = rounded > 0
    const label = flagged ? 'active' : 'inactive'
    return { value: rounded, ok: flagged, extra: label, note: 'done' }
  },
}

// ---- shape 2: a loop accumulating over a list ----

export const routeB = {
  handler: async (items: string[]) => {
    const collected: string[] = []
    for (const entry of items) {
      if (entry.length > OFFSET) {
        collected.push(entry.toUpperCase())
      }
    }
    return { total: collected.length, first: collected[0], all: collected }
  },
}

export const routeD = {
  process: async (items: string[]) => {
    const collected: string[] = []
    for (const entry of items) {
      if (entry.length > OFFSET) {
        collected.push(entry.toUpperCase())
      }
    }
    return { total: collected.length, first: collected[0], all: collected }
  },
}

// ---- shape 3: a switch dispatch ----

export const routeE = {
  run: async (mode: string) => {
    switch (mode) {
      case 'alpha':
        return { kind: 'alpha', weight: MULTIPLIER, tag: 'one' }
      case 'bravo':
        return { kind: 'bravo', weight: BONUS, tag: 'two' }
      default:
        return { kind: 'other', weight: LIMIT, tag: 'none' }
    }
  },
}

export const routeF = {
  run: async (mode: string) => {
    switch (mode) {
      case 'alpha':
        return { kind: 'alpha', weight: MULTIPLIER, tag: 'one' }
      case 'bravo':
        return { kind: 'bravo', weight: BONUS, tag: 'two' }
      default:
        return { kind: 'other', weight: LIMIT, tag: 'none' }
    }
  },
}
