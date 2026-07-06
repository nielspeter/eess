# Non-vacuity fixture — broken internal link

NON-VACUITY FIXTURE — this document contains an internal (relative) markdown
link to a file that does not exist, so `links().that().areInternal().should()
.resolve()` MUST report a violation. If it did not, the corpus/links gate would
be vacuous. See scripts/nonvacuity/bad-links.mjs.

See the [missing sibling document](./does-not-exist.md) — this target is not in
the repo tree, so the link cannot resolve.
