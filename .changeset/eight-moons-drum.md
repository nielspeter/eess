---
'@nielspeter/eess-md': patch
---

`linkResolves()`'s broken-link message now names the near-miss when the
target is a real directory: `broken link: "./guide/" does not resolve to a
file in the repo — "docs/guide" is a real directory; this check runs with
resolveDirectories off`.

Before this, a link to a real directory with `resolveDirectories` off and a
link to a target that doesn't exist at all reported the identical generic
message. A corpus that deliberately runs different resolution profiles for
different regions (a static-site guide vs. repo-hosted markdown, say) gave an
author no way to tell, from the message alone, which case they'd hit.

The hint only appears when it's true — a genuinely nonexistent target keeps
the plain message unchanged — and is computed lazily, only when a violation
is actually being reported, so a clean corpus pays nothing extra.
