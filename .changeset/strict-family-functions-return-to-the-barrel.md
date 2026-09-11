---
'@nielspeter/eess-ts': patch
---

**Fix: `isStrictFamily` and `resolveFlag` are on the `@nielspeter/eess-ts` barrel again.**

`0.5.0` removed them while keeping `STRICT_FAMILY_SIZE` and the
`StrictFamilyFlag` type, which come from the same module. That left the published
surface able to name a strict-family flag and count the family, and unable to
test whether a key belongs to it or resolve one against compiler options.

If your rule file imports either, `0.5.0` does not fail to type-check — it fails
to **load**, because ESM resolves named imports up front:

```
SyntaxError: The requested module '@nielspeter/eess-ts'
does not provide an export named 'isStrictFamily'
```

Upgrade to this version and the import works again, unchanged:

```ts
import { isStrictFamily, resolveFlag, STRICT_FAMILY_SIZE } from '@nielspeter/eess-ts'
```

Nothing else moved, and no other symbol removed in `0.5.0` is affected — the
`0.5` migration guide now lists all of them by name so you can check your own
imports against it.
