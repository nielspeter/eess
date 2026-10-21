# Proposal 018 — md: a mention of a record is a link

**State:** Draft — filed 2026-10-21 at the maintainer's request; not reviewed.
**Priority:** Medium — most references between records are written as plain text and nothing
reads them, so a wrong or dead reference is green; an agent copies the corpus, and the corpus
teaches it not to link.
**Origin:** self-found · the maintainer's observation about an adopter monorepo's records,
2026-10-21, measured there and here.
**Affects:** `@nielspeter/eess-md` (a new element type beside `links()`).

**This asks again for part of what [proposal 017](./017-md-blocks-to-check-a-documents-shape.md)'s
review rejected** (D2, "references in free prose, as a gate", rejected 2026-10-16 and still rejected
in its second review). It is filed because the ask is narrower than D2 and because the maintainer
wants the gap gated; § "What is different from 017's D2" answers each of the three reasons D2 was
rejected for. A review that finds an answer does not hold should reject this proposal for the same
reason, not reshape it.

## Problem

Records name each other by kind and number, mostly as plain text, and a plain-text reference is
read by nothing: `links().should().resolve()` checks a link, and the same reference written as text
can name a record that moved, never existed, or is of another kind, and stay green. The
record-authoring skills tell an agent to follow the house shape from the corpus, and the corpus
writes most references as text, so an agent writes them that way too. A line in the skills now says
to link (2026-10-21); a line in a skill is not a gate.

## Measured

A scan of every Markdown file under `work/`, `adr/`, `docs/` and the skills (and `kit/` here), 2026-10-21, on `main`
at 8e258550. The instrument is a regex per kind over each line, with fenced code dropped; a match is
"linked" when it sits inside a `[text](url)`, and a match inside inline code is skipped. Not
hand-classified: counts include numbers that are another project's (below) and placeholders.

| kind                                               | this repository: plain / all | an adopter monorepo: plain / all |
| -------------------------------------------------- | ---------------------------- | -------------------------------- |
| `ADR-NNN`                                          | 1599 / 1772 (90%)            | 325 / 447 (72%)                  |
| bug                                                | 1518 / 2009 (75%)            | 1542 / 2615 (59%)                |
| plan                                               | 1297 / 1630 (79%)            | 1109 / 1895 (59%)                |
| proposal                                           | 357 / 414 (86%)              | 2 / 2                            |
| spike                                              | 232 / 294 (78%)              | 11 / 11                          |
| a document path in a code span, file exists        | 737, none linked             | 416, none linked                 |
| a `work/` file naming a plan or bug it never links | 313 of 491 files             | 226 of 396 files                 |

The adopter writes bugs as `bug-081`, so its bug count comes from a pattern allowing the hyphen; a
space-only pattern found 9. That is the case for the pattern being the caller's. In the adopter's
`work/`, 2,188 of 2,193 plain plan and bug mentions resolve to an existing record by number and 5
to none.

Proposal 017 measured the dead half here (2026-10-16): 117 plain references naming a number no
record holds, 29 naming a number another kind holds, many of them the numbers of the project this
engine was ported from.

## Existing code survey

- **`links()` reads `link` nodes only** (`packages/md/src/model/links.ts:170-171`) and resolves
  them (`resolve()`, `beLinkedBack()`, `areLabelled()`). A reference written as text is never an
  element.
- **`terms()` reads one labelled value per line** (`packages/md/src/builders/vocabulary.ts:130`),
  after a label pattern, on prose text with closed fences removed. It has no notion of where in the
  line's Markdown the value sits, so it cannot say whether the value is inside a link.
- **`pointers()` reads `path.ext:line` in prose and inline code** (`packages/md/src/model/pointers.ts:27`),
  code extensions only; a `.md` path is not a pointer.
- **[Proposal 015](./015-md-wikilinks-are-read-or-reported.md)** asks to scan text nodes for
  `[[…]]` outside code. Ask A here needs the same walk; whichever is built first owns it.
- **Proposal 017, D1** (references at declared positions such as `Implements:` and `deferred→`) is
  held; **D2** (references in free prose) is rejected. This proposal reads free prose, so it is
  D2's ground.
- **No dialect has a mention element.** eess-ts's `access()` and `call()` match a spelling in code,
  which is the nearest shape: a caller's pattern, matched where the parser says code is.

Genuinely new, and eess-md's: a mention is Markdown text, and no other dialect would read it.

