import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Corpus } from '../corpus.js'

/**
 * What a corpus knows about itself that the `Corpus` interface does not carry: how it decided which
 * files to load, kept so a resolver can say why one was not (plan 0404), and how it reads a file in
 * its index (plan 0455). One registry, set once by the function both constructors call, so a
 * constructor cannot register one and forget the other.
 */
interface CorpusInternals {
  readonly inRoots: (relPath: string) => boolean
  readonly ignored: (relPath: string) => boolean
  readonly read: (relPath: string) => string
}

const internalsOf = new WeakMap<Corpus, CorpusInternals>()

/**
 * Record how a corpus filtered and reads its files. Called by `corpus()` and `corpusFromText()`
 * only; a `Corpus` built any other way has no entry, so an unloaded `.md` file in it is reported as
 * `outside-roots` and its files are read from disk under `root`.
 */
export function registerCorpusInternals(corpus: Corpus, internals: CorpusInternals): void {
  internalsOf.set(corpus, internals)
}

/** The text of a file in the corpus's index: through the corpus that built it, else from disk. */
export function readCorpusFile(corpus: Corpus, relPath: string): string {
  const read = internalsOf.get(corpus)?.read
  return read !== undefined ? read(relPath) : readFileSync(join(corpus.root, relPath), 'utf8')
}

/** The registered internals of a corpus, or `undefined` for a `Corpus` built by hand. */
export function corpusInternals(corpus: Corpus): CorpusInternals | undefined {
  return internalsOf.get(corpus)
}
