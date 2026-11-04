/**
 * VitePress's anchor rule, for the `docs/` site (bug 0136, spike 0574 decision 1). eess-md names no
 * renderer but GitHub's; this repository passes this one for the region VitePress publishes.
 *
 * Read from VitePress 1.6.4: `markdown-it-anchor` at every heading level, slugged by
 * `@mdit-vue/shared`'s `slugify` (bundled into `vitepress`, so a root devDependency in the range
 * `vitepress` declares), a repeated id numbered `-1`, `-2` (`uniqueSlugStartIndex: 1`) against every
 * id the document has used so far. An explicit `{#id}` (the attrs plugin) sets the id, is left out of
 * the text, and must be unique. `id` on any HTML element is an anchor, since VitePress renders HTML
 * as written. No `user-content-` alias.
 *
 * The pin is `vitepress-anchors.test.mjs`, which renders `docs/` with VitePress's own
 * `createMarkdownRenderer` and finds these ids equal to its own.
 */
import { slugify } from '@mdit-vue/shared'

/** A trailing attrs block (`{#id .class}`): its `#id`, if any, and the text without it. */
function attrsOf(text) {
  const m = /\s*\{([^{}]*)\}\s*$/.exec(text)
  if (m === null) return { text, id: undefined }
  const id = /(?:^|\s)#([^\s#.]+)/.exec(m[1] ?? '')?.[1]
  return { text: text.slice(0, m.index), id }
}

/** @type {import('@nielspeter/eess-md').AnchorRule} */
export const vitepressAnchors = {
  name: 'VitePress',
  ids(headings) {
    const used = new Set()
    return headings.map((heading) => {
      const { text, id } = attrsOf(heading)
      if (id !== undefined) {
        used.add(id)
        return id
      }
      const base = slugify(text)
      let unique = base
      for (let i = 1; used.has(unique); i++) unique = `${base}-${String(i)}`
      used.add(unique)
      return unique
    })
  },
  keepsHtmlAnchor: (_element, attribute) => attribute === 'id',
}
