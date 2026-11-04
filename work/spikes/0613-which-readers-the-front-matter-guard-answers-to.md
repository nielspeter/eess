# Spike 0613: which readers the front-matter guard answers to

Measured 2026-11-04 for [bug 0572](../bugs/fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md),
whose first fix PR #302 withdrew, time-boxed to about an hour. Throwaway scripts in a scratch
directory against `main` at d418afd6 (eess-md 0.13.0 plus the unreleased changesets), Node 24.22.0,
reading every Markdown file `git ls-files` lists in this repository and every `*.md` under
`node_modules` to depth 4 (under 400 kB): 2,177 files. Nothing here is built.

## The question

A line-1 `---` block is read two ways, and a reader sees links under each:

- **A renderer that drops front matter** (GitHub, VitePress): the block is metadata, the body is
  Markdown, and a body reference uses the body's definitions only.
- **A reader of the whole document as Markdown** ([bug 0087](../bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md)'s
  rule, "exactly as before front matter was parsed"): the block is Markdown too.

eess-md picks one reading per document (`parseFresh`, `packages/md/src/model/prose.ts:142`) and
`links()` examines that reading's links. PR #302's three review rounds showed that no rule about
what the block holds picks the right one: each narrowing left a document where the reading not
picked holds a broken link a reader sees. Which readers does the guard answer to, and what does
answering to both cost?

## 1. How often the readings differ

```text
files                                  2177
open with a line-1 ---                   55
read as front matter by the parser       54
the two readings' internal links differ   4   (all four are eess-md test fixtures:
                                               packages/md/tests/fixtures/frontmatter/docs/
                                               indented, link-in-front-matter, swallow,
                                               two-documents)
links eess-md misses today, either reading 0
```

In real corpora the readings agree. The defect is a crafted-input class, which matters because a
false green is the product's one disqualifying failure, not because adopters hit it often.

## 2. The union of both readings

Prototype: collect each reading's internal links (`collectLinks`, keyed by line and URL) and
examine their union.

```text
input                     eess today   union   links the union adds
0572 reproduction         green        RED     1
0572 YAML-key form        green        RED     1
#302 B1 shadowing         RED          RED     1
#302 two labels           RED          RED     1
#302 fence swallow        RED          RED     1
#302 link nesting         RED          RED     1
0610 task box             green        RED     1
0610 YAML error           green        RED     1
0610 inline link          green        RED     1
0611 HTML link in YAML    green        RED     1
0612 swallow              green        RED     1
ordinary front matter     green        green   0
tags: [adr] (0566 cost)   green        green   0
```

The union reds every reproduction by construction: each is a document where some reader sees a
broken link, and the union holds every link either reader sees. On ordinary front matter it adds
nothing; over the 2,177 files it adds links only to the four fixtures above.

## 3. Cost

A second parse, only for a document that opens with a line-1 `---` block: 55 of 2,177 here. The
reading not picked is parsed uncached, as `parseUncached` does.

## 4. Decision

1. **For links, the guard answers to both readers.** `links()` examines the union of the links
   each reading holds, keyed by line and URL; a link only one reading holds is examined and, when
   it fails, its finding says which reading holds it. This closes
   [bug 0572](../bugs/fixed/0572-a-definition-in-front-matter-hides-a-reference-in-the-body.md),
   [bug 0610](../bugs/fixed/0610-a-label-defined-in-front-matter-and-the-body-leaves-one-target-unchecked.md),
   [bug 0611](../bugs/fixed/0611-an-html-link-in-front-matter-is-hidden.md) and
   [bug 0612](../bugs/fixed/0612-a-construct-opened-in-front-matter-swallows-body-links.md), which share
   that root cause, in one change.
2. **For structure, nothing changes.** Sections, the title, fields and boxes keep [bug 0087](../bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md)'s single
   reading; whether they too answer to both readers is not measured here.
3. **No "cannot judge" finding.** The review proposed one for a document whose readings disagree;
   the union makes it unnecessary for links, since nothing is left unjudged.

## Corrections

The build's enforcement review (2026-11-04) measured three holes in decision 1 as first written, and
decision 3's claim that nothing is left unjudged was false:

- **External links.** The union added every URL in ordinary front matter (`homepage: https://…`) as
  an external link, which reddens a rule over external links on plain metadata, and gave a rule
  over all links a count of 1 where main reported it examined nothing. The union adds **internal
  links only**: the false greens this spike measured are internal links.
- **`select()`.** It handed the union to `correspondence()`, so a link only one reading holds could
  satisfy a join main reported missing. A selection carries no findings, and neither reading alone
  is safe for a join in both directions, so `links().select()` **refuses** when it reaches such a
  link, naming it, as it refuses an unread HTML link ([plan 0580](../plans/completed/0580-md-a-raw-html-link-is-resolved.md), R7). In real corpora (section 1)
  no document holds one. `sections().haveLink()` and `beLinkedBack()`'s evidence keep the picked
  reading, where adding links could only turn a finding green.
- **Unread HTML links.** An unquoted `<a href=…/…>` in a YAML value, or in a body a construct opened
  in the block swallows, was silently green: unread links were not in the union. They are now,
  keyed by line and cause, so either reading's unread link is reported.
