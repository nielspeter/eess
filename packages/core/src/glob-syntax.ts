import type { GlobBase, GlobKind } from './glob-site.js'
import { isAnchored } from './project-relative.js'

/**
 * The bases the glob-text rules know: the root `GlobBase`s, and
 * `'repo-relative'` for a dialect that matches a glob with picomatch against a
 * repository-relative POSIX path (eess-md). Kernel-internal, not a root type.
 */
export type TextBase = GlobBase | 'repo-relative'

/** A fault decidable from a glob's text alone, with nothing to compare against. */
export type GlobTextFault = 'dot-segment' | 'unanchored' | 'anchored' | 'parent-segment'

/**
 * The one owner of the glob-text rules (plan 0456). eess-ts's `syntacticFault`
 * narrows this for its three bases; eess-md calls it with `'repo-relative'`.
 *
 * For `'repo-relative'`, measured on picomatch 4.0.4 (plan 0456, Problem 4):
 * a leading `./` is stripped and matches, so it is no fault; a leading `/`, a
 * `../` segment anywhere, and a `./` segment after the first can never match.
 * A backslash is never a text fault: before a metacharacter it is the only way
 * to name a folder such as `(x)`, and before any other character it names a
 * different path, not none.
 */
export function globTextFault(
  glob: string,
  kind: GlobKind,
  base: TextBase = 'absolute',
): GlobTextFault | undefined {
  if (base === 'repo-relative') return repoRelativeFault(glob)
  // A './' anywhere, not just leading, makes the glob unmatchable against an
  // absolute path, and adding '**/' in front of it does not help.
  if (/(?:^|\/)\.\//.test(glob)) return 'dot-segment'
  // Exempt for the kinds that are not paths (`notImportFrom('fastify')`), and
  // for the bases where a relative glob is the correct spelling.
  const isPathKind = kind === 'file-path' || kind === 'parent-dir'
  if (isPathKind && base === 'absolute' && !isAnchored(glob)) return 'unanchored'
  return undefined
}

function repoRelativeFault(glob: string): GlobTextFault | undefined {
  if (glob.startsWith('/')) return 'anchored'
  if (/(?:^|\/)\.\.\//.test(glob)) return 'parent-segment'
  if (/\/\.\//.test(glob)) return 'dot-segment'
  return undefined
}

/**
 * The corrected glob for a `'repo-relative'` text fault, where one is unique (for
 * any other base it is not a correction: a leading `./` there is the fault): the
 * leading `/` removed, or every `./` segment after the first removed. A `../`
 * has none: the folder lies outside what the corpus can name.
 */
export function repoRelativeCorrection(glob: string, fault: GlobTextFault): string | undefined {
  if (fault === 'anchored') return glob.replace(/^\/+/, '')
  if (fault === 'dot-segment') return glob.replace(/\/(?:\.\/)+/g, '/')
  return undefined
}
