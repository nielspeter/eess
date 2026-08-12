# Bug 0083: `langium generate` throws `TypeError: Invalid URL` on Node ≥26 — blocks local build

## Status

- **State:** Fixed — fixed 2026-07-24 (PR #29). What first looked like a decision
  turned out trivial: the failing call is a **single** site, and Node 26 accepts
  `'thismessage:///'` while producing the identical `.hash`. A one-character,
  behavior-preserving patch to `jsonschema` (via `patch-package`) makes Node 26 build
  again — no Node pin needed. Full `build` + `validate` green on Node 26.5.0 (146 test
  files, 1934 tests). **Deferred: none.**
- **Found:** 2026-07-24, in passing, while running `npm run validate` for
  [plan 0082](../../plans/completed/0082-doc-code-fence-typecheck.md) — the build step
  failed before any gate ran. Local machine had moved to Node 26.

## Symptom

On **Node ≥ 26**, `npm run build` (and therefore `npm run validate`) fails at the
`@nielspeter/eess-mermaid` `langium:gen` step, before anything else runs:

```
> @nielspeter/eess-mermaid@0.1.2 langium:gen
> langium generate --file langium-config.json
Reading config from …/packages/mermaid/langium-config.json
TypeError: Invalid URL
```

Any contributor on Node 26+ cannot build the repo locally. **CI is unaffected** — it
pins `node-version: 24` (`.github/workflows/ci.yml`), where the build succeeds.

## Reproduction

On Node 26.x (verified `v26.5.0`):

```bash
npm run langium:gen -w @nielspeter/eess-mermaid
# → TypeError: Invalid URL   (ERR_INVALID_URL)
```

On Node 24.x the same command succeeds. It is purely Node-version-dependent; no eess
source or config changed.

## Root cause

Not eess code. `langium-cli`'s `generate` validates `langium-config.json` against a
JSON schema using the `jsonschema` package, which builds a URL from the schema's
`$ref`:

```
TypeError: Invalid URL
    at new URL (node:internal/url)
    at Validator.resolve (node_modules/jsonschema/lib/validator.js:263)
    …
    at generate (node_modules/langium-cli/lib/generate.js:29)
  code: 'ERR_INVALID_URL',
  input: '/undefined#/$defs/languageItem',
  base: 'thismessage::/'
```

`jsonschema` calls `new URL('/undefined#/$defs/languageItem', 'thismessage::/')`. The
schema lacks an `$id`, so it falls back to the base `thismessage::/`; Node ≤ 24's URL
parser tolerated that malformed pair, **Node 26's stricter WHATWG parser rejects it**.

Verified dead ends (both already newest):

- `langium` / `langium-cli` are already at **4.3.1 / 4.3.0** (latest) — bumping the
  declared range changes nothing.
- `jsonschema` is already at **1.5.0** (latest) — an `overrides` to `latest` is a no-op.

So there is no clean dependency-bump fix today; the real fix is upstream
(`langium-cli` or `jsonschema` handling Node 26).

## Fix

A one-character, behavior-preserving patch to `jsonschema`, applied via
`patch-package`. The single failing site (`validator.js:263`) uses only the parsed
URL's `.hash`, so changing the sentinel base `'thismessage::/'` → `'thismessage:///'`
— which Node 26 accepts and which yields the **identical** hash — fixes the crash
without touching any validation behaviour.

- `patches/jsonschema+1.5.0.patch` — the one-line change.
- `patch-package` added as a dev dependency; a `postinstall` script re-applies the
  patch on every install (verified: revert the dep edit → `patch-package` →
  `jsonschema@1.5.0 ✔` → green).

The options this bug first weighed — a `.nvmrc` Node pin, or a bigger patch-package
effort — proved unnecessary: the real fix was much smaller than the worry (it took
knowing there was exactly one call site and that one valid base preserves the hash).
The root cause is still upstream (`jsonschema` / `langium-cli` on Node 26); when a
fixed release lands, drop the patch and the `postinstall`.

## Verification

- [x] **Red — reproduced.** `npm run langium:gen -w @nielspeter/eess-mermaid` on Node
      26.5.0 → `TypeError: Invalid URL` (stack captured above). A toolchain/environment
      defect — the build command is the test; there is no unit test to write.
- [x] **Green — confirmed.** With the patch, `langium:gen`, the full `npm run build`,
      and the full `npm run validate` all pass on Node 26.5.0 (146 test files, 1934
      tests). CI (Node 24) is unaffected — it applies the same harmless patch.
