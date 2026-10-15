# Migrating to 0.13

> Written for the release tagged `v0.13.0`. All six packages move. Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-md @nielspeter/eess-mermaid @nielspeter/eess-gherkin @nielspeter/eess-crossvalidate`.

| package                          | from   | to     |
| -------------------------------- | ------ | ------ |
| `@nielspeter/eess`               | 0.6.1  | 0.7.0  |
| `@nielspeter/eess-ts`            | 0.12.0 | 0.13.0 |
| `@nielspeter/eess-md`            | 0.9.0  | 0.10.0 |
| `@nielspeter/eess-mermaid`       | 0.6.0  | 0.7.0  |
| `@nielspeter/eess-gherkin`       | 0.5.0  | 0.6.0  |
| `@nielspeter/eess-crossvalidate` | 0.7.0  | 0.8.0  |

Every package takes a minor, because the kernel change below is a break that every dialect ships to
its adopters. **Upgrade them together.** `eess-crossvalidate` 0.8.0 declares its sibling dialects as
peers at this release's versions: `eess-ts` 0.13.0, `eess-md` 0.10.0, `eess-mermaid` 0.7.0 and
`eess-gherkin` 0.6.0 or later. Upgrading it alone, beside an older dialect, fails at `npm install`
with a peer-dependency conflict (`ERESOLVE`). The floors are raised so one install never holds two
kernels.

**Most of this release fixes checks that passed when they should not have.** So the main thing to
expect is findings you were not getting before, on code and documents you did not change. They are
real. Read them before you regenerate a baseline.

## If you only read one thing

A waiver comment is now read only in a file eess can lex: JavaScript and TypeScript (including Vue and
Svelte) and Markdown (`.md`, `.markdown`, `.mdx`). In a `.feature`, `.yml`, `.py`, `.mmd`, `.graphql`
or any other file, no `eess-exclude` comment is read, in either the `//` or the `<!-- -->` form.

```gherkin
Feature: x
  Scenario: Same title
    Given a doc string
      """
      // eess-exclude-start unique-titles: this text is data, not a comment
      """
  Scenario: Same title
    Given another doc string
      """
      // eess-exclude-end
      """
```

With `scenarios(set).should().haveUniqueTitles().rule({ id: 'unique-titles' })`, before 0.13 those
doc strings waived the duplicate-title finding between them, because the kernel read the `.feature`
file as if it were JavaScript. From 0.13 the finding reports. Gherkin's own `# eess-exclude` comment
was never read and still is not. ADR-012 records why: a kernel that cannot prove a span is a comment
does not treat it as one.

**What to do with a waiver you had in such a file:**

- **Find them.** An old directive in these files is now ignored without a warning:
  `git grep -n eess-exclude -- ':!*.ts' ':!*.tsx' ':!*.js' ':!*.jsx' ':!*.mjs' ':!*.cjs' ':!*.vue' ':!*.svelte' ':!*.md' ':!*.markdown' ':!*.mdx'`
  lists every one.
- **Move the waiver onto the rule.** `.excluding(pattern)` on a rule built with a builder works for any
  file type. It matches a finding's element, file path or message, and warns when the pattern stops
  matching anything. For example, `.excluding('features/legacy.feature')`.
- Or fix the finding, or narrow the rule's selection.

`eess-crossvalidate`'s presets (`embeddedDiagramsMatchCode`, `tableErAgree`) offer no `.excluding()`,
and a comment does not silence their findings either.

## What can go red on update

| package              | what is now checked                                                                                       | why it passed before                                |
| -------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| every dialect        | a finding in a non-code, non-Markdown file that a `//` or `<!-- -->` waiver used to suppress              | the file was read as JavaScript (bug 0419)          |
| `eess-md`            | a code block nested in a list item or a blockquote is in `MdDocument.codeBlocks`                          | only top-level blocks were listed (bug 0290)        |
| `eess-crossvalidate` | a Mermaid diagram tagged `Mermaid`, in any letter case, in `embeddedDiagramsMatchCode` and `tableErAgree` | the tag was compared exactly (bugs 0423 and 0424)   |
| `eess-crossvalidate` | an `erDiagram` behind a `%%{init}%%` directive or `---` frontmatter, in `tableErAgree`                    | the selector read the fence's first line (bug 0210) |

Two of those come with a known gap. `eess-mermaid`'s ER parser does not yet accept `---` frontmatter
or a multi-line `%%{init}%%` block, so such a diagram is now reported as not parsing, instead of being
skipped in silence. The finding says it may be valid Mermaid; see the next section.

## Messages that changed

A fence `eess-mermaid`'s grammar cannot read used to be reported as the author's syntax error, with a
fix that led to deleting the fence. `embeddedDiagramsMatchCode` and `tableErAgree` now say the fence
"does not parse with eess-mermaid's class-diagram grammar" (or "ER grammar"), that it is either a
syntax error or valid Mermaid `eess-mermaid` does not model yet, and that eess cannot tell which
without Mermaid's own parser (bug 0409). Its fix line:

- check the fence in the Mermaid Live Editor;
- fix it if Mermaid reports a parse error;
- if Mermaid accepts it, keep it and report the construct to eess. No `eess-exclude` comment silences
  this finding. To be green meanwhile, move only that fence into a document of its own and leave that
  document out, so the others stay checked.

A `classDiagram-v2` fence is told to change its header to `classDiagram`. `tableErAgree`'s parse
finding now has a fix line; before, its remedy printed as its reason.

The rule ids are unchanged. If a test asserts on these findings, match `ruleId`
(`crossval/embedded-diagram`, `crossval/table-er-agree`), not the message text.

## New

- **`eess-md`: `parseCodeBlocks()` and `codeBlocks()`.** Check every fenced block of one language
  with a parser you name, for example `JSON.parse` over ` ```json ` blocks. A parser that throws,
  hangs past its budget, returns a malformed verdict or accepts one of its own canaries is a finding,
  never a pass. See [Code blocks that parse](./markdown.md#code-blocks-that-parse).
- **`eess-mermaid`: `diagramKind(text)`.** A diagram's declared kind (`erDiagram`, `graph`, …), read
  past `%%` comments, `%%{init}%%` directives and `---` frontmatter.

## Package by package

- **`@nielspeter/eess`** — the waiver change above.
- **`@nielspeter/eess-ts`** — the waiver change, for findings in files other than code. Nothing else.
- **`@nielspeter/eess-md`** — `parseCodeBlocks` and `codeBlocks`; nested code blocks in
  `MdDocument.codeBlocks`. Markdown waivers are unaffected.
- **`@nielspeter/eess-mermaid`** — `diagramKind`; no waiver is read in a `.mmd` file.
- **`@nielspeter/eess-gherkin`** — no waiver is read in a `.feature` file, which closes bug 0419.
- **`@nielspeter/eess-crossvalidate`** — the selection fixes and message changes above, and the
  `eess-mermaid` 0.7.0 requirement.
