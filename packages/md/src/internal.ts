// @nielspeter/eess-md/internal — family plumbing, the dialect's counterpart of the kernel's (ADR-011).
//
// NOT public API. These symbols exist so the family's other markdown readers — eess-crossvalidate and this
// repo's own gate scripts — read a document's prose with the one reader this dialect owns rather than a
// copy of it (bug 0287). A consumer writing rules never names them, and nothing here is taught by `docs/`
// or the package README.
//
// As with the kernel's, the boundary holds on this side only: the package barrel must never re-export
// what is here, and a subpath export is resolvable by anyone.

export { proseText, type SetAside } from './model/prose.js'
