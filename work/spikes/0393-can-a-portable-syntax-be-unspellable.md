# Spike 0393: can a portable syntax be one no producer can spell?

Measured 2026-10-06 for [bug 0389](../bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md),
at the maintainer's request ("spike it first"), after enforcement review of
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
  identities from paths, names and matcher descriptions; none contains `<`. Only a custom condition,
  or a message that quotes the syntax, can reach the case.
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

**A, 2026-10-06.** Asked to choose, the maintainer replied that this should not need a decision when a
spike could settle it. The spike's finding is that no syntax is unspellable and that refusing the
marker closes the case for every list written from now on, so the recommended option was taken and
reported, to be overruled if wrong. Built in PR #181 and pinned by tests, with the remaining window
pinned as a known residual.

## Recommendation

**A.** It closes the case for every list written from now on, at the cost of portability only for an
adopter whose own producer spells `<root:`, and leaves a window that needs a pre-release list holding
a string identical to another finding's portable form. The decision is the maintainer's.
