# Bug 0083: `langium generate` throws `TypeError: Invalid URL` on Node ≥26 — blocks local build

## Status

- **State:** Draft — reproduced and root-caused (2026-07-24). The fix is a
  **decision**, not a quick change: `langium` and `jsonschema` are already at their
  latest, so no bump resolves it — it is an unresolved upstream interaction with Node
  26's stricter URL parser. Recommended mitigation below; not yet applied.
- **Found:** 2026-07-24, in passing, while running `npm run validate` for
  [plan 0082](../plans/completed/0082-doc-code-fence-typecheck.md) — the build step
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

## Fix (options — undecided; recommend the mitigation)

1. **Mitigation (recommended, immediate):** pin the local toolchain to a working Node
   — a `.nvmrc` (`24`) so `nvm use` gives contributors a buildable version — and note
   the known Node-26 langium breakage in the contributor docs. CI already uses Node 24,
   so nothing there changes. This unblocks contributors now without waiting on upstream.
2. **Root fix (owed, upstream):** track `langium-cli` / `jsonschema` for a Node-26 fix,
   then bump. This bug ratchets to fixed when the pinned mitigation can be removed.
3. **Alternative:** `patch-package` the `new URL(...)` call in `jsonschema`
   (`validator.js:263`) to guard the malformed base — heavier machinery for a
   transitive-dep patch; prefer the `.nvmrc` pin unless pinning is unacceptable.

## Verification

- [ ] **Red — reproduced.** `npm run langium:gen -w @nielspeter/eess-mermaid` on Node
      26.5.0 → `TypeError: Invalid URL` (stack captured above). This is a
      toolchain/environment defect — the build command is the test; there is no unit
      test to write.
- [ ] **Green — owed.** On the pinned/working Node the build succeeds. Applied once a
      mitigation is chosen.
