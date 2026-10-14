# Bug 0420: a failed code-block parse is misdescribed by the kernel

## Status

- **State:** Draft — reproduced 2026-10-15 against PR #209's build of plan 0412 (eess-md
  `parseCodeBlocks`). Found by that PR's review (architect and enforcement). No red test yet, and the
  fix is not designed.
- **Severity:** Medium — an honesty gap between what a message says and what happened (`BUGS.md`'s
  Medium row). The build is red in both cases below, so nothing passes that should fail. What is wrong
  is what the author is told.
- **Origin:** self-found · review of PR #209, 2026-10-15.
- **Reported:** 2026-10-15
- **Related to:** [bug 0358](./0358-an-unused-exclusion-warning-does-not-say-which-instance-it-is-about.md),
  the same warning misidentifying its subject another way.

## Symptom

A parser that fails makes every rule over `parseCodeBlocks`' result report one instrument finding,
`eess-md: code-block parser`. Two kernel behaviours then misdescribe that failure:

1. **An exclusion that names a real block is called stale.** A rule with
   `.excluding('docs/a.md:3')`, where `docs/a.md:3` is a real `mermaid` block, prints
   `Unused exclusion 'docs/a.md:3' … It matched zero violations — it may be stale after a rename.`
   The exclusion is not stale. The parser failed, so no block was judged and nothing could match it.
2. **Two different failures collapse into one, and the second cause is lost.** Two
   `parseCodeBlocks` calls with one parser over two corpora fail for two different reasons. Each rule
   reports its instrument finding, and `dedupeConfigFindings` keeps one, because the key (`file`,
   `ruleId`, `element = name@version`) is the same. The survivor shows the first cause only and adds
   "This one option generated 2 rules that cannot enforce anything; they are not listed separately
   because they are one edit." They are two failures, not one edit.

## Reproduction

```js
// Node, against packages/md/dist and packages/core/dist
const parser = (msg) => ({
  name: 'stub',
  version: '1.0.0',
  canaries: [{ text: 'x', expect: 'invalid' }],
  parse: () => {
    throw new Error(msg)
  },
})
const p1 = await parseCodeBlocks(corpus({ roots: ['…/broken/**'] }), {
  language: 'mermaid',
  parser: parser('cause one'),
})
codeBlocks(p1).should().parse().excluding('…/broken/c.md:3').rule({ id: 'x' }).violations()
// stderr: [eess] Unused exclusion '…/broken/c.md:3' in rule 'x'. It matched zero violations — it may be stale after a rename.

const p2 = await parseCodeBlocks(corpus({ roots: ['…/valid/**'] }), {
  language: 'mermaid',
  parser: parser('cause two'),
})
dedupeConfigFindings([...rulesOver(p1), ...rulesOver(p2)])
// 2 instrument findings before, 1 after: "… the parser threw: cause one. … they are one edit."
```

The fixtures are `packages/md/tests/fixtures/code-block-parse/broken/` and `…/valid/`.

## Root cause

- **Part 1.** The kernel warns about an exclusion that matched no violation
  (`packages/core/src/execute-rule.ts:90`). It cannot tell "nothing matched because the target is
  gone" from "nothing was judged because the instrument failed".
- **Part 2.** `dedupeConfigFindings` collapses findings with the same key and states the collapse as
  one authored option fanned out by a preset (`affectedNote`,
  `packages/core/src/dedupe-config-findings.ts:56`). An instrument finding is not that shape: one
  parser can fail twice for different reasons. eess-md's docs (`docs/markdown.md`, "Code blocks that
  parse") state the collapse; the kernel's note does not.

## Fix

Not designed. Candidates:

- **Part 1.** Suppress the unused-exclusion warning for a rule whose result carries an unsuppressable
  instrument finding, or word it so it says no element was judged.
- **Part 2.** Key an instrument finding on its cause as well, or give instrument findings their own
  collapse note. ADR-016 C3 asks for one finding per instrument failure, not one per instrument.

## Verification

- [ ] Red test first for each part, through the public entry points.
- [ ] `npm run validate` green.

Deferred: none
