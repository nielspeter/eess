import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import { isArchRuleError } from '@nielspeter/eess'
import { applyFixes } from '@nielspeter/eess/internal'
import { corpus, corpusFromText, FRAGMENT_NOT_JUDGED, links } from '../src/index.js'
import type { LinkResolveOptions, TextCorpusOptions } from '../src/index.js'

// Bug 0575: a fragment on a file the corpus did not load, on a directory, or written as a line
// (`#L5`) was never judged, and the moved-link fix carried a fragment over unchecked. Bug 0567: the
// moved-link fix wrote a destination that was no longer a link, and the run went green.

const violationsOf = (
  files: Record<string, string>,
  options?: LinkResolveOptions,
  corpusOptions?: TextCorpusOptions,
) =>
  links(corpusFromText(files, corpusOptions))
    .that()
    .areInternal()
    .should()
    .resolve(options)
    .violations()

const findings = (
  files: Record<string, string>,
  options?: LinkResolveOptions,
  corpusOptions?: TextCorpusOptions,
): string[] =>
  violationsOf(files, options, corpusOptions).map((v) => `${String(v.line)} ${v.message}`)

describe('a fragment on a file the corpus did not load is judged (bug 0575)', () => {
  it('an unloaded Markdown file is read for its anchors', () => {
    expect(
      findings(
        {
          'docs/a.md': '# A\n\n[x](../outside/notes.md#gone) [y](../outside/notes.md#present)\n',
          'outside/notes.md': '# N\n\n## Present\n',
        },
        undefined,
        { roots: ['docs/**'] },
      ),
    ).toEqual([
      '3 broken fragment: "../outside/notes.md#gone" — "#gone" is no heading or anchor in outside/notes.md under the GitHub anchor rule',
    ])
  })

  it('a line fragment on a file that is not Markdown is judged against its lines and columns', () => {
    expect(
      findings({
        'docs/a.md':
          '# A\n\n[a](./a.ts#L3) [b](./a.ts#L4) [c](./a.ts#L2-L4) [d](./a.ts#L2C5) [e](./a.ts#L1C2)\n',
        'docs/a.ts': 'a\nhello\nc\n',
      }),
    ).toEqual([
      '3 broken fragment: "./a.ts#L4" — "#L4" is past the end of docs/a.ts, which has 3 lines',
      '3 broken fragment: "./a.ts#L2-L4" — "#L2-L4" is past the end of docs/a.ts, which has 3 lines',
      '3 broken fragment: "./a.ts#L1C2" — "#L1C2" is past the end of line 1 of docs/a.ts, which has 1 character',
    ])
  })

  it('on a loaded Markdown file #L3 is an anchor, and after ?plain=1 it is a line', () => {
    expect(
      findings({
        'docs/a.md':
          '# A\n\n[x](./notes.md#L3) [y](./notes.md?plain=1#L3) [z](./notes.md?plain=1#L9)\n',
        'docs/notes.md': '# N\n\ntext\n',
      }),
    ).toEqual([
      '3 broken fragment: "./notes.md#L3" — "#L3" is no heading or anchor in docs/notes.md under the GitHub anchor rule',
      '3 broken fragment: "./notes.md?plain=1#L9" — "#L9" is past the end of docs/notes.md, which has 3 lines',
    ])
  })

  it('a fragment on a directory is judged against its README.md, loaded or not; with none it is not judged', () => {
    const v = violationsOf(
      {
        'docs/a.md': '# A\n\n[x](./d/#gone) [y](./d/#here) [z](./e/#x)\n',
        'docs/d/README.md': '# D\n\n## Here\n',
        'docs/e/x.txt': 'x\n',
      },
      { resolveDirectories: true },
    )
    expect(v.map((x) => `${x.ruleId ?? ''} ${x.message}`)).toEqual([
      ' broken fragment: "./d/#gone" — "#gone" is no heading or anchor in the page of docs/d/ under the GitHub anchor rule',
      `${FRAGMENT_NOT_JUDGED} the fragment of 1 link into docs/e is not judged: the directory has no page the anchor rule names for it, so this rule cannot judge whether it names a place there (docs/a.md:3)`,
    ])
  })

  it('an unloaded README.md of a directory is read for its anchors', () => {
    expect(
      findings(
        {
          'docs/a.md': '# A\n\n[x](../out/#gone) [y](../out/#here)\n',
          'out/README.md': '# O\n\n## Here\n',
        },
        { resolveDirectories: true },
        { roots: ['docs/**'] },
      ),
    ).toEqual([
      '3 broken fragment: "../out/#gone" — "#gone" is no heading or anchor in the page of out/ under the GitHub anchor rule',
    ])
  })
})

