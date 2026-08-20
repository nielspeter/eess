/**
 * Fixture: the cases that tell `noConsole` apart from `noConsoleLog`, and
 * `noJsonParse` apart from the rest of the `JSON` namespace.
 *
 * Deliberately NOT folded into `security-class.ts` (bug 0186): the classes
 * there are shared by the module- and function-variant suites, so widening one
 * to carry another logging member would silently change what those rules
 * examine.
 *
 * **No comment in this file may contain a literal console-dot or parse-dot
 * spelling.** `security.test.ts` derives the expected violation lines by
 * scanning this text, and a mention inside a comment would be counted as a
 * fourth site — the cross-derivation is only independent while the prose stays
 * out of its way.
 */

/**
 * Logging access with **no `log` member anywhere**. This is the discriminator:
 * `noConsole` matches an access pattern and must flag all three sites, while
 * `noConsoleLog` matches a call to the `log` member and must flag none of
 * them. A class containing the `log` member cannot tell the two rules apart.
 */
export class NonLogConsoleClass {
  warn(message: string): void {
    console.warn(message)
  }

  fail(message: string): void {
    console.error(message)
  }

  /** An access that is never called — a call matcher cannot see this one. */
  tabulate(): unknown {
    return console.table
  }
}

/**
 * Both directions of the `JSON` round trip, so a rule keyed on the wrong
 * member of that namespace is caught either way.
 */
export class JsonRoundTripClass {
  read(raw: string): unknown {
    return JSON.parse(raw)
  }

  write(value: unknown): string {
    return JSON.stringify(value)
  }
}

/** The writing half alone — `noJsonParse` must stay quiet here. */
export class JsonWriterClass {
  write(value: unknown): string {
    return JSON.stringify(value)
  }
}
