# Bug 0293: an example inside an HTML block is read as the document's own claim, so a State line or a Ruling turns a check off

## Status

- **State:** Draft. Measured end to end on `main`. No red test yet, and no fix has been designed.
- **Severity:** **High**, a **fail-open**, in two gates. A done record with an open box reports nothing when an example State line sits in an HTML block above the record's own. And an accepted proposal reads as not accepted when an example Ruling sits in an HTML block below its own, so `check:corpus` stops requiring its plan.
- **Origin:** self-found · testing review of a markdown design
- **Reported:** 2026-09-13

## Symptom

CommonMark treats an HTML block's content as raw HTML, not markdown. The ledger's State reader strips fenced code with a regex (`packages/md/src/rules/ledger.ts:153` on 0.6.0; since PR #144 it sets aside code blocks through the markdown parser, `packages/md/src/model/prose.ts`) and reads the rest of the text, HTML blocks included. It takes the first `State:` line it finds, so an example placed above the real line wins. The proposal gate's Ruling reader (`operativeRuling` in `scripts/lib/proposal-ruling.mjs`) takes the **last** `**Ruling:**` line, so there an example placed below the real line wins.

## Reproduce

Each record is read with `honestyAtClose(corpus, { closeInPlace: true })` on `main` at `2a2a503`.

````text
control: plain
# 0001 x

**State:** Done

## Tasks

- [ ] box

control: the example in a fence
# 0001 x

```md
- **State:** Draft
```

**State:** Done

## Tasks

- [ ] box

in <pre>
# 0001 x

<pre>
- **State:** Draft
</pre>

**State:** Done

## Tasks

- [ ] box

in an HTML comment
# 0001 x

<!--
- **State:** Draft
-->

**State:** Done

## Tasks

- [ ] box

in a <pre> nested in a list item
# 0001 x

- note:
  <pre>
  - **State:** Draft
  </pre>

**State:** Done

## Tasks

- [ ] box
````

| Record                      | Findings                     |
| --------------------------- | ---------------------------- |
| control: plain              | `ledger/silent-open-box` @7  |
| control: fenced example     | `ledger/silent-open-box` @11 |
| example in `<pre>`          | **none**                     |
| example in a comment        | **none**                     |
| example in a nested `<pre>` | **none**                     |

One more silencing shape, measured the same way: an example State line inside `<details>` written **without** blank lines is one HTML block, and the done record reports **nothing**.

```text
# 0001 x

<details>
<summary>Example</summary>
- **State:** Draft
</details>

**State:** Done

## Tasks

- [ ] box
```

**The Ruling.** Measured with `operativeRuling` and `hasUnparseableRuling`:

```text
# P

**Ruling: Ship as-is**

<pre>
**Ruling: Rewrite needed**
</pre>
```

| Document                                                  | `operativeRuling`    | unparseable |
| --------------------------------------------------------- | -------------------- | ----------- |
| the live Ruling alone (control)                           | `Ship as-is`         | false       |
| an example `Rewrite needed` in `<pre>` below the live one | **`Rewrite needed`** | false       |
| the same example in a comment                             | **`Rewrite needed`** | false       |

## Related shapes, measured on `main`

These are recorded here so a fix considers them. They are not all this record's defect.

- **Readers that are right today, for now.** CommonMark treats `<div>`, `<details>`, `<pre>` and comments alike as HTML blocks whose content is raw HTML. These readers are right only because they ignore that and read the text:
  - A **real** State line inside `<div>` is read.
  - A pointer or scenario citation inside `<pre>`, a comment, or `<details>` is checked.
  - An old Ruling inside `<pre>` or a comment, **above** the live one, does not override it.
- **Silent today.**
  - An open box inside a `<div>` block, on a done record, reports nothing. The box is raw HTML, not a list item.
  - An unclosed `<!--` becomes one HTML block running to the end of the file, and the boxes after it are not read. Pointers below it are still checked.
  - A `<details>` example written with blank lines puts its State line outside any HTML block, so it silences a done record just as a plain example would.
- **Loud, not silent.** An example `Deferred: none` inside `<pre>`, on a record that really defers a box, raises a **false** `ledger/deferred-none-lie`.
- **The directive half.** A directive inside `<pre>` is honoured; see 0291.
- **This repository has none.** It has 35 HTML comment blocks and 1 element block. None holds a pointer, citation, State line or Ruling.

## The corruption that must produce a violation

An example State line inside an HTML block must not silence a record's close checks, and an example Ruling inside an HTML block must not change a proposal's operative Ruling. An example `Deferred: none` inside an HTML block must not raise a false lie.

## Measured constraints for a fix

- **Skipping every HTML block silences real claims.** A real State line inside `<div>` and a pointer inside `<details>` are read correctly today.
- **Skipping HTML comments silences pointers after an unclosed `<!--`.** Those pointers are checked today.
- **One direction that skips nothing.** Report a State, `Deferred:` or Ruling line found inside an HTML block as ambiguous, with a remedy: move it out, put an example in a fence, or add blank lines around it. That keeps both directions loud, and was not measured.

## Note, 2026-09-19

[0286](./fixed/0286-a-fenced-example-can-turn-the-close-checks-off.md)'s fix (PR #144) moved the ledger's
reading onto the markdown parser for **code blocks only**. Its first version set HTML blocks aside as
well, and silenced a real `State:` line inside a `<div>` or `<details>`, as this record's measured
constraints predicted; the fix leaves HTML blocks read as before. Nothing in this record is fixed yet.

## Verification ledger

- [x] A State example in `<pre>`, a comment, a nested `<pre>`, or `<details>` without blank lines silences a done record on `main`; both controls report.
- [x] An example Ruling in `<pre>` or a comment, below the live one, becomes the operative Ruling on `main`.
- [x] The related shapes above, each measured on `main`.
- [ ] A design for the fix, recorded before it is built.
- [ ] Red tests: the four State shapes, the two Ruling shapes, the false `Deferred:` lie, and the `<div>` and `<details>` controls.
- [ ] A non-vacuity row on the `<pre>` shape.

## Related

- [0286](./fixed/0286-a-fenced-example-can-turn-the-close-checks-off.md): the same fail-open through a fenced example.
- [0291](./0291-the-markdown-masker-honours-a-directive-inside-code.md): the directive half.
