# Bug 0326: a ruling finding names the blank line above the ruling

## Status

- **State:** Draft — measured against the shipped script; no red test yet.
- **Severity:** Low — a `check:corpus` finding placed on a proposal's `**Ruling:**` line reports the first
  blank line above it, when a blank line precedes it — which is the house shape. A ruling with a
  non-blank line directly above it reports its own line. The finding still fires; the reader is sent to a
  blank line and has to look down for the ruling.
- **Origin:** self-found · while building the non-vacuity row for
  [0288](./fixed/0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md), whose
  probe's ruling on line 13 was reported on line 8.
- **Reported:** 2026-09-19

## Symptom

`operativeRulingLine` and `declaredImplementsLine` in `scripts/lib/proposal-ruling.mjs`, measured on 0.6.0's script:

| document                                         | label on | reported |
| ------------------------------------------------ | -------- | -------- |
| `## Review`, a blank line, the ruling            | 3        | **2**    |
| `## Review`, three blank lines, the ruling       | 5        | **2**    |
| the ruling on line 1                             | 1        | 1        |
| `## Review`, a blank line, a garbled `**Ruling:` | 3        | **2**    |
| `## Status`, a blank line, `- **Implements:** …` | 3        | 3        |
| `## Status`, a blank line, `**Implements:** …`   | 3        | **2**    |

## Root cause

`LABEL_PREFIX` (`scripts/lib/proposal-ruling.mjs:138`) ends in `\s*`, and the patterns built on it are
multiline. `\s` matches a newline, so a match can start at the first blank line above the label and run
down to it, and the line is counted from where the match starts. A bulleted or quoted line reports
correctly only because its marker stops a match that starts higher up.

## Fix

Indentation is spaces and tabs, not newlines: `[ \t]` for each `\s` in the prefix, the two after the
markers as well as the one at its end. Measured on a patched copy of 0.6.0's script: every row above
reports its own line, and so do a bulleted, a quoted and an indented ruling — nine shapes in all, with
every ruling and `**Implements:**` value read unchanged. Both sides share the prefix, so both
are fixed together, and a test pins the line for each shape.

## Verification

- [x] Measured on 0.6.0's script: the table above.
- [x] Measured the candidate fix on a patched copy: every line right, every value unchanged.
- [ ] Red test: a ruling and a bare `**Implements:**` after blank lines report their own line.
- [ ] The fix, and the non-vacuity fixture's label-prefix directions still hold.

Deferred: none.

## Related

- [0288](./fixed/0288-a-four-backtick-fence-swallows-a-proposals-ruling-and-the-gate-agrees.md) —
  where it was seen.
- [0143](./0143-proposal-ruling-parser-duplicates-terms-vocabulary.md) — the same script's
  hand-rolled matcher.
