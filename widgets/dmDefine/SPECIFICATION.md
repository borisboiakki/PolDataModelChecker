# Specification — Data model definition widget (dmDefine)

**Status:** v0.2, 2026-10-30. Spike dmSpike runs 1–2 done on 2512 (`tests/dmSpike-v0.1.x/spike-tests.md`). Widget
**0.1.0 implemented** (`widgets/dmDefine/src`: D1–D7, D11, D13), **0.2.0** adds the pairs (D14), **0.3.0** the editor (D9), **0.4.0** `uses:` and documents of other projects (D15, D12), **0.5.0** *Save to Polarion* (D10); tested with Velocity 1.4 on mocks and in Chromium; open checks
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
| D9 | **In-widget editor** producing the YAML text to copy into the model item (details and decisions: §7.8, PO 2026-10-30): a **form editor** (general settings, roles with their item types, link rules, documents per role, pairs) whose lists come from the project configuration and the project's documents, and a **YAML text editor**; *Copy* and *Download* of the generated YAML; start from an empty model when the project has none | Should (done, 0.3.0) | 0.3.0 |
| D10 | **REST write-back**: *Save to Polarion* in the editor's YAML text tab writes the text into the description of the model work item (PATCH, verified call of dmSpike S4); shown only when the session REST token exists and a GET of the model item answers 200; re-reads the item before saving (warning when it changed since the page was loaded), confirms, reads it back after saving; explains 401/403/404/409; a widget parameter switches it off; copy and paste always available. Only an existing model item (a new model is pasted into a new Text item first) | Could (done, 0.5.0) | 0.5.0 |
| D11 | Show the revision of the model LiveDoc / item used; link to open the model item for editing | Should (done: item revision from `getLastRevision()`) | 1 |
| D12 | Cross-project documents in bindings (`project/space/document`) | Should (done, 0.4.0: resolved and tested on mocks; check on 2512 pending) | 0.4.0 |
| D15 | **`uses:` reference** (decision 5, ARCHITECTURE §3.4): roles and rules from a model item of another (or the same) project, bindings and pairs local; one level; shown in the header with the revision and a link; editor in a "local part" mode (roles and rules read only) | Should (done, 0.4.0) | 0.4.0 |
| D14 | **Pairs** (`pairs:` section, dmCheck K15): validate it (the rule id exists; each pair is `[source document, target document]`; the source document is declared for the rule's `from` role and the target for its `to` role) and show it (rule details, table, Excel). Documents of the two roles in no pair: warning | Should (done, 0.2.0) | 2 |
| D13 | **Model text** view with line numbers (problem lines marked, a click on a problem shows its line) and **Copy YAML** (copies the text, e.g. to reuse the model in another project) | Should (done) | 1 |
| D16 | **Exploded view** of the graph (PO 2026-10-30, decision 9): a switch *Collapsed / Exploded*. Collapsed = today's graph (one box per role, one arrow per rule). Exploded = one box per declared document inside a frame per role; **paired** rules drawn document to document (one arrow per pair); **pooled** rules drawn from each document of the `from` role to the **frame** of the `to` role ("any document of this role"), not one arrow per document combination; pair problems (documents of the rule's roles in no pair, pairs naming undeclared documents) outlined in orange. Shown when a role has more than one document. Parameter *Initial view* (collapsed by default) also chooses the static PDF graph. Table and Excel unchanged (the *Document pairs* sheet already lists the pairs) | Should | later (after the starter generator) |

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
| S5 | ✅ Done on 2512 (runs 1 and 3b): one `module` query resolves `name`, `space/name` and `project/space/name`; a missing document is reported. Document binding: by `space/name`, document type, name pattern, custom document field; what is available in SQL (`MODULE` columns) |
| S6 | Validation sources: reading the project's work item types, link roles (name, opposite name), custom document types from the project configuration |
| S7 | ✅ Run 4 on 2512 (2026-10-30): 151 documents; A and B accepted, same 281 document/type pairs and 781 link combinations as the full scan; full scan 650 ms, A 108 ms, B 80 ms; `searchInstancesCount` not available; tables identical; starter YAML shown by dmDefine. Closed: variant B for D8. **Starter generator data** (test S7 of dmSpike, run 4): types per document and link combinations (source document and type, role, target document and type) without looping over all items: variant A `SELECT MIN(c_uri) … GROUP BY` (representatives whose links are scanned), B the nested form, C full scan as reference; Lucene count method (`searchInstancesCount`); timing on the largest project; proposed starter model (one role per document, one rule per combination, read by dmDefine with no problem on mocks) |
| S9 | ✅ **Done on 2512 (run 3, 2026-10-30)**: typing, Enter, Ctrl+C/V not blocked, `<select>` events, both copy methods and the download work; Backspace, Ctrl+Z work; Tab moves the focus to the next control (browser default). **Editor controls in a Polarion page** (browser only): typing in a `textarea` and an `input` (spaces, Tab, Enter, Backspace, Ctrl+Z not taken by Polarion), a `<select>` not wrapped in a `<label>` (guide §11.7: one wrapped in a label did not react on 2512), `navigator.clipboard.writeText` and the `execCommand('copy')` fallback, download of a generated file. The editor does not depend on the `<select>` result (it uses button pickers, verified pattern) |
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

