import { describe, expect, it } from 'vitest'
import { ArchConfigError } from '@nielspeter/eess'
import { corpusFromText, githubAnchors, links, type AnchorRule } from '../src/index.js'
import type { LinkResolveOptions } from '../src/index.js'

// Bug 0136: `resolve()` threw a link's `#fragment` away, so a link to a real file with a dead anchor,
// and a same-document `#nowhere`, were green. A fragment is now judged against its target's anchors
// under the linking document's renderer's rule (spike 0574), GitHub's by default.

const violationsOf = (files: Record<string, string>, options?: LinkResolveOptions) =>
  links(corpusFromText(files)).that().areInternal().should().resolve(options).violations()

const findings = (files: Record<string, string>, options?: LinkResolveOptions): string[] =>
  violationsOf(files, options).map((v) => `${String(v.line)} ${v.message}`)

/** The `Fix:` line of each finding: the nearest anchors live there, so the message stays stable. */
const remedies = (files: Record<string, string>): (string | undefined)[] =>
  violationsOf(files).map((v) => v.suggestion)

const RULE_HINT = 'If the target is published by another renderer, pass its rule as `anchorRule`.'

const B = '# B\n\n## Real Heading\n'

describe('a fragment names an anchor in its target (bug 0136)', () => {
  it('a same-document fragment that names no heading is reported', () => {
    expect(findings({ 'docs/a.md': '# A\n\n[x](#no-such-heading)\n' })).toEqual([
      '3 broken fragment: "#no-such-heading" is no heading or anchor in this document under the GitHub anchor rule',
    ])
  })

  it('a fragment on an existing document names the fragment, not the file', () => {
    expect(
      findings({ 'docs/a.md': '# A\n\n[x](./b.md#no-such-heading)\n', 'docs/b.md': B }),
    ).toEqual([
      '3 broken fragment: "./b.md#no-such-heading" — "#no-such-heading" is no heading or anchor in docs/b.md under the GitHub anchor rule',
    ])
  })

  it('punctuation and a question mark are slugged away, as GitHub does', () => {
    const b = '# B\n\n## Close-out (2026-07-19)\n\n### When is a bug fixed?\n'
    expect(
      findings({
        'docs/a.md': '# A\n\n[x](./b.md#close-out-2026-07-19) [y](./b.md#when-is-a-bug-fixed)\n',
        'docs/b.md': b,
      }),
    ).toEqual([])
  })

  it('a heading with letters outside ASCII is reached plain and percent-encoded, and a near miss is red', () => {
    const b = '# B\n\n## Größe der Datei\n'
    expect(
      findings({
        'docs/a.md':
          '# A\n\n[x](./b.md#größe-der-datei) [y](./b.md#gr%C3%B6%C3%9Fe-der-datei) [z](./b.md#grosse-der-datei)\n',
        'docs/b.md': b,
      }),
    ).toEqual([
      '3 broken fragment: "./b.md#grosse-der-datei" — "#grosse-der-datei" is no heading or anchor in docs/b.md under the GitHub anchor rule',
    ])
  })

  it('a malformed percent-escape is a finding, not a thrown error', () => {
    expect(findings({ 'docs/a.md': '# A\n\n[x](./b.md#gr%E0)\n', 'docs/b.md': B })).toEqual([
      '3 broken fragment: "./b.md#gr%E0" — "#gr%E0" is not valid percent-encoding',
    ])
  })

  it('a heading inside a blockquote and an <a id> anchor are reached', () => {
    const b = '# B\n\n> ## Note\n\n<a id="manual"></a>\n\nText.\n'
    expect(
      findings({ 'docs/a.md': '# A\n\n[x](./b.md#note) [y](./b.md#manual)\n', 'docs/b.md': b }),
    ).toEqual([])
  })

  it('a user-content- fragment reaches its heading under GitHub’s rule', () => {
    expect(
      findings({ 'docs/a.md': '# A\n\n[x](./b.md#user-content-real-heading)\n', 'docs/b.md': B }),
    ).toEqual([])
  })

  it('letter case counts, and the finding names the anchor that differs only in case', () => {
    const files = { 'docs/a.md': '# A\n\n## Foo\n\n[x](#Foo)\n' }
    expect(findings(files)).toEqual([
      '5 broken fragment: "#Foo" is no heading or anchor in this document under the GitHub anchor rule',
    ])
    expect(remedies(files)).toEqual([
      `The nearest: #foo (#foo differs only in letter case). ${RULE_HINT}`,
    ])
  })

  it('the message names no other heading, so a baseline entry holds when the target’s headings change', () => {
    const one = findings({ 'docs/a.md': '# A\n\n## Going\n\n[x](#gone)\n' })
    const two = findings({ 'docs/a.md': '# A\n\n## Goner\n\n[x](#gone)\n' })
    expect(one).toEqual(two)
    expect(remedies({ 'docs/a.md': '# A\n\n## Going\n\n[x](#gone)\n' })).toEqual([
      `The nearest: #going. ${RULE_HINT}`,
    ])
  })

  it('a fragment in a raw HTML link is checked too', () => {
    expect(
      findings({
        'docs/a.md': '# A\n\n## Real\n\n<p><a href="#gone">x</a> <a href="#real">y</a></p>\n',
      }),
    ).toEqual([
      '5 broken fragment: "#gone" is no heading or anchor in this document under the GitHub anchor rule',
    ])
  })

  it('a line fragment after ?plain=1 names a line of the source, not an anchor', () => {
    expect(
      findings({
        'docs/a.md': '# A\n\n[x](./b.md?plain=1#L2) [y](./b.md?plain=1#L1-L2) [z](./b.md#L2)\n',
        'docs/b.md': B,
      }),
    ).toEqual([
      '3 broken fragment: "./b.md#L2" — "#L2" is no heading or anchor in docs/b.md under the GitHub anchor rule',
    ])
  })

  it('a fragment naming an id the rule does not count says so', () => {
    const files = { 'docs/a.md': '# A\n\n<span id="here">x</span>\n\n[x](#here)\n' }
    expect(findings(files)).toEqual([
      '5 broken fragment: "#here" names the id of a <span> in this document, which the GitHub anchor rule does not count as an anchor',
    ])
    expect(remedies(files)).toEqual([
      `Point the fragment at a heading or an anchor the GitHub rule counts. ${RULE_HINT}`,
    ])
  })

  it('a near miss of a user-content- fragment names the anchor it nearly is', () => {
    expect(remedies({ 'docs/a.md': '# A\n\n## Install\n\n[x](#user-content-instal)\n' })).toEqual([
      `The nearest: #install. ${RULE_HINT}`,
    ])
  })

  it('a repeated heading is numbered across containers', () => {
    const b = '# B\n\n> ## Dup\n\n## Dup\n'
    expect(
      findings({ 'docs/a.md': '# A\n\n[x](./b.md#dup-1) [y](./b.md#dup-2)\n', 'docs/b.md': b }),
    ).toEqual([
      '3 broken fragment: "./b.md#dup-2" — "#dup-2" is no heading or anchor in docs/b.md under the GitHub anchor rule',
    ])
  })

  it('an explicit {#id} is heading text under GitHub’s rule', () => {
    const b = '# B\n\n## Install {#install}\n'
    expect(
      findings({
        'docs/a.md': '# A\n\n[x](./b.md#install-install) [y](./b.md#install)\n',
        'docs/b.md': b,
      }),
    ).toEqual([
      '3 broken fragment: "./b.md#install" — "#install" is no heading or anchor in docs/b.md under the GitHub anchor rule',
    ])
  })

  it('a path back to the same document, a site-absolute link and a reference-style link are each checked', () => {
    const v = findings(
      {
        'docs/a.md': '# A\n\n[x](./a.md#gone) [y](/b#gone) [z][r]\n\n[r]: ./b.md#gone\n',
        'docs/b.md': B,
      },
      { rootDir: 'docs', tryExtensions: ['.md'] },
    )
    expect(v).toEqual([
      '3 broken fragment: "./a.md#gone" — "#gone" is no heading or anchor in this document under the GitHub anchor rule',
      '3 broken fragment: "/b#gone" — "#gone" is no heading or anchor in docs/b.md under the GitHub anchor rule',
      '5 broken fragment: "./b.md#gone" — "#gone" is no heading or anchor in docs/b.md under the GitHub anchor rule (the definition of [r])',
    ])
  })

  it('inline code is heading text; an image’s alt and inline HTML are not', () => {
    const b = '# B\n\n## Use `run()` ![logo](./l.png)\n\n## Setup <Badge/>\n'
    expect(
      findings({ 'docs/a.md': '# A\n\n[x](./b.md#use-run-) [y](./b.md#setup-)\n', 'docs/b.md': b }),
    ).toEqual([])
  })

  it('an <a id> in a fence, one in an HTML comment, a <meta name> and a <div id> are no anchors under GitHub’s rule', () => {
    const b =
      '# B\n\n```html\n<a id="fenced"></a>\n```\n\n<!-- <a id="commented"></a> -->\n\n<meta name="meta">\n\n<div id="box"></div>\n'
    expect(
      findings({
        'docs/a.md':
          '# A\n\n[a](./b.md#fenced) [b](./b.md#commented) [c](./b.md#meta) [d](./b.md#box)\n',
        'docs/b.md': b,
      }).map((f) => f.split(' — ')[1]?.split(' ')[0]),
    ).toEqual(['"#fenced"', '"#commented"', '"#meta"', '"#box"'])
  })

  it('#top in any letter case and an empty # name the top of the page', () => {
    expect(
      findings({
        'docs/a.md': '# A\n\n[x](#top) [y](#TOP) [z](#) [w](./b.md#top)\n',
        'docs/b.md': B,
      }),
    ).toEqual([])
  })
})

