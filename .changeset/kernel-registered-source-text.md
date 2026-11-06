---
'@nielspeter/eess': minor
---

New on `@nielspeter/eess/internal`: `registerSourceText(root, files)` (ADR-024). A dialect whose files are not on disk claims an absolute root and registers the texts under it; the waiver scan in `applyFilters` then reads a claimed file's `eess-exclude` directives from those texts, never from the disk. The registry is one versioned object on `globalThis`, shared by every kernel copy in the realm.

For a violating file under a claimed root, the scan reports an unsuppressable finding, never a silent disk read, when the registry cannot be read, the path lies under two roots, the root or the reported path exists on disk, or the texts do not hold the path. Each finding names its cause and remedy and leaves the violation unwaived. A file under no claimed root is read from disk, as before. Registration refuses a relative root, a root on disk, a root that overlaps another, a different map under a claimed root, a non-canonical key and a non-string text.
