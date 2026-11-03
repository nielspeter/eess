import { describe, expect, it } from 'vitest'
import { corpusFromText, links } from '../src/index.js'

// Bug 0583: the resolver cut a link's URL at `#` only, so a query stayed in the path, and
// `./logo.png?raw=true` was "broken" beside `logo.png`. GitHub reads `?…` as a query: `?raw=true`
// serves the raw file and `?plain=1` shows a Markdown file's source.

const resolveOf = (files: Record<string, string>) =>
  links(corpusFromText(files)).that().areInternal().should().resolve().violations()

const page = (body: string) => `# R\n\n${body}\n`

describe('a local link with a query string resolves to its file (bug 0583)', () => {
  it('?raw=true on an image file, ?plain=1 on a document, and both with a fragment resolve', () => {
    const v = resolveOf({
      'docs/readme.md': page(
        '[q](./logo.png?raw=true)\n\n[q2](./a.md?plain=1)\n\n[q3](./a.md?plain=1#a)\n\n[control](./logo.png)',
      ),
      'docs/logo.png': 'png',
      'docs/a.md': '# A\n',
    })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(4)
  })

  it('a missing file is still broken, with its query', () => {
    const v = resolveOf({
      'docs/readme.md': page('[q](./gone.png?raw=true)'),
      'docs/a.md': '# A\n',
    })
    expect(v.map((x) => x.message)).toEqual([
      'broken link: "./gone.png?raw=true" does not resolve to a file in the repo',
    ])
  })

  it('a `?` written %3F is part of the file name, and resolves to that file', () => {
    const v = resolveOf({ 'docs/readme.md': page('[q](./a%3F.md)'), 'docs/a?.md': '# A\n' })
    expect(v.map((x) => x.message)).toEqual([])
  })

  it('a URL that is only a query names the document itself', () => {
    const v = resolveOf({ 'docs/readme.md': page('[source](?plain=1)') })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
  })
})

describe('the path ends at the first `?` or `#`, whichever comes first (bug 0583)', () => {
  it('a `?` after a `#` is part of the fragment, so the path is the file', () => {
    // The fragment `x?y` is judged since bug 0136, so `a.md` holds an anchor of that name.
    const v = resolveOf({
      'docs/readme.md': page('[x](./a.md#x?y)'),
      'docs/a.md': '# A\n\n<a id="x?y"></a>\n',
    })
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
  })

  it('haveLiveTargets reads a query-string link into a frozen record as that record, and drops it', () => {
    const c = corpusFromText({
      'docs/readme.md': page('[old](./completed/r.md?plain=1)\n\n[live](./live.md)'),
      'docs/completed/r.md': '# R\n',
      'docs/live.md': '# L\n',
    })
    const v = links(c).that().areInternal().and().haveLiveTargets().should().resolve().violations()
    expect(v.map((x) => x.message)).toEqual([])
    expect(v.examined).toBe(1)
  })
})

describe('a moved target linked with a query keeps the query and the fragment (bug 0583)', () => {
  // Since bug 0575 a fragment is carried only when the new target holds it: here a line the moved
  // file has, read after `?plain=1`.
  it('./old/guide.md?plain=1#L1 is rewritten to the new path with ?plain=1#L1', () => {
    const text = page('[q](./old/guide.md?plain=1#L1)')
    const v = resolveOf({ 'docs/readme.md': text, 'docs/new/guide.md': '# Guide\n' })
    expect(v).toHaveLength(1)
    expect(v[0]?.fix?.replacement).toBe('./new/guide.md?plain=1#L1')
    expect(text.slice(v[0]?.fix?.start, v[0]?.fix?.end)).toBe('./old/guide.md?plain=1#L1')
  })

  it('./old/logo.png?raw=true#x gets no fix: the fragment cannot be judged on an image', () => {
    const v = resolveOf({
      'docs/readme.md': page('[q](./old/logo.png?raw=true#x)'),
      'docs/new/logo.png': 'png',
    })
    expect(v).toHaveLength(1)
    expect(v[0]?.fix).toBeUndefined()
  })
})
