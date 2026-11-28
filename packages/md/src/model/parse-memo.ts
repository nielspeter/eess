import type { Root } from 'mdast'
import { createHash } from 'node:crypto'

/**
 * Bug 0547: one parse per distinct text per process. A text was parsed again by every `corpus()` that
 * read it and by every reader not handed its tree — 1,946 parses for 502 texts in one `check:ledger`
 * run (spike 0546). The parse is a function of the text alone, so a held tree cannot go stale.
 *
 * The tree kept is the **master**, deep-frozen. The readers in `./prose.ts` read it, and since bug 0657
 * `parseMarkdown` hands it out too, so every `MdDocument` of one text shares it. A reader that wrote to
 * the master would change every later verdict for that text; frozen, it throws instead. A cache keyed by
 * a tree (`collectLinkBlocks`'s walk, the ledger's list-item lines) now lives as long as the memo holds
 * the master: memory, never a verdict, since each is a function of the tree and its text.
 *
 * Keyed by a hash of the text and then the text compared, so a collision is a miss: V8 hashes a long
 * string by its length, and a `Map` on the text itself was measured at 3 ms a lookup. Bounded by the
 * total length of the texts held (a proxy for the trees, 10–12.5 bytes a character, measured), least
 * recently used dropped first. The bound must hold a corpus, since LRU over a repeated scan larger than itself
 * keeps nothing. It decides only whether a tree is kept, never whether a text is parsed, so running
 * out costs time and no verdict, and is no ADR-016 instrument: a text over the bound is parsed and not
 * kept, and a parse that throws keeps nothing.
 */
export interface ParseMemo {
  /** The frozen master tree for `text`, parsed if not held. */
  master(text: string): Root
  /**
   * Bug 0666: the total length of the texts a corpus is about to read, before it reads them. The
   * bound grows to hold them, up to the cap; past the cap the memo keeps what it holds and stores no
   * more until the next reservation, so a repeated scan in one order reuses what fits instead of
   * nothing.
   */
  reserve(chars: number): void
  /** What the memo has done since its last reset, for the gates that must see it stay warm. */
  stats(): ParseMemoStats
  reset(): void
}

/** Counts since the last reset; `bound` and `reserved` are the current bound and last reservation. */
export interface ParseMemoStats {
  readonly parses: number
  readonly hits: number
  readonly evictions: number
  readonly refused: number
  readonly held: number
  readonly bound: number
  readonly reserved: number
}

const sha1 = (text: string): string => createHash('sha1').update(text).digest('base64')

/**
 * A memo of `parse` holding up to `limit` characters of text, or up to `cap` when a corpus reserves
 * more; `keyOf` is a parameter for the tests. With no reservation it is least recently used within
 * `limit`, as before bug 0666.
 */
export function createParseMemo(
  limit: number,
  parse: (text: string) => Root,
  keyOf: (text: string) => string = sha1,
  { cap = limit }: { readonly cap?: number } = {},
): ParseMemo {
  let entries = new Map<string, { readonly text: string; readonly tree: Root }>()
  let held = 0
  let bound = limit
  let reserved = 0
  // A reservation larger than the bound: least recently used would keep nothing of a repeated scan.
  let overBound = false
  const counts = { parses: 0, hits: 0, evictions: 0, refused: 0 }
  const drop = (key: string): void => {
    const entry = entries.get(key)
    if (entry === undefined) return
    entries.delete(key)
    held -= entry.text.length
    counts.evictions++
  }
  return {
    master(text) {
      const key = keyOf(text)
      const entry = entries.get(key)
      if (entry?.text === text) {
        entries.delete(key)
        entries.set(key, entry)
        counts.hits++
        return entry.tree
      }
      const tree = parse(text)
      counts.parses++
      deepFreeze(tree)
      if (text.length > bound) return tree
      if (overBound && entries.get(key) === undefined && held + text.length > bound) {
        counts.refused++
        return tree
      }
      if (entries.has(key)) {
        drop(key)
        counts.evictions--
      }
      for (const oldest of entries.keys()) {
        if (held + text.length <= bound) break
        drop(oldest)
      }
      entries.set(key, { text, tree })
      held += text.length
      return tree
    },
    reserve(chars) {
      reserved = chars
      // 5% over what the corpus reads, so a document grown since it was counted still fits.
      bound = Math.max(bound, Math.min(cap, Math.ceil(chars * 1.05)))
      overBound = chars > bound
    },
    stats() {
      return { ...counts, held, bound, reserved }
    },
    reset() {
      entries = new Map()
      held = 0
      bound = limit
      reserved = 0
      overBound = false
      counts.parses = 0
      counts.hits = 0
      counts.evictions = 0
      counts.refused = 0
    },
  }
}

function deepFreeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}
