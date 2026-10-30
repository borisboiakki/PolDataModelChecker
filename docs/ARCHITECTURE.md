# Architecture of the data model widgets (preliminary)

**Status:** preliminary, v0.1, 2026-10-30. Written after the specifications were agreed with the product owner (PO).
Requirements: `widgets/dmDefine/SPECIFICATION.md`, `widgets/dmCheck/SPECIFICATION.md`. Model format:
`docs/DATA_MODEL_FORMAT.md`. Polarion facts verified on 2512 (in the sister repo) are listed in `CLAUDE.md`.
Everything marked **[S…]/[T…]** depends on a spike that has not run yet. The architecture is revised after the spikes.

The widgets follow the same pattern as the sister widgets (docBranches, docCoverage, advImpact). See
`docs/reference/ARCHITECTURE-docwidgets.md` for the parts reused as they are (build, inlining, page model, static view,
client core).

## 1. Overview

```
 Model LiveDoc (any project)                Project being checked
 ┌──────────────────────────────┐           ┌──────────────────────────────────────────┐
 │ work item type "text"        │  uses:    │ Model LiveDoc of the project             │
 │ description = YAML           │◄──────────│ "text" item: YAML  uses + bindings       │
 │   model: roles, types, rules │ (optional)│   (or a complete model + bindings)       │
 └──────────────────────────────┘           └───────────────┬──────────────────────────┘
                                                            │ read (Velocity, server side)
                       ┌────────────────────────────────────┴───────────────────────┐
                       ▼                                                            ▼
        dmDefine (Velocity widget)                                   dmCheck (Velocity widget)
        read → parse → validate → resolve bindings                   read → parse → validate → resolve bindings
        page model: model + problems + bindings                      SQL per rule → violations, counts
        browser: graph, table, exports, editor (copy/paste,          page model: model + results
                 REST save later)                                    browser: coloured graph, report table, Excel,
        PDF: static table of the model                                        drill-down
                                                                     PDF: static summary + violation table
```

The two widgets share the **model pipeline** (§3) through shared Velocity snippets. They do not depend on each other at
run time. Both can sit on the same page or on different pages, and dmCheck can be tested with a hand-written model.

## 2. Surfaces (golden rule: decide before coding)

| Concern | Surface | Why |
|---|---|---|
| Read the model item, parse the YAML, validate, resolve documents | **Velocity** (server) | Needed by the static PDF view and by dmCheck's SQL. No server call is possible from the browser except REST |
| Data of the checks (items, types, links of the declared documents) | **SQL** through `sqlSearch` (Velocity) | Set queries, fast, scoped to the declared documents (verified pattern of docCoverage/advImpact) |
| Evaluation of the rules | **Velocity**, on the SQL results | Single implementation, used by both the browser and PDF views (guide §11.5.10: compute once on the server) |
| Graph, table, filters, Excel/SVG export, YAML editor | **Browser JS** (`shared/js/core.js` + widget `graph.js`) | Interactive, no reload |
| Drill-down | **Lucene** query strings built in Velocity, opened in Polarion's table view | Native bulk correction [T3] |
| Write the model back (dmDefine 0.3) | **REST** from the browser (`X-Polarion-REST-Token` from `top.getRestApiToken()`, guide §8.2) | Optional: it needs the admin property `com.siemens.polarion.rest.security.restApiToken.enabled=true` and REST endpoint permissions. Copy/paste always stays available [S4] |
| Polarion Scripting, Java | not used | Admin-deployable widgets only |

### Change against the specification draft

The dmDefine spec draft recommended parsing the YAML **in the browser**. That fails for dmCheck: its results must be
computed on the server, because the PDF export runs no JavaScript and a widget cannot call the server back (no partial
refresh, guide §11.7). Parsing in the browser would mean a second parser in Velocity anyway. The decision is therefore
**one parser, in Velocity**, shared by both widgets. It writes the parsed model to the page model, and the browser
never parses YAML. The in-widget editor (dmDefine 0.2) edits the structured model and **serializes** it to YAML in JS,
which is simpler than parsing. The specs are updated accordingly.

## 3. The model pipeline (shared by both widgets)

