# Specification — Data model check widget (dmCheck)

**Status:** v0.4, 2026-10-30. **dmCheck 0.2.0** adds the drill-down queries (K9; tested on mocks, in Chromium and on an SQLite copy of the test structure; checks on 2512: `docs/PO_CHECKS.md` 3.7–3.11). **dmCheck 0.1.0 implemented** (`widgets/dmCheck/src`, shared `dm-check.vm`: K1, K3–K8,
K10, K12, K14–K16), tested with Velocity 1.4 on mocks built from `test-data/vcycle-check/` and in Chromium; **verified by the PO
on 2512 (2026-10-30, `docs/PO_CHECKS.md` 3.1–3.6: test structure with the expected violations, details, table, Excel,
PDF, a real model of the largest project, a model with an error)**. Spike S10 (T1, T3) prepared. Open questions of §7 all decided by the PO (2026-10-30). Items marked `[?]` are open or need verification on a Polarion instance.

## 1. Goal

A Velocity LiveReport widget that **checks the real data of a project against the formalized data model** (see
`widgets/dmDefine/SPECIFICATION.md` and `docs/DATA_MODEL_FORMAT.md`) and reports the violations: a table, an Excel file,
and a visual representation of the model coloured by compliance, in the style of docCoverage in the sister repo.

## 2. Context and constraints

Same as dmDefine (C1–C8), plus:

| ID | Constraint | Source |
|---|---|---|
| C9 | dmCheck is independent of dmDefine: it reads the same model item(s) from the same place. A dummy model written by hand (or the output of dmDefine) lets it be tested alone | PO |
| C10 | v1 checks: required links (coverage), forbidden/unexpected links, required item types per document. Orphan items and items in the wrong document come later | PO |

## 3. Functional requirements

