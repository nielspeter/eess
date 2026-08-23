# Proposal 003 — Future dialect candidates (catalog)

**State:** Draft — reviewed 2026-08-13 (architect · product · enforcement, plus
the survey the entries declined to run). **Rewrite needed**: the material is
worth keeping, two entries are known-wrong (GraphQL ships; the ER cost is
understated), no entry states a break class, and the lane is unsettled. See
_Review_ below — it is the operative section, and the candidate entries after it
are preserved as submitted, not as verified.

This is a catalog of candidate future dialects raised in conversation, not a
design for any one of them. Written down for the same reason plan
[0078](../plans/0078-workflow-dialect.md) gives for existing unbuilt: "written
down so the shape is on record, not because it is scheduled."
**Priority:** None assigned — no candidate below has a measured demand signal.
Contrast with [002](./002-comment-embedded-links.md), which measured 130 real
citations (51 dangling) before its ask was evaluated; this proposal has zero
measurements. It is a list of shapes, not evidence.
**Origin:** brainstormed with the maintainer in conversation, 2026-08-13. Not
inbound from an adopter, not triggered by a bug this repo hit.
**Affects:** nothing yet. No code changes, no existing package touched. Only
naming candidate future packages.

## Problem

eess's dialect model generalizes past the four artifact types it already
speaks (`eess-md`, `eess-ts`, `eess-mermaid`, `eess-gherkin`). The pattern a
dialect fits is: an artifact format that **declares what must hold**, parsed
into first-class elements, checkable with the kernel's `RuleBuilder`
(ADR-006), and optionally bindable to another dialect's elements via
`packages/crossvalidate`'s `correspondence()` when the two are supposed to
agree.

Any format meeting that shape — declares intent, can drift from code or from
another spec, has no existing eess coverage — is a candidate. This proposal
does not argue that any one candidate should be built. It records the ones
raised so a future session doesn't re-derive the same list from scratch, and
states plainly what is missing before any of them earns a plan.

## Review — 2026-08-13

**Ruling: Rewrite needed**

Keep the material, correct two entries, change the entry template, and settle
the lane. The framing is the most disciplined in
`work/proposals/`; the failure is not the guard but what the guard cannot cover.
A disclaimer that says "I did not survey" neutralizes _silence_. It does not
neutralize an _affirmative false claim_, and the one entry a reader can check
against the repo is wrong in the direction that costs most.

The entries below this section are preserved as submitted, not endorsed. **Two
of them are known-wrong** — see _Corrections_ — and the survey that found them
was one `ls` and one `grep` deep, so the remaining six carry no more warrant
than the two that failed.

### What the review accepted

The dialect membership sketch at _Problem_ is a real pattern, and the document
is right that it generalizes past the four artifact types the family speaks. The
tier reasoning does genuine work and **declines rather than over-claims** —
Terraform routed to Tier 3, Kubernetes flagged as not-a-static-claim, Docker
flagged for false positives from conditionally-read env vars. That is the honest
tier model used as a filter, and it is the most reusable content here.

Two of eight entries argue _against_ building a package — a catalog of candidate
dialects whose best entries conclude "not a dialect" is a catalog doing its job.
Declining to re-list plan [0078](../plans/0078-workflow-dialect.md), with
reasons, is the discipline that keeps this from becoming a second roadmap. And
the inbound ER passage is the model for how an entry should be updated: dated,
sourced, states what was tried, states what was falsified, and retracts the
header's own "zero measurements" claim rather than leaving the contradiction
silent. Both its negative findings were verified true. The Drizzle handling is
textbook — the ORM name appears only as provenance, and the sketched primitive
explicitly refuses the vocabulary.

### Corrections to specific claims in the text below