## What is different from 017's D2

D2 asked eess-md to read a reference in prose and decide what it names. Its review gave three
reasons that cannot be made honest; each is answered here, or this proposal fails with it.

1. **"Identifiers collide with the ported project's, in the same words."** D2 had to decide what
   `bug 0039` means. This ask does not: its first condition is only that a mention the caller's
   pattern matches is inside a link (Tier 1, syntax). The author decides what it names, by choosing
   the target, and the target is then checked by what already checks links. A foreign record is
   linked to where it lives; its link agrees with a foreign namespace the rule file declares (ask
   B), not with a marker on the line.
2. **"A per-line marker is an escape an agent can stamp."** There is no per-line marker. The
   escapes are a declared foreign namespace and the caller's pattern, both in the rule file, both
   code a reviewer reads once, and both judged by [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md): a namespace no link uses, or a pattern
   matching nothing, is a finding. Two escapes remain open and are named as questions below:
   inline code, and rewording a mention so the pattern misses it.
3. **"A warning is the release nobody reads."** Every condition here fails the build; nothing is a
   warning.

D2 was Tier 4 in 017's review. Ask A is Tier 1; ask B is Tier 1 against the filesystem and the
declared namespaces.

## Asks

- **A — a mention is a link.** `mentions(corpus, { pattern })` selects every match of the caller's
  pattern in a document's text, outside fenced and indented code; each element knows its document,
  line, matched text, captured kind and number, and the link it sits in, if any. `beLinked()`
  reports a mention outside a link. A mention in the document it names is not reported.
- **B — the link agrees with the mention.** `linkTo(resolve)` takes the caller's resolver from a
  mention to the file it names; a mention whose link points elsewhere is reported, naming both,
  and a mention the resolver finds no file for is reported as naming nothing. A link outside the
  repository agrees only with a namespace the caller declares (`{ foreign: [...] }`).
- **C — a document path is a link.** A path to an existing `.md` file written in inline code is a
  mention of that file. Whether it is the same element as A or its own is the reviewers' to say.
- **D — a fix.** Where the resolver names exactly one file, the CLI rewrites the mention as a link
  to it. Without a fix, adopting A means hand-editing thousands of mentions in each corpus measured
  above.

## Acceptance criteria

Each break class is a fixture row in the vacuity matrix (`scripts/check-nonvacuity.mjs`).

- **A — break class:** a document with one plain `bug 0001` beside a linked one is red at the plain
  one's line; the same document with both linked is green.
- **A — break class (false red):** a mention inside a fenced block is not an element; a mention
  inside link text is linked.
- **A — vacuity:** a pattern that matches nothing in the selection is a finding, never a green
  ([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md); [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md) for a string naming nothing).
- **B — break class:** `[bug 0338](./0339-x.md)` is red, naming 0338 and 0339; a mention naming no
  file is red with its own message, not the "points elsewhere" one ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2).
- **B — break class:** an external link outside every declared namespace is red; a declared
  namespace no link uses is red.
- **D — remedy test:** applying the fix to the A and B fixtures turns each red row green and
  changes nothing else in the file.

## Open questions

1. **Inline code.** A mention in inline code is skipped by A as written. That is an escape an
   agent can stamp (wrap the number in backticks). Should inline code be read, and examples of a
   mention move to fenced blocks?
2. **Rewording.** An author can write `bug number 338` or `0338` alone and the pattern misses it.
   Is that out of reach for a pattern-based rule (and said so in its docs), or does it argue for a
   wider default pattern?
3. **Every mention or the first per document.** Every mention is mechanical and fixable; the first
   per section is common house style but needs a judgement about scope. Proposed: every mention,
   with no option, until a consumer asks.
4. **Foreign records with no URL.** The ported project's records may not be reachable at a URL. If
   not, how does this repository's corpus name them without a marker?
5. **Which dialect owns the text walk** shared with [proposal 015](./015-md-wikilinks-are-read-or-reported.md).

## Out of scope

- **Pull request and issue numbers (`#123`, `PR #45`).** They name records outside the repository;
  the gate cannot check they exist without the network.
- **Deciding what a plain mention names.** That is D2, and stays rejected.
- **Paths to source files in inline code.** `pointers()` owns `path:line`; a bare source path is a
  different question.
- **Fixing this repository's corpus.** That follows the plan, as its last phase, if this is
  accepted.
