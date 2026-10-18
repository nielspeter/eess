# Bug 0465: a corpus root that matches no file is dropped silently

## Status

- **State:** Fixed — 2026-10-18, in PR #236 (with bugs 0467, 0466 and 0444).
- **Severity:** High — a silent pass: a mistyped root in a multi-root corpus removes that root's
  documents from every rule over the corpus, without a word.
- **Origin:** self-found · plan 0456's rework, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

`corpus({ roots: ['guides/**', 'gudies-ref/**'] })` loads the documents under `guides/`, so it is
not an empty source, and the mistyped second root contributes nothing and is reported nowhere. A
rule over the corpus then judges half of what its author named. Plan 0456 makes an empty corpus a
finding, which catches a single mistyped root; it does not catch one of several.

## Fix

`corpus()` records a root that matches no file in the repository as a source fact on the corpus, and
every rule over it reports that fact through its own receipt (ADR-008, ADR-013, ADR-014), deduplicated
like other configuration findings (whose appended note is itself wrong for this case: [bug 0461](../0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)), so a rule file with ten rules over one corpus shows it once. Whether
a root may declare that matching nothing is intended is decided against ADR-018 (a string that names
code resolves, or the rule says why not). The fix reds corpora that pass today: a flagged eess-md break
with a migration line (remove or correct the dead root). Not plan 0456's scope (a change to `corpus()`, not to a selector); plan
0456 pins today's behaviour with a test, so this fix turns that test red on purpose.

## Resolution

`corpus()` refuses with an `ArchConfigError` when a root matches no file, or only ignored files,
while another root does load. It names each dead root and says why. This replaces the source fact on
each rule's receipt that the Fix above planned. The receipt route was measured against the kernel's
deduplication: the key includes the rule id, so ten rules over one corpus would report the root ten
times, and collapsing them needs a kernel change. A refusal is one finding for one authored mistake,
on every door that loads a corpus, as eess-md already does for a half-declared vocabulary (bug 0284).

What it deliberately does not refuse:

- **A corpus whose every root is dead.** The first version refused it, and the non-vacuity gate
  measured four fixtures breaking that build such corpora on purpose. Today most builders report it
  only as zero examined units. [Plan 0456](../../plans/0456-kernel-notexist-and-dead-glob.md) makes it
  a named empty-source finding, and owns that case.
- **A root that matches files but no Markdown**, beside a live one. Such a root contributes nothing.
  Refusing it broke existing callers, which list code globs (`src/**/*.ts`) as roots beside their
  documents. Recorded in [bug 0475](./0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md).
- **A root that is legitimately empty for now** (a lane with no records yet). It has no way to be
  declared, so its author can only remove it, and the folder is silently unexamined once it appears.
  Also bug 0475.

eess-gherkin's loader has the same multi-root shape: [bug 0472](../0472-a-gherkin-root-that-matches-no-file-is-dropped-silently.md).

## Verification

- [x] Red first: the two-root corpus above loaded with no finding on main (`packages/md/tests/corpus-dead-root.test.ts`).
- [x] Green: the dead root is refused and named, an ignored-only root is named as ignored, and roots that all match still load. The `corpus/dead-root` row in `check:nonvacuity` guards it at the gate tier.
- [ ] deferred→plan 0456 — a corpus whose every root is dead becomes a named empty-source finding there
- [ ] deferred→bug 0472 — eess-gherkin's loader has the same multi-root shape
- [ ] deferred→bug 0475 — no declaration for a legitimately empty root; a non-Markdown root contributes nothing

Deferred: plan 0456, bug 0472, bug 0475