- **The GraphQL entry describes a shipped capability as nonexistent.**
  `@nielspeter/eess-ts/graphql` is 959 LOC across `packages/ts/src/graphql/`, a
  sub-path export, a docs page (`docs/graphql.md`), a tested surface, and a
  bullet in the flagship README. The entry's claimed drift — "resolver code that
  doesn't implement a field the SDL declares" — is `haveMatchingResolver()` at
  `packages/ts/src/graphql/schema-conditions.ts:88`, message `Field "X.y" has no
matching resolver` at `:117`. Its elements are `SchemaElement`
  (`packages/ts/src/graphql/schema-predicates.ts:9`); its binding side is
  `resolvers()` (`packages/ts/src/graphql/index.ts:82`). "Sequence GraphQL
  second, not first" sequences a thing that is already zeroth.
  **The correction is not "delete" but "exists at low fidelity"** — and that is
  the more interesting entry. `haveMatchingResolver` joins every resolver file's
  text into one string and greps it (`:95`, `:104-109`), so a field named `id`
  or `name` is satisfied by any occurrence anywhere, including a comment; the
  second pattern is dead code behind the first; every violation is stamped
  `line: 1` on `documents[0]`; and the entry's other declared direction (a
  resolver for a field the schema no longer has) has no mechanism at all. Filed
  as bug [0135](../bugs/0135-graphql-resolver-binding-is-a-text-grep.md).
- **"The ER-parsing side already exists and doesn't need building" is wrong
  load-bearingly.** Parsing exists; **selection does not**.
  `packages/mermaid/src/builders/` contains exactly one file,
  `class-rule-builder.ts` — there is no ER builder, therefore no `.select()`
  producing a `Selection<ErEntityInfo>`, which is what `correspondence()`
  consumes and how `diagramMatchesCode` uses `mmdClasses`. Combined with eess-ts
  having no variable/const element type (its entry points are `modules`,
  `classes`, `functions`, `types`, `slices`, `calls`, `jsxElements` and nothing
  else), the honest cost is **three packages, two of them gaining new public
  element surface** — including a new element category in the flagship. Delete
  "a materially smaller ask than the rest of this list"; it is smaller than a new
  dialect, and it is not small.
- **`erEntities(diagram)` does not exist.** The exports are
  `collectEntities(ast)` and `collectErRelationships(ast)`
  (`packages/mermaid/src/index.ts:62`). Separately, `ErEntityInfo`
  (`packages/mermaid/src/models/er-entity.ts:14`) carries **no line**, where the
  class model keeps one — so a correspondence built on it reports line 0 on every
  violation, the same attribution defect the graphql module already ships.
- **"all four existing dialects validate this repo's own artifacts first"
  (Protobuf caveat) is false**, and instructively so. The shipped GraphQL surface
  validates nothing in this repo — and it is also the lowest-fidelity mechanism
  in the family. That is not a coincidence, and it is a stronger argument for the
  Protobuf caveat than the one given.
- **Zero of eight candidates has a dogfood corpus here** — no Dockerfile, no
  compose file, no `.tf`, no `.proto`, no locale directory, no OpenAPI document,
  and no `erDiagram` outside test fixtures and plan prose. The catalog raises
  this for Protobuf alone, which implies the other seven have one. Belongs in
  _Not surveyed, not reviewed_ as a cross-cutting line.
- **ADR miscited:** the fluent builder DSL is **ADR-003**, not ADR-006. ADR-006's
  three-tier model (core primitives / `rules/*` sub-paths / separate packages) is
  the right citation for the placement question left open at the end.
- Minor: `erEntities` aside, lines in the OpenAPI entry are ungrammatical
  ("…route-like structures would need to"); the header's "zero measurements"
  contradicts the ER entry's retraction; "sixth+ package" is off by at least one
  (six exist); and code is cited as bare backticked paths, which neither
  `links()` nor `pointers()` can see — so `check:corpus` passes over the entry's
  central existence claim without touching it. Citing
  `packages/mermaid/src/models/er-entity.ts:14` instead puts it under the gate.

### The structural finding: no entry states a break class

