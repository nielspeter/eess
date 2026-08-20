/**
 * The links in the files we PUBLISH have to work from where they are published.
 *
 * `CHANGELOG.md` ships inside the npm package (v0.25.0) because several releases
 * require an action rather than merely describing one, and `node_modules` is
 * where an agent inspecting the installed package looks. But `bugs/`, `plans/`
 * and `src/` are not in `files`, so every relative link in it — all 17 —
 * resolved to nothing from the tarball. Measured on the published 0.25.0
 * artifact, not inferred.
 *
 * Absolute GitHub links fix that and introduce the opposite hazard, which is why
 * this test exists rather than just the rewrite: the repo's link checker only
 * ever validated RELATIVE links, so a `blob/main/...` URL was checked by nothing
 * and rotted in silence. It already had — `plans/0070-a-rule-must-assert-something.md`
 * had moved to `plans/completed/` and the changelog still linked the old path, in
 * two places, shipped.
 *
 * So the property is checked from both directions: no relative link may remain
 * in a shipped file, and every absolute link into this repository must name a
 * path that exists in it.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { packageRoot, repoRoot } from '../roots.js'

const BLOB = 'https://github.com/nielspeter/eess/blob/main/'

/**
 * Files listed in package.json `files` that can contain links.
 *
 * **Only `README.md` in eess**, where the `ts-archunit` original also listed
 * `CHANGELOG.md`. Changesets generates this package's changelog and it carries no
 * links at all, so it is not in `files` and there is nothing in it to check. The
 * first row below derives the list from `package.json` and would fail if that
 * changed, which is how the difference was found rather than assumed.
 */
const SHIPPED = ['README.md']

/** The PACKAGE root: these are the files THIS package publishes to npm. */
const read = (name: string): string => fs.readFileSync(path.join(packageRoot, name), 'utf-8')

describe('files that ship inside the package', () => {
  it('are the ones this test knows about', () => {
    // Derived from package.json rather than hard-coded, so adding a shipped
    // markdown file fails here instead of silently escaping the checks below.
    const pkg: unknown = JSON.parse(read('package.json'))
    const files =
      pkg !== null && typeof pkg === 'object' && 'files' in pkg && Array.isArray(pkg.files)
        ? pkg.files
        : []
    const shippedMarkdown = files.filter(
      (f: unknown): f is string => typeof f === 'string' && f.endsWith('.md'),
    )
    expect([...shippedMarkdown].sort()).toEqual([...SHIPPED].sort())
  })

  for (const name of SHIPPED) {
    it(`${name} has no relative links, because the directories they point at are not published`, () => {
      const relative = [...read(name).matchAll(/\]\((\.{1,2}\/[^)#\s]*)/g)].map((m) => m[1])
      // README's links into `docs/` are the exception this asserts against:
      // `docs/` is not shipped either, so a relative link there is broken in the
      // tarball exactly as the changelog's were.
      expect(relative).toEqual([])
    })
  }
})

describe('absolute links into this repository', () => {
  // The half nothing checked. A `blob/main/...` URL is invisible to a
  // relative-link checker, so it rots the moment a file moves — and files in
  // this repo move on purpose (`bugs/X` → `bugs/fixed/X`, `plans/X` →
  // `plans/completed/X`). Validated against the working tree, which is a
  // different derivation from the URL itself.
  // Shipped files only. The `ts-archunit` original also scanned `plans/ROADMAP.md`
  // — in eess that corpus lives under `work/` and its relative links are already
  // validated by `check:corpus` (930 checks), so adding it here would be a second
  // mechanism for a fact one already covers.
  const sources = [...SHIPPED]

  it('name paths that exist', () => {
    const broken: string[] = []
    let total = 0
    for (const name of sources) {
      for (const match of read(name).matchAll(
        new RegExp(BLOB.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^)\\s#]+)', 'g'),
      )) {
        total += 1
        const target = match[1]
        // The MONOREPO root: a `…/eess/blob/main/<path>` URL is repo-relative, so
        // `docs/agent-integration.md` is resolved from the repository and not from
        // this package — the same URL would 404 on GitHub if it were not.
        if (target !== undefined && !fs.existsSync(path.join(repoRoot, target))) {
          broken.push(`${name} -> ${target}`)
        }
      }
    }
    // Non-vacuity: if the regex stops matching, this test silently certifies
    // nothing.
    //
    // The floor is 1, not the `ts-archunit` original's 15, and the difference is
    // a fact about eess rather than a lowered bar: there the changelog ships and
    // carries ~20 such links; here changesets writes a link-free changelog that is
    // not in `files`, so the entire population is `README.md`'s. It holds two, both
    // of which THIS commit created — they were `../../README.md` and
    // `../../docs/agent-integration.md`, relative links to paths outside the
    // tarball, which is the exact defect the row above exists to catch and which it
    // caught the moment this test could see the real files.
    expect(total).toBeGreaterThan(0)
    expect(broken).toEqual([])
  })
})
