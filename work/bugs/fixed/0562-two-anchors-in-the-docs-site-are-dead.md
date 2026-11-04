# Bug 0562: two anchors in the docs site are dead, and `check:corpus` is green over them

## Status

- **State:** Fixed — both links reach their sections (2026-11-03). Found by PR #280's enforcement
  re-check, re-measured 2026-10-30.
- **Severity:** Low — documentation drift: a reader following either link lands at the top of the
  page, not the section. The gate that should catch it is
  [bug 0136](./0136-link-fragments-are-never-checked.md)'s; this record is the drift itself.
- **Origin:** self-found · PR #280's enforcement re-check of
  [bug 0136](./0136-link-fragments-are-never-checked.md), which said this repository held no dead
  anchor.
- **Reported:** 2026-10-30

## Symptom

1. **Dead on every renderer.** `docs/violation-reporting.md:103` links `/cli#doctor`, and
   `docs/cli.md` has no heading containing "doctor".
2. **Dead on the VitePress site only.** `docs/migrating-to-0.15.md:397` links
   `./markdown.md#a-documents-shape-built-from-blocks`, the heading `## A document's shape, built
from blocks` (`docs/markdown.md:897`). GitHub's slug is `a-documents-shape-built-from-blocks`, so
   the link works when the file is read on GitHub; VitePress's default slug is
   `a-document-s-shape-built-from-blocks` (measured with `@mdit-vue/shared` 2.1.4, the version
   VitePress bundles not verified), so it is dead on the published site.

## Reproduction

`grep -niE '^#+ .*doctor' docs/cli.md` prints nothing. The slugs: see
[bug 0136](./0136-link-fragments-are-never-checked.md)'s "Which renderer" table.

## Fix

Point `/cli#doctor` at the section that documents `eess-ts doctor`, or add one if none exists; give
the 0.15 migration link the anchor both renderers produce, or an explicit `{#id}` on the heading.

**Built 2026-11-03.** `docs/cli.md` had no section about `eess-ts doctor`, so one was added
(`### \`doctor\` — Diagnose Rules`, written from `packages/ts/src/cli/commands/doctor.ts`'s own
account), and `/cli#doctor`now names its VitePress id,`/cli#doctor-—-diagnose-rules`; the site
link is site-absolute, so GitHub's id does not apply. The heading the migration link names is now
`## The shape of a document, built from blocks`, whose id is
`the-shape-of-a-document-built-from-blocks`on both renderers, and the link and`packages/md/README.md`'s link to it name that id.

## Verification

- [x] `/cli#doctor` reaches a section about `eess-ts doctor`: the gate, now judging fragments under
      VitePress's rule for `docs/`, is green on it.
- [x] The migration link reaches its heading on the VitePress site and on GitHub: both rules give
      `the-shape-of-a-document-built-from-blocks` (measured with `slugify` and `github-slugger`).
- [x] `npm run validate` green.

Deferred: the gate that would have caught both →
[bug 0136](./0136-link-fragments-are-never-checked.md).
