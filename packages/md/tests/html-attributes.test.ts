import type { Nodes, Root } from 'mdast'
import { describe, expect, it } from 'vitest'
import {
  attributeOf,
  decodeReferences,
  inlineTagStartsOf,
  isLinkStart,
  isOnlyComment,
  readHtmlNode,
  tokenizeHtml,
} from '../src/model/html-attributes.js'
import { parseUncached } from '../src/model/prose.js'

// Plan 0580 Phase 1: the one reader of HTML tags and attributes. Every row names the Measured row or
// probe (P, Q, A, B) it pins, so a micromark upgrade that changes one reds here first.

const htmlNodes = (root: Nodes, out: Nodes[] = []): Nodes[] => {
  if (root.type === 'html') out.push(root)
  if ('children' in root) for (const c of root.children) htmlNodes(c, out)
  return out
}

/** Every `html` node in `md`, read. */
const read = (md: string): ReturnType<typeof readHtmlNode>[] => {
  const root: Root = parseUncached(md)
  return htmlNodes(root).map((n) => readHtmlNode(n, md))
}

/** The `href` of every link start the owner reads in `md`'s `html` nodes. */
const hrefs = (md: string): string[] =>
  read(md).flatMap((r) =>
    r.starts.filter(isLinkStart).map((t) => attributeOf(t, 'href')?.value ?? '<none>'),
  )

const inline = (md: string) =>
  inlineTagStartsOf(parseUncached(md), md).map((s) =>
    s.kind === 'unquoted-slash'
      ? `${s.kind}:${s.attributes.join(',')}@${String(s.line)}`
      : `${s.kind}@${String(s.line)}`,
  )

describe('inside an html node the owner reads tags as the HTML tokenizer does (D1)', () => {
  it('reads href in any letter case and quoting, spaces around =, and a tag over several lines', () => {
    expect(hrefs('<div>\n<A HREF="./a.md">a</A>\n</div>\n')).toEqual(['./a.md'])
    expect(hrefs("<div>\n<a href='./b.md'>b</a>\n</div>\n")).toEqual(['./b.md'])
    expect(hrefs('<div>\n<a href = "./c.md">c</a>\n</div>\n')).toEqual(['./c.md'])
    expect(hrefs('<div>\n<a\n  class="x"\n  href="./d.md">d</a>\n</div>\n')).toEqual(['./d.md'])
  })

  it('reads a missing space between attributes (P9) and an @click before href (P10)', () => {
    expect(hrefs('<div>\n<a href="./x.md"title="y">W</a>\n</div>\n')).toEqual(['./x.md'])
    expect(hrefs('<div align=center>\n<a @click="go" href="./x.md">C</a>\n</div>\n')).toEqual([
      './x.md',
    ])
  })

  it('reads an unquoted value to whitespace or >, so href=docs/ is docs/', () => {
    expect(hrefs('<a href=docs/>x</a>\n')).toEqual(['docs/'])
  })

  it('reads a quoted > as part of the value: title="a>b" (bug 0593)', () => {
    expect(hrefs('see <a title="a>b" href="./x.md">x</a> here\n')).toEqual(['./x.md'])
  })

  it('keeps the first of two hrefs, and reads a valueless href as ""', () => {
    expect(hrefs('<a href="./first.md" href="./second.md">D</a>\n')).toEqual(['./first.md'])
    expect(hrefs('the <a href>element</a> here\n')).toEqual([''])
  })

  it('does not read data-href, :href, xlink:href or href= inside another value as href', () => {
    expect(hrefs('<div>\n<a data-href="./x.md">x</a>\n</div>\n')).toEqual([])
    expect(hrefs('see <a :href="foo">x</a>\n')).toEqual([])
    expect(hrefs('<div>\n<a xlink:href="./x.md">x</a>\n</div>\n')).toEqual([])
    expect(hrefs('<div>\n<a title="href=./x.md">x</a>\n</div>\n')).toEqual([])
  })

  it('decodes a value after tokenizing: ./R&amp;D.md is ./R&D.md, and &lt;a href…&gt; is no tag', () => {
    expect(hrefs('<a href="./R&amp;D.md">x</a>\n')).toEqual(['./R&D.md'])
    expect(hrefs('<div>\n&lt;a href="./x.md"&gt;\n</div>\n')).toEqual([])
    expect(decodeReferences('a&#38;b&#x26;c&amp;d&amp e&bogus;')).toBe('a&b&c&d&amp e&bogus;')
  })

  it('cuts comments and CDATA out, wherever they sit in the node (D2)', () => {
    expect(
      hrefs('<div>\n<!-- <a href="./x.md">K</a> -->\n<a href="./y.md">Y</a>\n</div>\n'),
    ).toEqual(['./y.md'])
    expect(hrefs('<![CDATA[\n<a href="./x.md">D</a>\n]]>\n')).toEqual([])
  })

  it('reads no tag inside another tag’s quoted value: <img alt="<a href=…>">', () => {
    expect(hrefs('see <img alt="<a href=\'./g.md\'>"> here\n')).toEqual([])
  })

  it('reads a fence and a code span inside an HTML block, as GitHub renders them (D4)', () => {
    expect(hrefs('<details>\n```\n<a href="./x.md">F</a>\n```\n</details>\n')).toEqual(['./x.md'])
    expect(hrefs('<div>\n`<a href="./x.md">C</a>`\n</div>\n')).toEqual(['./x.md'])
    // A blank line after the opening tag makes the fence code: the remedy, measured.
    expect(hrefs('<details>\n\n```\n<a href="./x.md">F</a>\n```\n\n</details>\n')).toEqual([])
  })

  it('reads <script>, <textarea> and <pre> content: tagfilter elements change no state (D5, D6)', () => {
    expect(hrefs('<script>\nvar s = \'<a href="./x.md">S</a>\'\n</script>\n')).toEqual(['./x.md'])
    expect(hrefs('<textarea>\n<a href="./x.md">S</a>\n</textarea>\n')).toEqual(['./x.md'])
    expect(hrefs('<pre>\n<a href="./x.md">P</a>\n</pre>\n')).toEqual(['./x.md'])
  })

  it('reads <area href> as a link start', () => {
    expect(hrefs('<map name="m">\n<area shape="rect" href="./x.md" alt="A">\n</map>\n')).toEqual([
      './x.md',
    ])
  })

  it('gives each attribute its own line inside a multi-line block', () => {
    const [r] = read('<div>\n<a\n  title="t"\n  href="./x.md">x</a>\n</div>\n')
    const a = r?.starts.find(isLinkStart)
    expect(a?.line).toBe(2)
    expect(a === undefined ? undefined : attributeOf(a, 'href')?.line).toBe(4)
  })
})

