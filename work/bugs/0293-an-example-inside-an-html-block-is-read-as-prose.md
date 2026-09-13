# Bug 0293: an example State line inside an HTML block is read as the record's own, so the close checks turn off

## Status

- **State:** Draft. Measured end to end on `main`. No red test yet, and no fix has been designed.
- **Severity:** **High**, a **fail-open**. A done record with an open box reports nothing when an example State line sits in `<pre>`, in an HTML comment, or in a `<pre>` nested in a list item, above the record's own State line.
- **Origin:** self-found · testing review of a markdown design
- **Reported:** 2026-09-13

## Symptom

CommonMark treats an HTML block's content as raw HTML, not markdown. The ledger's State reader strips fenced code with a regex (`packages/md/src/rules/ledger.ts:153`) and reads the rest of the text, HTML blocks included. It takes the first `State:` line it finds, so an example placed above the real line wins.

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

## Related shapes, measured on `main`

These are recorded here so a fix considers them. They are not all this record's defect.

- **Readers that are right today.**
  - A **real** State line inside `<div>` is read. `<div>` is an element block, so its content renders.
  - A pointer or scenario citation inside `<pre>`, a comment, or `<details>` is checked.
  - An old Ruling inside `<pre>` or a comment does not override the live one.
- **Silent today.**
  - An open box inside a `<div>` block, on a done record, reports nothing. The box is raw HTML, not a list item.
  - An unclosed `<!--` becomes one HTML block running to the end of the file, and the boxes after it are not read. Pointers below it are still checked.
  - A `<details>` example written with blank lines puts its State line outside any HTML block, so it silences a done record just as a plain example would.
- **The directive half.** A directive inside `<pre>` is honoured; see 0291.
- **This repository has none.** It has 35 HTML comment blocks and 1 element block. None holds a pointer, citation, State line or Ruling.

## The corruption that must produce a violation

An example State or `Deferred:` line inside an HTML block must not silence the record's close checks.

## Measured constraints for a fix

- **Skipping every HTML block silences real claims.** A real State line inside `<div>` and a pointer inside `<details>` are read correctly today.
- **Skipping HTML comments silences pointers after an unclosed `<!--`.** Those pointers are checked today.
- **One direction that skips nothing.** Report a State or `Deferred:` line found inside an HTML block as ambiguous, with a remedy: move it out, put an example in a fence, or add blank lines around it. That keeps both directions loud, and was not measured.

## Verification ledger

- [x] A State example in `<pre>`, a comment, or a nested `<pre>` silences a done record on `main`; both controls report.
- [x] The related shapes above, each measured on `main`.
- [ ] A design for the fix, recorded before it is built.
- [ ] Red tests: the three silencing shapes, plus the `<div>` and `<details>` controls.
- [ ] A non-vacuity row on the `<pre>` shape.

## Related

- [0286](./0286-a-fenced-example-can-turn-the-close-checks-off.md): the same fail-open through a fenced example.
- [0291](./0291-the-markdown-masker-honours-a-directive-inside-code.md): the directive half.
