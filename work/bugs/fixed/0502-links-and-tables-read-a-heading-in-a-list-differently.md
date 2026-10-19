# Bug 0502: links and tables read a heading inside a list or blockquote differently

## Status

- **State:** Draft — reproduced 2026-10-19 on main's build (`9675402`) while planning
  [plan 0496](../plans/0496-sections-as-elements.md); the drop direction was found by PR #247's
  enforcement review and reproduced here the same day. No red test written yet.
- **Severity:** High — eess reports green on links it never examined. A heading inside a list item
  or a blockquote replaces the real section headings on `links()`' heading stack, so
  `links().areInSection('Sub')` silently drops a link that sits under `### Sub`, with a non-zero
  `examined`. It also selects links outside the section it names. No verdict in this repository is
  wrong today: its corpus holds no heading inside a container (measured below), and the only
  repository caller of `links().areInSection()` is a non-vacuity probe.
- **Origin:** self-found · plan 0496's planning, 2026-10-19; the drop direction from PR #247's
  enforcement review.
- **Reported:** 2026-10-19
- **Builds after:** [plan 0496](../plans/0496-sections-as-elements.md), whose section index the fix
  reads. Order: plan 0496, then this fix, then plan 0503; plan 0496 does not ship in a release
  without this fix.
- **Precondition of:** [plan 0503](../plans/0503-in-sections-boxes-by-section.md) (block 18,
  `inSections`), recorded in proposal 017's conditions. Its fix ships in this release batch as its
  own pull request.

## Symptom

eess-md has two heading walks, and they disagree about a heading that sits inside a container:

- `buildDocument` reads only the root's children (`packages/md/src/model/document.ts:139`). A heading
  inside a list item or a blockquote is not in `doc.sections`, and it does not enter a table's
  `sectionPath`. `haveSection`, `haveTable({ section })` and `vocabulary({ fromHeadings })` read this
  walk.
- `collectLinks` recurses into every node (`packages/md/src/model/links.ts:158-160`, `:198`), so the
  same heading enters the running heading stack, and a link's `sectionPath`. Entering it truncates
  the stack to its depth, which drops every real heading at that depth or deeper, and the stack is
  never restored when the container closes. Two directions follow:
  - **drop (fail-open):** a link after the container, under a real section, no longer carries that
    section, so `areInSection(<the real section>)` does not select it;
  - **over-selection:** the same link carries the container's heading, so `areInSection(<the
container's heading>)` selects it.

## Reproduction

Both read with `corpus({ cwd, roots: ['**/*.md'] })`, and a `b.md` holding `# B`, on main's build.

**The drop direction.**

```markdown
# Top

## Real

### Sub

[before](b.md)

- ## Listed

  text

[after](b.md)

| t   |
| --- |
| 1   |
```

| reading                                 | result                                 |
| --------------------------------------- | -------------------------------------- |
| `doc.sections`                          | `Top`, `Real`, `Sub`                   |
| the table's `sectionPath`               | `['Top', 'Real', 'Sub']`               |
| `links().that().areInSection('Sub')`    | `before` (line 7) only                 |
| `links().that().areInSection('Real')`   | `before` (line 7) only                 |
| `links().that().areInSection('Listed')` | `after` (line 13), `['Top', 'Listed']` |

`after` sits under `### Sub`, beside the table that the other walk places there, and no
`areInSection` of a real heading selects it.

**The over-selection direction.**

```markdown
# Top

> ## Quoted
>
> [x](b.md)

- ## Listed

  [y](b.md)

[z](b.md)
```

`areInSection('Listed')` selects `y` (line 9) **and `z` (line 11)**; `doc.sections` is `[Top]`.

Measured over this repository's corpus (`work/`, `docs/`, `adr/`, 523 documents, 5,181 top-level
headings), through eess-md's own `corpus()`: 0 headings inside a list item or a blockquote. The
command is in plan 0496's "Measured". Nothing pins that zero.

## Root cause

Two walks of one tree, each written for its own element. `collectLinks` recurses because a link can
sit at any depth, and it enters every heading it meets on the way down, with no notion of which
headings start a section. `buildDocument` was written for top-level headings and tables only.

## Why it matters

A rule over links and a rule over tables or sections, written with the same section name, select
from different parts of the same document, and the links rule can be green on a link it dropped.
Plan 0496 settles what a section is for every reader but links: a heading inside a container does
not start a section, and its findings say so. Plan 0503 (`inSections`) attributes a link to the
sections that contain its line through plan 0496's index, so until this is fixed the two would
disagree on any such document. That is why it is 0503's precondition.

## Fix

One owner: links take their enclosing sections from plan 0496's section index (`sectionsOf(doc)`
and its line lookup) instead of a running stack. A heading inside a container then scopes nothing
outside it, and the drop direction is gone, as is the over-selection after the container.

Left for the fix to measure and decide, and only this: whether a link **inside** the container
still matches the container's own heading (`y` under `- ## Listed`). The section index cannot say
so, since that heading is not a section; keeping it would be a links-only exception, read from the
container, not from the index. The changed `links().areInSection()` verdicts ship with a release
note.

## Verification

- [ ] Red first, the drop direction: `areInSection('Sub')` selects `after` in the first reproduction
- [ ] Red first, the over-selection: `areInSection('Listed')` does not select `z`; `links()` and the
      table under one heading report the same `sectionPath`
- [ ] The links-only exception decided, with a row either way
- [ ] Green, with the release note; `npm run validate` green

Deferred: none