Eight candidate ways to fail a build; **zero corruptions named**. The per-entry
template's "the drift a dialect would catch" slot does the break class's job in
prose without ever having to name a specific thing that must go red. This is
proposal [001](./001-md-corpus-rule-coverage.md)'s recorded correction at one
remove, and that correction's own conclusion applies verbatim: _write the break
class belongs in the proposal template, not in the author's memory._

It is not pedantry about a list — writing that one sentence changed four of the
eight entries under review:

- **GraphQL** → already shipped, and false-green.
- **Kubernetes** → the falsifiable core is `configMapKeyRef` / Service selector /
  `volumeMounts` referential integrity: **manifest↔manifest, Tier 1, no code side
  needed**, buried in the element list while the entry is flagged weak on the
  strength of the image-tag sub-claim (which is honestly Tier 3).
- **i18n** → the three sub-claims have opposite profiles. `locale↔locale`
  completeness needs no code side, has near-zero false positives, and is the best
  gate on the list; `locale→code` (dead keys) can never be made quiet, because
  composed keys (``t(`errors.${code}`)``) flag live translations.
- **Protobuf** → the honest caveat is not "no dogfood corpus" (all eight share
  that) but **"the compiler already gates the falsifiable half"**; and
  codegen-freshness is `git diff` after regeneration, not a correspondence at all.

Two entries _not_ flagged as weak are as unfalsifiable as the two that were:
OpenAPI's field-shape half (statically undecidable where types aren't generated,
and owned by `tsc` where they are) and Protobuf's codegen half. Recommended
template change: rename the slot to **Break class**, add **Would go red on** and
**Tier**, and move anything that cannot produce both under a separate heading.
A committed non-vacuity fixture should _not_ be required — there is no gate yet
to keep honest — but a one-line fixture sketch should be.

Two directions should be marked **`.warn()`-only in the catalog** so nobody plans
them as blocking gates: Docker declared-but-never-read (runtime-, framework- and
sidecar-consumed vars are correctly unread) and i18n dead keys.

### Placement

The document defers per-candidate placement to a future review. **The
architecture has already narrowed it, and the narrowing is gated in CI.**
`arch.rules.ts` enforces `eess/ts-isolated`, `eess/mermaid-isolated`,
`eess/md-isolated`, `eess/gherkin-isolated` ("dialects are siblings, not
cross-dependent") and `eess/kernel-no-dialects`. So **any candidate whose binding
side is TypeScript code cannot be a standalone dialect** — six of the eight
(OpenAPI handlers, Protobuf implementations, i18n call sites, Docker
`process.env` reads, ORM models, and GraphQL resolvers). Each is either a
sub-path of `eess-ts` (the shipped GraphQL precedent) or a pure artifact dialect
plus a crossvalidate pairing (the mermaid/gherkin precedent). The catalog applies
this instinct to two entries and drops it for the five closest to the precedent.

**Nothing on this list may become a kernel concern**, and the document never says
so — one blanket sentence would remove the reading most likely to go wrong.
`correspondence()`, `Selection<T>`, `select()` and `matchSelections` are already
the complete kernel-side vocabulary; every candidate needs a parser, an element
model and an `identify()`, all dialect-side. Specifically forbidden in
`packages/core`: HTTP-method/status-code vocabulary, YAML or JSON-Pointer
resolution, locale/plural-form logic, ER cardinality-notation parsing.

On naming: `@nielspeter/eess-crossvalidate/mermaid-er-ts` breaks the subpath
grammar. The existing subpaths are `<spec-side>-<code-side>` pairs, and
`md-mermaid-er` already bends it with a grammar qualifier bound to `mermaid`;
adding `mermaid-er-ts` makes the same hyphen mean two different things in the
same position. Cheaper and clearer: add `erMatchesCode()` as an export of the
existing `mermaid-ts`, and ship no new subpath.

### Unresolved, carried forward

- **The lane is wrong, and it is the one lane with no lifecycle.** A proposal is
  design under debate that becomes a plan or is declined; this has no ask, no
  design, and **no terminal state** — it can be neither accepted nor declined.
  `work/proposals/` has no board, and `check:ledger` does not scan it (bugs
  [0108](../bugs/0108-work-readme-lanes-table-lists-one-lane.md),
  [0121](../bugs/fixed/0121-ledger-reads-two-of-four-lanes.md)). Either move the
  content to a ROADMAP "Candidates — not scheduled" section, or give it a `State:`
  that says explicitly it never becomes a plan. Author's call; both are defensible.
- **Entries want triggers, not ranks.** The informal ordering ("best-positioned",
  "sequence GraphQL second", "rank last") is unearned by the document's own
  standard — it has no demand signal — and the GraphQL finding proves it wrong in
  practice. The house already has the better pattern: plan
  [0096](../plans/completed/0096-dogfood-missing-crossvalidate-bindings.md) parks the ER
  binding with an explicit trigger — _the day a doc in this repo gains an
  erDiagram, that is when it becomes work_. A classification (tier +
  falsifiability + parser dependency + trigger) survives; a rank rots.
- **Open Question 2 (does DB-schema-vs-ORM need a new package?) is sharpened, not
  answered.** No new _dialect_ — but "just a crossvalidate pairing" is not
  available either, per the second correction above. Whether the ER entry
  graduates to its own proposal on n=1 is the author's call; the house bar (002
  measured 130 citations and was still declined as specified) argues for a
  trigger instead. Note also that the entry's headline drift class (migrations ↔
  ORM, authoritative, catches production breakage) and its sketch (erDiagram ↔
  ORM, documentation, catches doc rot) are **different gates**; a future session
  picking this up on the headline will build the other thing.
