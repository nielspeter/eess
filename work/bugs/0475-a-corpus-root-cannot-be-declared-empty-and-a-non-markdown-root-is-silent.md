# Bug 0475: a corpus root cannot be declared empty, and a root with no Markdown contributes nothing silently

## Status

- **State:** Draft — recorded 2026-10-18 from PR #236's review (enforcement), the residual of bug 0465's fix.
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

## Verification

- [ ] A design decided and recorded
- [ ] Red first, then green, per that design

Deferred: none
