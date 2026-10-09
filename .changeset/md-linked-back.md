---
'@nielspeter/eess-md': minor
---

`links()` gains `beLinkedBack(options?)`, a condition that each selected link's target links back to
the record that declared it, and `haveLiveTargets(options?)`, a selector that leaves out links into
frozen records, which cannot answer:

```ts
links(c).that().areLabelled('Related to').and().haveLiveTargets().should().beLinkedBack().check()
```

Any link back answers. A target that cannot — frozen, outside the corpus, missing, a directory, the
record itself, or an external URL — is one finding naming its cause, with its remedy as the
suggestion. An empty selection fails with the zero-examined finding. Both take the options
`resolve()` takes.
