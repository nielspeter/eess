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

- [Bug 0465](./0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md) made `corpus()` refuse it beside live roots, and its only remedies are to correct the glob
  or remove the root.
- Removing the root makes the folder silently unexamined once it appears, which is the class [bug 0465](./0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md)
  exists to stop.
- [ADR-018](../../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md): resolving to nothing is a finding "unless matching nothing is the purpose", and [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3
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

- **Live trees:** every root of every call matches files. The refusal from [bug 0465](./0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md) breaks no live
  corpus, and all three want it there.
- **Fixtures:** one adopter's two test suites build its shared nine-root corpus in fixtures that hold
  only the one root each rule reads, so eight roots are empty on purpose. Those suites would throw.

**The fix.** `corpus()` takes `expectEmptyRoots`, naming roots that are empty on purpose. It is a
declaration, so it expires ([ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) §3):

- a named root that loads no Markdown document is allowed beside other roots. A lane holding only a
  `.gitkeep`, or code, counts as empty;
- a named root that loads documents is refused, so the folder is never silently unexamined once it
  fills;
- a name that is not one of the roots is refused as stale;
- an undeclared dead root beside a declared one is still refused and named, even with no live root.

A blanket "allow empty roots" switch was rejected, because it would silence a dead root on a live tree
too.

**Residual.** An undeclared root that matches files but no Markdown, beside a live root, still
contributes nothing silently. It can now be declared, but nothing tells its author to. Refusing it
broke existing callers, which list code globs as roots. Recorded as
[bug 0478](../0478-a-root-with-files-but-no-markdown-contributes-nothing-silently.md).

## Verification

- [x] A design decided and recorded (Resolution).
- [x] Red first, then green: `packages/md/tests/corpus-dead-root.test.ts`. The rows that pass `expectEmptyRoots` were red before the option existed. The typo-beside-a-live-root row passes on main as well, and is a regression guard. Sabotage of the expiry check, and of the stale check, each turned one row red (measured by hand, 2026-10-18).
- [ ] deferred→[bug 0478](../0478-a-root-with-files-but-no-markdown-contributes-nothing-silently.md) — an undeclared root with files but no Markdown is still silent

Deferred: [bug 0478](../0478-a-root-with-files-but-no-markdown-contributes-nothing-silently.md)