describe('the anchor rule is the caller’s to pass (spike 0574 decision 1)', () => {
  const upper: AnchorRule = {
    name: 'Upper',
    ids: (headings) => headings.map((h) => h.toUpperCase().replace(/ /g, '_')),
    keepsHtmlAnchor: () => false,
  }

  it('one corpus judged under two rules gives each its own answer', () => {
    const c = corpusFromText({
      'docs/a.md': '# A\n\n## Real Heading\n\n[x](#REAL_HEADING) [y](#real-heading)\n',
    })
    const under = (anchors: AnchorRule) =>
      links(c)
        .that()
        .areInternal()
        .should()
        .resolve({ anchorRule: anchors })
        .violations()
        .map((v) => v.message.split(' ')[2])
    expect(under(upper)).toEqual(['"#real-heading"'])
    expect(under(githubAnchors)).toEqual(['"#REAL_HEADING"'])
    expect(under(upper)).toEqual(['"#real-heading"'])
  })

  it('a rule that gives another number of ids than headings is a configuration error', () => {
    const short: AnchorRule = { name: 'Short', ids: () => [], keepsHtmlAnchor: () => false }
    const c = corpusFromText({ 'docs/a.md': '# A\n\n[x](#a)\n' })
    expect(() =>
      links(c).that().areInternal().should().resolve({ anchorRule: short }).violations(),
    ).toThrow(ArchConfigError)
  })
})