8. **In-widget editor (D9)**, PO 2026-10-30:
   - **Forms + text**: a form editor and a YAML text editor. The forms start from the model read by the server (the
     path maps of `dm-yaml.vm`, written to the page model: no second YAML parser in the browser) and regenerate the
     YAML; the text editor shows the generated (or current) YAML, editable, to copy. Text edits are not read back into
     the forms (that would need a browser parser): the editor says so.
   - **Comments**: the comment lines above the first key (title, explanations) and the `description:` fields are kept;
     comments inside the model and unknown keys are dropped when the forms regenerate the YAML, after a warning that
     names them. The text editor keeps everything.
   - **Documents**: chosen in a search-and-pick list of the current project's documents (one SQL query on the modules,
     capped); documents of other projects can be typed as `project/space/name`.
   - **Start from an empty model** when the model document has no model item, or no model document is selected: the
     forms open on an empty model, to be copied into a new `text` work item.
   - **A model with errors**: the forms are not offered (they would silently drop what the parser could not read); the
     text editor is, with the problems listed (PO did not choose "edit a model with errors" in the forms).
   - Pickers are buttons with a search-and-pick panel (guide §11.7), not `<select>` elements.
   - Client-side checks in the forms (required fields, role keys unique and made of letters, digits, `_` and `-`, whole
     numbers, references to existing roles / rules); the full validation runs again when the pasted model is read.

9. **Exploded view (D16)**, PO 2026-10-30, proposals accepted: role frames holding their documents; pooled rules
   point to the target role's frame, paired rules document to document; switch offered whenever a role has several
   documents (not only with `pairs:`); pair warnings outlined in orange; collapsed by default, parameter *Initial view*
   also used by the PDF; table/Excel unchanged. dmCheck gets the same switch later (dmCheck K17: pair arrows coloured
   by compliance). Not implemented yet.

## 8. Increments

PO 2026-10-30: dmDefine is completed before dmCheck is started.

1. **0.1.0** (done) read + validate + show: parameters, YAML read (spike S1–S3), validation, graph + table + documents,
   model text, Copy YAML. Reuse by copying/branching the model LiveDoc.
2. **0.2.0** (done) pairs (D14).
3. **0.3.0** (done; PO 2026-10-30: item 2 of the list first) in-widget editor with Copy (D9); spike S9 done on 2512 (run 3).
4. **0.4.0** (done) `uses:` reference (D15, S8 verified) and documents of other projects (D12).
5. **0.5.0** (done) *Save to Polarion* through the REST API (D10); checks on 2512 in `docs/PO_CHECKS.md` 2.14–2.18.
6. Next increment: starter generator (spike S7 prepared: `tests/dmSpike-v0.1.x/spike-tests.md` run 4, PO_CHECKS 1.3)
   (D8, spike S7).
7. Later: exploded view of the graph (D16).

## 9. Open checks on 2512

Only verifiable on the instance (the harness uses mocks). The ordered to-do list for the PO, with what to report, is
`docs/PO_CHECKS.md`.

a. Upload of `dmDefine.zip` (entries ≤ 30 characters: `dmDefine/resources/xlsx.js` = 26) and the widget icon.
b. Model document selector and default type `text`; the model item found without the id parameter (the model text
   starts with comment lines in the sample).
c. The sample model (`test-data/vcycle-model.yaml`, names adapted to the project) shows no problem; the graph, details,
   *Model text* (line numbers equal to the editor's lines), table, Excel and SVG export.
d. A model with mistakes (unknown type or link role, missing document, wrong indentation) lists the problems with the
   right lines.
e. PDF export: problems, roles and rules tables.
f. Optional: a binding to a document of another project (`project/space/name`).
h. 0.3.0 (with spike S9, run 3): *Edit model* opens the forms prefilled from the model; pickers (types, link roles,
   roles, documents of the project) work; *Generate YAML*, *Copy*, *Download*; the copied YAML pasted into the model item
   (plain text) reads with no problem and gives the same graph; a model with errors opens in the text editor only; with no
   model item, the forms start empty.
j. 0.5.0: *Save to Polarion* (PO_CHECKS 2.14–2.18): saved text read back, revision in the history, no edit rights,
   parameter off, REST token disabled.
i. 0.4.0: `uses:` (valid, wrong id, with a local model part), editor in the local-part mode, a binding to a document
   of another project (PO_CHECKS 1.2, 2.10–2.13).
g. 0.2.0: use case 3 of `docs/MODELING_GUIDE.md` (names adapted) shows no problem, the pairs in the details, table and
   Excel; a reversed pair and a document in no pair are reported.
