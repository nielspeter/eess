import { basename } from 'node:path'
import { globNode, type Predicate } from '@nielspeter/eess'
import picomatch from 'picomatch'
import type { MdDocument } from '../model/document.js'
import { hasSection } from '../model/query.js'

/**
 * The glob a location predicate declares (plan 0456), so an absence rule's
 * selector can be diagnosed. `'normalized'` is the nearest root base: md
 * matches a path relativised from the corpus's `cwd`. md's own check never
 * reads the base; it judges the glob as `'repo-relative'`.
 */
function located(
  call: 'resideInFolder' | 'resideInFile',
  description: string,
  glob: string,
): Predicate<MdDocument> {
  const match = picomatch(glob)
  return {
    description,
    test: (d) => match(d.relPath),
    globs: globNode({ glob, kind: 'file-path', base: 'normalized' }),
    originLabel: `${call}("${glob}")`,
  }
}

/** Documents whose repository-relative path matches the folder glob, e.g. `'guides/**'`. */
export function resideInFolder(glob: string): Predicate<MdDocument> {
  return located('resideInFolder', `reside in folder ${glob}`, glob)
}

/** Documents whose repository-relative path matches the file glob, e.g. `'guides/*.md'`. */
export function resideInFile(glob: string): Predicate<MdDocument> {
  return located('resideInFile', `reside in file ${glob}`, glob)
}

/** Documents whose file name (not its folder) matches the pattern. */
export function haveNameMatching(re: RegExp): Predicate<MdDocument> {
  return {
    description: `have name matching ${String(re)}`,
    test: (d) => re.test(basename(d.relPath)),
  }
}

/** Predicate form of `haveSection` — "documents that have section X". */
export function predicateHaveSection(name: string | RegExp): Predicate<MdDocument> {
  return { description: `have section "${String(name)}"`, test: (d) => hasSection(d, name) }
}

/** Documents `corpus()` marked frozen: matched by its `frozen` globs (plan 0457). */
export function areFrozen(): Predicate<MdDocument> {
  return { description: 'are frozen', test: (d) => d.frozen }
}

/** Documents `corpus()` did not mark frozen (plan 0457). */
export function areLive(): Predicate<MdDocument> {
  return { description: 'are live', test: (d) => !d.frozen }
}