describe('only resolve() judges a fragment (spike 0574 decision 3)', () => {
  it('haveLiveTargets() asks about the target, so a dead fragment on a live document is selected', () => {
    const c = corpusFromText({ 'docs/a.md': '# A\n\n[x](./b.md#gone)\n', 'docs/b.md': B })
    const selected = links(c)
      .that()
      .haveLiveTargets()
      .should()
      .satisfy({ description: 'list', evaluate: () => [] })
      .violations()
    expect(selected.examined).toBe(1)
  })
})

describe('what a fragment finding says about the rule (bug 0136 review)', () => {
  it('a name the rule does not count names the attribute and the element', () => {
    const rule: AnchorRule = {
      name: 'Ids',
      ids: (headings) => headings.map((h) => h.toLowerCase()),
      keepsHtmlAnchor: (_element, attribute) => attribute === 'id',
    }
    const v = links(corpusFromText({ 'docs/a.md': '# A\n\n<a name="here"></a>\n\n[x](#here)\n' }))
      .that()
      .areInternal()
      .should()
      .resolve({ anchorRule: rule })
      .violations()
    expect(v.map((x) => x.message)).toEqual([
      'broken fragment: "#here" names the name of an <a> in this document, which the Ids anchor rule does not count as an anchor',
    ])
  })

  it('a malformed fragment with no remedy carries no suggestion', () => {
    expect(remedies({ 'docs/a.md': '# A\n\n[x](#gr%E0)\n' })).toEqual([undefined])
  })
})
