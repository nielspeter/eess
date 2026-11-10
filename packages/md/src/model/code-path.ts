import { pathSuffixIndex } from '@nielspeter/eess/internal'
import type { Corpus } from '../corpus.js'
import { readCorpusFile } from './corpus-internals.js'
import { lineCount } from './line-count.js'

/**
 * Where a cited path lands in a corpus (plan 0648): one resolver, shared by `pointers().resolve()`
 * and the code-reference conditions, so a pointer cannot resolve one way under one rule and another
 * way under the next (bug 0257's lesson). In-corpus only: a path the corpus does not hold is
 * `broken`, never skipped. External roots stay with `pointerResolves`, whose caller reports them.
 */
export type CitedPath =
  | { readonly kind: 'resolved'; readonly rel: string }
  /**
   * `unique`: the one file whose path ends with the cited one, which a pointer fix may rewrite to.
   * Set in `exact` mode, where a suffix match does not resolve; and in `suffix` mode never, since
   * there a unique suffix match is `resolved`.
   */
  | { readonly kind: 'broken'; readonly wanted: string; readonly unique?: string }
  | { readonly kind: 'ambiguous'; readonly wanted: string; readonly candidates: readonly string[] }

/** A corpus's cited paths, each file read once and its lines and tokens worked out once. */
export interface CitedPaths {
  /** Where `path` lands. A leading `./` or `/` is not part of the path. */
  classify(path: string): CitedPath
  /** A resolved file's text. */
  text(rel: string): string
  /** A resolved file's line count, as `lineCount` counts it. */
  lines(rel: string): number
  /** A resolved file's tokens: its text split on every character outside `[A-Za-z0-9_$]`. */
  tokens(rel: string): ReadonlySet<string>
}

/** The path without the `./` or `/` a writer may put before a repo-relative path. */
export function wantedPath(path: string): string {
  return path.replace(/^\.?\//, '')
}

const CACHE = new WeakMap<Corpus, Map<'suffix' | 'exact', CitedPaths>>()

/**
 * The corpus's cited paths under one resolution mode, made once per corpus and mode, so every rule
 * over the same corpus shares one index and one read of each file.
 *
 * - `suffix`: the exact repo-relative path, else the one file whose path ends with it on a `/`
 *   boundary; several such files are `ambiguous`.
 * - `exact`: the exact repo-relative path only; anything else is `broken`, carrying the unique
 *   suffix match when there is exactly one.
 */
export function citedPaths(corpus: Corpus, mode: 'suffix' | 'exact'): CitedPaths {
  let byMode = CACHE.get(corpus)
  if (byMode === undefined) {
    byMode = new Map()
    CACHE.set(corpus, byMode)
  }
  const known = byMode.get(mode)
  if (known !== undefined) return known

  const index = pathSuffixIndex(corpus.fileIndex)
  const texts = new Map<string, string>()
  const lineCounts = new Map<string, number>()
  const tokenSets = new Map<string, ReadonlySet<string>>()

  const text = (rel: string): string => {
    let t = texts.get(rel)
    if (t === undefined) {
      t = readCorpusFile(corpus, rel)
      texts.set(rel, t)
    }
    return t
  }

  const made: CitedPaths = {
    classify(path: string): CitedPath {
      const wanted = wantedPath(path)
      const match = index.resolve(wanted)
      if (match.kind === 'exact') return { kind: 'resolved', rel: match.file }
      if (mode === 'suffix') {
        if (match.kind === 'unique') return { kind: 'resolved', rel: match.file }
        if (match.kind === 'ambiguous')
          return { kind: 'ambiguous', wanted, candidates: match.files }
        return { kind: 'broken', wanted }
      }
      return match.kind === 'unique'
        ? { kind: 'broken', wanted, unique: match.file }
        : { kind: 'broken', wanted }
    },
    text,
    lines(rel: string): number {
      let n = lineCounts.get(rel)
      if (n === undefined) {
        n = lineCount(text(rel))
        lineCounts.set(rel, n)
      }
      return n
    },
    tokens(rel: string): ReadonlySet<string> {
      let set = tokenSets.get(rel)
      if (set === undefined) {
        set = new Set(
          text(rel)
            .split(/[^A-Za-z0-9_$]+/)
            .filter((t) => t !== ''),
        )
        tokenSets.set(rel, set)
      }
      return set
    },
  }
  byMode.set(mode, made)
  return made
}
