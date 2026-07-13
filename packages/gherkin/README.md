# @nielspeter/eess-gherkin

Architecture testing for Gherkin feature files — the Gherkin dialect of the
[eess](https://github.com/nielspeter/eess) family.

Loads `.feature` files with a deliberate **line grammar** (feature titles,
scenario titles, keywords, tags, locations — steps and tables stay opaque) and
exposes features/scenarios as first-class elements:

```ts
import { features, scenarios } from '@nielspeter/eess-gherkin'

const set = features({ roots: ['specs/behaviors/features/**'] })

// Scenario hygiene: titles must be citable — unique within their file.
scenarios(set).should().haveUniqueTitles().rule({ id: 'gherkin/unique-titles' }).check()
```

Why it exists: a spec corpus cites scenarios from markdown (user stories →
behavior specs). Those citations are validated by the **md↔gherkin pairing** in
`@nielspeter/eess-crossvalidate`, which resolves each cited
`` `path/to/x.feature` `` · `'Scenario title'` against the elements this
dialect loads — so a renamed or deleted scenario fails the build instead of
silently orphaning the story that cites it.

Doc strings (`"""` / fenced) are guarded: keyword-looking lines inside them are
never parsed as scenarios.
