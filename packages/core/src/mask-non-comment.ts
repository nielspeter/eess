/**
 * Blank every span a directive must NOT be read from, preserving length and
 * lines so reported positions are unchanged.
 *
 * Bug 0154: `parseExclusionComments` scanned raw source line by line with a bare
 * regex, so text that merely LOOKED like `// eess-exclude …` — inside a string,
 * a template literal, or a block comment describing the grammar — was parsed as
 * a real waiver and silently suppressed a genuine finding on the next line. That
 * is a suppression nobody wrote, which is the worst direction a suppression
 * system can fail in.
 *
 * **Text-only, deliberately.** The kernel cannot import ts-morph (ADR-002/007
 * confine it to `eess-ts`), so this is a hand-rolled single-pass scanner rather
 * than an AST walk. The failure direction is what makes that acceptable: a
 * mis-lex can only ever *hide* a directive — a waiver stops working, loudly, and
 * the violation it was hiding comes back — never invent one.
 *
 * Line comments are deliberately NOT blanked: they are the thing being looked
 * for. Everything else that can contain `//` is.
 */

/** Replace a span with spaces, keeping newlines so line numbers do not move. */
function blank(text: string, start: number, end: number): string {
  let out = ''
  for (let i = start; i < end; i++) {
    out += text[i] === '\n' ? '\n' : ' '
  }
  return out
}

/**
 * A `/` here starts a regex literal rather than dividing.
 *
 * Decided by the previous significant character: after a value (identifier,
 * literal, `)`, `]`) a `/` divides; after an operator, `(`, `,`, `=` or nothing
 * it opens a regex. Getting this wrong is safe in one direction only — treating
 * a division as a regex blanks source that could then hide a directive, so the
 * bias is toward NOT opening a regex when unsure.
 */
function opensRegex(text: string, at: number): boolean {
  let i = at - 1
  while (i >= 0) {
    const c = text[i]
    if (c === undefined) return true
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i -= 1
      continue
    }
    return !/[A-Za-z0-9_$)\]]/.test(c)
  }
  return true
}

/**
 * Blank strings, template literals, regex literals and block comments.
 *
 * @param sourceText the raw file text
 * @returns text of identical length and line structure, with those spans spaced out
 */
export function maskNonCommentSpans(sourceText: string): string {
  let out = ''
  let i = 0
  const n = sourceText.length

  while (i < n) {
    const c = sourceText[i]
    const next = sourceText[i + 1]

    // Line comment — left intact; this is what the directive parser reads.
    if (c === '/' && next === '/') {
      const end = sourceText.indexOf('\n', i)
      const stop = end === -1 ? n : end
      out += sourceText.slice(i, stop)
      i = stop
      continue
    }

    // Block comment — blanked. A grammar description inside JSDoc is prose.
    if (c === '/' && next === '*') {
      const close = sourceText.indexOf('*/', i + 2)
      const stop = close === -1 ? n : close + 2
      out += blank(sourceText, i, stop)
      i = stop
      continue
    }

    // String or template literal — blanked whole, interpolations included. A
    // `${…}` may itself contain a quote, so scanning it as code would need a
    // nesting stack for no benefit: nothing inside a template is a directive.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      let j = i + 1
      while (j < n) {
        const d = sourceText[j]
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === quote) {
          j += 1
          break
        }
        // An unterminated single- or double-quoted string ends at the newline;
        // a template legitimately spans lines.
        if (d === '\n' && quote !== '`') break
        j += 1
      }
      out += blank(sourceText, i, j)
      i = j
      continue
    }

    // Regex literal — blanked. `/…\/…/` can contain `//`.
    if (c === '/' && opensRegex(sourceText, i)) {
      let j = i + 1
      let inClass = false
      let closed = false
      while (j < n) {
        const d = sourceText[j]
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === '\n') break
        if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) {
          j += 1
          closed = true
          break
        }
        j += 1
      }
      // Only blank when it really closed on the same line; an unterminated
      // `/` was division after all, and blanking to end-of-line could hide a
      // trailing directive.
      if (closed) {
        out += blank(sourceText, i, j)
        i = j
        continue
      }
    }

    out += c
    i += 1
  }

  return out
}

/**
 * The markdown answer to the question `maskNonCommentSpans` asks of code.
 *
 * A `.md` file has no string or template literals, so running the JS/TS lexer
 * over one is a category error — and a costly one, because markdown is
 * backtick-dense: a single unbalanced backtick in prose opened a "template
 * literal" that swallowed the rest of the file, silencing every real directive
 * after it. Fail-closed, so no invented suppression, but a waiver that stops
 * working for a reason nobody can see is its own defect.
 *
 * What markdown DOES have is code spans, and they mean the same thing a string
 * literal means in code: this is an example of the grammar, not an instance of
 * it. Fenced blocks (``` or ~~~) and inline spans are blanked; prose is left
 * alone. Length- and line-preserving, so reported positions do not move.
 *
 * An unterminated fence blanks to end-of-file. That is the fail-closed
 * direction: text under a fence that was opened and never closed is more likely
 * an example than a waiver, and the cost is a directive that does not apply
 * rather than one that applies where nobody asked.
 */
export function maskMarkdownCodeSpans(sourceText: string): string {
  const lines = sourceText.split('\n')
  const out: string[] = []
  let fenceChar: string | undefined
  let fenceLength = 0

  for (const line of lines) {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line)
    const marker = opener === null ? undefined : opener[1]

    if (fenceChar !== undefined) {
      // Inside a fence: blank everything, the closing marker line included.
      out.push(' '.repeat(line.length))
      if (marker !== undefined && marker.charAt(0) === fenceChar && marker.length >= fenceLength) {
        fenceChar = undefined
        fenceLength = 0
      }
      continue
    }

    if (marker !== undefined) {
      fenceChar = marker.charAt(0)
      fenceLength = marker.length
      out.push(' '.repeat(line.length))
      continue
    }

    // Outside a fence: blank BALANCED inline spans only. An odd backtick is
    // prose, and treating it as an opener is exactly the bug this replaces.
    out.push(blankInlineCodeSpans(line))
  }
  return out.join('\n')
}

/** Blank `…` runs on one line, leaving an unpaired backtick as ordinary text. */
function blankInlineCodeSpans(line: string): string {
  const ticks: number[] = []
  for (let i = 0; i < line.length; i++) {
    if (line.charAt(i) === '`') ticks.push(i)
  }
  if (ticks.length < 2) return line
  let out = line
  for (let i = 0; i + 1 < ticks.length; i += 2) {
    const open = ticks[i]
    const close = ticks[i + 1]
    if (open === undefined || close === undefined) continue
    out = out.slice(0, open) + ' '.repeat(close - open + 1) + out.slice(close + 1)
  }
  return out
}
