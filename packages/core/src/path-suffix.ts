/**
 * Resolve a cited path against a set of repo-relative paths.
 *
 * Two dialects had written this independently — `eess-md`'s `uniqueSuffix()`
 * for `path:line` code pointers, and `eess-crossvalidate`'s `resolveFeature`
 * for `.feature` citations. Same algorithm, same three-way answer, and after
 * bug 0254 the same remedy text; bug 0257 is that duplication.
 *
 * **Why the kernel.** It is pure string work over a list of paths: no
 * `ArchProject`, no ts-morph, nothing dialect-shaped. That is exactly
 * `path-universe.ts`'s argument for living here, and
 * [ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md)'s
 * test is satisfied — the kernel takes the *fact* (a list of paths), not the
 * project that produced it. It is family plumbing rather than public API, so it
 * is exported from `internal.ts` (ADR-011).
 *
 * **What it deliberately does not decide.** Whether a `none` is broken, whether
 * an `ambiguous` fails or warns, whether to consult external roots, what the
 * message says — all of that is the caller's policy and differs between the two
 * dialects for good reasons. This answers one question: *which path did they
 * mean?*
 */

/** How a cited path resolves against a set of repo-relative paths. */
export type PathSuffixMatch =
  /** The citation IS a repo-relative path. Wins outright, even if the same tail also matches elsewhere. */
  | { readonly kind: 'exact'; readonly file: string }
  /** Exactly one path ends with the citation on a `/` boundary. */
  | { readonly kind: 'unique'; readonly file: string }
  /** Several do, so the citation names none of them. Candidates in index order. */
  | { readonly kind: 'ambiguous'; readonly files: readonly string[] }
  /** Nothing matches. */
  | { readonly kind: 'none' }

/** A prepared path set. Build once, resolve many. */
export interface PathSuffixIndex {
  resolve(wanted: string): PathSuffixMatch
}

/**
 * Prepare a path set for repeated suffix lookups.
 *
 * Indexed by last segment, because the corpora this runs over resolve hundreds
 * of citations against thousands of paths and a linear scan per citation was
 * measurable in `eess-md`. The index is the reason this takes the whole set up
 * front rather than being a plain two-argument function.
 */
export function pathSuffixIndex(paths: Iterable<string>): PathSuffixIndex {
  const all = new Set<string>()
  const byLastSegment = new Map<string, string[]>()
  for (const rel of paths) {
    all.add(rel)
    const seg = rel.slice(rel.lastIndexOf('/') + 1)
    const list = byLastSegment.get(seg)
    if (list) list.push(rel)
    else byLastSegment.set(seg, [rel])
  }

  return {
    resolve(wanted: string): PathSuffixMatch {
      // Exact first, and it wins outright. A citation that IS a real path is not
      // ambiguous just because some longer path happens to end the same way —
      // both dialects had this precedence already, and getting it backwards
      // would turn correct citations into findings.
      if (all.has(wanted)) return { kind: 'exact', file: wanted }

      const seg = wanted.slice(wanted.lastIndexOf('/') + 1)
      // Narrow by last segment, then confirm the FULL suffix on a `/` boundary:
      // `x.ts` must not match `prefix-x.ts`, and `a/x.ts` must not match
      // `b/aa/x.ts`.
      const matches = (byLastSegment.get(seg) ?? []).filter((f) => f.endsWith('/' + wanted))
      const only = matches[0]
      if (matches.length === 1 && only !== undefined) return { kind: 'unique', file: only }
      if (matches.length > 1) return { kind: 'ambiguous', files: matches }
      return { kind: 'none' }
    },
  }
}
