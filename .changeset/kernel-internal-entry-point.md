---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking** — the kernel splits into two entry points. Family plumbing moves from
`@nielspeter/eess` to `@nielspeter/eess/internal` (ADR-011).

`@nielspeter/eess` had never declared what its public API was. It was implied — the
union of whatever the five dialects happened to import — so nothing could check the
boundary, and 78 engine internals sat on the published surface: `shallowClone`,
`isRecord`, `resetEdgeCoverage`, the glob-tree vocabulary, the suppression and
edge-coverage counters. Because `check:family` required each dialect to re-export
every kernel symbol its own source imports, each of those was published again by
every dialect that touched it.

**What moved.** 71 symbols now live at `@nielspeter/eess/internal`. If you import one
from `@nielspeter/eess`, change the specifier — nothing was deleted or renamed.

If you consume a DIALECT and hit one of these, note that `@nielspeter/eess/internal`
resolves for you only if the kernel is hoisted to your `node_modules` root. Under
pnpm's isolated layout or Yarn PnP it will not: add `@nielspeter/eess` to your own
dependencies. That is a direct dependency the family otherwise does not ask of you,
and it is the honest cost of reaching plumbing.

**What did not move**, because "unreferenced in this repo" is not "not API":
`correspondence` and `CorrespondenceBuilder` (documented on six pages, and the public
surface of eess-md and eess-crossvalidate), `reportViolations` and `finishPreset`
(named seams in ADR-008), and the `ArchJson*` types, which describe the `--format
json` output that `docs/agent-integration.md` teaches.

Also still on the root, and worth naming because an earlier draft of this changeset
said otherwise: `globNode` and `globAnyOf` (the constructors a user-written
`definePredicate` needs to declare its globs — a documented extension point), and
`CorrespondenceOptions`, `RelationSpec` and `KeyBy` (the parameter types of
`correspondence()` and `preserveRelations()`, both public). **Do not rewrite imports
of those five to `/internal`** — they are not there.

**The dialects' surfaces shrink too.** A dialect no longer re-exports kernel plumbing
it only uses internally, so `eess-ts`, `eess-md` and `eess-mermaid` each drop what they
used to forward. For those, the rule above applies — the symbol is a KERNEL symbol and
`@nielspeter/eess/internal` has it.

**That rule does not cover the 37 dialect-local symbols removed in the same release.**
Those were never kernel symbols, so `/internal` does not have them and there is no
replacement path; see the companion changeset for the list and the reasoning.

Measured at release: the kernel root goes 156 → 86 exports, with 673 scanned across
the family's published entry points. All 86 root exports are documented; 116
dialect-side exports are still undocumented and are reported rather than gated — ADR-011 clause 1
covers the kernel root, and no ruling covers the dialects yet (bug 0220).

`@nielspeter/eess/internal` is a published, versioned contract — breaking it still
needs a changeset. What it is not is API: nothing there is taught by `docs/` or a
README, and a consumer writing rules never names it. That boundary is enforced inside
this repo and is convention outside it, which ADR-011's Enforcement table records as
`manual` rather than claiming otherwise.

**Also in this release, and narrower than it sounds:** `@nielspeter/eess-crossvalidate`
raises its peer floors on the four dialects from `>=0.1.1` to the versions current at
release. `>=0.1.1` admitted any dialect ever published, which since the kernel split can
resolve **two copies of `@nielspeter/eess`** — and the kernel holds module-level state
(coverage counters, suppression counters, identity collisions, the cache registry), so
that state splits silently. If you pin an older dialect alongside crossvalidate you will
now get an `ERESOLVE` instead, which is the point.
