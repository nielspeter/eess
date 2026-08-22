---
'@nielspeter/eess-ts': patch
---

`eess-ts check` no longer stays silent when a rule-level `.warn()` leaks past your
filters — bug 0207.

A `.warn()`'s advisory violations ride no throw, so the CLI never collects them and
neither `--baseline` nor `--changed` can reach them. `check` is supposed to say so.
It did not: the emitter writes through a different path from the other two, so the
run's leak detector never saw the output and the notice stayed silent.

Measured: a live `.warn()` beside a throwing `.check()` under `--baseline` printed
its findings unfiltered while the run reported nothing unusual.

Nothing about what is printed changes — only whether the run tells you those lines
bypassed your filters.