```
 parameters ─► locate model item ─► description HTML ─► text lines ─► YAML subset parser ─► tree
            ─► uses: merge (one level) ─► schema validation ─► config validation ─► binding resolution
            ─► $dmModel (normalized lists/maps) + $dmProblems (severity, line, message)
```

Shared snippets, inlined at build time (`## BW_SHARED <file>`), each with its own `dm` prefix:

| Snippet | Role |
|---|---|
| `shared/vm/dm-params.vm` | Parameter reading common to both widgets (§3.1) |
| `shared/vm/dm-locate.vm` | Finds the model item and reads its description (§3.2) |
| `shared/vm/dm-yaml.vm` | HTML → lines, YAML subset parser → tree of `newMap()` / lists (§3.3) |
| `shared/vm/dm-model.vm` | `uses:` merge, schema and configuration validation, normalization (§3.4, §3.5) |
| `shared/vm/dm-bind.vm` | Resolves each role's declared documents to `IModule`s, keys `project/space/name` (§3.6) |
| `shared/vm/dm-pagemodel.vm` | Writes the model and problems as hidden `<i>` elements (§5) |
| existing `style.vm`, `common.vm` | Reused; `bwKey`, `bwOptionIds` and the project helpers as they are |

### 3.1 Parameters (both widgets)

| Parameter | Kind | Notes |
|---|---|---|
| Model document | `@document` single select | Current project only (verified limitation, guide §2.1) |
| Model item type | `workitem-type` selector, default `text` | Single value [S2: is `.value("text")` accepted on a single select? Otherwise multi with `values(["text"])`, verified] |
| Model item id | text, optional | `ID`: picks one item when the document holds several items of the type |
| Static view details | boolean | PDF: full lists or summary only |

dmCheck adds: severities shown by default, list cap per rule (default 500), excluded item types (existing shared
selector, default `heading`, see dmCheck spec Q1).

### 3.2 Locating and reading the model item [S1, S2]

1. Document from the `@document` option: `getModelObject()`, `isUnresolvable()` check. Its items in document order:
   `items().contained()` (guide §2.1).
2. Candidates = items of the model item type. If an id is given, take that one. Otherwise take the first whose text
   starts with `model:` or `uses:`. None or several → a problem is reported and nothing is checked.
3. The description is read as HTML [S1: Rendering API `fields().description()` vs. Open API
   `getDescription().getContent()`; how the rich text editor stores a pasted YAML block: paragraphs, `<br>`, `<pre>`,
   `&nbsp;`, entities, leading spaces].
4. The item's id, project, revision and a link to open it go to the page model (D11) [S2: revision accessor].

### 3.3 YAML subset parser in Velocity 1.4 [S3]

The model uses a **YAML subset**, documented in `DATA_MODEL_FORMAT.md` and valid YAML, so external tools can read it:
block maps and lists indented with spaces, plain/single/double-quoted scalars, one-level flow lists `[a, b]` and flow
maps `{k: v}` of scalars, `#` comments, and `null`/`true`/`false`/integers. There are no anchors, multi-line scalars,
tabs or nested flow collections. These are rejected with a line number.

Design:
- **HTML → lines**: replace the block ends (`</p>`, `<br>`, `</div>`, `</li>`) with a line marker, remove the other
  tags, decode the entities (`&nbsp;` → space, `&amp; &lt; &gt; &quot; &#39;`), and split on the marker. Inside `<pre>`, split
  on the newline character. Velocity 1.4 forbids backslashes in string literals, so regexes that need one are built at
  run time from `$esc.b`, and the comment sign from `$esc.h` [S3: both EscapeTool getters on the instance].
- **Start of the model**: lines before the first top-level model key (`version:`, `name:`, `model:`, `uses:`,
  `bindings:` at column 0) are skipped and counted, so a title or explanation above the YAML (or above a code block)
  is allowed.
- Checked locally with velocity-1.4.jar (2026-10-30): a newline cannot be written in a string literal (lexical error),
  so the newline regex must come from `$esc.b`; `"#"` and `'#'` are accepted in string literals; `$list.remove($i)`
  with an Integer removes by index; ranges `[1..$n]` work. The prototype parser is in the spike widget
  (`tests/dmSpike-v0.1.x/`), with 48 harness checks on mocks.
