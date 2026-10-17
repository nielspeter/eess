# Bug 0453: RELEASING.md states a tag rule the tags do not follow

## Status

- **State:** Draft — recorded 2026-10-17 from PR #233's method review (the `v0.14.0` release).
- **Severity:** Low — a release author reading the rule picks the wrong tag or page name; the
  `v0.14.0` train nearly did (it was first prepared as `v0.7.1`, commit `984c7908`; no such tag was pushed).
- **Origin:** self-found · PR #233's review, 2026-10-17.
- **Reported:** 2026-10-17

## Symptom

`RELEASING.md:317` says "The tag is normally the KERNEL's version". Measured from
`packages/core/package.json` at each tag: none of the last ten tags (`v0.6.0` to `v0.14.0`) carries
the kernel's version; `v0.6.0`, `v0.7.0` and `v0.8.0` all shipped kernel 0.5.1. What the tags actually follow is the rule `RELEASING.md:333` added for `v0.14.0`: tags only go up.
Most releases take the next minor tag; patch tags exist too (`v0.1.1`, `v0.2.1` to `v0.2.3`, `v0.5.1`,
`v0.10.1`), and RELEASING.md does not say when a patch tag is right.

The page-naming rule at `RELEASING.md:124` says "Whenever the tag is not the kernel's version, name
the page after the TAG", and its examples list only `0.9`, `0.13` and `0.14`. Both are wrong:
`v0.6.0` broke the rule, because its page is `docs/migrating-to-eess-ts-0.6.md`, which
`RELEASING.md:326` calls correct for a release where the kernel does not move. Pages for 0.7, 0.8,
0.10, 0.11 and 0.12 also follow the rule but are not listed.

## Fix

Make "tags only go up, and the migration page is named after the tag, with each package's real
version in the page's table" the headline rule, and say when a release takes a patch tag rather than
the next minor (decide it from the patch tags above, not from this record). Keep the `eess-ts-0.6`
page as the one historical exception, named as such. Drop the example list, or make it complete.

Both halves can be checked by a program rather than a table built by hand: a new tag sorts above
every earlier one, and every tag that has a migration page names the page after itself. Whether to
add that check is part of this fix's design.

## Verification

- [ ] The headline and the page-naming rule agree with every tag from `v0.5.0` on, patch tags
      included (`v0.5.1`, `v0.10.1`), and with every `docs/migrating-*.md` name, the `eess-ts-0.6`
      page as the named exception

Deferred: none
