import { basename } from 'node:path'
import type { Predicate } from '@nielspeter/eess'
import picomatch from 'picomatch'
import type { MdDocument } from '../model/document.js'
import { hasSection } from '../model/query.js'

export function resideInFolder(glob: string): Predicate<MdDocument> {
  const match = picomatch(glob)
  return { description: `reside in folder ${glob}`, test: (d) => match(d.relPath) }
}

export function resideInFile(glob: string): Predicate<MdDocument> {
  const match = picomatch(glob)
  return { description: `reside in file ${glob}`, test: (d) => match(d.relPath) }
}

export function haveNameMatching(re: RegExp): Predicate<MdDocument> {
  return {
    description: `have name matching ${String(re)}`,
    test: (d) => re.test(basename(d.relPath)),
  }
}

/** Predicate form of `haveSection` — "documents that have section X". */
export function haveSectionPredicate(name: string | RegExp): Predicate<MdDocument> {
  return { description: `have section "${String(name)}"`, test: (d) => hasSection(d, name) }
}