- **Tokens**: each non-empty line gives `[lineNo, indent, isListItem, key, value]`. The indent is computed with Integer
  arithmetic (`length()` before and after `replaceAll("^ +", "")`). Tuples are stored as lists, because Java arrays
  have no methods in Velocity 1.4.
- **Tree**: a stack-based builder (lists used as stacks) produces `$objectFactory.newMap()` and lists. It has no
  recursion (`#macro` recursion is fragile in 1.4). Every node remembers its line number for messages.
- Every problem is collected as `[severity, line, message]`. The parser never stops the page: the widget shows the
  problems instead of failing.
- Size: a model is expected to be a few hundred lines, so the cost is negligible next to the SQL.

Fallback if S3 fails (e.g. the description markup is too unpredictable): require the YAML inside a `<pre>`/code block
of the description, or switch to JSON (simpler to tokenize). Either is a PO decision, recorded in the spec.

### 3.4 Reuse across projects: `uses:` (PO 2026-10-30: the model must be reusable)

A model has two parts with different scopes:
- **`model`**: roles, item types, link rules. Project-neutral and reusable.
- **`bindings`**: role → explicit list of documents. Always local to the checked project (PO: the user declares the
  documents).

Reuse mechanisms, in order of increments:
1. **Copy or branch the model LiveDoc** to the other project (native Polarion, no code). The copy is then edited:
   bindings always, rules if needed. This works from 0.1.0. Changes to the original are not propagated except through
   Polarion's own branch merge.
2. **Reference** (planned for 0.2.0, the YAML split is designed for it from 0.1.0): the local item holds
   `uses: "PROJ/WI-123"` plus its own `bindings:`. The referenced item is read with
   `$trackerService.getWorkItem(projectId, id)` (guide §12.1 pattern) and its `model` part is used. Only one level is
   allowed: a referenced item that itself `uses` another is an error. Its `bindings` are ignored. Local `model` keys are
   not allowed in v0.2 (no override semantics yet). Optional pinning `PROJ/WI-123@revision` later, with the read API
   to spike [S8].
   The referenced model is validated against the **checked project's** configuration, since its types and roles must
   exist there.

### 3.5 Validation

| Level | Checks | Where |
|---|---|---|
| Syntax | subset grammar, indentation, duplicate keys | parser |
| Schema | known keys (unknown = warning), value types, severities, `model:` version | `dm-model.vm` |
| References | roles used by rules exist, rule ids unique | `dm-model.vm` |
| Configuration | item types and link roles exist in the checked project (`getWorkItemLinkRoleEnum()` verified; types: [S6]) | `dm-model.vm` |
| Bindings | every declared document resolves; a document declared in two roles is a warning | `dm-bind.vm` |

dmCheck runs the checks only when there is no **error**. Warnings are shown and the checks still run.

### 3.6 Binding resolution [S5]

Declared document = `space/name` (current project) or `project/space/name`. One SQL query on `module` for all declared
documents (join `project`, filter on `c_moduleFolder` and `c_moduleName` per project), keyed by `bwKey`. Branches and
copies are included only when declared (PO). An unresolvable or not found document is a problem, and its role is
checked on the documents found.

## 4. dmCheck: data and evaluation [T1, T2]

Inputs: the normalized model, the module URIs per role, and the excluded types. Every query is restricted to the
**declared documents**, never to the whole project.

| Check | Data (SQL) | Evaluation |
|---|---|---|
| Required item types / unexpected types | `GROUP BY` module and `c_type` with counts (verified to be accepted), plus the ids of unexpected-type items (capped) | Velocity, per role and document |
| Required links `from_min` | items of the `from` documents and type with fewer than `from_min` links of `role` to items of the `to` documents and type | preferred: one query per rule with a correlated sub-select or `NOT EXISTS` [T1: accepted by `sqlSearch`?]. Fallback: `GROUP BY … HAVING` on the links (verified) and set difference in Velocity over the items of those documents (bounded, as docCoverage coverage) |
| Required links `to_min` (coverage) | same, mirrored (items targeted) | as above |
| Unexpected links | links of the roles used by the model whose source and target are both in declared documents (one query, as the docCoverage link query) | Velocity: each link is classified against the rules (role, source role and type, target role and type). No match → violation. Roles the model never mentions are ignored. Links to undeclared documents are ignored (PO) |

