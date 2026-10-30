---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `pointers().should().resolve()` counts a file's lines as a pointer numbers them (bug 0561). A final newline ends the last line rather than starting one, and an empty file has no lines. It used to count one more line for every file ending in a newline, so a pointer to the line after the last passed, and the stale message gave the wrong count: a two-line file "has 3 lines". Now such a pointer is reported stale, with the file's real count, for files in the repository and under `externalRoots` alike. To migrate: a pointer this reports cited a line the file does not have; point it at the line you meant.
