# Specification — Data model definition widget (dmDefine)

**Status:** v0.2, 2026-10-30. Spike dmSpike runs 1–2 done on 2512 (`tests/dmSpike-v0.1.x/spike-tests.md`). Widget
**0.1.0 implemented** (`widgets/dmDefine/src`: D1–D7, D11), tested with Velocity 1.4 on mocks and in Chromium; open checks
on the instance in §9. Items marked `[?]` are open or need verification on a Polarion instance.

## 1. Goal

A Velocity LiveReport widget that lets a key user or project admin **formalize the project data model**: the main
LiveDocs of the project, the work item types each must contain, and how those items must be linked to items of the
other main documents (the V-cycle: system specification ← subsystem requirements via `satisfies`, …).
The model is stored in Polarion (SPEC §6) and read by **dmCheck** (`widgets/dmCheck/`). Format: `docs/DATA_MODEL_FORMAT.md`.

## 2. Context and constraints

| ID | Constraint | Source |
|---|---|---|
| C1 | Target **Polarion 2512**, compatible with **2612** | PO |
| C2 | Deployable by an admin as a Velocity widget zip, no server-side component | PO |
| C3 | Developed incrementally; this widget and dmCheck are two separate widgets sharing the model format | PO |
| C4 | Model stored as **YAML** in the description of a work item (type configurable, default a text-like item) of a **dedicated LiveDoc** | PO |
| C5 | Documents referred to by **logical role + binding** | PO |
| C6 | One project, optional cross-project documents | PO |
| C7 | Editing: copy/paste into the work item first; REST write-back later, always with the manual fallback | PO |
| C8 | Same workflow and Polarion knowledge as the sister repo: spec → architecture → spikes → code | PO |

## 3. Functional requirements

| ID | Requirement | Priority | Increment |
|---|---|---|---|
| D1 | Parameters: model LiveDoc (`@document`, single), model work item type (`workitem-type`, multi with `text` preselected: verified preselection form), optional model item id, graph height | Must (done) | 1 |
| D2 | Read the YAML from the description of the model item(s) and parse it | Must (done) | 1 |
| D3 | **Validate** the model: syntax (YAML), schema (keys, types, severities), references (every role used in a rule is defined; link roles and item types exist in the project configuration; documents of each binding resolve). Show the problems with line numbers | Must (done) | 1 |
| D4 | **Graph** of the model: documents (roles) as boxes with their item types, link rules as arrows labelled with the link role, cardinalities in the tooltip and details (client-side SVG from `shared/js/core.js`) | Must (done) | 1 |
| D5 | **Table** of the model: documents, types, link rules; bound real documents per role | Must (done) | 1 |
| D6 | **Bindings view**: for each role, the real documents it resolves to (or "not found") | Must (done) | 1 |
| D7 | Excel and SVG export of the model; PDF/print static view | Should (done) | 1 |
| D8 | **Starter generator**: propose a model skeleton from the real data (documents, item types per document, observed link roles between documents, as in docCoverage), to be corrected by the user and pasted into the model item | Should | 2 |
| D9 | **In-widget editor** (forms or graph edits) producing the YAML text, with a Copy button to paste it into the model item | Should | 2 |
| D10 | **REST write-back**: "Save to Polarion" updates the description of the model item from the browser; hidden when the REST API is unreachable | Could | 3 (after spike S4) |
| D11 | Show the revision of the model LiveDoc / item used; link to open the model item for editing | Should (done: item revision from `getLastRevision()`) | 1 |
| D12 | Cross-project documents in bindings (`project/space/document`) | Should (form accepted by 0.1.0, not verified on 2512) | 2 |
| D13 | **Model text** view with line numbers (problem lines marked, a click on a problem shows its line) and **Copy YAML** (copies the text, e.g. to reuse the model in another project) | Should (done) | 1 |

## 4. Non-functional requirements

As the sister widgets: render within the 10 s budget, SQL scoped to the project, `isUnresolvable()` guard on every
referenced object, Velocity 1.4-safe templates, PDF/print without JS, no customer data in the repo.

## 5. Technical approach (preliminary, to challenge in `docs/ARCHITECTURE.md`)

- Reuse `shared/` (style, params, common macros, `core.js` graph/table/export, `xlsx.js`) and the build/test tooling.
- **Superseded by decision 7 (§7) and `docs/ARCHITECTURE.md` §3.3: one YAML subset parser in Velocity.** Original
  analysis kept for the record: **YAML parsing** is the key risk. Options: (a) parse in the browser with a small embedded YAML subset parser in
  `core.js`/`graph.js` (Velocity only extracts the text and puts it in the page model; no `$`/`#`/backslash allowed in
  the JS, the YAML parser must respect that); (b) parse in Velocity (poor fit: Velocity 1.4); (c) JSON instead of YAML
  (PO prefers YAML for readability). Recommendation: (a), with a YAML **subset** documented in `DATA_MODEL_FORMAT.md`
  (maps, lists, scalars, flow `{}`/`[]`, comments), and a clear error report. Both widgets then share the parser, which
  the build inlines in each.
