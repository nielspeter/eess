# Spike 0393: can a portable syntax be one no producer can spell?

Measured 2026-10-06 for [bug 0389](../bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md),
at the maintainer's request (they chose the option "Spike it first" when asked), after
enforcement review of
[spike 0392](./0392-what-makes-an-accepted-entry-portable.md)'s C5 build found a second way an entry
matches a finding `main` reports.

## The question

C5 prints a portable form, `<root:NAME>/relative/path`, and accepts a finding when an entry equals its
raw subject or that form. If some finding X's **raw** subject is itself a string in the portable
syntax, an entry written for X equals the portable form of a different finding Y. Fix X, and Y is
accepted where `main` reports it. Is there a portable syntax that no raw subject can ever spell?

## What was found

- **No syntax is unspellable.** `ArchViolation.identity` is a plain `string`
  (`packages/core/src/violation.ts:87`), and with no identity the subject is `element::message`,
  where the message is free text. Any syntax a matcher can recognise is a string, and a producer can
  emit that string. Choosing an exotic marker only lowers the odds; it does not close the case.
- **eess's own producers never spell it.** All 21 `identity:` sites under `packages/*/src` build
  identities from paths, names and matcher descriptions; no template contains `<`. The values a
  template interpolates (module specifiers, names, matcher descriptions) are user-controlled, so a
  custom condition, a message that quotes the syntax, or such a value can reach the case.
- **What can be closed is the source.** If a raw subject containing the marker `<root:` is refused —
  reported as a finding, with portable matching off for that rule — then nothing produced after the
  release can collide. An entry pasted from such a finding cannot be relied on, because the rule
  reports the refusal whenever that finding is present.
- **What cannot be closed.** A list written **before** this release, for a custom producer whose
  subject spelled `<root:NAME>/path` with this repository's NAME, the same relative path and the same
  remainder as a later, different finding. Once the literal finding is fixed, the refusal no longer
  fires and the entry matches the other finding. No rule that reads only strings can tell the two
  apart, because the entry predates the syntax it collides with.

## Options

- **A. Refuse the marker, and name the pre-release window as the residual.** A raw subject containing
  `<root:` turns portable matching off for that rule and reports a finding that names the subject.
  The remaining window is one exact string collision in a list written before the release.
- **B. Accept the whole case as a residual**, as the shared-package-name case was, and pin it.

## Decision

**A, taken 2026-10-06 by the coordinating agent, on the maintainer's instruction.** Asked to choose
between A and B, the maintainer answered "and this cannot be decide by investatgion or a spike" (sic),
which the coordinator read as: a question a spike can settle should not come back to them. The coordinator took the
recommended option and reported it, open to being overruled.

**As built** (bug 0389, PR #181): a rule with a subject containing `<root:` compares raw subjects
only, exactly as on `main`, and its advice names the subjects and the remedy. A first build
(`bcfe457`) escalated every finding of such a rule instead; review measured that as stricter than
option A and than `main`, and it was narrowed. **Not built: a finding of its own.** Nothing is
reported unless another finding of the rule is outside the list, because the advice is read only
then (through `diagnose`). So the findings' claim that "the rule reports the refusal whenever that
finding is present" does not hold. The behaviour is never more lenient than `main`, which is what
option A was for; the report half is not delivered.

**What A does not close.** The findings above say "nothing produced after the release can
collide", and the Recommendation below says "every list written from now on". That is too
strong: an entry kept for a literal finding still equals another finding's portable form once the
literal finding is fixed, whenever the entry was written. Bug 0389 records it as a residual, and a
test pins it.

## Recommendation

**A.** It closes the case for every list written from now on, at the cost of portability only for an
adopter whose own producer spells `<root:`, and leaves a window that needs a pre-release list holding
a string identical to another finding's portable form. (Recommendation as written before the
decision; see Decision for who took it.)
