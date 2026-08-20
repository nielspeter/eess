import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

import { docsDir, repoRoot } from '../roots.js'

/**
 * **The `upgrading.md` exemption is gone, because eess has no such page.**
 *
 * Inherited from `ts-archunit`, where that page is a historical record whose
 * per-release table correctly quotes the word this scan bans, so scanning it
 * reddened a correct page. eess publishes no upgrade page, so the carve-out
 * exempted nothing — and the row below asserted it exempted exactly one file,
 * which is how the emptiness was caught rather than inherited silently.
 *
 * A carve-out for a file that does not exist is the stale-exclusion shape this
 * repo deletes everywhere else (`arch.internal.rules.ts` records the same call
 * for `GENERATED`). If an upgrade page is ever added, restore the exemption AND
 * the assertion that it names a real file — not one without the other.
 */

/** Every living doc page, plus the README. `.vitepress/` is build output. */
function livingDocs(): { path: string; text: string }[] {
  const pages = fs
    .readdirSync(docsDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(docsDir, name))
  return [...pages, path.join(repoRoot, 'README.md')].map((file) => ({
    path: path.relative(repoRoot, file),
    text: fs.readFileSync(file, 'utf8'),
  }))
}

/**
 * Plan 0077 promoted `doctor` from hidden experiment to supported command.
 *
 * The promotion is spread over prose in two pages, a help string and a dispatch
 * comment, and the word it removes appears in ordinary sentences — so a reader
 * re-adding "experimental" next to `doctor`, or a page that was simply missed,
 * leaves the docs contradicting `--help` with nothing to catch it. The plan's
 * test inventory claimed this guard existed before it did; review found the row
 * describing a test nobody had written.
 */
describe('docs do not call doctor experimental (plan 0077)', () => {
  it('has no page pairing the command with the word', () => {
    const offenders: string[] = []
    const pages = livingDocs()
    // Nothing is exempt, so the guard is that the scan READ something. Without
    // this the row passes on an empty corpus — which is exactly how the adopted
    // doc gates failed while looking like they had found nothing wrong.
    expect(pages.length).toBeGreaterThan(20)
    for (const file of pages) {
      file.text.split('\n').forEach((line, index) => {
        if (!/\bdoctor\b/.test(line)) return
        if (!/experimental/i.test(line)) return
        offenders.push(`${file.path}:${index + 1}: ${line.trim()}`)
      })
    }
    // The list, not the count — ADR-008 rule 4. A count tells the next reader to
    // go hunting; the line tells them what to edit.
    expect(offenders).toEqual([])
  })

  it('has no link left pointing at the retired #diagnostics-experimental anchor', () => {
    const offenders: string[] = []
    for (const file of livingDocs()) {
      file.text.split('\n').forEach((line, index) => {
        if (!line.includes('diagnostics-experimental')) return
        offenders.push(`${file.path}:${index + 1}: ${line.trim()}`)
      })
    }
    // A dead in-page anchor renders as a link that silently lands at the top of
    // the page — the reader never learns they missed the section.
    expect(offenders).toEqual([])
  })
})
