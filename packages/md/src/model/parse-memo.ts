import type { Root } from 'mdast'
import { createHash } from 'node:crypto'

/**
 * Bug 0547: one parse per distinct text per process. A text was parsed again by every `corpus()` that
 * read it and by every reader not handed its tree — 1,946 parses for 502 texts in one `check:ledger`
 * run (spike 0546). The parse is a function of the text alone, so a held tree cannot go stale.
 *
 * The tree kept is the **master**, deep-frozen, and it never leaves `./prose.ts`: the readers there read
 * it, and `parseMarkdown` hands each caller its own copy, so every `MdDocument` owns a mutable tree as
 * before and two documents of one text share no node. A reader that wrote to the master would change
 * every later verdict for that text; frozen, it throws instead.
 *
 * Keyed by a hash of the text and then the text compared, so a collision is a miss: V8 hashes a long
 * string by its length, and a `Map` on the text itself was measured at 3 ms a lookup. Bounded by the
 * total length of the texts held (a proxy for the trees, 10–12.5 bytes a character, measured), least recently
 * used dropped first. The bound must hold a corpus, since LRU over a repeated scan larger than itself
 * keeps nothing. It decides only whether a tree is kept, never whether a text is parsed, so running
 * out costs time and no verdict, and is no ADR-016 instrument: a text over the bound is parsed and not
 * kept, and a parse that throws keeps nothing.
 */
export interface ParseMemo {
  /** The frozen master tree for `text`, parsed if not held. Never hand it to a caller. */
  master(text: string): Root
  reset(): void
}

const sha1 = (text: string): string => createHash('sha1').update(text).digest('base64')

/** A memo of `parse` holding up to `limit` characters of text; `keyOf` is a parameter for the tests. */
export function createParseMemo(
  limit: number,
  parse: (text: string) => Root,
  keyOf: (text: string) => string = sha1,
): ParseMemo {
  let entries = new Map<string, { readonly text: string; readonly tree: Root }>()
  let held = 0
  const drop = (key: string): void => {
    const entry = entries.get(key)
    if (entry === undefined) return
    entries.delete(key)
    held -= entry.text.length
  }
  return {
    master(text) {
      const key = keyOf(text)
      const entry = entries.get(key)
      if (entry?.text === text) {
        entries.delete(key)
        entries.set(key, entry)
        return entry.tree
      }
      const tree = parse(text)
      deepFreeze(tree)
      if (text.length > limit) return tree
      drop(key)
      for (const oldest of entries.keys()) {
        if (held + text.length <= limit) break
        drop(oldest)
      }
      entries.set(key, { text, tree })
      held += text.length
      return tree
    },
    reset() {
      entries = new Map()
      held = 0
    },
  }
}

function deepFreeze(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
}
