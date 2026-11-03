/**
 * The pin for `vitepress-anchors.mjs` (bug 0136, spike 0574 decision 1): VitePress's own renderer
 * is the authority for the ids of the `docs/` site, so `docs/` is rendered with its
 * `createMarkdownRenderer` and every heading id it gives must be an anchor `check:corpus`'s rule
 * finds, one id per heading on both sides. A VitePress upgrade that changes ids reds this test,
 * not the gate's cost: rendering takes about 2.5 s, which every gate run would pay.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMarkdownRenderer } from 'vitepress'
import { corpus, corpusFromText, links, resolveLink } from '@nielspeter/eess-md'
import { vitepressAnchors } from './vitepress-anchors.mjs'

const ROOT = new URL('../../', import.meta.url).pathname

/** The heading ids in rendered HTML, entities decoded as an attribute value is. */
function renderedIds(html) {
  const ids = []
  for (const m of html.matchAll(/<h[1-6][^>]*?\sid="([^"]*)"/g)) {
    ids.push(
      (m[1] ?? '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    )
  }
  return ids
}

/** Whether `#id` from `relPath` itself is found under the VitePress rule. */
const found = (c, relPath, id) => {
  const target = resolveLink(
    { url: `#${encodeURIComponent(id)}`, external: false, doc: { relPath } },
    c,
    { anchors: vitepressAnchors },
  )
  return target.kind === 'self' && target.fragment?.kind === 'found'
}

/** How many headings eess-md reads in a document, at any depth. */
function headingCount(node) {
  let n = node.type === 'heading' ? 1 : 0
  for (const child of node.children ?? []) n += headingCount(child)
  return n
}

test('every heading id VitePress renders for docs/ is an anchor under the gate’s rule', async () => {
  const md = await createMarkdownRenderer(`${ROOT}docs`, {}, '/')
  const c = corpus({ root: ROOT, roots: ['docs/**/*.md'] })
  const mismatches = []
  let total = 0
  for (const doc of c.documents()) {
    const ids = renderedIds(
      md.render(readFileSync(doc.file, 'utf8'), { relativePath: doc.relPath }),
    )
    total += ids.length
    if (ids.length !== headingCount(doc.root))
      mismatches.push(
        `${doc.relPath}: VitePress ${ids.length} ids, eess-md ${headingCount(doc.root)} headings`,
      )
    for (const id of ids) if (!found(c, doc.relPath, id)) mismatches.push(`${doc.relPath}: #${id}`)
  }
  assert.deepEqual(mismatches, [])
  assert.ok(total > 500, `rendered only ${total} heading ids: is docs/ empty?`)
})

const under = (files) =>
  links(corpusFromText(files))
    .that()
    .areInternal()
    .should()
    .resolve({ anchors: vitepressAnchors })
    .violations()
    .map((v) => v.message.split(' ')[2])

test('an explicit {#id} is the id under the VitePress rule, and its text is not', () => {
  assert.deepEqual(
    under({ 'docs/a.md': '# A\n\n## Install {#install}\n\n[x](#install) [y](#install-install)\n' }),
    ['"#install-install"'],
  )
})

test('no user-content- alias under the VitePress rule', () => {
  assert.deepEqual(under({ 'docs/a.md': '# A\n\n## Foo\n\n[x](#user-content-foo)\n' }), [
    '"#user-content-foo"',
  ])
})

test('a <div id> is an anchor under the VitePress rule', () => {
  assert.deepEqual(under({ 'docs/a.md': '# A\n\n<div id="box"></div>\n\n[x](#box)\n' }), [])
})

test('## Setup <Badge/> is #setup under the VitePress rule', () => {
  assert.deepEqual(under({ 'docs/a.md': '# A\n\n## Setup <Badge/>\n\n[x](#setup)\n' }), [])
})

// Four shapes VitePress slugs from markdown-it's tokens, which a rule over eess-md's heading text
// cannot recover (spike 0574 section 1); none occurs in docs/ today. Pinned as they are, so a change
// either way is seen: bug 0614.
test('four heading shapes the VitePress rule reads differently from VitePress (bug 0614)', async () => {
  const md = await createMarkdownRenderer(`${ROOT}docs`, {}, '/')
  const shapes = ['## :tada: Release', '## Foo &amp; Bar', '## Copy&copy;right', '## Notes[^1]']
  const vitepress = shapes.map((s) => renderedIds(md.render(`${s}\n`, {}))[0])
  assert.deepEqual(vitepress, ['release', 'foo-amp-bar', 'copy-copy-right', 'notes-1'])
  // With its definition, `[^1]` is a footnote mark to eess-md's parser, which VitePress has no
  // plugin for; without one, both read it as text.
  for (const [i, id] of vitepress.entries()) {
    const c = corpusFromText({ 'docs/a.md': `${shapes[i]}\n\n[^1]: a note\n` })
    assert.equal(found(c, 'docs/a.md', id), false, `${shapes[i]} now reads as VitePress does`)
  }
})

test('a heading with letters outside ASCII under the VitePress rule: plain and percent-encoded, and GitHub’s form is red', () => {
  assert.deepEqual(
    under({
      'docs/a.md':
        '# A\n\n## Größe der Datei\n\n[x](#große-der-datei) [y](#gro%C3%9Fe-der-datei) [z](#größe-der-datei)\n',
    }),
    ['"#größe-der-datei"'],
  )
})
