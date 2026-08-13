# Board

- [fixed/](./fixed/) — a real directory, no index file (bug 0086's exact shape).
- [fixed, no slash](./fixed) — the same directory, written without a trailing
  slash (the shape `work/README.md` actually uses).
- [an item inside fixed/](./fixed/0001-item.md) — an ordinary file resolution,
  proving the new directory branch doesn't disturb the existing file-index path.
- [missing/](./missing/) — does not exist; must stay broken either way.
- [missing, no slash](./missing) — same, no slash.
- [indexed/](./indexed/) — a directory that DOES have an index file, to prove
  `tryIndex` and `resolveDirectories` compose rather than conflict when both
  are on.
