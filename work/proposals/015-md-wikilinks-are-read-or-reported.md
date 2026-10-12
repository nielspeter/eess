# Proposal 015 — md: a wikilink is read, or reported as unread

**State:** Draft — filed 2026-10-12 at the maintainer's request; not reviewed.
**Priority:** Medium — a corpus written with wikilinks gets a green link check while none of its
wikilinks is checked. No shipped rule claims to read them, so nothing over-claims today; the green
is what misleads.
**Origin:** self-found · the maintainer's question, 2026-10-12, while answering an inbound question
about checking an LLM-maintained Markdown wiki. That wiki uses standard links; no consumer has asked
for wikilinks.
**Affects:** `@nielspeter/eess-md` (the link walk, and possibly `resolveLink`).

## Problem

Obsidian and similar tools link with wikilinks — `[[Page]]`, `[[Page|label]]`, `[[Page#Heading]]`,
`[[Page#^block]]`, and embeds `![[file.png]]`. To CommonMark they are plain text. eess-md reads only
`link` nodes, so a wikilink is never selected, never resolved and never reported: a broken
`[[Missing Page]]` is green.

## Measured

Against this repository's build at `8db0605` and the published `@nielspeter/eess-md` 0.8.0, on one
page holding `[[Missing Page]]`, `[[b|the B page]]`, `![[img.png]]`, a wikilink in a code span and
one in a fence, and a standard `[real](gone.md)`:

- `links(c).that().areInternal()` selects `gone.md` only;
- `.should().resolve()` reports `gone.md` only — the three wikilinks in prose, one of them broken,
  produce no finding.

## Existing code survey

- **The link walk reads `link` nodes and counts `linkReference` nodes**
  (`packages/md/src/model/links.ts:168-169`); text is not scanned for links.
- **The parser has no wikilink extension:** `fromMarkdown` with GFM only
  (`packages/md/src/corpus.ts:85-86`). No `wikilink`, `wiki-link` or `obsidian` appears in
  `packages/*/src`.
- **Resolution is `resolveLink`** (plan 0404): relative paths, with `tryExtensions`, `tryIndex`,
  `rootDir` and directories. Obsidian resolves differently — a bare name matches a file by its name
  anywhere in the vault, and a heading or block reference targets part of a file.
- **The closest precedent is reporting what cannot be read.** Plan 0405's declaration scan reports a
  declaration made of reference-style links as one eess-md "does not read", rather than skipping it
  (ADR-016 rule 7).

## Asks

- **A — disclose.** A wikilink in a corpus is never silently skipped: a rule over links reports it
  as unread, or reports how many it did not read beside its green. A wikilink in code is not one.
- **B — resolve.** Wikilinks are links: selected by `links()` and resolved with Obsidian's rules, so
  `resolve()` reports a broken one. Expected to be held until a consumer brings a real vault, since
  the rules are a second resolver beside `resolveLink`.

## Acceptance criteria

**A — disclosure.**

- **Break class:** a corpus whose only broken link is a wikilink is not green without a word: the
  unread wikilink is a finding, or its count is reported beside the result.
- **Break class (false red):** a `[[…]]` inside a code span or fenced block is not counted.
- **Break class:** an embed, `![[…]]`, is counted like a link.
- **Non-vacuity:** a fixture row per break class.

**B — resolution.** Not specified until a consumer's vault sets the rules it must follow.

## Open questions

1. **Finding or count.** Is an unread wikilink a finding that fails the build (fail closed, but red
   for every Obsidian corpus until B ships), or a count disclosed beside a green (honest, but green)?
2. **How to find them.** A micromark wikilink extension parses them as nodes; a scan of text nodes
   finds them without a new dependency. Either must skip code.
3. **Resolution rules.** Which tool's rules — Obsidian's, or a common subset — and whether
   `resolveLink` gains a mode or a second resolver sits beside it.

## Out of scope

- Other non-CommonMark link forms (MediaWiki, Roam block references).