describe('a tag the node ends inside is split-tag or unterminated (R3)', () => {
  const unfinished = (md: string) =>
    read(md).flatMap((r) => r.unfinished.map((u) => `${u.name}:${u.cause}@${String(u.line)}`))

  it('P15: a blank line inside a quoted value with no > so far is split-tag', () => {
    expect(unfinished('<div>\n<a href="./x\n\nmd">x</a>\n</div>\n')).toEqual(['a:split-tag@2'])
  })

  it('B3: a quote that never closes is unterminated, though a later paragraph holds " and >', () => {
    expect(unfinished('<div>\n<a href="./gone.md>x</a>\n</div>\n\nSee "this" -> there.\n')).toEqual(
      ['a:unterminated@2'],
    )
  })

  it('B1 and B2: a block its container ended is unterminated', () => {
    expect(unfinished('> <div>\n> <a\nhref="./gone.md">x</a>\n')).toEqual(['a:unterminated@2'])
    expect(unfinished('- <div>\n  <a\nhref="./gone.md">x</a>\n')).toEqual(['a:unterminated@2'])
  })

  it('an unfinished tag inside a tagfilter element whose end tag the node holds is silenced (D5)', () => {
    // A quote that never closes swallows `</script>`, so the `<a` is unfinished inside the element.
    const [r] = read("<script>\nconst s = '<a href=\"' + u\n</script>\n")
    expect(r?.unfinished).toEqual([])
    expect(r?.silenced.map((u) => u.name)).toEqual(['a'])
  })

  it('an unclosed <textarea> has no inside, so P15’s split after it is split-tag', () => {
    // Inside a `<div>` block, which a blank line ends; a `<textarea>` block (type 1) would not end.
    expect(unfinished('<div>\n<textarea>\n<a href="./x\n\nmd">x</a>\n</div>\n')).toEqual([
      'a:split-tag@3',
    ])
  })

  it('JavaScript that builds a tag the tokenizer can finish is read, not silenced (D5)', () => {
    expect(hrefs('<script>\nconst s = "<a href=\\"" + u\n</script>\n')).toEqual(['\\""'])
  })

  it('tokenizes a value with no source as unterminated', () => {
    expect(tokenizeHtml('<a href="x', 1, false).unfinished.map((u) => u.cause)).toEqual([
      'unterminated',
    ])
  })
})

