# Bug 0475: a corpus root cannot be declared empty, and a root with no Markdown contributes nothing silently

## Status

- **State:** Fixed — 2026-10-18, in the batch-2 pull request, after a spike over the three adopters' root lists.
- **Severity:** Medium — the first half turns a correct configuration into a future silent pass; the
  second is a silent pass on a rarer shape.
- **Origin:** self-found · PR #236's review, 2026-10-18.
- **Reported:** 2026-10-18

## Symptom

**A root that is legitimately empty for now** has no way to say so. Example: `work/bugs/**` in a
repository that has filed no bug yet.

- Bug 0465 made `corpus()` refuse it beside live roots, and its only remedies are to correct the glob
  or remove the root.
- Removing the root makes the folder silently unexamined once it appears, which is the class bug 0465
  exists to stop.
- ADR-018: resolving to nothing is a finding "unless matching nothing is the purpose", and ADR-010 §3
  requires a declaration path.

**A root that matches files but no Markdown**, beside a live one, contributes nothing and is not
refused (`['docs/**', 'adr/*.txt']`). Refusing it broke existing callers, which list code globs as
roots beside their documents.

## Fix

Undecided. The design question is whether `corpus()` takes an expiring per-root declaration that reds
the day the root loads a document, in the way `.expectEmpty()` behaves, and how a code-glob root is
told apart from a mistyped Markdown root. Start with a spike over the three adopters' root lists.

## Resolution

**The spike.** Each of the three adopters measured its `corpus()` calls read-only on 2026-10-18.

- **Live trees:** every root of every call matches files. The refusal from bug 0465 breaks no live
  corpus, and all three want it there.
- **Fixtures:** one adopter's two test suites build its shared nine-root corpus in fixtures that hold
  only the one root each rule reads, so eight roots are empty on purpose. Those suites would throw.

**The fix.** `corpus()` takes `expectEmptyRoots`, naming roots that are empty on purpose. It is a
declaration, so it expires (ADR-010 §3):

- a named root that matches no file loads beside live roots;
- a named root that matches files is refused, so the folder is never silently unexamined once it
  fills;
- a name that is not one of the roots is refused as stale.

A blanket "allow empty roots" switch was rejected, because it would silence a dead root on a live tree
too.

**Not changed.** A root that matches files but no Markdown, beside a live root, is still not
refused. Callers list code globs as roots beside their documents. That shape is now declarable or
correctable, and it stays recorded here as accepted.

## Verification

- [x] A design decided and recorded (Resolution).
- [x] Red first, then green: `packages/md/tests/corpus-dead-root.test.ts`, the four `expectEmptyRoots` rows, red before the option existed. Sabotage rows that skip the expiry check, or the stale check, each turn one row red.

Deferred: none
