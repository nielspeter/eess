// @nielspeter/eess-md/internal — family plumbing, the dialect's counterpart of the kernel's (ADR-011).
//
// NOT public API. These symbols exist so the family's other markdown readers — eess-crossvalidate and this
// repo's own gate scripts — read a document's prose with the one reader this dialect owns rather than a
// copy of it (bug 0287). A consumer writing rules never names them, and nothing here is taught by `docs/`
// or the package README.
//
// As with the kernel's, the boundary holds on this side only: the package barrel must never re-export
// what is here (checked by `scripts/lib/internal-not-reexported.test.mjs`), and a subpath export is
// resolvable by anyone.
//
// `unterminatedFence` rides along with `proseText` on purpose: a caller that sets aside only closed
// fences is choosing to read past an unclosed one, and ADR-010's line is that a verdict is built from
// evidence. A caller that can report should be able to reach the fact, not just the reading.

export { proseText, unclosedFences, unterminatedFence, type SetAside } from './model/prose.js'
