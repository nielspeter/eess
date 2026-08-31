import type { Corpus } from '../corpus.js'
import type { MdDocument } from './document.js'

/**
 * Every reference in the corpus, each stamped with the document it came from.
 *
 * `links`, `pointers` and `task-items` each walked the corpus and re-attached
 * `doc` to what their collector returned — `no-copy-paste` reported the first
 * two at 100%. The collector is the parameter, which is all that ever differed;
 * even its argument order did (`collectLinks(root, text)` against
 * `extractPointers(text, root)`), which is why this takes a callback rather
 * than a `(root, text)` pair.
 *
 * The stamp is not decoration. An md element's violation is reported at
 * `doc.relPath`, so a reference that loses its document is a finding with no
 * file — unactionable, and ADR-009 rule 2's whole subject. One place to attach
 * it is one place for that to be true.
 */
export function stampedByDocument<Ref extends object>(
  corpus: Corpus,
  collect: (doc: MdDocument) => readonly Ref[],
): (Ref & { doc: MdDocument })[] {
  return corpus.documents().flatMap((doc) => collect(doc).map((ref) => ({ ...ref, doc })))
}
