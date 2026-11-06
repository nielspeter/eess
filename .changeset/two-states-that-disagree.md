---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** `honestyAtClose` reports two state lines that disagree (bug 0623). It judged a record by the first `State:` line in its header region, so a live plan holding `State: Draft` then `State: Done` and an open box passed, while the reverse order reported the record. Two lines whose states differ are now `ledger/states-disagree`, at the first that disagrees (`State is given twice (line 3 'Draft', line 4 'Done'); keep one`), reported before the record is placed, as an unreadable state is. Two lines that agree read as before. A corpus with such a record can newly go red. To migrate: keep the one state the record means. `findState` is unchanged and still returns the first state line; its documentation now says how its reading differs from `haveField`'s.