- Server side only fetches: the model item description (rendered text), the project's link roles / types, the real
  documents for the bindings (SQL as in the sister widgets). Validation against the real configuration can run
  client-side on the page model.
- A server-side parse is not needed in v1 unless the spike shows a client-side parse is not possible in PDF mode (static
  view): then the static view shows the table from a Velocity-side pre-parsed structure or notes that the graph is
  interactive only `[?]`.

## 6. Spikes (to run on 2512, then 2612 when available)

| ID | Question |
|---|---|
| S1 | How is the **description** of a work item read in Velocity (`$workItem.fields().description()`, `.render()`/`.asPlainText()`, Open API `getDescription()`), and what HTML does a YAML block produce in the rich-text editor (paragraphs, `<pre>`, `<code>`, `&nbsp;`, quotes, indentation)? Is a code block / macro the most robust container? |
| S2 | Find the model item robustly: by document (`@document`), type, title/id; SQL vs `queryWorkItems`; several items in one document read in order |
| S3 | YAML subset parser in **Velocity 1.4**: `$esc.b`/`$esc.h`, run-time regexes, stack builder with `newMap()`; round trip on the real description text (ARCHITECTURE §3.3) |
| S4 | **REST write-back**: can the widget (browser, user session) call the Polarion REST API (`/polarion/rest/v1/...`) to PATCH the description? Auth/CSRF, CORS, permission handling, rich text format of the PATCH, behaviour under 2512 and 2612, and detection when REST is disabled |
| S5 | Document binding: by `space/name`, document type, name pattern, custom document field; what is available in SQL (`MODULE` columns) |
| S6 | Validation sources: reading the project's work item types, link roles (name, opposite name), custom document types from the project configuration |
| S7 | Starter generator data: item types per document, observed link roles between documents (reuse docCoverage queries), timing on a large project |
| S8 | Read a work item of another project (`$trackerService.getWorkItem`), optionally at a revision (`uses:` reference) |

## 7. Decisions and open questions

Decided by the PO (2026-10-30):

1. **One work item holds the whole model**, in a dedicated LiveDoc (so baselines of the LiveDoc version the model). No merging of several items.
2. The model item has the Polarion type **`text`**; the type stays a widget parameter.
3. **No constraint for now** on who creates or modifies the model (no permission or workflow rules in v1).
4. **The user declares explicitly the documents** that belong to the data model. Branches and copies are considered
   only if the user lists them as part of the model; they are never added automatically. Consequence: bindings are
   explicit document lists per role. Binding by document type or name pattern is dropped from v1 (S5 reduced to
   "resolve explicit documents, same project or `project/space/document`").

5. **The model must be reusable** across projects (PO, 2026-10-30). The YAML separates the project-neutral `model`
   (roles, types, rules) from the local `bindings` (documents). Reuse: copy/branch the model LiveDoc (works from 0.1.0),
   then a `uses: "PROJ/WI-ID"` reference with local bindings (0.2.0). See `docs/ARCHITECTURE.md` §3.4.
6. **dmDefine is usable on its own** as read-only documentation of the data model (PO, 2026-10-30).
7. **YAML is parsed in Velocity, not in the browser** (architecture, 2026-10-30): dmCheck must compute on the server
   (PDF export has no JavaScript, no server call from the browser), so one Velocity parser is shared by both widgets.
   The browser only serializes YAML (editor). Replaces option (a) of §5.

## 8. Increments

1. **0.1.0** read + validate + show: parameters, YAML read (spike S1–S3), validation, graph + table + bindings. No editing.
   Reuse by copying/branching the model LiveDoc.
2. **0.2.0** `uses:` reference, starter generator and in-widget editor with copy/paste output.
3. **0.3.0** REST write-back (if S4 is positive), cross-project bindings.

## 9. Open checks for 0.1.0 on 2512

Only verifiable on the instance (the harness uses mocks):

a. Upload of `dmDefine.zip` (entries ≤ 30 characters: `dmDefine/resources/xlsx.js` = 26) and the widget icon.
b. Model document selector and default type `text`; the model item found without the id parameter (the model text
   starts with comment lines in the sample).
c. The sample model (`test-data/vcycle-model.yaml`, names adapted to the project) shows no problem; the graph, details,
   *Model text* (line numbers equal to the editor's lines), table, Excel and SVG export.
d. A model with mistakes (unknown type or link role, missing document, wrong indentation) lists the problems with the
   right lines.
e. PDF export: problems, roles and rules tables.
f. Optional: a binding to a document of another project (`project/space/name`).
