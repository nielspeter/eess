/**
 * The named groups a pattern declares, in any branch, listed by compiling it as an alternative of
 * the empty string: `exec('')` then reports every group it has, so a lookbehind or an escaped `\(?<`
 * in the source is never mistaken for one. The caller's flags are kept, less `g` and `y`, so a
 * pattern that needs `u` or `v` compiles. One probe for every caller (plan 0648's build review found
 * it written twice).
 */
export function namedGroups(pattern: RegExp): readonly string[] {
  const probe = new RegExp(`(?:${pattern.source})|`, pattern.flags.replace(/[gy]/g, ''))
  return Object.keys(probe.exec('')?.groups ?? {})
}