Outputs per rule: a counter (checked items, compliant items) and the violation list (`item id`, document key, type,
message), capped at the "list cap" with the full count kept (as docCoverage `uncCap`). Unresolvable link targets are
skipped and counted as a data-quality note.

Drill-down [T3]: per rule, a Lucene string `project.id:P AND document.id:"…" AND type:T AND SQL:(…)` (forms verified in
advImpact's spike: `document.id` and `SQL:(…)` restrictions), opened as a Polarion work item query URL.

Performance target: < 2 s for ~100 documents / 20 000 items (sizing of the sister repo). Number of queries ≈ 2 + 2 per
link rule. Chunk `IN` lists at 500 ids (guide §11.5.9).

## 5. Page model (contract between Velocity and JS)

As in the sister widgets: a root element with `data-*` settings, a hidden model `<div>` with one `<i>` per object,
values escaped with `$esc.html`, separators replaced inside values, caps with warnings (guide §11.5.8).

| Element | Attributes | Widgets |
|---|---|---|
| root `dd-root` / `dc-root` | `data-project`, `data-version`, `data-height`, `data-model-item` (`project/id`), `data-model-rev`, `data-model-uses` | both |
| `dm-r` (role) | `data-k` (role key), `data-title`, `data-types` (`type:min:max:flags;…`), `data-unexp` (severity), `data-docs` (bound keys `;`), `data-miss` (declared but not found) | both |
| `dm-l` (link rule) | `data-id`, `data-from`, `data-ft`, `data-role`, `data-to`, `data-tt`, `data-fmin`, `data-tmin`, `data-sev`, `data-other` | both |
| `dm-p` (problem) | `data-sev`, `data-line`, `data-msg` | both |
| `dm-y` | `data-text`: the model text as lines (for display and the editor) | dmDefine |
| `dm-c` (rule result) | `data-id` (rule id or `types:<role>`), `data-kind`, `data-n` (checked), `data-ok`, `data-vn` (full count), `data-v` (`id|docKey|type|msg;…` capped), `data-q` (drill-down query) | dmCheck |
| `dm-d` (document) | `data-k`, `data-role`, `data-title`, `data-items`, counts per type | dmCheck |

Any field added must be changed on both sides (Velocity output and `readModel` in the widget's `graph.js`) and in the
harness checks.

## 6. Client side

`shared/js/core.js` is reused unchanged at first: layered layout, SVG drawing, toolbar, tooltip, zoom, table, SVG/Excel/CSV
export. Widget code:
- **dmDefine `graph.js`**: nodes = roles (title, types), edges = link rules (role, `from_min`/`to_min`); bindings panel;
  problems panel with line numbers next to the model text; Excel sheets Roles, Types, Rules, Bindings, Problems.
  From 0.2: starter generator (data from Velocity: item types per declared document and observed link roles), editor
  forms on the structured model, YAML serializer and **Copy** button. From 0.3: **Save to Polarion** through REST, shown
  only after a successful probe call (token available, endpoint reachable, permission), with copy/paste as fallback.
- **dmCheck `graph.js`**: same graph, coloured by compliance (green = all compliant, orange = warnings only, red =
  errors; counts on edges and nodes); a click lists the violations; a report table filtered by severity, rule and
  document; Excel sheets Summary, Item types, Required links, Unexpected links, Model.

Constraints of the inlined JS (enforced by the build): no `$`, `#`, backslash or non-ASCII character (`HASH`,
`String.fromCharCode`). The YAML serializer must respect them, and `#` comments are produced from `HASH`. Toolbar
choices use buttons or checkboxes, not `<select>` (guide §11.7).

## 7. Static view (PDF / print)

No JavaScript. dmDefine prints the table of roles, types, rules, bindings and problems. dmCheck prints the summary per
rule, the violation table (full or summary depending on the parameter) and a static SVG of the model graph with
integer geometry, as the sister widgets do.

## 8. Build, tests, packaging

- `tools/build-widget.py` (copied) builds each `widgets/<w>/` into `dist/<w>/` and `<w>.zip`, inlines `shared/vm/*`
  and the JS, and checks with Velocity 1.4. Entry names ≤ 30, ≤ 30 entries.
- `tools/vtest/<w>/` gets a harness on the copied mocks (`tools/vtest/mocks/`), extended with:
  a model item whose description is HTML (variants observed in S1), a second project with a referenced model (`uses:`),
  and declared documents with known items and links.
- **Test data** (`test-data/`): an invented V-cycle model (`vcycle-model.yaml`) and a structure with known expected
  violations, covering every rule kind. It is the regression set for dmCheck (PO C9). A parser test runs the
  `dm-yaml.vm` snippet on fixture YAML files (valid and invalid) and compares the tree with an expected JSON.
- `tools/test-widget.sh` and the CI workflow are adapted from the sister repo with the first widget.

## 9. Spikes before implementation

One diagnostic widget, `dmSpike` (`tests/dmSpike-v0.1.x/`, run sheet in its `spike-tests.md`), covers the dmDefine
spikes S1–S6 and S8. The checks have their own
spike after dmDefine 0.1.0.

| ID | Question | Blocks |
|---|---|---|
| S1 | Description HTML of a `text` item holding a pasted YAML block (plain paste, `<pre>`/code formatting); Rendering vs Open API access | §3.2, §3.3 |
| S2 | Locate the item: `items().contained()` on the `@document` option, type filter, id parameter; revision accessor; single-select `workitem-type` default | §3.1, §3.2 |
| S3 | `$esc.b` / `$esc.h` available; `replaceAll`/`split` with run-time regexes; stack builder with `newMap()` and `remove(size-1)` on lists; timing on a 300-line model | §3.3 |
| S4 | REST from the widget: `top.getRestApiToken()` present, property enabled, GET then PATCH of the description (format `text/html`), 401/403 handling | dmDefine 0.3 |
| S5 | SQL on `module` for a list of `space/name` (and `project/space/name`) | §3.6 |
| S6 | Project work item types with name (Open API enum of the tracker project, as the link roles) | §3.5 |
| S7 | Starter generator data (types per document, observed roles between documents) | dmDefine 0.2 |
| S8 | Read a work item of another project (`getWorkItem`), at a given revision | §3.4 |
| T1–T3 | Correlated sub-select / `NOT EXISTS` in `sqlSearch`, binding queries, drill-down Lucene | §4 |

All spikes run on 2512 first. **2612 compatibility is unverified** until the PO repeats the key spikes (S1, S3, S4,
T1) there.

## 10. Increments

| Version | dmDefine | dmCheck |
|---|---|---|
| 0.1.0 | Pipeline §3 (without `uses:`), graph, table, bindings, problems, exports, PDF | — (spike T1–T3 on the dummy model) |
| 0.2.0 | `uses:` reference, starter generator, editor + Copy | 0.1.0: three v1 checks, report, Excel, coloured graph, PDF |
| 0.3.0 | REST save (if S4 positive), cross-project bindings | drill-down, cross-project documents |
| later | — | collection context, orphans, wrong document, field rules |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Rich-text editor alters the YAML (spaces, quotes, line breaks) | S1 first; accept a `<pre>`/code block; Copy button output already in the right form; problems with line numbers |
| Velocity 1.4 parser bugs or limits | Small grammar, fixtures test in the harness with velocity-1.4.jar, parser isolated in one snippet |
| SQL forms not accepted (correlated sub-select) | Verified fallback: `GROUP BY … HAVING` + set difference in Velocity on the declared documents |
| REST disabled on the instance | Write-back optional, probe before showing the button, copy/paste always there |
| Model reused in a project whose configuration differs | Validation against the checked project's configuration; clear problems |
| 2612 changes (SQL columns, rendering API) | Public APIs only; repeat key spikes on 2612; unverified items marked as such |
| Shared code drift with the sister repo | Snapshot noted in `CLAUDE.md`; port fixes deliberately |
