# A directory with an index file

Present to prove `tryIndex` and `resolveDirectories` don't conflict when both
options are on: this directory should resolve via `tryIndex` regardless of
whether `resolveDirectories` is also set.
