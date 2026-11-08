# Spike 0646: what a named code reference's check reads and judges

Measured 2026-11-08, as the second review of
[proposal 021](../proposals/021-a-code-reference-points-at-the-code-it-names.md)'s ask A requires
before ask A1 can be planned ("one time-boxed spike settles critical items 1–4"). It was time-boxed
to about an hour but not timed exactly: each instrument run takes about 10 s, and most of the hour
went on reading code and judging the sample. It brings back a design, decided below so it can be
overruled. Code pointers are as at `main` f17759a6.

## The question

The review held A1 on four critical items:

1. **The reading.** `mentions()` drops inline code's backticks, so the sketched pattern examines
   nothing. Which reading finds the reference the instrument measured?
2. **The span clause.** Is a miss inside the named declaration's span green? 103 of them were
   counted and never judged, and a container is green on every line of its body.
3. **The code facts' contract.** A `Selection` cannot say which files it covers or what it knows
   about each one, and a facts input that loaded nothing has no finding.
4. **Non-vacuity under `.warn()`.** A warning never reds `check:corpus`, so an emptied condition
   stays green.

The review also listed five defects in the instrument for the spike to fix.

## Measured

### The instrument, fixed

`scripts/measure-code-reference-names.mjs` now fixes the five defects the review listed:

- **A backticked path is no longer paired as a name.** `ts` or `md` came from a path's extension;
  `cleanName` now rejects anything holding a `/` or a source extension.
- **A name written with arguments** (`` `select(fields)` ``) is read as `select`.
- **Pairing twice** is counted and reported: 44 pointers are paired twice.
- **The silent `catch`** now records the parse error on the row: 0 errors.
- **`DECL` gains the missing kinds:** parameters, binding elements, type parameters, and named
  function and class expressions.

It also records each declaration's doc-comment start and its scope, and adds a `--pool span`
sample. Run with `node scripts/measure-code-reference-names.mjs`, plus `--json` for every row.

At `main` f17759a6, 10.2 s:

| measure                                                             |         count |
| ------------------------------------------------------------------- | ------------: |
| pointers (live)                                                     | 2,148 (1,163) |
| paired with a name                                                  |           692 |
| ... in the before form `` `name` `path:N` ``                        |           485 |
| ... in the after form `` `path:N` `name` ``                         |           197 |
| resolved (live)                                                     |     682 (362) |
| the cited line holds the name                                       |           160 |
| misses                                                              |           522 |
| misses inside the named declaration's span (span-greens)            | 103 (60 live) |
| ... only in its doc comment                                         |            61 |
| ... in its body                                                     |            42 |
| ... the named declaration is a container (class, interface, object) |            14 |
| ... the span is over 100 lines                                      |            19 |
| single-declaration names: module, member, local scope               |   318, 43, 21 |

The fixes moved the review's counts (649 resolved and 497 AST misses at `6eaf0122`): fewer pairs
are rejected as paths, and more declarations are known.

**The after form is noise.** Over its 196 AST pairs, 19 hold as code and 101 name nothing declared
in the file. That is the review's finding (5 of 8 spot-checked were pairing artefacts) measured
over the whole form: a backticked name after a pointer usually begins the next clause. In the
before form, 117 of 481 hold as code, 100 are span-greens and 86 name nothing.

### The reading

Under eess-md's own corpus (the instrument's roots and frozen globs), a caller's pattern was run
over the prose lines as written, with inline-code backticks kept and fenced blocks skipped:

