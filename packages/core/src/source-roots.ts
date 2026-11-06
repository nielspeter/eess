/**
 * Registered source text for files that are not on disk (ADR-024).
 *
 * A dialect whose files live in memory, as eess-md's `corpusFromText` does, claims a root and hands
 * the kernel the texts of the files under it. The kernel's waiver scan in `applyFilters` then reads a
 * claimed file's directives from those texts, never from the disk. This module owns the registry and
 * its one lookup; `execute-rule.ts` is its only reader (ADR-024 clause 8).
 *
 * The registry lives on `globalThis` under a `Symbol.for` key, so every kernel copy in one realm
 * (two copies in one install tree, which `RELEASING.md` records happens) reads the same texts. That
 * also makes it writable by any code in the realm; the lookup's disk checks are what keep a forged
 * entry off a file that is on disk (clause 9).
 */
import fs from 'node:fs'
import path from 'node:path'
import { ArchConfigError } from './errors.js'

/** The shape of the shared object. A change to it is a break (ADR-024 clause 6). */
const SHAPE_VERSION = 1
const KEY = Symbol.for('@nielspeter/eess/source-text')

interface Registry {
  readonly version: typeof SHAPE_VERSION
  readonly roots: Map<string, ReadonlyMap<string, string>>
}

/** No object is an empty registry; an object of another shape is unreadable (clause 6). */
type Read = { kind: 'none' } | { kind: 'ok'; registry: Registry } | { kind: 'unreadable' }

function isRegistry(value: unknown): value is Registry {
  if (typeof value !== 'object' || value === null) return false
  if (!('version' in value) || value.version !== SHAPE_VERSION) return false
  if (!('roots' in value) || !(value.roots instanceof Map)) return false
  let wellFormed = true
  value.roots.forEach((files: unknown, root: unknown) => {
    if (typeof root !== 'string' || !(files instanceof Map)) {
      wellFormed = false
      return
    }
    files.forEach((text: unknown, key: unknown) => {
      if (typeof key !== 'string' || typeof text !== 'string') wellFormed = false
    })
  })
  return wellFormed
}

function readRegistry(): Read {
  const value: unknown = Reflect.get(globalThis, KEY)
  if (value === undefined) return { kind: 'none' }
  return isRegistry(value) ? { kind: 'ok', registry: value } : { kind: 'unreadable' }
}

/** Separators become POSIX, `posix.normalize` collapses `//`, `.` and `..`, a trailing slash goes. */
function normalizeSourcePath(p: string): string {
  const posix = path.posix.normalize(p.replace(/\\/g, '/'))
  return posix.length > 1 && posix.endsWith('/') ? posix.slice(0, -1) : posix
}

const isAbsolute = (p: string): boolean => path.posix.isAbsolute(p) || path.win32.isAbsolute(p)

/** `p` is `root` or lies under it, by whole path segments: `/t/1` does not contain `/t/10`. */
function isUnder(p: string, root: string): boolean {
  if (p === root) return true
  return p.startsWith(root.endsWith('/') ? root : `${root}/`)
}

/** Why a key is not a canonical relative POSIX path, or `undefined`. */
function badKey(key: string): string | undefined {
  if (key === '') return 'is empty'
  if (key.includes('\\')) return 'contains a backslash'
  if (isAbsolute(key)) return 'is absolute'
  if (key.split('/').includes('..')) return "contains '..'"
  if (key.startsWith('./')) return "starts with './'"
  if (path.posix.normalize(key) !== key || key.endsWith('/')) return 'is not normalised'
  return undefined
}

