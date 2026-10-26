# Plan 0542: this repository's record mentions are migrated

## Status

- **State:** Draft — written 2026-10-21 so that [plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md)'s
  ledger has a named home for its removal (PR #256's method review, I3); since 0541's freeze on
  2026-10-22 it keeps no ledger, and this plan is the home of bringing its count to zero. It cannot go Ready until
  [proposal 019](../proposals/019-md-a-mention-is-a-link-built-from-blocks.md)'s ask B and its fix
  are built: [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md) and
  [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md), both Ready on
  2026-10-26 with their Phase 0 measured.
- **Priority:** Low until B is built; then Medium.
- **Effort:** Large, and to be split at Ready by lane: the fixable mentions are mechanical, the
  colliding ones need a reader.
- **Created:** 2026-10-21
- **Builds after:** [plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md), [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md) (B) and
  [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md) (the fix), both Ready
  2026-10-26; the fix's anachronism list names mentions this plan must keep out of its mechanical lane, and
  how (`--fix --apply` has no per-fix filter) is this plan's to decide at Ready.
- **Carried from [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s Phase 0
  (2026-10-26), listed by value in the Appendix:** the 128 anachronisms its frame left out, each read
  here rather than applied (some are a number claimed on a branch before its record merged, and
  right); the 156 mentions its `foreign` refuses, the 76 across a soft break and the 76 in inline
  code, each linked by hand or moved to a fence; and `work/spikes/0001-eess-over-ts-archunit/`, a record landed
  verbatim with another numbering, left out of the run by selection, as the maintainer's acceptance
  of the fix's residual assumes.

## Problem

[Plan 0541](./completed/0541-this-repositorys-record-mentions-are-gated.md) holds this repository's unlinked mentions at today's count and lets it only fall. This
plan brings it to zero, so the rule holds with nothing owed. There is no ledger to delete: 0541
judges each file against the merge base's own counts (changed at its freeze, 2026-10-22).

## What is known ([plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s Phase 0, 2026-10-26)

Over 4,704 plain mentions at c9e55336, with ts-archunit's record list as a second source
([spike 0540](../spikes/0540-one-join-over-every-source.md) first counted 4,682, 3,079, 1,598 and 5):

| outcome                                              | count | how it closes                                                                                                                            |
| ---------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| exactly one record in either source                  | 3,098 | the fix, once built, less the 436 the Appendix lists; and less [spike 0001](../spikes/0001-eess-over-ts-archunit/README.md) by selection |
| a record in both sources (the ts-archunit collision) | 1,601 | a reader decides each, link by link                                                                                                      |
| no record anywhere                                   | 5     | reworded or removed by a reader                                                                                                          |

Mentions in inline code that quote examples move to fenced blocks.

## Phases

Not written: they depend on the shape B's plan chooses for the fix. At Ready, one phase per lane
(`adr/`, `docs/`, `work/` by folder), each a reviewable diff, and the last bringing the count to zero.

## Out of scope

- Building B or the fix: [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md) and
  [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md). Adopting them in
  this repository's `check:corpus` is this plan's, in its last phase: [spike 0540](../spikes/0540-one-join-over-every-source.md)
  found nothing red over 1,207 judged links, and [plan 0549](./completed/0549-a-link-names-the-record-it-mentions.md)'s
  title rule measured one more (`work/plans/ROADMAP.md`'s row for [plan 0454](./completed/0454-box-marks-are-the-callers.md)).

## Progress ledger

- [ ] Ready, once B and the fix are built
- [ ] The count at zero

## Appendix — the fix's Phase 0 lists, 2026-10-26

Recorded by value from [plan 0550](./0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)'s Phase 0 (`main` at c9e55336, amended `foreign` reading). Each row is a one-record mention the fix leaves to this plan, with the target the fix would write (`ts-archunit:` abbreviates `https://github.com/nielspeter/ts-archunit/blob/main/`). The blocks are fenced, so the corpus gate does not count them.

### Anachronisms (128): read, not applied

A mention first written before its local record existed: each is read; some are a number claimed on a branch before its record merged, and right.

```tsv
location	mention	target	mention first	record first
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:40	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:68	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:79	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/019-a-code-blocks-language-tag-is-read-in-any-letter-case.md:92	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
adr/023-a-predicate-and-a-condition-that-share-a-word.md:6	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
docs/calls.md:158	bug 0324	work/bugs/fixed/0324-the-callback-conditions-read-a-direct-callback-only.md	2026-09-19	2026-09-20
docs/markdown.md:1274	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
docs/migrating-to-eess-ts-0.6.md:95	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-19	2026-09-20
docs/migrating-to-eess-ts-0.6.md:170	bug 0295	work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md	2026-09-19	2026-10-04
docs/migrating-to-eess-ts-0.6.md:171	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-19	2026-09-20
docs/migrating-to-eess-ts-0.6.md:172	bug 0314	work/bugs/fixed/0314-the-function-rules-read-no-parameter-default.md	2026-09-19	2026-09-19
docs/migrating-to-eess-ts-0.6.md:177	bug 0324	work/bugs/fixed/0324-the-callback-conditions-read-a-direct-callback-only.md	2026-09-19	2026-09-20
docs/standard-rules.md:42	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-14	2026-09-20
docs/standard-rules.md:117	bug 0305	work/bugs/fixed/0305-security-rules-miss-a-global-reached-through-a-local-alias.md	2026-09-14	2026-09-20
work/bugs/0244-the-board-status-cell-is-bound-to-nothing.md:226	bugs 0295	work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md	2026-09-14	2026-10-04
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:20	bugs 0282	work/bugs/rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md	2026-09-14	2026-09-14
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:21	bugs 0289	work/bugs/0289-a-fence-its-container-closes-hides-the-next-line.md	2026-09-14	2026-09-14
work/bugs/0302-next-number-cannot-see-numbers-claimed-on-open-branches.md:22	bug 0282	work/bugs/rejected/0282-the-kit-teaches-a-state-vocabulary-its-own-gate-rejects.md	2026-09-14	2026-09-14
work/bugs/0407-a-wrapped-code-span-reads-as-links-to-the-link-test.md:8	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/bugs/BUGS.md:410	bug 0507	work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md	2026-10-19	2026-10-19
work/bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md:102	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	2026-08-19	2026-08-21
work/bugs/fixed/0240-check-guardrails-prints-a-rule-count-it-does-not-derive.md:60	Bug 0239	work/bugs/fixed/0239-a-cluster-finding-carries-one-file-so-diff-aware-drops-the-rest.md	2026-09-03	2026-09-03
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:85	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:92	bug 0476	work/bugs/fixed/0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md	2026-10-18	2026-10-18
work/bugs/fixed/0444-honesty-at-close-reads-state-only-and-says-nothing.md:94	bug 0476	work/bugs/fixed/0476-honestyatclose-reads-no-heading-form-state-and-says-nothing-beside-readable-records.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:48	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:58	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:60	bug 0475	work/bugs/fixed/0475-a-corpus-root-cannot-be-declared-empty-and-a-non-markdown-root-is-silent.md	2026-10-18	2026-10-18
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:10	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:352	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:353	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:418	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:572	ADR-016	adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md	2026-09-28	2026-10-01
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:616	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:667	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:791	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/plans/ROADMAP.md:70	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/ROADMAP.md:70	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/plans/ROADMAP.md:88	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/ROADMAP.md:89	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/ROADMAP.md:90	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0214-extract-the-diagram-kind-predicate.md:80	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	2026-08-23	2026-08-24
work/plans/completed/0406-md-a-declared-link-is-answered.md:131	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0406-md-a-declared-link-is-answered.md:240	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0406-md-a-declared-link-is-answered.md:257	plan 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:17	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:19	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:38	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:61	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:65	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:148	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:167	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:214	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:221	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:224	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:226	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:237	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:276	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:319	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:339	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:365	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:400	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:407	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:407	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:408	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:466	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:527	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:548	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:551	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:795	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1131	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1163	Bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1166	bug 0465	work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:156	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:417	bug 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:525	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:533	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:704	bug 0467	work/bugs/fixed/0467-eess-ts-expectnonempty-does-nothing.md	2026-10-18	2026-10-18
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:803	plan 0496	work/plans/completed/0496-sections-as-elements.md	2026-10-19	2026-10-19
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:94	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:115	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:175	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:265	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:294	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0468-fields-read-a-labelled-value-in-the-callers-forms.md:321	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:22	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:25	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:34	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:40	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:50	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/001-md-corpus-rule-coverage.md:403	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-09	2026-10-14
work/proposals/001-md-corpus-rule-coverage.md:689	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-09	2026-10-14
work/proposals/002-comment-embedded-links.md:162	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-08-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:471	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:473	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:481	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:491	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:493	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:542	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:548	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:548	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:556	bug 0290	work/bugs/fixed/0290-a-code-block-nested-in-a-list-is-never-checked.md	2026-10-12	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:681	Bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:698	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/006-mermaid-beyond-classdiagram.md:710	bug 0426	work/bugs/fixed/0426-parsecodeblocks-and-md-mermaid-read-the-mermaid-tag-differently.md	2026-10-15	2026-10-15
work/proposals/006-mermaid-beyond-classdiagram.md:761	Plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:761	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/proposals/006-mermaid-beyond-classdiagram.md:765	plans 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md	2026-10-14	2026-10-14
work/proposals/006-mermaid-beyond-classdiagram.md:820	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md	2026-10-15	2026-10-16
work/proposals/017-md-blocks-to-check-a-documents-shape.md:1072	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/017-md-blocks-to-check-a-documents-shape.md:1091	Plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md	2026-10-18	2026-10-18
work/proposals/PROPOSALS.md:189	bug 0409	work/bugs/fixed/0409-md-mermaid-blames-the-author-for-a-grammar-gap.md	2026-10-12	2026-10-12
work/proposals/PROPOSALS.md:197	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:16	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:55	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:126	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:182	Bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:215	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:291	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:314	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:412	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:461	bug 0403	work/bugs/fixed/0403-the-vacuity-matrix-probes-one-dialect-of-five.md	2026-10-07	2026-10-07
work/proposals/promoted/013-md-a-declared-relation-is-reciprocated.md:472	Plans 0405	work/plans/completed/0405-md-select-the-links-a-block-declares.md	2026-10-07	2026-10-09
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:124	Bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-09-04	2026-10-14
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:146	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	2026-09-04	2026-10-14
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:74	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:128	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
work/spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md:235	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	2026-10-06	2026-10-06
```

### Refused by `foreign` (156): linked by hand

Refused because `/\b(?:ts-archunit|upstream)\b/i` matched in the reading Decision 2 names; the last column says where.

```tsv
location	mention	target	where
adr/009-agent-first-failure-surfaces.md:44	Plan 0051	work/plans/completed/0051-consolidation-eess-monorepo.md	own paragraph
adr/009-agent-first-failure-surfaces.md:71	plan 0063	ts-archunit:plans/completed/0063-docs-deprecation-scan.md	own paragraph
adr/009-agent-first-failure-surfaces.md:103	bugs 0011	ts-archunit:bugs/fixed/0011-dogfood-rules-select-nothing.md	own paragraph
adr/009-agent-first-failure-surfaces.md:108	bug 0011	ts-archunit:bugs/fixed/0011-dogfood-rules-select-nothing.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:109	bug 0014	ts-archunit:bugs/fixed/0014-bare-package-import-globs-match-nothing.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:110	bug 0018	ts-archunit:bugs/fixed/0018-data-layer-preset-silently-enforces-nothing-for-a-file-glob.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:111	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:112	bug 0022	ts-archunit:bugs/fixed/0022-forward-import-conditions-are-blind-to-reexports-and-dynamic-imports.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:113	bug 0019	ts-archunit:bugs/fixed/0019-a-rule-with-no-condition-passes-in-total-silence.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:114	bug 0021	ts-archunit:bugs/fixed/0021-a-config-finding-prints-the-rule-authors-unrelated-remedy.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:115	bug 0024	ts-archunit:bugs/fixed/0024-warn-terminal-is-invisible-inside-a-test-runner.md	own row,lead-in
adr/009-agent-first-failure-surfaces.md:116	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md	own row,lead-in
adr/010-a-pass-is-constructed-from-evidence.md:53	bug 0011	ts-archunit:bugs/fixed/0011-dogfood-rules-select-nothing.md	own row,lead-in
adr/010-a-pass-is-constructed-from-evidence.md:54	bug 0048	ts-archunit:bugs/fixed/0048-the-dead-glob-gate-blames-the-glob-when-the-project-is-empty.md	own row,lead-in
adr/010-a-pass-is-constructed-from-evidence.md:55	bug 0048	ts-archunit:bugs/fixed/0048-the-dead-glob-gate-blames-the-glob-when-the-project-is-empty.md	own row,lead-in
adr/010-a-pass-is-constructed-from-evidence.md:56	bug 0066	ts-archunit:bugs/fixed/0066-a-smell-detector-over-zero-files-passes.md	own row,lead-in
adr/010-a-pass-is-constructed-from-evidence.md:263	bug 0066	ts-archunit:bugs/fixed/0066-a-smell-detector-over-zero-files-passes.md	own paragraph
adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md:20	Spike 0438	work/spikes/0438-what-the-family-does-under-bun.md	own paragraph
docs/tests-cannot-lie.md:150	bug 0014	ts-archunit:bugs/fixed/0014-bare-package-import-globs-match-nothing.md	own row
docs/tests-cannot-lie.md:151	bug 0066	ts-archunit:bugs/fixed/0066-a-smell-detector-over-zero-files-passes.md	own row
work/bugs/0159-violation-identities-collide-across-distinct-findings.md:15	bugs 0064	ts-archunit:bugs/fixed/0064-a-dependency-identity-collides-across-two-spellings-of-one-module.md	own item
work/bugs/0159-violation-identities-collide-across-distinct-findings.md:127	bug 0056	ts-archunit:bugs/fixed/0056-a-cycle-identity-changes-when-imports-are-reordered.md	blockquote
work/bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md:11	bug 0054	ts-archunit:bugs/fixed/0054-within-makes-helpers-depend-on-builders.md	own item
work/bugs/0162-a-folder-glob-in-strictboundaries-shared-falsely-flags-with-no-diagnostic.md:10	bug 0023	ts-archunit:bugs/fixed/0023-strictboundaries-shared-globs-are-raw-and-unguarded.md	own item
work/bugs/0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md:10	bug 0029	ts-archunit:bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md	own item
work/bugs/0164-rulebuilder-carries-the-assertion-gate-and-exceeds-its-own-size-rules.md:9	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	own item
work/bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md:6	bug 0179	work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md	heading
work/bugs/0183-upstream-citations-are-pinned-to-a-moving-branch.md:37	Bug 0179	work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md	heading
work/bugs/0298-an-exclusion-that-absorbs-several-subjects-says-nothing.md:58	plan 0104	ts-archunit:plans/completed/0104-a-cycle-waiver-names-the-edge-it-waives.md	own item
work/bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md:70	plan 0104	ts-archunit:plans/completed/0104-a-cycle-waiver-names-the-edge-it-waives.md	heading
work/bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md:70	plan 0104	ts-archunit:plans/completed/0104-a-cycle-waiver-names-the-edge-it-waives.md	heading
work/bugs/0391-the-identity-scrub-replaces-the-root-inside-a-path.md:10	bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md	own item
work/bugs/0391-the-identity-scrub-replaces-the-root-inside-a-path.md:11	bug 0010	ts-archunit:bugs/fixed/0010-violation-identity-embeds-absolute-paths.md	own item
work/bugs/0391-the-identity-scrub-replaces-the-root-inside-a-path.md:12	spike 0392	work/spikes/0392-what-makes-an-accepted-entry-portable.md	own item
work/bugs/0433-a-kind-on-its-directives-line-is-a-comment-to-eess-mermaids-grammars.md:24	bug 0429	work/bugs/fixed/0429-diagramkind-reads-a-directive-closed-mid-line-as-open.md	own paragraph
work/bugs/BUGS.md:176	bug 0019	ts-archunit:bugs/fixed/0019-a-rule-with-no-condition-passes-in-total-silence.md	own row
work/bugs/BUGS.md:177	bug 0020	ts-archunit:bugs/fixed/0020-should-twice-silently-drops-the-first-assertion.md	own row
work/bugs/BUGS.md:178	bug 0038	ts-archunit:bugs/fixed/0038-a-typo-in-a-preset-override-key-is-a-silent-false-green.md	own row
work/bugs/BUGS.md:179	bug 0039	ts-archunit:bugs/fixed/0039-an-undocumented-exclusion-comment-suppresses-and-only-warns.md	own row
work/bugs/BUGS.md:180	plan 0532	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md	own row
work/bugs/BUGS.md:180	bug 0388	work/bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md	own row
work/bugs/BUGS.md:199	bug 0179	work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md	own row
work/bugs/BUGS.md:229	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	own row
work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md:108	bug 0043	ts-archunit:bugs/fixed/0043-an-exclusion-directive-inside-a-string-literal-suppresses.md	own paragraph
work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md:258	bug 0043	ts-archunit:bugs/fixed/0043-an-exclusion-directive-inside-a-string-literal-suppresses.md	own paragraph
work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md:274	Plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md	own paragraph
work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md:14	bug 0019	ts-archunit:bugs/fixed/0019-a-rule-with-no-condition-passes-in-total-silence.md	own item
work/bugs/fixed/0156-should-twice-silently-drops-the-first-assertion.md:10	bug 0020	ts-archunit:bugs/fixed/0020-should-twice-silently-drops-the-first-assertion.md	own item
work/bugs/fixed/0156-should-twice-silently-drops-the-first-assertion.md:88	bugs 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md	own paragraph
work/bugs/fixed/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md:11	bug 0038	ts-archunit:bugs/fixed/0038-a-typo-in-a-preset-override-key-is-a-silent-false-green.md	own item
work/bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md:11	bug 0039	ts-archunit:bugs/fixed/0039-an-undocumented-exclusion-comment-suppresses-and-only-warns.md	own item
work/bugs/fixed/0161-smell-detectors-silently-miss-object-literal-functions.md:10	bug 0013	ts-archunit:bugs/fixed/0013-resolvers-cannot-see-resolvers.md	own item
work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md:161	bug 0020	ts-archunit:bugs/fixed/0020-should-twice-silently-drops-the-first-assertion.md	own item
work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md:161	bug 0038	ts-archunit:bugs/fixed/0038-a-typo-in-a-preset-override-key-is-a-silent-false-green.md	own item
work/bugs/fixed/0198-no-migration-path-from-ts-archunit.md:92	bug 0199	work/bugs/fixed/0199-a-bare-preset-call-throws-before-baseline-filtering.md	lead-in,heading
work/bugs/fixed/0198-no-migration-path-from-ts-archunit.md:146	bug 0195	work/bugs/fixed/0195-crossproject-ships-with-no-documentation.md	heading
work/fold-audit-2026-08-19.md:45	bug 0043	ts-archunit:bugs/fixed/0043-an-exclusion-directive-inside-a-string-literal-suppresses.md	own paragraph,heading
work/fold-audit-2026-08-19.md:136	bug 0160	work/bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md	own paragraph,heading
work/fold-audit-2026-08-19.md:233	plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md	own item,heading
work/fold-audit-2026-08-19.md:251	Plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md	heading
work/fold-audit-2026-08-19.md:308	bugs 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	heading
work/fold-audit-2026-08-19.md:341	bug 0161	work/bugs/fixed/0161-smell-detectors-silently-miss-object-literal-functions.md	heading
work/fold-audit-2026-08-19.md:347	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md	heading
work/fold-audit-2026-08-19.md:348	bug 0156	work/bugs/fixed/0156-should-twice-silently-drops-the-first-assertion.md	heading
work/fold-audit-2026-08-19.md:351	bug 0162	work/bugs/0162-a-folder-glob-in-strictboundaries-shared-falsely-flags-with-no-diagnostic.md	heading
work/fold-audit-2026-08-19.md:357	bug 0163	work/bugs/0163-a-config-finding-prints-twice-defeating-adr-008s-gated-clause.md	heading
work/fold-audit-2026-08-19.md:363	plan 0148	work/plans/completed/0148-workspace-multi-root-awareness.md	heading
work/fold-audit-2026-08-19.md:366	bug 0157	work/bugs/fixed/0157-a-typo-in-a-preset-override-key-is-a-silent-false-green.md	heading
work/fold-audit-2026-08-19.md:367	bug 0158	work/bugs/fixed/0158-an-undocumented-exclusion-directive-suppresses-and-only-warns.md	heading
work/fold-audit-2026-08-19.md:371	bug 0154	work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md	heading
work/fold-audit-2026-08-19.md:372	plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md	heading
work/fold-audit-2026-08-19.md:382	bug 0160	work/bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md	heading
work/fold-audit-2026-08-19.md:386	plan 0148	work/plans/completed/0148-workspace-multi-root-awareness.md	heading
work/fold-audit-2026-08-19.md:391	bug 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	heading
work/fold-audit-2026-08-19.md:392	bug 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	heading
work/fold-audit-2026-08-19.md:394	bug 0159	work/bugs/0159-violation-identities-collide-across-distinct-findings.md	heading
work/fold-audit-2026-08-19.md:407	bugs 0154	work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md	own paragraph,heading
work/plans/0100-publish-the-fold-retire-ts-archunit.md:255	bug 0106	work/bugs/fixed/0106-no-gate-requires-a-changeset.md	heading
work/plans/0150-close-0088s-disclosed-review-findings.md:32	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md	ancestor item
work/plans/0150-close-0088s-disclosed-review-findings.md:40	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	ancestor item
work/plans/0150-close-0088s-disclosed-review-findings.md:104	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own item
work/plans/0150-close-0088s-disclosed-review-findings.md:146	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own paragraph
work/plans/0191-flip-the-inert-finding.md:46	plan 0105	ts-archunit:plans/0105-the-inert-finding-flipped.md	own paragraph
work/plans/0191-flip-the-inert-finding.md:66	Plan 0102	ts-archunit:plans/completed/0102-a-detector-that-cannot-fire-says-so.md	lead-in
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:718	Spike 0386	work/spikes/0386-strings-that-name-code.md	own item
work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:140	spike 0386	work/spikes/0386-strings-that-name-code.md	own item
work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:140	ADR-018	adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md	own item
work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:141	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md	own item
work/plans/ROADMAP.md:104	bug 0189	work/bugs/fixed/0189-adr-008s-preset-default-row-is-gated-over-a-changed-engine.md	own row
work/plans/ROADMAP.md:106	plan 0105	ts-archunit:plans/0105-the-inert-finding-flipped.md	own row
work/plans/ROADMAP.md:178	bug 0141	work/bugs/fixed/0141-no-check-binds-accepted-proposals-to-plans.md	own paragraph
work/plans/ROADMAP.md:186	bug 0131	work/bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md	own paragraph
work/plans/ROADMAP.md:186	bugs 0151	work/bugs/0151-honesty-at-close-options-undiscoverable-past-source.md	own paragraph
work/plans/ROADMAP.md:187	plan 0153	work/plans/0153-standalone-consumption-fixtures.md	own paragraph
work/plans/completed/0051-consolidation-eess-monorepo.md:28	plans 0049	ts-archunit:plans/completed/0049-recommended-preset.md	lead-in
work/plans/completed/0051-consolidation-eess-monorepo.md:250	plans 0049	ts-archunit:plans/completed/0049-recommended-preset.md	own item
work/plans/completed/0088-fold-ts-archunit-into-eess.md:5	plans 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own item,heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:50	plan 0051	work/plans/completed/0051-consolidation-eess-monorepo.md	own paragraph,heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:113	ADR-011	adr/011-the-kernels-public-api-is-explicit.md	own paragraph,heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:290	plan 0095	ts-archunit:plans/completed/0095-the-vacuity-matrix-and-the-conformance-audit.md	own paragraph,heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:502	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own item,heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:782	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md	heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:858	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:873	plans 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	heading
work/plans/completed/0088-fold-ts-archunit-into-eess.md:873	bug 0149	work/bugs/fixed/0149-release-gate-loses-history-through-a-merge-commit.md	heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:44	plan 0015	ts-archunit:plans/completed/0015-within-scoped-rules.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:402	Bug 0036	ts-archunit:bugs/fixed/0036-the-relative-glob-audit-is-incomplete.md	own item,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1029	bug 0049	ts-archunit:bugs/fixed/0049-the-type-assertion-self-check-selected-classes.md	own item,lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1055	bug 0029	ts-archunit:bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md	own item,lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1217	bug 0022	ts-archunit:bugs/fixed/0022-forward-import-conditions-are-blind-to-reexports-and-dynamic-imports.md	own item,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1218	bug 0059	ts-archunit:bugs/fixed/0059-slice-conditions-and-module-conditions-disagree-about-a-dependency.md	own item,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1219	plan 0085	ts-archunit:plans/completed/0085-the-slice-graph-cannot-see-a-re-export.md	own item,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1252	bug 0022	ts-archunit:bugs/fixed/0022-forward-import-conditions-are-blind-to-reexports-and-dynamic-imports.md	own paragraph,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1268	bug 0022	ts-archunit:bugs/fixed/0022-forward-import-conditions-are-blind-to-reexports-and-dynamic-imports.md	own paragraph,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1271	bugs 0014	ts-archunit:bugs/fixed/0014-bare-package-import-globs-match-nothing.md	own item,lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1282	bug 0057	ts-archunit:bugs/fixed/0057-an-empty-options-object-reverts-a-documented-default.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1282	bug 0056	ts-archunit:bugs/fixed/0056-a-cycle-identity-changes-when-imports-are-reordered.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1292	bug 0015	ts-archunit:bugs/fixed/0015-allowlist-conditions-pass-vacuously-on-edgeless-subjects.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1294	bug 0063	ts-archunit:bugs/fixed/0063-a-dependency-identity-collides-across-files-sharing-a-basename.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1298	bug 0059	ts-archunit:bugs/fixed/0059-slice-conditions-and-module-conditions-disagree-about-a-dependency.md	lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1321	bug 0065	ts-archunit:bugs/fixed/0065-reverse-dependency-findings-carry-no-identity.md	own item,lead-in,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1357	bug 0065	ts-archunit:bugs/fixed/0065-reverse-dependency-findings-carry-no-identity.md	own paragraph,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1366	bug 0065	ts-archunit:bugs/fixed/0065-reverse-dependency-findings-carry-no-identity.md	own paragraph,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1556	bug 0012	ts-archunit:bugs/fixed/0012-metric-findings-have-no-usable-ratchet.md	own item,heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1590	bugs 0033	ts-archunit:bugs/fixed/0033-assignedFrom-does-not-accept-a-project-relative-glob.md	heading
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:2070	bug 0058	ts-archunit:bugs/fixed/0058-workspace-applies-one-packages-compiler-flag-to-all.md	own paragraph,heading
work/plans/completed/0148-workspace-multi-root-awareness.md:39	bug 0058	ts-archunit:bugs/fixed/0058-workspace-applies-one-packages-compiler-flag-to-all.md	own paragraph
work/plans/completed/0148-workspace-multi-root-awareness.md:49	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	lead-in
work/plans/completed/0148-workspace-multi-root-awareness.md:92	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own paragraph
work/plans/completed/0148-workspace-multi-root-awareness.md:117	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	lead-in
work/plans/completed/0148-workspace-multi-root-awareness.md:232	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md	own item
work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md:194	bug 0045	ts-archunit:bugs/fixed/0045-two-tests-fail-by-environment-and-corrupt-sabotage-verdicts.md	heading
work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md:201	bug 0160	work/bugs/0160-within-creates-an-import-cycle-and-nothing-watches-for-cycles.md	heading
work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md:237	bug 0029	ts-archunit:bugs/fixed/0029-a-throwing-warn-truncates-the-rest-of-the-rule-file.md	lead-in,heading
work/plans/completed/0165-integrate-the-copied-ts-archunit-engine.md:395	bug 0154	work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md	heading
work/proposals/002-comment-embedded-links.md:80	plans 0001	ts-archunit:plans/completed/0001-exploratory-poc.md	own paragraph
work/proposals/017-md-blocks-to-check-a-documents-shape.md:165	bug 0066	ts-archunit:bugs/fixed/0066-a-smell-detector-over-zero-files-passes.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:174	bug 0303	work/bugs/0303-ts-archunit-adr-numbers-persist-in-eess-comments.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:178	bugs 0011	ts-archunit:bugs/fixed/0011-dogfood-rules-select-nothing.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:476	bug 0039	ts-archunit:bugs/fixed/0039-an-undocumented-exclusion-comment-suppresses-and-only-warns.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:476	ADR-012	adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:477	plan 0103	ts-archunit:plans/completed/0103-a-body-too-small-to-differ-is-not-evidence.md	own item
work/proposals/017-md-blocks-to-check-a-documents-shape.md:477	bug 0229	work/bugs/0229-a-call-site-whose-arguments-carry-logic-reads-as-copy-paste.md	own item
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:20	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	blockquote
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:20	plan 0085	ts-archunit:plans/completed/0085-the-slice-graph-cannot-see-a-re-export.md	blockquote
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:21	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	blockquote
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:22	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md	blockquote
work/spikes/0001-eess-over-ts-archunit/CONCLUSION.md:24	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md	blockquote
work/spikes/0001-eess-over-ts-archunit/README.md:16	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	blockquote
work/spikes/0001-eess-over-ts-archunit/README.md:16	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	blockquote
work/spikes/0001-eess-over-ts-archunit/README.md:25	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	own paragraph,heading
work/spikes/0001-eess-over-ts-archunit/README.md:92	plan 0084	ts-archunit:plans/completed/0084-cycle-detection-that-ignores-type-only-imports.md	heading
work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md:270	bug 0010	ts-archunit:bugs/fixed/0010-violation-identity-embeds-absolute-paths.md	own item
work/spikes/0536-what-a-mention-of-a-record-needs.md:131	bugs 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md	own paragraph
work/spikes/0536-what-a-mention-of-a-record-needs.md:131	plans 0000	ts-archunit:plans/completed/0000-project-bootstrap.md	own paragraph
work/spikes/0540-one-join-over-every-source.md:62	bug 0046	ts-archunit:bugs/fixed/0046-cross-document-links-rot-silently.md	own paragraph
```

### Across a soft break (76): linked by hand

No exact `span`, so no fix.

```tsv
location	mention	target
adr/014-the-emitter-refuses-a-verdict-without-evidence.md:105	Plan 0263	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md
adr/020-a-package-supports-a-runtime-only-where-ci-checks-it-there.md:119	spike 0438	work/spikes/0438-what-the-family-does-under-bun.md
adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md:106	bug 0262	work/bugs/0262-an-adr-cannot-cite-a-kernel-test.md
docs/migrating-to-eess-ts-0.6.md:44	bug 0315	work/bugs/fixed/0315-the-function-builder-does-not-collect-constructors-accessors-or-wrapped-functions.md
docs/migrating-to-eess-ts-0.6.md:174	bug 0321	work/bugs/fixed/0321-function-positions-no-function-rule-reads.md
work/bugs/0159-violation-identities-collide-across-distinct-findings.md:213	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md
work/bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md:76	plan 0104	ts-archunit:plans/completed/0104-a-cycle-waiver-names-the-edge-it-waives.md
work/bugs/0248-the-source-text-guard-covers-a-sixth-of-the-repo.md:5	bug 0247	work/bugs/fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md
work/bugs/0391-the-identity-scrub-replaces-the-root-inside-a-path.md:11	Bug 0389	work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md
work/bugs/0396-doctor-assumes-every-rule-has-a-ts-morph-project.md:85	plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md
work/bugs/0401-an-expired-expectempty-is-reported-twice.md:21	bug 0400	work/bugs/fixed/0400-a-one-way-becomplete-counts-the-side-it-never-reads.md
work/bugs/0414-a-label-after-a-soft-break-is-reported-never-read.md:127	Bug 0408	work/bugs/0408-a-label-without-its-colon-is-neither-read-nor-reported.md
work/bugs/0501-md-and-kernel-leftovers-from-plan-0457.md:31	plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md
work/bugs/fixed/0154-a-directive-inside-a-string-literal-suppresses-a-real-violation.md:262	plan 0150	work/plans/0150-close-0088s-disclosed-review-findings.md
work/bugs/fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md:205	bug 0086	work/bugs/fixed/0086-links-to-directories-do-not-resolve.md
work/bugs/fixed/0339-globs-match-nothing-when-the-project-sits-under-a-dot-directory.md:143	bug 0036	ts-archunit:bugs/fixed/0036-the-relative-glob-audit-is-incomplete.md
work/bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md:62	spike 0393	work/spikes/0393-can-a-portable-syntax-be-unspellable.md
work/bugs/fixed/0465-a-corpus-root-that-matches-no-file-is-dropped-silently.md:25	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md
work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md:5	plans 0496	work/plans/completed/0496-sections-as-elements.md
work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md:5	plans 0496	work/plans/completed/0496-sections-as-elements.md
work/bugs/fixed/0508-an-unknown-report-mode-prints-and-passes.md:72	Bug 0284	work/bugs/fixed/0284-a-declared-vocabulary-disjoint-from-its-terminal-set-turns-the-gate-off.md
work/plans/0150-close-0088s-disclosed-review-findings.md:8	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:12	plan 0534	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:667	plan 0534	work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:781	spike 0395	work/spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md
work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md:795	plan 0532	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md
work/plans/0504-honestyatclose-boxes-and-deferrals-from-public-blocks.md:45	plan 0498	work/plans/0498-honestyatclose-places-a-record-with-block-5.md
work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:111	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md
work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:125	Bug 0388	work/bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md
work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md:248	spike 0395	work/spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md
work/plans/0534-the-adr-a-finding-is-identified-by-the-code-it-matched.md:49	spike 0395	work/spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md
work/plans/ROADMAP.md:10	plan 0051	work/plans/completed/0051-consolidation-eess-monorepo.md
work/plans/completed/0088-fold-ts-archunit-into-eess.md:5	bug 0149	work/bugs/fixed/0149-release-gate-loses-history-through-a-merge-commit.md
work/plans/completed/0089-family-standalone-sufficiency.md:25	bug 0131	work/bugs/fixed/0131-honesty-at-close-bypasses-the-builder-dsl.md
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1474	bugs 0033	ts-archunit:bugs/fixed/0033-assignedFrom-does-not-accept-a-project-relative-glob.md
work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md:1949	bug 0049	ts-archunit:bugs/fixed/0049-the-type-assertion-self-check-selected-classes.md
work/plans/completed/0148-workspace-multi-root-awareness.md:60	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/completed/0148-workspace-multi-root-awareness.md:148	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/completed/0148-workspace-multi-root-awareness.md:155	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/completed/0148-workspace-multi-root-awareness.md:164	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/completed/0148-workspace-multi-root-awareness.md:171	plan 0147	work/plans/completed/0147-copy-the-eess-ts-bound-delta-from-ts-archunit.md
work/plans/completed/0148-workspace-multi-root-awareness.md:235	bug 0035	ts-archunit:bugs/fixed/0035-a-workspace-has-no-single-root.md
work/plans/completed/0235-the-emitter-takes-a-receipt.md:790	bug 0174	work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md
work/plans/completed/0263-adr-014s-residual-enforcement-rows.md:159	plan 0188	work/plans/0188-unify-the-duplicated-engine-modules.md
work/plans/completed/0263-adr-014s-residual-enforcement-rows.md:213	bug 0203	work/bugs/fixed/0203-a-preset-at-module-scope-prints-its-findings-twice.md
work/plans/completed/0263-adr-014s-residual-enforcement-rows.md:218	bug 0206	work/bugs/fixed/0206-deliver-bypasses-the-kernel-finisher-on-the-default-path.md
work/plans/completed/0406-md-a-declared-link-is-answered.md:53	bug 0155	work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md
work/plans/completed/0406-md-a-declared-link-is-answered.md:262	bug 0087	work/bugs/fixed/0087-frontmatter-parsed-as-setext-heading.md
work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md:179	plan 0413	work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:149	spike 0428	work/spikes/0428-where-mermaid-puts-an-errors-line.md
work/plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md:275	plan 0412	work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md
work/plans/completed/0448-a-bun-load-guard-and-bug-0439s-fix.md:33	Spike 0438	work/spikes/0438-what-the-family-does-under-bun.md
work/plans/completed/0455-a-corpus-built-from-text.md:146	plan 0458	work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md
work/plans/completed/0455-a-corpus-built-from-text.md:368	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:523	Plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:534	bug 0355	work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md
work/plans/completed/0456-kernel-notexist-and-dead-glob.md:1118	bug 0460	work/bugs/fixed/0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:541	plan 0469	work/plans/completed/0469-havefield-a-document-has-a-value.md
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:569	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:698	plan 0456	work/plans/completed/0456-kernel-notexist-and-dead-glob.md
work/plans/completed/0458-the-examples-gate-a-document-shape-from-public-blocks-only.md:678	plan 0455	work/plans/completed/0455-a-corpus-built-from-text.md
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:22	Plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md
work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md:29	plan 0457	work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md
work/plans/completed/0495-a-value-agrees-with-its-folder.md:260	bug 0014	ts-archunit:bugs/fixed/0014-bare-package-import-globs-match-nothing.md
work/plans/completed/0495-a-value-agrees-with-its-folder.md:296	plan 0498	work/plans/0498-honestyatclose-places-a-record-with-block-5.md
work/plans/completed/0496-sections-as-elements.md:5	bug 0502	work/bugs/fixed/0502-links-and-tables-read-a-heading-in-a-list-differently.md
work/plans/completed/0496-sections-as-elements.md:274	plan 0505	work/plans/completed/0505-a-field-read-inside-a-named-section.md
work/plans/completed/0496-sections-as-elements.md:607	plan 0503	work/plans/completed/0503-in-sections-boxes-by-section.md
work/proposals/006-mermaid-beyond-classdiagram.md:569	plan 0214	work/plans/completed/0214-extract-the-diagram-kind-predicate.md
work/proposals/017-md-blocks-to-check-a-documents-shape.md:705	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
work/proposals/017-md-blocks-to-check-a-documents-shape.md:768	bug 0116	work/bugs/0116-gated-row-resolves-against-a-skipped-test.md
work/proposals/017-md-blocks-to-check-a-documents-shape.md:1103	plan 0454	work/plans/completed/0454-box-marks-are-the-callers.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:27	spike 0536	work/spikes/0536-what-a-mention-of-a-record-needs.md
work/spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md:248	plan 0346	work/plans/0346-a-finding-is-identified-by-the-code-it-matched.md
work/spikes/0418-where-python-architecture-tools-pass-on-a-broken-rule.md:143	Spike 0417	work/spikes/0417-which-engine-reads-python-for-eess-py.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:144	bug 0066	ts-archunit:bugs/fixed/0066-a-smell-detector-over-zero-files-passes.md
```

### In inline code (76): moved to a fence, or linked

A quoted example moves to a fenced block; a live mention in code is linked by hand.

```tsv
location	mention	target
adr/012-the-kernel-borrows-a-lexer-it-cannot-own.md:142	bug 0039	ts-archunit:bugs/fixed/0039-an-undocumented-exclusion-comment-suppresses-and-only-warns.md
adr/014-the-emitter-refuses-a-verdict-without-evidence.md:503	plan 0235	work/plans/completed/0235-the-emitter-takes-a-receipt.md
adr/017-a-heritage-predicate-names-a-relation-not-a-clause.md:102	bug 0295	work/bugs/fixed/0295-extend-and-implement-read-only-the-direct-clause.md
docs/markdown.md:395	bug 0402	work/bugs/0402-correspondence-checks-leak-between-rules-built-from-one-base.md
docs/markdown.md:424	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
docs/markdown.md:618	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
docs/markdown.md:659	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
docs/markdown.md:664	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
docs/markdown.md:665	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
docs/markdown.md:665	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
docs/markdown.md:684	plans 0532	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md
work/bugs/0408-a-label-without-its-colon-is-neither-read-nor-reported.md:58	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
work/bugs/0408-a-label-without-its-colon-is-neither-read-nor-reported.md:88	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
work/bugs/0416-the-link-test-reads-an-indented-fence-as-prose.md:6	bug 0414	work/bugs/0414-a-label-after-a-soft-break-is-reported-never-read.md
work/bugs/0543-an-invisible-character-hides-a-mention.md:8	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/bugs/0543-an-invisible-character-hides-a-mention.md:24	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/bugs/0543-an-invisible-character-hides-a-mention.md:26	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/bugs/0543-an-invisible-character-hides-a-mention.md:27	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/bugs/fixed/0155-a-rule-with-no-condition-passes-in-total-silence.md:131	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md
work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md:169	bug 0020	ts-archunit:bugs/fixed/0020-should-twice-silently-drops-the-first-assertion.md
work/bugs/fixed/0187-four-visibility-and-async-predicates-cannot-fail.md:233	plan 0099	ts-archunit:plans/completed/0099-the-floor-no-family-can-be-born-below.md
work/bugs/fixed/0219-corpus-listing-surface-is-undocumented.md:6	bug 0220	work/bugs/0220-nothing-requires-a-public-symbol-to-be-documented.md
work/bugs/fixed/0273-nothing-compiles-a-changesets-migration-snippet.md:196	plan 0263	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md
work/bugs/fixed/0273-nothing-compiles-a-changesets-migration-snippet.md:197	plan 0235	work/plans/completed/0235-the-emitter-takes-a-receipt.md
work/bugs/fixed/0273-nothing-compiles-a-changesets-migration-snippet.md:197	bug 0185	work/bugs/fixed/0185-a-kernel-break-reaches-adopters-as-a-dialect-patch.md
work/bugs/fixed/0325-the-class-search-reads-no-comment-on-a-parameter.md:119	bug 0307	work/bugs/fixed/0307-class-body-rules-skip-class-code-outside-its-members.md
work/bugs/fixed/0419-a-waiver-in-a-gherkin-doc-string-suppresses-a-real-finding.md:133	bug 0421	work/bugs/0421-a-waiver-in-a-file-the-kernel-cannot-lex-is-ignored-in-silence.md
work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md:47	plan 0002	ts-archunit:plans/completed/0002-project-loader.md
work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md:47	plan 0002	ts-archunit:plans/completed/0002-project-loader.md
work/bugs/fixed/0507-a-boxs-text-stops-at-its-first-paragraph.md:49	plan 0002	ts-archunit:plans/completed/0002-project-loader.md
work/plans/0150-close-0088s-disclosed-review-findings.md:35	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md
work/plans/0150-close-0088s-disclosed-review-findings.md:36	bug 0016	ts-archunit:bugs/fixed/0016-narrowing-a-named-selection-mutates-it.md
work/plans/0430-an-acceptance-criterion-is-never-deferred.md:29	bug 0420	work/bugs/0420-a-failed-code-block-parse-is-misdescribed-by-the-kernel.md
work/plans/completed/0216-dogfood-the-proposals-lane.md:8	plan 0218	work/plans/completed/0218-gate-proposal-acceptance-criteria.md
work/plans/completed/0235-the-emitter-takes-a-receipt.md:1095	plan 0263	work/plans/completed/0263-adr-014s-residual-enforcement-rows.md
work/plans/completed/0404-md-one-link-resolver-names-each-case.md:120	plan 0406	work/plans/completed/0406-md-a-declared-link-is-answered.md
work/plans/completed/0405-md-select-the-links-a-block-declares.md:123	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
work/plans/completed/0405-md-select-the-links-a-block-declares.md:244	bug 0253	work/bugs/0253-frozen-drift-is-not-reported-only-unexamined.md
work/plans/completed/0405-md-select-the-links-a-block-declares.md:284	bug 0402	work/bugs/0402-correspondence-checks-leak-between-rules-built-from-one-base.md
work/plans/completed/0405-md-select-the-links-a-block-declares.md:291	plan 0406	work/plans/completed/0406-md-a-declared-link-is-answered.md
work/plans/completed/0412-a-code-block-parses-with-the-parser-the-caller-names.md:532	bug 0420	work/bugs/0420-a-failed-code-block-parse-is-misdescribed-by-the-kernel.md
work/plans/completed/0454-box-marks-are-the-callers.md:345	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
work/plans/completed/0457-a-rule-limited-to-the-documents-the-caller-chooses.md:812	bug 0174	work/bugs/0174-eess-ts-reports-a-clean-gate-with-no-denominator.md
work/plans/completed/0503-in-sections-boxes-by-section.md:169	plan 0002	ts-archunit:plans/completed/0002-project-loader.md
work/plans/completed/0539-a-mention-of-a-record-is-a-link.md:149	plans 0532	work/plans/0532-a-baseline-entry-matches-only-the-file-it-was-written-for.md
work/plans/completed/0541-this-repositorys-record-mentions-are-gated.md:22	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/proposals/006-mermaid-beyond-classdiagram.md:818	plan 0427	work/plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:55	ADR-011	adr/011-the-kernels-public-api-is-explicit.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:168	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:203	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:203	bug 0009	ts-archunit:bugs/fixed/0009-slice-glob-conventions-diverge-and-remedy-misleads.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:204	plan 0001	ts-archunit:plans/completed/0001-exploratory-poc.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:205	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:205	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:270	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:289	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:295	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:328	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/proposals/019-md-a-mention-is-a-link-built-from-blocks.md:345	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
work/proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md:92	bug 0039	ts-archunit:bugs/fixed/0039-an-undocumented-exclusion-comment-suppresses-and-only-warns.md
work/proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md:132	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
work/proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md:138	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/proposals/rejected/018-md-a-mention-of-a-record-is-a-link.md:217	plan 0103	ts-archunit:plans/completed/0103-a-body-too-small-to-differ-is-not-evidence.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:58	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:84	bug 0421	work/bugs/0421-a-waiver-in-a-file-the-kernel-cannot-lex-is-ignored-in-silence.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:102	ADR-011	adr/011-the-kernels-public-api-is-explicit.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:116	bug 0338	work/bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:151	bug 0278	work/bugs/fixed/0278-the-strict-family-barrel-kept-the-count-and-dropped-the-functions.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:151	plan 0470	work/plans/completed/0470-a-lifted-predicate-carries-its-findings.md
work/spikes/0536-what-a-mention-of-a-record-needs.md:224	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/spikes/0540-one-join-over-every-source.md:19	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/spikes/0540-one-join-over-every-source.md:36	ADR-011	adr/011-the-kernels-public-api-is-explicit.md
work/spikes/0540-one-join-over-every-source.md:37	bug 0002	ts-archunit:bugs/fixed/0002-missing-property-name-condition.md
work/spikes/0540-one-join-over-every-source.md:63	bug 0048	ts-archunit:bugs/fixed/0048-the-dead-glob-gate-blames-the-glob-when-the-project-is-empty.md
work/spikes/0540-one-join-over-every-source.md:68	bug 0046	ts-archunit:bugs/fixed/0046-cross-document-links-rot-silently.md
work/spikes/0540-one-join-over-every-source.md:126	bug 0001	ts-archunit:bugs/fixed/0001-excluding-cant-match-definecondition-by-file.md
```