| ID | Requirement | Priority | Increment |
|---|---|---|---|
| K1 | (done, 0.1.0) Parameters: same model location as dmDefine (model document, model item type, model item id); severity filters in the toolbar; list cap; graph height. Projects come from the model (documents of other projects as `project/space/name`, `uses:`); collection scope later (K11) | Must | 1 |
| K2 | **Resolve the bindings**: roles → real documents; report unbound roles and documents bound to no role (information) | Must | 1 |
| K3 | **Required item types**: for each role, required types present (min/max); unexpected types reported with the severity of the model | Must (done, 0.1.0) | 1 |
| K4 | **Required links**: for each link rule, `from` items without the required link (`from_min`) and `to` items not targeted (`to_min`), counting only links of the role between the bound documents | Must (done, 0.1.0) | 1 |
| K5 | **Forbidden/unexpected links**: links of a role used by the model between modelled documents that match no rule (wrong target document/type, wrong direction) | Must (done, 0.1.0) | 1 |
| K6 | **Report table**: one row per violation with rule id, severity, check kind, document, work item (clickable link), message; filter by severity/rule/document | Must (done, 0.1.0) | 1 |
| K7 | **Excel export**: Summary sheet (counts per rule, % compliant), one sheet per check kind, model used (revision) | Must (done, 0.1.0) | 1 |
| K8 | **Graph**: model documents as nodes, link rules as edges, coloured green/orange/red with counts (compliant items / total); click an edge or node to list its violations | Must (done, 0.1.0) | 1 |
| K9 | **Drill-down** (done, 0.2.0): per rule and per document of each side with a minimum (missing link, not covered), and per document for unexpected types, a Lucene query `project.id:P AND SQL:(… NOT IN (…))` (form verified by S10 runs 5/5b) listing **all** the violating items (not only the listed ones), with the count; a link opens Polarion's work item table with the query `[?]` URL form `#/project/P/workitems?query=…` to check on 2512; *Copy query* to paste it into the table's query field. Shown in the line and role details, the table (section *Drill-down queries*) and Excel (sheet *Queries*). Not offered for cross-pair links, unexpected links, unpaired documents and missing types (listed in full, or no item to list) | Should | 2 |
| K10 | PDF/print static view: summary + violation table + static graph, no JS | Must (done, 0.1.0) | 1 |
| K11 | Collection context (check the model on the documents of a collection at the pinned revisions), as docCoverage F17 | Could | 3 |
| K12 | Cross-project documents in bindings (as dmDefine 0.4.0: links between declared documents of different projects count) | Should (done, 0.1.0; on mocks) | 1 |
| K13 | Later checks: orphan items (no link at all), items in the wrong document, mandatory fields / statuses, max cardinality | Could | later |
| K15 | **Several documents per role, pooled or paired** (PO 2026-10-30, Q2). **Pooled** (default, no `pairs:` entry for the rule): the documents of a role form one set; a link to any document of the target role counts; violations are listed per document. **Paired** (the rule has an entry in `pairs:`): only links between the documents of a declared pair count for `from_min` / `to_min`; a link between documents of the two roles that are not paired is reported as a **cross-pair link**; a document of the rule's roles without a pair is reported as **unpaired**; both with the rule's severity. A document may appear in several pairs (e.g. one test specification for two specifications). Format: `docs/DATA_MODEL_FORMAT.md` §2.1; examples: `docs/MODELING_GUIDE.md` | Must (done, 0.1.0) | 1 |
| K16 | **Model problems first**: when the model has errors (dmDefine validation, same pipeline), dmCheck lists them and checks nothing; warnings are shown and the checks run | Must (done, 0.1.0) | 1 |
| K14 | Item cap per violation list (e.g. 500 per rule in the page model, full count always shown), as docCoverage | Must (done, 0.1.0) | 1 |
| K18 | **Severity per side** (PO 2026-10-30, dmDefine D17): `from` violations (missing links) take `from_severity`, `to` violations (not covered) `to_severity`, default the rule's `severity`; cross-pair and unpaired keep `severity`; summary counts, graph line colour (worst severity found), details, table and Excel follow; the rules table shows both severities | Must (done, 0.3.0; verified on 2512: PO_CHECKS 3.13) | 3 |
| K17 | **Exploded view** (PO 2026-10-30, as dmDefine D16): switch *Collapsed / Exploded*; in the exploded view one box per declared document inside its role frame, coloured by the document's compliance; paired rules drawn per pair and coloured by that pair's compliance (counts per pair), pooled rules from each document to the target role's frame; cross-pair links and unpaired documents highlighted. Same *Initial view* parameter (collapsed by default; the PDF has no graph). As built: a document box shows its items, the share without violation and up to 3 violation lines (rule and check, coloured by severity); a pair arrow counts the missing links of its source document and the targets not covered of its target document; a pooled arrow the missing links of its source document; cross-pair links dotted, with their count per pair; *Show* filters arrows and lines by severity | Should (done, 0.4.0) | 0.4.0 |

## 4. Non-functional requirements

As the sister widgets (10 s budget; target < 2 s). Only the **declared documents** are read (never all the items of a
project). 0.1.0 uses SQL forms verified on 2512 (items of the declared documents; link sources between them as in
docCoverage; links read with `getLinkedWorkItemsStructsDirect()`), evaluated in Velocity; set queries per rule
(`NOT EXISTS` / `NOT IN`, spike T1 = dmSpike S10) can replace parts of it once verified. `isUnresolvable()` guard on
every referenced object. Velocity 1.4-safe. No customer data in the repository.

## 5. Technical approach (preliminary)

- Model read as in dmDefine (shared Velocity snippets and YAML subset parser, `docs/ARCHITECTURE.md` §3). Resolution of
  bindings by SQL on `module`. Rules evaluated in Velocity on SQL results (ARCHITECTURE §4), so the PDF view has them too.
- Per rule one or two SQL queries on `workitem` / `struct_workitem_linkedworkitems` / `module` (as the docCoverage and
  advImpact queries): count, and the list of ids of the violating items (capped).
- Page model: model graph + per-rule counts + capped violation lists; the client renders graph, table, details, exports
  from `shared/js/core.js`.
- Unresolvable link targets are ignored in counts and listed as a data-quality note `[?]`.

## 6. Spikes