describe('in a paragraph, heading or table cell the owner applies CommonMark’s open tag (D7)', () => {
  it('finds a tag micromark refused for an unquoted / (row 3, P1, P3, P5)', () => {
    expect(inline('see <a href=./x.md>x</a> here\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see <a href=x.md title=a/b>x</a> here\n')).toEqual(['unquoted-slash:title@1'])
    expect(inline('see <a href=./x.md title=a/b>x</a>\n')).toEqual(['unquoted-slash:href,title@1'])
    expect(inline('see <a\nhref=./x.md>x</a> here\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('| h |\n| - |\n| <a href=./x.md>x</a> |\n')).toEqual(['unquoted-slash:href@3'])
  })

  it('finds a refused tag whole, though micromark split it across nodes (Q1, Q2, Q3, Q6, Q10)', () => {
    expect(inline('see <a href=./a*b*.md>x</a>\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see <a href=./x.md title=*t*>x</a>\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see <a href=./x.md title=~~t~~>x</a>\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see <a title="`" href=./x.md>x`</a>\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see <a href="./x.md" data-x=a/_b_>x</a>\n')).toEqual(['unquoted-slash:data-x@1'])
  })

  it('reads an entity before a tag as source text, so it hides nothing (Q5)', () => {
    expect(inline('see R&amp;D <a href=./x.md>x</a>\n')).toEqual(['unquoted-slash:href@1'])
  })

  it('counts backslashes: \\<a is no start, \\\\<a is (Q4); &lt;a is none (P14)', () => {
    expect(inline('see \\<a href=./x.md>x</a>\n')).toEqual([])
    expect(inline('see \\\\<a href=./x.md>x</a>\n')).toEqual(['unquoted-slash:href@1'])
    expect(inline('see &lt;a href=./x.md>x\n')).toEqual([])
  })

  it('reads what GitHub renders as text as no tag (P7, P8, foo=bar=baz, the unclosed quote)', () => {
    expect(inline('see <a href="./x.md"title="y">W</a> here\n')).toEqual(['not-a-tag@1'])
    expect(inline('see <a @click="go" href="./x.md">C</a> here\n')).toEqual(['not-a-tag@1'])
    expect(inline('see <a href="./x.md" foo=bar=baz>B</a> here\n')).toEqual(['not-a-tag@1'])
    expect(inline('see <a href="./x.md>x</a> here\n')).toEqual(['not-a-tag@1'])
  })

  it('reads a tag with no href as no-href (Q7), and prose that names a tag as no tag', () => {
    expect(inline('see <a name=a/b>x</a>\n')).toEqual(['no-href@1'])
    expect(inline('Write an <a href attribute on the tag.\n')).toEqual(['not-a-tag@1'])
  })

  it('finds no start in an image’s alt, a link’s title or its destination (A1 to A4)', () => {
    expect(inline('![logo <a href=./x.md>](y.png)\n')).toEqual([])
    expect(inline('![logo <a href="./x.md">](y.png)\n')).toEqual([])
    expect(inline('[x](y.md "<a href=./z.md>")\n')).toEqual([])
    expect(inline('[x](<a href=./z.md>)\n')).toEqual([])
  })

  it('finds no start in a tag micromark accepted, which is an html node', () => {
    expect(inline('see <a href=x.md>x</a> here\n')).toEqual([])
  })

  it('steps a blockquote prefix over when the tag continues on the next line', () => {
    expect(inline('> see <a class="c"\n> href=./x.md>x</a>\n')).toEqual(['unquoted-slash:href@1'])
  })

  it('gives each start its own line in a multi-line paragraph', () => {
    expect(inline('one\ntwo <a href=./x.md>x</a>\n')).toEqual(['unquoted-slash:href@2'])
  })
})

describe('a node that is only comments holds nothing a reader sees (D2)', () => {
  it('one comment, two comments, a doctype and a processing instruction', () => {
    expect(isOnlyComment('<!-- a -->')).toBe(true)
    expect(isOnlyComment('<!-- a -->\n<!-- b -->')).toBe(true)
    expect(isOnlyComment('<!DOCTYPE html>')).toBe(true)
    expect(isOnlyComment('<?x?>')).toBe(true)
  })

  it('a comment beside text, a tag, or nothing at all', () => {
    expect(isOnlyComment('<!-- a --> text <!-- b -->')).toBe(false)
    expect(isOnlyComment('<!-- a --><div>')).toBe(false)
    expect(isOnlyComment('')).toBe(false)
  })
})
