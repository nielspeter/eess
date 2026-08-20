# Bug 0177: the load-bearing waiver check covers one rule of four

## Status

- **State:** Draft — the gap is demonstrated by three defects it failed to catch.
- **Found:** 2026-08-20, enforcement review of the `fold-audit-0154-0160` branch.
- **Severity:** a denominator problem in a guard, not a false green in a rule.

## Symptom

Two detectors in `packages/ts/tests/archunit/arch-rules.test.ts` watch this
repo's `// eess-exclude` waivers, and only one of them proves anything:

| row                                                     | what it proves                  | population                                |
| ------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| `VACUITY: the orphan check really reads our directives` | a directive is **present**      | all 4 rule ids, 20 directives             |
| `every waiver in src/ actually suppresses something`    | a directive is **load-bearing** | `adr005/no-as-cast-module` only — 2 files |

So 18 of the repo's 20 waivers have no proof they suppress anything. A waiver can
name a live rule, sit in a file that legitimately holds waivers, read as "there is
a real exemption here" — and cover nothing at all.

## Repro

This is not hypothetical; it happened three times on one branch, and the third
survived a full six-persona review:

1. `packages/ts/src/core/terminal-builder.ts:37` waived `eess/no-unused-exports`
   for `ASSERTION_DOCS`. That export moved to `core/vacuity-diagnosis.ts` and took
   a fresh directive with it. The old one stayed, now covering **line 38, a blank
   line**.
2. The presence row stayed green: `core/terminal-builder.ts` was still in its
   pinned file list, because the file still contained _a_ directive.
3. The load-bearing row never looked, because it runs only
   `adr005/no-as-cast-module`.

Two earlier instances on the same branch (`helpers/baseline.ts`, deleted in
`f791a81`) were each a directive whose stated reason was false AND which covered
its own second comment line. Same detector gap, same silence.

## Root cause

A single-line `// eess-exclude` directive covers exactly the **next line**. When
the waived declaration moves or gains a comment line, the directive silently
retargets whatever now sits below it — a blank line, another comment — and stays
syntactically valid. Nothing distinguishes that from a live waiver except running
the rule and asking what it suppressed, which is exactly what the load-bearing row
does and exactly what it does not do for 18 of 20.

## Fix

Not built. Extend `every waiver in src/ actually suppresses something` to cover
every rule id the presence row asserts, not one of them. The mechanism already
exists — `commentSuppressions()` (shipped for bug 0041) reports what each rule
silenced — so this is a loop over the four ids rather than new machinery.

Two things to get right:

- **Assert by identity, not count.** The presence row's own comment argues this
  and is correct: a count that shrinks by one tells nobody which waiver died.
- **Decide what a legitimately-unmatched waiver looks like.** A waiver on a rule
  whose finding is currently suppressed by a _different_ mechanism would report
  zero suppressions without being dead. If that shape exists here, the row needs
  a way to say so that is not just an allowlist.

Consider also whether the directive should be required to name what it waives, so
a retargeted directive is detectable statically rather than only by execution.
That is a larger change and belongs in its own record if pursued.

## Verification

- [ ] The load-bearing row covers all four waived rule ids.
- [ ] Sabotage: move a waived export to another file, leaving the directive
      behind, and the row goes red. (This is the exact instance above — it
      should reproduce.)
- [ ] The row asserts identities, so deleting any one live waiver is visible.
- [ ] The denominator is stated, so a run that checked two waivers cannot read
      like a run that checked twenty.
