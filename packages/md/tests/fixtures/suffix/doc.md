# Suffix resolution fixture

- unique partial path resolves: `admin/index.vue:2`
- ambiguous suffix is skipped (two files end with it): `dup/x.ts:2`
- genuinely missing path is broken: `ghost/missing.ts:2`
