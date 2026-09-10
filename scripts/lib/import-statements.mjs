/**
 * The import statements in a code fence, verbatim.
 *
 * Split out of `scripts/check-docs-code.mjs` so it can be unit-tested the way
 * every other pure helper here is (bug 0273, second review round). A hand-rolled
 * parser doing a job TypeScript already does properly earns a test per shape,
 * and the first version had three that it silently dropped — a dropped import
 * makes the fence a fragment, which is indistinguishable from a fence that never
 * claimed anything.
 *
 * **Why a changeset is checked by its imports and not by its whole body.** The
 * defect bug 0273 was filed for is a claim about WHERE a symbol is exported —
 * "`finishPreset` is exported from the same three places the alias was". That
 * claim is only checkable once written as an import line, and an import line is
 * checkable alone: `tsc` reports TS2305 for a named member a module does not
 * export whether or not the name is ever used.
 *
 * Demanding the whole snippet compile would be the wrong bar. A migration reads
 * `finishPreset(violations, …)`, where `violations` is the reader's variable and
 * not one a changeset can invent. Requiring it to be invented would push authors
 * toward ceremony or toward the skip directive, and a gate people route around
 * is the failure ADR-009 rule 1 names.
 *
 * **Known limits, stated rather than discovered.** A line beginning with the word
 * `import` inside a template literal or a `/* … *\/` block comment is matched and
 * compiled as real — measured by a testing review. A `//` line comment is not,
 * because the line no longer starts with `import`.
 *
 * Both are fail-CLOSED: the cost is an extra statement compiled, never a real one
 * skipped, so the worst case is noise on a fence that was making no claim. Closing
 * them means parsing TypeScript, which would make this helper heavier than the
 * fences it guards. The escape hatch is the documented skip directive.
 */

// `(?![.(\w])` keeps `import.meta`, dynamic `import(`, and any identifier
// starting with "import" from opening a statement. The first version had no such
// guard, so an `import.meta.url` line swallowed the statement after it — measured
// by a testing review, which left a bad import unchecked and the gate green.
const STARTS = /^[ \t]*import(?![.(\w])/gm

// Tried IN THIS ORDER at each start, and the order is load-bearing. A bare
// specifier ends the statement immediately; trying the `from` form first lets it
// run past the closing quote to a LATER statement's `from`, merging two imports
// into one — which the unit test beside this file caught on the first draft.
const BARE = /[ \t]*import[ \t]*(['"])[^'"]*\1[ \t]*;?/y
const FROM = /[ \t]*import(?:[^'"\n]|\n)*?from[ \t]*(['"])[^'"]*\1[ \t]*;?/y

/** @param {string} code @returns {string[]} */
export function importStatementsIn(code) {
  const out = []
  for (const start of code.matchAll(STARTS)) {
    const at = start.index ?? 0
    // Re-anchor past the leading whitespace the start match consumed.
    const from = code.indexOf('import', at)
    for (const re of [BARE, FROM]) {
      re.lastIndex = from
      const m = re.exec(code)
      if (m) {
        out.push(m[0].trim())
        break
      }
    }
  }
  return out
}
