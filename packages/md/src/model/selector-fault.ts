import type { GlobNode, GlobSite } from '@nielspeter/eess'
import {
  isGlobNode,
  isOpaqueGlob,
  repoRelativeCorrection,
  globTextFault,
  type GlobTextFault,
  type SelectorFault,
} from '@nielspeter/eess/internal'
import picomatch from 'picomatch'
import type { Corpus } from '../corpus.js'
import { notInCorpusReasons } from './resolve-link.js'

/**
 * Why an eess-md absence rule examined nothing, when the reason is its
 * selector and not the assertion holding (bug 0460, plan 0456).
 *
 * Judged per positive selector site, in order: a fault in the glob text; the
 * repository holds Markdown the glob names that the corpus did not load; a
 * backslash written as a path separator. A glob that names nothing in the
 * repository is never a fault: that is also what a holding ratchet looks like
 * (bug 0355's ruling). `corpus` is absent for `codeBlocks()`, which carries no
 * file index, so only the text is judged there.
 */
export function mdSelectorFault(
  trees: readonly GlobNode[],
  corpus: Corpus | undefined,
): SelectorFault | undefined {
  for (const site of positiveSelectorSites(trees)) {
    const fault =
      textFault(site) ??
      (corpus === undefined
        ? undefined
        : (unloadedFault(site, corpus) ?? separatorFault(site, corpus)))
    if (fault !== undefined) return fault
  }
  return undefined
}

/** The positive selector sites, after negation-normal form: a negative site is never dead. */
function positiveSelectorSites(trees: readonly GlobNode[]): GlobSite[] {
  const out: GlobSite[] = []
  const walk = (node: GlobNode): void => {
    for (const child of node.children) {
      if (isGlobNode(child)) walk(child)
      else if (!isOpaqueGlob(child)) {
        if (child.position === 'selector' && (child.polarity ?? 'positive') === 'positive') {
          out.push(child)
        }
      }
    }
  }
  for (const tree of trees) walk(tree)
  return out
}

const TEXT_CAUSE: Record<Exclude<GlobTextFault, 'unanchored'>, string> = {
  anchored: "a leading `/` can never match a path relative to the corpus's `cwd`",
  'parent-segment': "a `../` segment can never match a path under the corpus's `cwd`",
  'dot-segment': 'a `./` segment after the first can never match a path',
}

/**
 * Why a repository-relative glob can never match, from its text alone, and how to write it; or
 * `undefined`. Shared by the selector-fault check and `corpus()`'s frozen globs (bug 0499).
 */
export function repoRelativeTextProblem(
  glob: string,
): { readonly cause: string; readonly remedy: string } | undefined {
  const fault = globTextFault(glob, 'file-path', 'repo-relative')
  if (fault === undefined || fault === 'unanchored') return undefined
  const correction = repoRelativeCorrection(glob, fault)
  const remedy =
    correction !== undefined
      ? `Write the glob as \`${correction}\`.`
      : "md globs are matched against paths under the corpus's `cwd`; name the folder " +
        'relative to it, or change `cwd`.'
  return { cause: TEXT_CAUSE[fault], remedy }
}

function textFault(site: GlobSite): SelectorFault | undefined {
  const problem = repoRelativeTextProblem(site.glob)
  return problem === undefined ? undefined : { origin: site.origin, ...problem }
}

function markdownPaths(corpus: Corpus): { loaded: string[]; onDisk: string[] } {
  return {
    loaded: corpus.documents().map((d) => d.relPath),
    onDisk: [...corpus.fileIndex].filter((p) => p.endsWith('.md')),
  }
}

/** Bug 0355's class: the repository holds Markdown under the glob that the corpus never loaded. */
function unloadedFault(site: GlobSite, corpus: Corpus): SelectorFault | undefined {
  // The predicate's own matcher and options, so no dotfile is counted that it could never match.
  const match = picomatch(site.glob)
  const { loaded, onDisk } = markdownPaths(corpus)
  if (loaded.some((p) => match(p))) return undefined
  const unloaded = onDisk.filter((p) => match(p))
  const first = unloaded[0]
  if (first === undefined) return undefined
  const count = String(unloaded.length)
  if (notInCorpusReasons(corpus, first).includes('ignored')) {
    return {
      origin: site.origin,
      cause: `${count} Markdown files it names are excluded by the corpus's \`ignore\` (first: \`${first}\`)`,
      remedy: `${count} files this glob names are excluded by the corpus's \`ignore\`; remove that pattern, or narrow the glob.`,
    }
  }
  return {
    origin: site.origin,
    cause: `the repository holds ${count} Markdown files under it that the corpus did not load (first: \`${first}\`)`,
    remedy:
      `The corpus's \`roots\` do not include ${count} Markdown files this glob names (first: ` +
      `\`${first}\`). Add the folder to \`roots\`, or narrow the glob to folders under them.`,
  }
}

/**
 * A backslash before one of these is an escape, never a separator. `-` and `^`
 * are special inside a character class (`[a\\-c]`), so they escape too.
 */
const ESCAPED = new Set(['[', ']', '(', ')', '{', '}', '!', '@', '+', '|', '\\', ' ', '-', '^'])

/**
 * The glob with every separator-like backslash replaced by `/`, or `undefined`
 * when it has none; and whether a replaced one stood before `*` or `?`.
 */
function asSeparators(glob: string): { replaced: string; beforeWildcard: boolean } | undefined {
  let replaced = ''
  let any = false
  let beforeWildcard = false
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i)
    const next = glob.charAt(i + 1)
    if (c !== '\\' || next === '') {
      replaced += c
    } else if (ESCAPED.has(next)) {
      replaced += c + next
      i++
    } else {
      replaced += '/'
      any = true
      if (next === '*' || next === '?') beforeWildcard = true
    }
  }
  return any ? { replaced, beforeWildcard } : undefined
}

/**
 * A Windows separator, on evidence: the glob as written selects no path, and
 * with every candidate backslash read as `/` it selects at least one. The first
 * condition decides the verdict (plan 0456, round five).
 */
function separatorFault(site: GlobSite, corpus: Corpus): SelectorFault | undefined {
  const reading = asSeparators(site.glob)
  if (reading === undefined) return undefined
  const { loaded, onDisk } = markdownPaths(corpus)
  const paths = [...new Set([...loaded, ...onDisk])]
  const asWritten = picomatch(site.glob)
  if (paths.some((p) => asWritten(p))) return undefined
  const asSlashes = picomatch(reading.replaced)
  const selected = paths.filter((p) => asSlashes(p)).length
  if (selected === 0) return undefined
  const literal = reading.beforeWildcard
    ? ' If you meant a literal `*` or `?`, write it as `[*]` or `[?]`.'
    : ''
  return {
    origin: site.origin,
    cause:
      `a \`\\\` is an escape in a glob, not a path separator, so it selects no file, while ` +
      `\`${reading.replaced}\` selects ${String(selected)}`,
    remedy: `Write the glob as \`${reading.replaced}\`.${literal}`,
  }
}