function sameTexts(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

const CALL = 'registerSourceText'

/**
 * Claim `root`: each file under it is the text `files` holds for its path relative to `root`, and
 * nothing else. The kernel copies `files`; changing it afterwards changes nothing.
 *
 * Refused with an `ArchConfigError`, in the kernel's own words (a dialect adds its remedy): a
 * relative root; a root that exists on disk; a key that is not a canonical relative POSIX path, or a
 * value that is not a string; a root equal to, containing, or contained by a registered root, except
 * the same root with an exactly equal map; a registry of a shape this kernel does not know.
 */
export function registerSourceText(root: string, files: Readonly<Record<string, string>>): void {
  if (!isAbsolute(root)) {
    throw new ArchConfigError(
      CALL,
      `${CALL}: root '${root}' is relative; a claimed root is absolute.`,
    )
  }
  const claimed = normalizeSourcePath(root)
  if (fs.existsSync(root) || fs.existsSync(claimed)) {
    throw new ArchConfigError(
      CALL,
      `${CALL}: root '${claimed}' exists on disk, so registered text would stand in for a real file.`,
    )
  }
  const texts = new Map<string, string>()
  for (const [key, text] of Object.entries(files)) {
    const why = badKey(key)
    if (why !== undefined) {
      throw new ArchConfigError(CALL, `${CALL}: key '${key}' under '${claimed}' ${why}.`)
    }
    if (typeof text !== 'string') {
      throw new ArchConfigError(
        CALL,
        `${CALL}: the text of '${key}' under '${claimed}' is not a string.`,
      )
    }
    texts.set(key, text)
  }

  const read = readRegistry()
  if (read.kind === 'unreadable') {
    throw new ArchConfigError(
      CALL,
      `${CALL}: the source-text registry on this realm has a shape this kernel (shape ${String(SHAPE_VERSION)}) ` +
        `does not read; two kernel copies of different shapes share it. Install one shape: upgrade the ` +
        `package that brings the older kernel.`,
    )
  }
  const registry: Registry =
    read.kind === 'ok' ? read.registry : { version: SHAPE_VERSION, roots: new Map() }
  for (const [other, otherTexts] of registry.roots) {
    if (other === claimed) {
      if (sameTexts(otherTexts, texts)) return
      throw new ArchConfigError(
        CALL,
        `${CALL}: root '${claimed}' is already claimed with other texts; a root names one text per ` +
          `path for the realm.`,
      )
    }
    if (isUnder(claimed, other) || isUnder(other, claimed)) {
      throw new ArchConfigError(
        CALL,
        `${CALL}: root '${claimed}' overlaps the claimed root '${other}'; one file would have two texts.`,
      )
    }
  }
  registry.roots.set(claimed, texts)
  if (read.kind === 'none') Reflect.set(globalThis, KEY, registry)
}

/** What the waiver scan reads for one violating file (ADR-024 clause 5). */
type SourceLookup =
  | { readonly kind: 'disk' }
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'finding'
      readonly root: string
      readonly cause: string
      readonly remedy: string
    }

/**
 * Where the waiver scan reads `file`'s directives from, in ADR-024 clause 5's order. Decided here,
 * outside the scan's swallowing `try`, so no outcome can be silenced.
 */
export function lookupSource(file: string): SourceLookup {
  const read = readRegistry()
  if (read.kind === 'none') return { kind: 'disk' }
  if (read.kind === 'unreadable') {
    return {
      kind: 'finding',
      root: '',
      cause:
        `the source-text registry on this realm has a shape this kernel (shape ${String(SHAPE_VERSION)}) ` +
        `does not read, so it cannot tell whether '${file}' is claimed`,
      remedy:
        'install one registry shape: upgrade the package that brings the older kernel, so one kernel copy remains',
    }
  }
  if (file === '' || !isAbsolute(file)) return { kind: 'disk' }
  const normal = normalizeSourcePath(file)
  const roots = [...read.registry.roots.keys()].filter((r) => isUnder(normal, r))
  const [root] = roots
  if (root === undefined) return { kind: 'disk' }
  if (roots.length > 1) {
    return {
      kind: 'finding',
      root: roots.join("', '"),
      cause: `'${file}' lies under ${String(roots.length)} claimed roots ('${roots.join("', '")}')`,
      remedy: 'claim roots that do not overlap; the registry was written past its own refusals',
    }
  }
  if (fs.existsSync(root)) {
    return {
      kind: 'finding',
      root,
      cause: `the claimed root '${root}' exists on disk, created after it was claimed or never checked`,
      remedy: `remove what was created at '${root}', or claim a root that does not exist`,
    }
  }
  if (fs.existsSync(file)) {
    return {
      kind: 'finding',
      root,
      cause: `'${file}' exists on disk, and its spelling folds under the claimed root '${root}'`,
      remedy:
        'claim a root no real path folds onto (in eess-md, leave `root` unset), rename the directory, ' +
        'or report the file by its resolved path',
    }
  }
  const key = normal === root ? '' : normal.slice(root.length + (root.endsWith('/') ? 0 : 1))
  const text = read.registry.roots.get(root)?.get(key)
  if (text !== undefined) return { kind: 'text', text }
  return {
    kind: 'finding',
    root,
    cause: `the rule reported '${file}', which the texts claimed at '${root}' do not hold (or spell differently)`,
    remedy: "report the document's `file`, or add the file to the map",
  }
}

/** Drop every registration. For tests only: the registry has no release (ADR-024 clause 6). */
export function resetSourceTextForTests(): void {
  Reflect.deleteProperty(globalThis, KEY)
}