```js
const NAMED =
  /`(?<name>[A-Za-z_$][\w$.]*)(?:\([^`)]*\))?`(?<gap>[^`\n]{0,12})`(?<path>[\w./@-]+\.[A-Za-z]+):(?<line>\d+)(?:-(?<end>\d+))?`/g
```

It reproduces **467 of the instrument's 485 before-form pairs**: 18 are instrument-only and 14 are
pattern-only. The difference comes from the instrument pairing across a line break, and from a
gap of 12 characters or more. The reading the review asked for therefore exists, and it is
`mentions()` with the delimiters kept, not a name read around a `pointers()` element: a pointer
does not know the text before it, and every pair above is two code spans in one sentence.

### The span clause

The review asked for a judged sample of the span-greens. It is 30 rows drawn with `--pool span`
and seed 20261108, judged by a separate model run against the cited lines and the sentence:

| where the cited lines land          | correct | drifted to the top | drifted inside | pairing error |
| ----------------------------------- | ------: | -----------------: | -------------: | ------------: |
| the named declaration's doc comment |      16 |                  0 |              0 |             0 |
| its body                            |       6 |                  5 |              2 |             1 |

All 16 doc-comment greens are correct. Of the 14 body greens, 8 are wrong:

- **Drifted to the top (5):** the sentence means the declaration, and the line has drifted onto a
  body line under it (s06, s19, s20, s23, s26).
- **Drifted inside (2):** the line now lands on a different thing inside the same container. One
  is `select()` drifting into `satisfy`'s doc comment within `RuleBuilder` (s05).
- **Pairing error (1):** s04.

"The innermost enclosing declaration is the named one" does not separate correct body rows from
wrong ones: four of the wrong rows (s06, s19, s20, s29) have the named declaration innermost. A
line count does not separate them either: s06 and s01 are each 4 lines below their declaration,
and s06 is wrong while s01 is right. The sample's rows and verdicts are in the session's scratch
directory, beside the instrument's `--json` output; the seed redraws the same 30.

### Ranges

There are 64 before-form AST pairs that cite a range:

- 24 hold, with the name as code on some line of the range;
- 9 of those 24 hold it on the range's first line;
- 3 ranges are wider than 20 lines.

### The code facts' coverage

The six package tsconfigs, loaded through eess-ts's `project()`, take 3.0 s. They cover 441 of the
485 before-form pairs, and 226 of the 246 live ones. The 20 uncovered live pairs:

- `scripts/`: 16;
- the kit: 1;
- `eslint.config.ts`: 1;
- `.github/`: 1;
- a package file outside its tsconfig: 1.

The review's 33 was counted over all forms.

### Non-vacuity

Under `.warn()`, the trap is the one `scripts/check-nonvacuity.mjs:1583-1589` records: a rule
that reports and does not block, while its probe trips other rules. Every arm stays green unless
the row asserts the finding by rule id and severity. No new mechanism is needed. The rows have to
assert more than the exit code.

## Options

**The reading:**

- **R1: an opt-in `mentions()` reading that keeps inline-code delimiters.** It gives each named
  group a source offset, so ask C can write a fix. `MdMentionLink.text` is the precedent, the
  default reading is unchanged, and it measures 467 of 485.
- **R2: a name read around each `pointers()` element.** It needs a second scanner beside
  `mentions()` for the text before a pointer. That is a parallel mechanism, and it cannot read the
  name-alone form.

**The span clause:**

- **S1: a body line is green.** This is the rewrite's rule, and it is wrong on 8 of 14 in the
  sample.
- **S2: only the doc comment is green.** The named declaration's own `/** */` comment is green and
  its body is never green. All 16 such rows are correct, and the 6 correct body citations go red.
- **S3: a body line is green within a bound or for the innermost declaration.** Neither separates
  the sample, as measured above.

## Decided, 2026-11-08

Each decision follows the mission's rule that a check which cannot fail is worth less than none
([ADR-009](../../adr/009-agent-first-failure-surfaces.md)), and that a pass is built from evidence
([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)).

1. **The reading is R1.** `mentions()` takes an opt-in that keeps inline code's delimiters in the
   text a pattern runs over, and reports each named group's source offset. The default reading is
   unchanged. A1 reads **the before form only** (`` `name` `path:N` `` within one sentence): the
   after form is noise, as measured. The stock pattern above ships under `examples/md/`, and the
   condition refuses at configuration a pattern without `name` and `path` groups.
2. **The span clause is S2.** The guarantee, stated as it is: "a cited line holds `X` as code, or
   lies in `X`'s own doc comment". The doc comment is the `/** */` attached to `X`'s declaration.
   An identifier inside a JSDoc comment (`{@link X}`) is not code. A mention inside `X`'s own doc
   comment is green by the doc-comment clause, whatever the line holds.

   Containers need no rule of their own. A body is never green, so `RuleBuilder`'s 476 lines are
   not either. The remedy for a correct body citation that now reds is in its message: name the
   inner thing, or cite the declaration's line.

3. **A range holds** when any line in it holds `X` as code, or when its first line lies in `X`'s
   doc comment. Its width is not a finding: a wide range weakens the claim honestly and does not
   hide drift. A1's fixtures pin three cases:
   - a range held only on its last line is green;
   - a range held on no line is red;
   - a range past the end of the file is past-end.
4. **The facts contract** is an eess-md type, defined on the consumer side as `MentionFix` is
   (`packages/md/src/conditions/be-linked.ts:30`):

   ```ts
   export interface CodeFacts {
     /** The kinds of fact known for this file; empty when it is not covered. */
     readonly covers: (relPath: string) => ReadonlySet<'declaration' | 'import' | 'use'>
     readonly symbols: Selection<CodeSymbol>
   }
   export interface CodeSymbol {
     readonly file: string
     readonly name: string
     readonly kind: 'declaration' | 'import' | 'use'
     readonly line: number
     readonly scope: 'module' | 'member' | 'local'
     readonly container?: string
     readonly docComment?: { readonly start: number; readonly end: number }
   }
   ```

   - **Loaded nothing.** A facts input that loaded nothing is `symbols.sourceEmpty`, the kernel
     flag from [spike 0640](./0640-an-input-side-loaded-nothing.md)
     (`packages/core/src/correspondence.ts:34`). The condition also counts it so when no cited
     file is covered, so a hand-built facts input cannot forget the flag. Either way it is one
     unsuppressable finding that outranks `.expectEmpty()`.
   - **An uncovered file** is a cause the condition cannot judge
     ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). That is one
     finding per uncovered file, never a pass. A caller who means to leave a file out declares it
     as an exclusion, and the success line counts it ("K judged, E left out").
   - **A file covered for declarations only** (ctags) makes a use line a cause the condition
     cannot judge, never a red. That is the 10 of 26 correct holders the review counted.
   - **Paths** resolve as `pointers().resolve()` resolves them, against the corpus's file index,
     before the facts are looked up.
   - **"Declared at line N"** names a line only for a `module` or `member` declaration (318 and 43
     here; the 21 locals get no line). It carries `container` from the first release, and says
     "imported at line N, declared elsewhere" for an imported name.

5. **Severity.** A rename, a move and a text-only mention are reported at error: none of them
   comes from `prettier`. A drifted line is reported at warning while ask C, the fix, is held.
   Those four classes are the ones the review named.
6. **Non-vacuity.** A1's plan names `check:nonvacuity` rows for four cases:
   - a drifted reference: rule id, severity `warn`, and the message carrying "declared at line N";
   - a text-only reference: rule id and severity `error`;
   - a renamed reference: rule id and severity `error`;
   - facts that loaded nothing: the source-empty finding under `.expectEmpty()`.

   Each row asserts its finding by id and severity, never by exit code, per the trap at
   `scripts/check-nonvacuity.mjs:1583-1589`.

The cost for `check:corpus` (3.0 s for the facts here) is A2's to state, with its home. Open
question 1 stays the author's.

## Corrections

- **The reading's agreement was measured over the before form (485 pairs), not the review's 649.**
  The after form is dropped by decision 1, so measuring the reading against it would count noise.