- **Open Question 3 (kernel or dialect, per-candidate) is narrowed by the gated
  rules above** — an argument, not a ruling.
- **`dialect` appears in zero ADRs.** The kernel/dialect/family split is this
  repo's most load-bearing structural concept, gated in `arch.rules.ts`, and it
  has no decision record. That makes this document's _Problem_ section the most
  explicit written membership test in the repo, sitting in the lowest-authority
  tier. An ADR ratifying what `arch.rules.ts` already enforces — kernel purity,
  dialect isolation, what admits a new package — would let this catalog cite
  rather than restate. Separate ask; should not block the rewrite.
- **The membership test is insufficient as stated** — "declares intent, can drift,
  no existing coverage" admits every config file ever written. Three filters are
  already present as scattered caveats and never promoted: a parseable code side,
  a dogfood corpus, and falsifiability. Promoting them would let the catalog rank
  itself, which is the thing the header says it cannot do.
- **Cost intuition is inverted for the thin cases.** `packages/gherkin/src` is 268
  LOC across four files with no `predicates/` or `conditions/` directories at all —
  a complete shipped dialect. For flat-JSON locale files, a thin dialect plus a
  crossvalidate pairing is plausibly _cheaper and cleaner_ than bolting a
  JSON-keys model into the flagship, and it keeps `eess/ts-isolated` intact.

## Candidates

Each entry: the artifact, the drift a dialect would catch, a rough element
sketch, and the honest caveat on why it isn't further along than "idea."

### OpenAPI / JSON Schema

**Drift it would catch:** an endpoint or field declared in the spec that the
handler code doesn't actually accept/return, or vice versa — the contract and
the implementation disagreeing silently.

**Rough elements:** `path`, `operation` (method + path), `parameter`,
`requestBody` schema, `response` schema — each with a source location in the
YAML/JSON file.

**Binding side:** framework-specific (Express/Fastify/Nest route handlers,
or their TS types) — this is why it's a candidate dialect and not a kernel
feature; the "code side" of the correspondence varies by framework and would
need its own predicate/condition set, closer to how `eess-ts` already reads
route-like structures would need to.

**Caveat:** of everything here, this has the cleanest two-sided
`correspondence()` shape and the most well-known real-world pain
(contract drift). Best-positioned candidate if demand ever shows up.

### GraphQL schema

