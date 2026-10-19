---
'@nielspeter/eess-md': minor
---

A box mark can be declared `'unjudged'` (bug 0525): `taskItems(c, { marks: { '?': 'unjudged' } })`, and the same for `honestyAtClose()`. An unjudged box is neither open nor done: `honestyAtClose` does not report it as a silent open box, it does not count as finished work, and `areOpen()` and `areChecked()` do not select it. It is still a `taskItems()` element, so a rule selects it by its mark or by `state === 'unjudged'`. Use it for a mark your records use, on purpose, for a box nobody should judge, where `'open'` would demand a disposition and `'done'` would claim work that was never done.

Only a declaration makes a mark unjudged; an undeclared mark is still `md/undeclared-box-mark`, whose remedy now names `'unjudged'` beside `'open'` and `'done'`. A declaration whose state is not one of the three, `undefined` included, is refused, and `collectTaskItems()` now refuses one too. Additive against the published release: `BoxMarkState`, and the `state` of a `taskItems()` element, gain `'unjudged'` beside the `'open' | 'done'` that `box-marks-are-the-callers` introduces in this same release.
