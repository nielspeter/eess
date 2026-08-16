/**
 * Whether a glob can already match an absolute path.
 *
 * Extracted from ts-archunit's larger `project-relative.ts`, most of which
 * (`rootOf`/`relativeToRoot`, workspace multi-root awareness) needs
 * `ArchProject`/ts-morph and stays deferred — this one predicate is pure
 * string syntax with no dependency on either, and `glob-diagnosis.ts` needs
 * it to be kernel-eligible at all, so it gets its own small home here rather
 * than waiting on the ts-morph-blocked half of the file it came from.
 *
 * Covers POSIX-absolute and Windows drive-absolute globs as well as an
 * explicit globstar.
 */
export function isAnchored(glob: string): boolean {
  return glob.startsWith('**/') || glob.startsWith('/') || /^[A-Za-z]:\//.test(glob)
}

/**
 * Does this glob name a location relative to the project root?
 *
 * Only an **unanchored, relative** glob is normalized. `'**\/x'` is explicitly
 * "anywhere" and must keep meaning that; `'/abs/x'` is already absolute. So
 * this is the same population `syntacticFault` calls `unanchored`, which is
 * what makes the two consistent: a glob stops being reported dead for being
 * unanchored exactly when it starts working.
 */
export function isProjectRelative(glob: string): boolean {
  // A `./` segment is excluded, and that exclusion is load-bearing rather than
  // fussy. `syntacticFault` reports `dot-segment` for a `./` anywhere in a
  // glob, so normalizing one would make the rule MATCH at runtime while the
  // gate still reported it dead — two derivations disagreeing about the same
  // glob, which is the failure this project spends most of its guards on.
  //
  // `./` is a mistake in both worlds — it never occurs in an absolute path and
  // it says nothing extra in a relative one — so the honest fix is to leave it
  // failing, with advice that says to remove it.
  // `..` is not relative-to-the-root in any usable sense: containment returns
  // `undefined` for anything above the root, deliberately, so a `../`
  // glob would normalize to nothing and be reported dead with three false
  // causes. Excluded alongside `./` — both are mistakes in both readings.
  if (/(?:^|\/)\.\.?\//.test(glob)) return false
  // Derived from `isAnchored`, not restated — two lists that disagree is the
  // failure this file spends most of its guards on. `isAnchored` covers `/x`,
  // `**/x` and a drive-absolute `C:/x`.
  if (isAnchored(glob)) return false
  // `*/x/**` is deliberately NOT normalized, even though it is unanchored.
  // Normalizing it would make it match, which sounds like an improvement until
  // you notice it is the LAST reachable `unanchored` fault for a path glob —
  // the anchor advice would become unreachable. Left failing, with a remedy
  // that works: `'**/x/**'`.
  return !glob.startsWith('*/')
}