**Drift it would catch:** resolver code that doesn't implement a field the
`.graphql` SDL declares, or a resolver for a field the schema no longer has.

**Rough elements:** `type`, `field`, `resolver` reference.

**Binding side:** generated types or hand-written resolver maps in TS.

**Caveat:** same shape as OpenAPI, narrower audience (only GraphQL projects).
Likely subsumed by whatever an OpenAPI dialect learns, if either gets built —
sequence GraphQL second, not first.

### SQL schema / DB migrations vs. ORM models

**Drift it would catch:** a migration that renames/drops a column the ORM
model still declares, or an ORM field with no backing column.

**Rough elements:** `table`, `column` (name, type, nullability) — either
parsed from `.sql` migration files or, more interestingly, read from an
existing **Mermaid ER diagram** if a project already documents its schema
that way.

**Caveat — the one worth flagging loudest:** `eess-mermaid` already parses ER
diagrams into exactly this shape
(`packages/mermaid/src/models/er-entity.ts` — `ErEntityInfo`,
`ErAttributeInfo`). If a project maintains its DB schema as a mermaid
`erDiagram` (several do, for documentation), this candidate may not need a
new dialect at all — it may only need a new `eess-crossvalidate` pairing
binding the existing ER model to ORM code. That's a materially smaller ask
than the rest of this list and worth surveying on its own before assuming a
new package is needed.

**Inbound evidence (2026-08-13)** — this proposal's "zero measurements" line
(see header) is no longer quite true for this one candidate. Origin: an agent
working in a consuming project (not this repo), writing an ADR for a new
Drizzle table and wanting a mermaid `erDiagram` bound to the real schema code,
drift failing the build — this candidate exactly. Two things confirmed by
trying it for real:

- `diagramMatchesCode` (`crossvalidate/mermaid-ts`) only parses `classDiagram`
  and matches against TS `class` declarations by name (`tsClasses()`). A
  Drizzle table (`export const x = pgTable('x', {...})`) is invisible to it —
  there is no `class` for `tsClasses()` to find, regardless of which Mermaid
  syntax is on the diagram side.
- `tableErAgree` (`crossvalidate/md-mermaid-er`) does parse `erDiagram`, but
  only cross-validates it against a **markdown property table in the same
  document** — a doc-internal consistency check (diagram agrees with its own
  nearby prose), not a binding to real code at all.

So today, neither preset covers **`erDiagram` ↔ real, non-class schema code**.
The caveat above is confirmed correct in both directions: the ER-parsing side
already exists and doesn't need building; what's missing is narrowly the
crossvalidate pairing, not a new dialect. A plausible shape needs nothing new
in the kernel — pair `erEntities(diagram)` (already exposed via
`parseErDiagram`/`collectEntities`) against a new `eess-ts` selector for
"exported `const` initialized by a call expression matching a configurable
name pattern," with attributes read from the object literal's keys — generic
enough to cover Drizzle/Prisma-style call-shaped ORM schemas without
hard-coding one ORM. Likely `@nielspeter/eess-crossvalidate/mermaid-er-ts` or
similar, reusing `correspondence()` — not a new engine.

### Dockerfile / Compose

**Drift it would catch:** an env var, port, or volume declared in
`Dockerfile`/`docker-compose.yml` that the application code never reads (or a
`process.env.X` the code reads that nothing declares).

**Rough elements:** `service`, `envVar`, `port`, `volume`, `dependsOn`.

**Binding side:** source code's `process.env` reads (or framework config
loaders).

**Caveat:** real drift class (stale env docs are a known pain), but the
"declares vs. reads" binding is fuzzier than a typed schema — false positives
from conditionally-read or framework-injected env vars would need real
tuning, not just parsing.

### Kubernetes manifests

**Drift it would catch:** an image tag, env var, or config-map key a
manifest references that doesn't match what the built image / code actually
expects.

**Rough elements:** `resource` (Deployment/Service/etc.), `container`,
`env`, `image` reference.