describe('a fragment this rule cannot judge is one unsuppressable finding per target (bug 0575)', () => {
  const files = {
    'docs/a.md': '# A\n\n[x](./f.pdf#page=2) [y](./f.pdf#x)\n\n[i](./ign.md#a)\n',
    'docs/b.md': '# B\n\n[z](./f.pdf#y)\n',
    'docs/f.pdf': '%PDF',
    'docs/ign.md': '# I\n',
  }
  const c = () => corpusFromText(files, { roots: ['docs/**'], ignore: ['docs/ign.md'] })

  it('a .pdf and an ignored file: one finding each, naming the links it covers', () => {
    const v = links(c()).that().areInternal().should().resolve().violations()
    expect(v.map((x) => `${x.ruleId ?? ''} ${x.message}`)).toEqual([
      `${FRAGMENT_NOT_JUDGED} the fragment of 3 links into docs/f.pdf is not judged: it is not Markdown, and the fragment is not a line (\`#L5\`), so this rule cannot judge whether it names a place there (docs/a.md:3, docs/a.md:3, docs/b.md:3)`,
      `${FRAGMENT_NOT_JUDGED} the fragment of 1 link into docs/ign.md is not judged: the corpus ignores the file, so this rule cannot judge whether it names a place there (docs/a.md:5)`,
    ])
  })

  it('survives .excluding(), .warn() and an exclusion comment', () => {
    const v = links(c()).that().areInternal().should().resolve().excluding(/.*/).violations()
    expect(v.filter((x) => x.ruleId === FRAGMENT_NOT_JUDGED)).toHaveLength(2)
    expect(v.every((x) => x.bypassFilters === true)).toBe(true)
    let thrown: unknown
    try {
      links(c()).that().areInternal().should().resolve().warn()
    } catch (e) {
      thrown = e
    }
    expect(isArchRuleError(thrown) ? thrown.violations.length : thrown).toBe(2)
    // A waiver is read from disk, so this half runs over a fixture written to a temp dir.
    const tmp = fs.mkdtempSync(join(os.tmpdir(), 'eess-fragment-waiver-'))
    try {
      for (const [rel, text] of Object.entries(files)) {
        const body =
          rel === 'docs/a.md'
            ? `<!-- eess-exclude ${FRAGMENT_NOT_JUDGED}: a probe -->\n${text}`
            : text
        fs.mkdirSync(join(tmp, rel, '..'), { recursive: true })
        fs.writeFileSync(join(tmp, rel), body)
      }
      const onDisk = corpus({ roots: ['docs/**'], ignore: ['docs/ign.md'], cwd: tmp })
      expect(
        links(onDisk)
          .that()
          .areInternal()
          .should()
          .resolve()
          .rule({ id: FRAGMENT_NOT_JUDGED })
          .violations()
          .filter((x) => x.ruleId === FRAGMENT_NOT_JUDGED),
      ).toHaveLength(2)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})

/** Write `files` under a temp dir, run `rules`, apply their fixes, and return the new text of `a`. */
function applied(
  files: Record<string, string>,
  rules: (c: ReturnType<typeof corpus>) => ReturnType<ReturnType<typeof links>['violations']>[],
): { readonly fixes: number; readonly text: string; readonly after: string[] } {
  const tmp = fs.mkdtempSync(join(os.tmpdir(), 'eess-fragment-fix-'))
  try {
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(join(tmp, rel, '..'), { recursive: true })
      fs.writeFileSync(join(tmp, rel), text)
    }
    const c = corpus({ roots: ['docs/**'], cwd: tmp })
    const found = rules(c).flat()
    const fixes = found.filter((v) => v.fix !== undefined).length
    applyFixes(found, { write: true })
    const text = fs.readFileSync(join(tmp, 'docs/a.md'), 'utf8')
    const again = corpus({ roots: ['docs/**'], cwd: tmp })
    const after = links(again)
      .that()
      .areInternal()
      .should()
      .resolve()
      .violations()
      .map((v) => v.message)
    return { fixes, text, after }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

const resolveOnly = (c: ReturnType<typeof corpus>) => [
  links(c).that().areInternal().should().resolve().violations(),
]

describe('the moved-link fix carries a fragment only when the new target holds it (bug 0575)', () => {
  it('resolve() and beLinkedBack() fix a moved link whose fragment the new document holds', () => {
    const r = applied(
      {
        'docs/a.md': '# A\n\n**Related to:** [b](./old/b.md#sec)\n',
        'docs/new/b.md': '# B\n\n## Sec\n\n**Related to:** [a](../a.md)\n',
      },
      (c) => [
        links(c).that().areInternal().should().resolve().violations(),
        links(c).that().areLabelled('Related to').should().beLinkedBack().violations(),
      ],
    )
    expect(r.fixes).toBe(2)
    expect(r.text).toBe('# A\n\n**Related to:** [b](./new/b.md#sec)\n')
    expect(r.after).toEqual([])
  })

  it('a moved link whose fragment the new document does not hold is reported with no fix, at both callers', () => {
    const r = applied(
      {
        'docs/a.md': '# A\n\n**Related to:** [b](./old/b.md#gone)\n',
        'docs/new/b.md': '# B\n\n## Sec\n\n**Related to:** [a](../a.md)\n',
      },
      (c) => [
        links(c).that().areInternal().should().resolve().violations(),
        links(c).that().areLabelled('Related to').should().beLinkedBack().violations(),
      ],
    )
    expect(r.fixes).toBe(0)
    expect(r.after).toEqual([
      'broken link: "./old/b.md#gone" does not resolve to a file in the repo',
    ])
  })
})

describe('the moved-link fix keeps the link a link (bug 0567)', () => {
  it('a target with a space is written in <…>, and after the fix the link resolves', () => {
    const r = applied(
      {
        'docs/a.md': '# A\n\nSee [b](./old/b.md) now. Also [c](./c.md).\n',
        'docs/c.md': '# C\n',
        'docs/new dir/b.md': '# B\n',
      },
      resolveOnly,
    )
    expect(r.text).toBe('# A\n\nSee [b](<./new dir/b.md>) now. Also [c](./c.md).\n')
    expect(r.after).toEqual([])
  })

  it('a target with a parenthesis is written in <…> too', () => {
    const r = applied(
      { 'docs/a.md': '# A\n\n[b](./old/b.md)\n', 'docs/new (2)/b.md': '# B\n' },
      resolveOnly,
    )
    expect(r.text).toBe('# A\n\n[b](<./new (2)/b.md>)\n')
    expect(r.after).toEqual([])
  })

  it('a target with a | in a table row gets no fix: it would split the cell', () => {
    const r = applied(
      {
        'docs/a.md': '# A\n\n| x |\n| - |\n| [b](./old/b.md) |\n',
        'docs/a|b/b.md': '# B\n',
      },
      resolveOnly,
    )
    expect(r.fixes).toBe(0)
    expect(r.after).toEqual(['broken link: "./old/b.md" does not resolve to a file in the repo'])
  })

  it('a destination already in <…> is rewritten inside it', () => {
    const r = applied(
      { 'docs/a.md': '# A\n\n[b](<./old/b.md>)\n', 'docs/new dir/b.md': '# B\n' },
      resolveOnly,
    )
    expect(r.text).toBe('# A\n\n[b](<./new dir/b.md>)\n')
  })

  it('a plain target still gets its plain fix', () => {
    const r = applied(
      { 'docs/a.md': '# A\n\n[b](./old/b.md)\n', 'docs/new/b.md': '# B\n' },
      resolveOnly,
    )
    expect(r.text).toBe('# A\n\n[b](./new/b.md)\n')
    expect(r.after).toEqual([])
  })
})