| ID | Question |
|---|---|
| T1 | ✅ Run 5 on 2512: `NOT IN` and correlated `NOT EXISTS` accepted, 1–3 ms, same as the reference; run 5b with two links removed: the NOT IN query (inside Lucene `SQL:(…)`) returns the same 2 + 2 items as the reference. Closed: dmCheck 0.2 uses NOT IN. (dmSpike **S10**) SQL set queries for the three v1 checks on a real project: items of a type in a document **without** a link of role R to document D (`NOT EXISTS`/`LEFT JOIN`), items **not** targeted, links between modelled documents matching no rule; accepted by `sqlSearch` on 2512 (and 2612)? Timing on the large project (~20k items) |
| T2 | ~~Documents bound by type / pattern~~ (dropped: documents are declared explicitly, PO); several documents per role: the one `module` query of dmDefine (S5 verified) |
| T3 | ✅ Run 5 on 2512: `queryWorkItems` with `SQL:(…)` holding the set query accepted, same as the reference, also with non-empty results (run 5b): drill-down K9 feasible. (dmSpike **S10**) Drill-down Lucene queries equivalent to each check (K9): `queryWorkItems` with an `SQL:(…)` restriction holding the T1 query |
| T4 | (`test-data/vcycle-check/`, PO_CHECKS 3.x) A **dummy model**: invent a V-cycle model and test data (in the PO's sandbox project) that exercise every rule, with known expected violations; used as the regression set of the harness (`test-data/`) |
| T5 | Behaviour when a viewer cannot read some documents/items (partial visibility): do the counts silently shrink? (open check also in the sister widgets) |

## 7. Open questions (to ask the PO)

1. Counting of items: **Decided (PO, 2026-10-30, as proposed)**: no separate "excluded types" parameter; the model says it: a type with `ignored: true`
   in a role (e.g. heading) is allowed and not counted by the rules; a type not listed in the role is an unexpected
   type (severity `unexpected_types`). A rule end without `type` counts every listed, not ignored type of the role.
2. ~~Several documents in one role~~ **Decided (PO, 2026-10-30)**: both, chosen per rule. By default the documents of a
   role are **pooled** (a link to any document of the target role counts). A rule listed in the local `pairs:` section
   is **paired**: only links between the declared document pairs count, cross-pair links and unpaired documents are
   reported (K15). Use case that raised it: two solution specifications satisfying one customer specification, each
   verified by its own test specification (STD). The workaround without pairs (one role per document) stays valid.
3. Severity and score: **Decided (PO, 2026-10-30, as proposed)**: the severities of the model (error, warning, info); a compliance percentage per rule
   (compliant items / checked items, per side) and per document (items without violation / counted items); the
   graph is red when a rule has errors, orange for warnings only, green when compliant.
4. Storable report: **Decided (PO, 2026-10-30, as proposed)**: a live report plus the Excel export (and PDF export of the page); no snapshot work item
   in v1.
5. ~~Copies and branches~~ **Decided (PO, 2026-10-30)**: only the documents the user declares in the model are checked. A branch or copy is part of the model only if listed. Links from undeclared documents are ignored.

## 8. Increments

PO 2026-10-30: dmCheck is started after dmDefine is completed.


1. **0.1.0** (done) the v1 checks (K3–K5, K15) on verified SQL forms, bindings, report table, Excel, coloured graph, static PDF
   view; dummy model and test structure (T4: `test-data/vcycle-check/`). Spike S10 (T1, T3) run in parallel.
2. **0.2.0** (done) Drill-down queries (K9). **Decided (PO, 2026-10-30)**:
   the evaluation of 0.1.0 is kept (verified on 2512, its timing on the largest project was fine, and it handles pairs,
   cross-pair and unexpected links in one pass); the S10 set queries are used for the drill-down only, and are not run
   by the widget. A faster evaluation through set queries stays possible if a larger project needs it.
3. Later: collection context (K11); orphans, wrong document, field rules.
4. **0.3.0** (done) severity per side (K18). The collection context moves to a later increment.
5. **0.4.0** (done) exploded view (K17), with dmDefine 0.8.0 (D16).
