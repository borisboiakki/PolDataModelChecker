# Specification — Data model check widget (dmCheck)

**Status:** v0.1 draft, 2026-10-30, written with the product owner (PO) from the kick-off Q&A. Nothing is implemented or
verified yet. Items marked `[?]` are open or need verification on a Polarion instance.

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

## 3. Functional requirements (proposal)

| ID | Requirement | Priority | Increment |
|---|---|---|---|
| K1 | Parameters: same model location as dmDefine (model LiveDoc, item type), projects/collection scope, severities shown | Must | 1 |
| K2 | **Resolve the bindings**: roles → real documents; report unbound roles and documents bound to no role (information) | Must | 1 |
| K3 | **Required item types**: for each role, required types present (min/max); unexpected types reported with the severity of the model | Must | 1 |
| K4 | **Required links**: for each link rule, `from` items without the required link (`from_min`) and `to` items not targeted (`to_min`), counting only links of the role between the bound documents | Must | 1 |
| K5 | **Forbidden/unexpected links**: links of a role used by the model between modelled documents that match no rule (wrong target document/type, wrong direction) | Must | 1 |
| K6 | **Report table**: one row per violation with rule id, severity, check kind, document, work item (clickable link), message; filter by severity/rule/document | Must | 1 |
| K7 | **Excel export**: Summary sheet (counts per rule, % compliant), one sheet per check kind, model used (revision) | Must | 1 |
| K8 | **Graph**: model documents as nodes, link rules as edges, coloured green/orange/red with counts (compliant items / total); click an edge or node to list its violations | Must | 1 |
| K9 | **Drill-down**: each rule offers a Lucene query (and link) listing the violating items in Polarion's table view for bulk correction `[?]` how to express "items without a link of role R to document D" in Lucene on 2512 and 2612 (`linkedWorkItemsOf` follows incoming links only; SQL: `SQL:(…)` restriction) | Should | 1 or 2 |
| K10 | PDF/print static view: summary + violation table + static graph, no JS | Must | 1 |
| K11 | Collection context (check the model on the documents of a collection at the pinned revisions), as docCoverage F17 | Could | 3 |
| K12 | Cross-project documents in bindings | Should | 2 |
| K13 | Later checks: orphan items (no link at all), items in the wrong document, mandatory fields / statuses, max cardinality | Could | later |
| K14 | Item cap per violation list (e.g. 500 per rule in the page model, full count always shown), as docCoverage | Must | 1 |

## 4. Non-functional requirements

As the sister widgets (10 s budget; target < 2 s). Plan the checks as **SQL set queries per rule** (items of a document
and type with/without a link of a role to a document), not item-by-item loops in Velocity. `isUnresolvable()` guard on
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
| T1 | SQL set queries for the three v1 checks on a real project: items of a type in a document **without** a link of role R to document D (`NOT EXISTS`/`LEFT JOIN`), items **not** targeted, links between modelled documents matching no rule; accepted by `sqlSearch` on 2512 (and 2612)? Timing on the large project (~20k items) |
| T2 | Documents bound by type / pattern / several documents per role: SQL form and result sizes |
| T3 | Drill-down Lucene queries equivalent to each check (K9) |
| T4 | A **dummy model**: invent a V-cycle model and test data (in the PO's sandbox project) that exercise every rule, with known expected violations; used as the regression set of the harness (`test-data/`) |
| T5 | Behaviour when a viewer cannot read some documents/items (partial visibility): do the counts silently shrink? (open check also in the sister widgets) |

## 7. Open questions (to ask the PO)

1. Counting of items: ignore headings and other types as in docCoverage (excluded types parameter), and do `ignored: true` types in the model take that role?
2. When several documents fill one role (e.g. subsystem specs), is a `from_min` link required to a document of the target role as a whole or to the sibling document of the same subsystem?
3. Severity vocabulary (error/warning/info) and a compliance score per document: wanted?
4. Should the report be storable (snapshot as a work item or a document) or is a live report enough?
5. ~~Copies and branches~~ **Decided (PO, 2026-10-30)**: only the documents the user declares in the model are checked. A branch or copy is part of the model only if listed. Links from undeclared documents are ignored.

## 8. Increments

1. **0.1.0** Spike T1/T2/T4, then bindings, the three v1 checks, table, Excel, graph, static PDF view.
2. **0.2.0** Drill-down queries, cross-project documents.
3. **0.3.0** Collection context; later: orphans, wrong document, field rules.