**Caveat:** weakest binding side of the list — "what the code expects" isn't
usually a static, parseable claim the way a DB column or an OpenAPI schema
is. Likely needs a narrower, more specific claim than "the whole manifest"
before it's falsifiable (enforcement lens, per `review-proposal`).

### Protobuf / gRPC

**Drift it would catch:** a `.proto` service/message definition with no
matching handler, or generated-code drift from a hand-edited stub.

**Rough elements:** `service`, `rpc` method, `message`, `field`.

**Binding side:** generated TS/JS bindings plus hand-written service
implementations.

**Caveat:** similar shape to OpenAPI/GraphQL; only worth it for a project
that actually uses gRPC, which this repo does not — no dogfood corpus,
unlike every dialect eess has shipped so far (all four existing dialects
validate this repo's own artifacts first).

### i18n / locale files

**Drift it would catch:** a translation key referenced in code
(`t('some.key')`) with no entry in one or more locale files, or a locale key
nothing in code ever references (dead translation).

**Rough elements:** `key`, `locale`, `value` — parsed per-locale JSON/YAML,
correlated across locales for completeness.

**Binding side:** source code's `t(...)`/`i18n.t(...)` call sites — a
predicate over `eess-ts`'s existing call-expression model, potentially
expressible as **new predicates on the existing ts dialect** rather than a
whole new dialect, since the "elements" (keys) live in a much simpler format
(flat JSON) than anything else on this list.

**Caveat:** genuinely useful (dead/missing translations are a real recurring
bug class), but might be the smallest lift on this list — worth asking
whether it's a dialect at all, or a builder addition to `eess-ts` plus a
lightweight JSON-keys model, before assuming a sixth+ package.

### Terraform / IaC

**Drift it would catch:** declared infrastructure (resource names, regions)
vs. code's runtime assumptions about that infrastructure.

**Rough elements:** `resource`, `variable`, `output`.

**Caveat:** weakest candidate on the list. Infra rarely has a clean "code
side" to bind against the way a DB schema or an API contract does — most of
what would go wrong is operational (Tier 3, per the manifesto's tiers), not
something a static correspondence can catch. Include for completeness, rank
last.

## Already on the board — not duplicated here

Plan [0078](../plans/0078-workflow-dialect.md) (`eess-workflow`,
`.github/workflows/*.yml` vs. `package.json` scripts) already covers
CI-workflow drift, with a real demand signal this repo hit twice in one
session (a missing `npm rebuild` and a `GITHUB_ACTIONS`-conditional output
format, both invisible to every existing gate). It is not repeated here —
this catalog is the _other_ candidates, the ones with no plan yet.

## Not surveyed, not reviewed

Explicit, per this repo's own `review-proposal` skill, which any of the
above would need to pass before becoming a plan:

- **Existing-code survey** (`review-proposal` Step 2) — grep `packages/*/src`
  for whether the kernel or a sibling dialect already covers part of a given
  ask. Not done for any candidate here except the SQL/ER-diagram note above,
  which is itself only a hunch, not a verified survey result.
- **A measured demand signal** — a real bug this repo or an adopter hit, the
  way 002 measured 130 citations before being evaluated, or 0078 named two
  concrete CI defects. None of the candidates above has one.
- **Architect + product + enforcement review** — not run. No verdict, no
  placement call, no break-class analysis exists for any entry here.

This document is the raw list only. Nothing above should be read as
scheduled, prioritized against each other's, or design-frozen.

## Open questions

- Which candidate, if any, hits real demand first — in this repo or an
  adopter's? That is the actual trigger to advance one, not this list's
  existence.
- Does DB-schema-vs-ORM need a new package at all, or is it reachable by
  binding `eess-mermaid`'s existing ER model to ORM code through a new
  `eess-crossvalidate` pairing? Worth answering before any other candidate
  on this list, since it may already be mostly buildable.
- Kernel or dialect placement, per-candidate — deliberately not decided here;
  that's `review-proposal`'s Step 2/3 job once a candidate is picked up.
