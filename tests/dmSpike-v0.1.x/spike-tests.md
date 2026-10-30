# Spike dmSpike (dmDefine 0.1.x): model item, YAML in Velocity, bindings, configuration, REST

**Status:** run 1 done on 2512 (2026-10-30, PO): S1, S2, S3 (plain paste), S5 (default space), S6, S8 ✅; S4 GET ✅;
run 2: S4 PATCH ✅ (204). Open: code-block variant, S5 named space / other project /
missing document, S4 PATCH. The widget is checked locally with
Velocity 1.4 on mocks only (`tools/test-spikes.sh`: 48 checks). Questions S1–S8 come from `docs/ARCHITECTURE.md` §9.
Findings are added below after each run, as in the sister repo. Never commit raw results (screenshots, PDFs, HTML dumps
of the instance): keep only the findings.

## 1. Questions

| ID | Question | What decides it |
|---|---|---|
| S1 | How is the description of a `text` work item holding a pasted YAML block stored (paragraphs, `<br>`, `<pre>`, `&nbsp;`, styles for indentation, entities)? Open API `getDescription().getContent()` vs Rendering API `fields().description().get()` / `render()` | The HTML → lines conversion of the parser (ARCHITECTURE §3.3) and how users must paste the model |
| S2 | Can the model item be located from the `@document` parameter (`items().contained()`, Open API item via `getOldApi()`), its type and an optional id (`getWorkItem`)? Same items through SQL? Revision accessors (`getRevision()`, `getLastRevision()`)? What does a single-select `workitem-type` parameter return? | Parameters and locating step (§3.1, §3.2), revision shown to users (D11) |
| S3 | Are the EscapeTool getters `$esc.b` / `$esc.backslash` / `$esc.h` / `$esc.hash` available (run-time regexes)? Does the Velocity YAML subset parser give the expected values on the real description? Time for the model | The parser design; fallback = code block or JSON |
| S4 | REST from the widget: is `top.getRestApiToken()` available, does GET of the model item work with the token and without it (session cookie), does PATCH of the description work (format), which errors (401/403/404) when disabled? | dmDefine 0.3 write-back |
| S5 | Does one SQL query on `module` resolve a list of declared documents (`name`, `space/name`, `project/space/name`)? | Binding resolution (§3.6) |
| S6 | Are the project's work item types readable (`getTrackerProject(p).getWorkItemTypeEnum().getAllOptions()`, id and name), next to the link roles (verified)? | Configuration validation (§3.5) |
| S8 | Can a work item of another project be read (`$trackerService.getWorkItem(project, id)`) with its description? Types of that project? | `uses:` reference (§3.4) |

S7 (starter generator data): run 4 below (test S7 of the spike widget, three query variants).

## 2. Setup on the sandbox project (2512)

1. Upload `spike-widget/dmSpike.zip` (Administration → Velocity Widgets). One instance of the widget runs one test (or all).
2. Create a LiveDoc, e.g. `Model/Data Model`. Add:
   - a heading and a `text` work item with an ordinary sentence (the parser must skip it);
   - a `text` work item **A**: paste `test-data/vcycle-model.yaml` as plain text (Ctrl+Shift+V or paste from a plain
     text editor), one line per line;
   - a `text` work item **B** in a second LiveDoc (e.g. `Model/Data Model Pre`): the same YAML inside a code block / preformatted
     text if the editor offers one (title paragraph above the block is fine).
   Adapt type, role and document names of the YAML to the sandbox project if you like; the spike does not check them.
3. Optional for S5: note 2–3 real documents (one in the default space, one in a named space, one of another project).
4. Optional for S8: note a work item of another project (`PROJECT/ID`).
5. Optional for S4: ask whether `com.siemens.polarion.rest.security.restApiToken.enabled=true` is set on the instance
   (`polarion.properties`). The spike shows what happens in either case.

## 3. Run sheet

| Run | Parameters | Report |
|---|---|---|
| 1 | Test **All**, Model document = `Model/Data Model`, types = Text, source = Description | Summary table; if the page shows an error instead, the error text, then run tests one by one |
| 2 | Same, test **S1** | Description section: counts of markup tokens, newlines, no-break spaces, and the **first lines of the stored HTML** (they contain the invented model only: copy them as text, not a screenshot) |
| 3 | Test **S3**, source = Description | Problems (line, message), number of values, top-level keys, timing stamps. Compare a few paths, e.g. `model.links[0].link_role` = `satisfies` |
| 4 | Test **S3**, Model document = `Model/Data Model Pre` (item B) | Same as run 3 (code block variant) |
| 5 | Test **S3**, source = Built-in valid sample, then Built-in invalid sample | Valid: "no problem"; invalid: the problems listed (line 6 duplicate key, line 7 indentation, …) |
| 6 | Test **S2**, also with Model item id = id of item A, and with the single select type set | Locate section: `items().contained()` result and timing, SQL count, revision values, raw/`id()` of the single select |
| 7 | Test **S5**, documents = the ones of setup step 3 plus one that does not exist | Found yes/no per document, the SQL (shown) accepted? |
| 8 | Test **S6** | Number of types and roles; do the ids match the project configuration? |
| 9 | Test **S8**, `PROJECT/ID` of setup step 4 | Read or not, type, description length, number of types of that project |
| 10 | Browser view, S4 buttons 1, 2, 3 in order; 4 only if you agree to a no-change PATCH of item A | The lines printed in the grey box (HTTP status, start of the JSON; no token value is printed) |
| 11 | PDF export of the page with test All | Does it render (no script expected)? Same summary as run 1? |

Then, when 2612 is available: runs 1, 3, 4, 10 again.

## 4. Findings

### Run 1 on 2512 (2026-10-30, PO; Polarion PDF export of the page + text of the S4 box)

Whole page with test All: 81 ms (stamps), including the parse.

| ID | Result |
|---|---|
| S1 | ✅ Plain paste of `vcycle-model.yaml` into a `text` item is stored as **one `<span style="font-size: 10pt;line-height: 1.5;">` per line, separated by `<br/>`**; an empty line = a span holding a `<br/>`. No `<p>`, `<pre>`, `<div>`, `margin-left` or `padding-left`. Indentation kept as spaces and **no-break space characters** (100 U+00A0 in 48 lines; no `&nbsp;` entity). Double quotes stored as `&quot;`. No raw newline. Open API `getDescription()`: type `text/html`, `getContent()` = the HTML (4073 characters). Rendering API `fields().description().render()` = the same HTML (4075 characters); `get()` printed a short object text (59 characters, not the HTML); `isUnset()` printed nothing. → Use the Open API `getDescription().getContent()` |
| S2 | ✅ `@document` single select → `getModelObject()` → `items().contained()`: 5 items in document order (≤ 3 ms), Open API item via `getOldApi()`; SQL on the same document with `c_type IN ('text')` gives the same 2 items. `getWorkItem(project, id)` with the id parameter works. **`getRevision()` is empty** on the HEAD work item and module; **`getLastRevision()`** gives the revision (85780). A single-select `workitem-type` parameter works: `singleValue()` = `ProxyEnumOption`, `id()` = type id. Auto-detection by "text starts with a model key" failed because the model starts with comment lines (the PO used the id parameter; detection now looks for a line starting with a key) |
| S3 | ✅ `$esc.b` and `$esc.backslash` = `\` (length 1), `$esc.h` / `$esc.hash` = `#`, `$esc.d` = `$`: run-time regexes work (`\r?\n`, `\u00A0`). The Velocity parser read the stored HTML: **48 lines, 40 values, 0 problems**, 2 comment lines before `version:` skipped, values as expected (e.g. `model.links[0].link_role` = `satisfies`, flow maps and flow lists with quotes). Parse time ≈ 3–4 ms |
| S4 | `top.getRestApiToken` is a function, token present (the REST token property is enabled on this instance). **GET with the token: HTTP 200** (92–132 ms), description returned as `{"type":"text/html","value":"<span …>"}`. **GET without the token: HTTP 401** "No access token" (the session cookie alone is not enough). **PATCH: HTTP 400** "Invalid query parameter: fields[workitems]": a spike bug (the PATCH reused the GET URL with `?fields[workitems]=…`). Fixed: PATCH now goes to the URL without query parameter. To re-run (the PO will also send the call used in another widget) |
| S5 | ✅ One `module` query for 4 documents of the default space (`name` form): 4 of 4 found, ≈ 1 ms. Named space, other project and a missing document not tried yet |
| S6 | ✅ `getTrackerProject(p).getWorkItemTypeEnum().getAllOptions()`: 27 types with id and name; link roles: 32 with name and opposite name |
| S8 | ✅ `$trackerService.getWorkItem("VforIA", "VIA-552")` from another project: read, type, title, description (Open API); `getTrackerProject("VforIA")` types: 12. Spike bug: `getRevision()` returned nothing (printed as a literal); now `getLastRevision()` |
| PDF | ✅ The Polarion PDF export renders all sections (no script) |

Consequences (see `docs/ARCHITECTURE.md` §3.2, §3.3, §6):
- HTML → lines: `<br>` and block ends as line breaks, tags removed, U+00A0 → space, entities decoded: works as designed on
  the real storage. A code block is not needed for a plain paste.
- Model item: Open API `getDescription().getContent()`; revision from `getLastRevision()`; detection = first item of the
  type with a line starting with `version:`, `model:` or `uses:`, or the id parameter.
- REST write-back: a token is required (header `X-Polarion-REST-Token`); availability = token function present and a
  probe GET returning 200. The HTML to write must follow the same storage (one line per `<br/>`, leading spaces as
  U+00A0 or `&nbsp;`, `&quot;`) [to verify with the PATCH re-run].

### REST call checked against the instance's OpenAPI definition (2026-10-30, PO)

The PO provided the instance's `openapi.json` (Polarion REST API v1, 156 paths; not committed: Siemens document,
1.9 MB). For `/projects/{projectId}/workitems/{workItemId}`:
- **GET** `getWorkItem`: query parameters `fields` (deepObject, e.g. `fields[workitems]=title,description`), `include`,
  `revision` (read the item at a given revision); response `application/json`.
- **PATCH** `patchWorkItem`: query parameters only `workflowAction` and `changeTypeTo` (hence the 400 on `fields[workitems]`
  in run 1); body `workitemsSinglePatchRequest` =
  `{"data":{"type":"workitems","id":"<project>/<id>","attributes":{"description":{"type":"text/html","value":"…"}}}}`
  (`description.type` is `text/html` or `text/plain`), `Content-Type: application/json`; success = **204 No Content**
  (empty body); errors 400, 401, 403, 404, 409, 413, 415.
- Authentication in the definition: bearer JWT; from a widget the session token goes in `X-Polarion-REST-Token`
  (guide §8.2, verified by the GET of run 1).
The fixed spike PATCH (URL without query parameter, body above, JSON content type) matches the definition. Expected in
run 2: HTTP 204.

### Run 2 on 2512 (2026-10-30, PO; S4 box)

| ID | Result |
|---|---|
| S4 | ✅ GET with the token: HTTP 200 in 70 ms. **PATCH** of the description written back unchanged (`{"data":{"type":"workitems","id":"<project>/<id>","attributes":{"description":{"type":"text/html","value":…}}}}`, URL without query parameter, header `X-Polarion-REST-Token`, `Content-Type: application/json`): **HTTP 204 in 79 ms**, empty body. Write-back from a widget works on this instance |

S4 is closed for the feasibility and the call. Left for a short check before dmDefine 0.3 (REST save), not needed for
0.1/0.2: (a) PATCH a **changed** model in the HTML form the widget will generate and parse it back; (b) whether a
PATCH creates a revision in the item history (also when unchanged); (c) a user without edit rights (expected 403) and
an instance with the REST token disabled (no `top.getRestApiToken`, or 401) → the Save button stays hidden;
(d) non-ASCII and special characters (`é`, `&`, `<`, quotes) in the written text.

Still open from run 1 (optional): S5 with a named space, another project and a missing document (done in run 3b below).

### Run 3b on 2512 (2026-10-30, PO; S5 table, read from a photo, not committed)

| ID | Result |
|---|---|
| S5 | ✅ One `module` query (`SELECT m.c_uri FROM module m INNER JOIN project p ON p.c_uri = m.fk_uri_project WHERE (p.c_id = … AND m.c_modulefolder = … AND m.c_id = …) OR (…)`) for three declared documents, ≈ 1 ms: a document of a **named space** of the current project (`Space/Name`) found; a document of **another project** (`PROJECT/Space/Name`, the sandbox project of the sister repo) found with its title; a **missing** document (`Space/Name`) reported "no" (summary "2 of 3 found", info). The binding resolution of `dm-model.vm` uses the same form |

### Run 3 on 2512 (2026-10-30, PO; S9 box, read from a photo of the screen, not committed)

| ID | Result |
|---|---|
| S9 | ✅ PO: "everything works". Log: text area `keydown` Enter, space, Ctrl+C, Ctrl+V and its `input` event received, **none prevented by the page**; multi-line text with leading spaces kept (12 lines, indentation shown); input `keydown` and `input` event received (value as typed); `<select>` (not in a `<label>`) `input` and `change` events for "two" and "three"; `navigator.clipboard.writeText`: ok; `execCommand('copy')`: true; download of the `.yaml` started; *Show the values* read the text area, the input and the select. Second photo (end of the log): **Backspace** received; **Tab** received and moves the focus to the next control (the input), the browser default, not blocked; **Ctrl+Z** works (PO). dmDefine does not depend on Tab (indentation is typed with spaces; Tab leaves the text area), copy with `navigator.clipboard` then `execCommand`, as verified here) |

S9 closed. Tab leaves the text area (browser default): indentation in the YAML text tab is typed with spaces; catching
Tab to insert spaces would be a small editor option, not requested.

### Run 4 on 2512 (2026-10-30, PO; S7 summaries read from photos of the PDF export, not committed)

Project with 151 documents (all spaces, *S7 max documents* 300), 150 holding items. All three variants render.

| Variant | Items read (types query) | Link sources read | Links scanned | Link combinations | Out of scope | start → starter YAML |
|---|---|---|---|---|---|---|
| C full scan | 8240 | 8091 (`SELECT DISTINCT ws.c_uri …`) | 26549 | **781** | 0 | **650 ms** (types scan 168 ms, links scan 395 ms) |
| A representatives (`SELECT MIN(w.c_uri) … GROUP BY`) | 281 | 781 | 4601 | **781** | 0 | **108 ms** |
| B nested (`… WHERE c_uri IN (SELECT MIN(…) … GROUP BY …)`) | 281 | 375 | 1713 | **781** | 0 | **80 ms** |

Findings:
- `sqlSearch` **accepts `SELECT MIN(c_uri) … GROUP BY …`** (A) and returns the work item objects, one per group (781 rows
  for 781 groups, the same item possibly several times); the nested form (B) returns each item once (375 distinct link
  sources). Both give the **same number of document/type pairs (281) and link combinations (781) as the full scan**.
  **The type and link tables of A and B are identical to those of C** (PO).
- Even the full scan stays well within the 10 s budget on this project (≈ 0.65 s for 8k items), but scales with the
  items; B is ≈ 8× faster and reads ≈ 20× fewer links.
- Count method: **`searchInstancesCount` not available** ("method not available"): A and B give representatives, not
  item counts per type. The starter does not need counts (proposed `min: 1` per observed type); counts, if wanted,
  would need `GROUP BY … HAVING` style queries (verified form) or the full scan.
- The page export of the full output is large (≈ 200 pages for 151 documents): the starter generator must show a
  compact proposal (YAML + summary), not every combination table.
- The generated starter YAML (all three variants) **opens in dmDefine and shows the starter model** (PO: "everything seems good").

Decision proposed for the starter generator (D8): **variant B** (nested; A also works as a fallback);
full scan not used.

### Run 5 on 2512 (2026-10-30, PO; S10 summaries read from photos, not committed)

Pairs of documents of one space, role `satisfies`, small and large documents; the three variants.

| Variant | Accepted | Same as the reference | Example (181 source items, 181 target items, 181 link sources) |
|---|---|---|---|
| NOT IN (`sqlSearch`) | ✅ no error | yes | reference queries 12 ms + evaluation 23 ms; NOT IN: items without link 3 ms, items not covered 2 ms |
| NOT EXISTS, correlated (`sqlSearch`) | ✅ no error | yes | reference 8 + 15 ms; NOT EXISTS 3 ms + 2 ms |
| Lucene `queryWorkItems` with `SQL:(…)` holding the set query | ✅ no error | yes | reference 9 + 15 ms; Lucene 3 ms + 1 ms |

Findings:
- `sqlSearch` accepts `NOT IN (SELECT …)` and correlated `NOT EXISTS (SELECT …)`; `queryWorkItems` accepts an
  `SQL:(…)` restriction holding such a query (drill-down K9). Each set query takes 1–3 ms against ≈ 25–35 ms for the
  reference (SQL + Velocity scan) on this pair; no visible difference on large documents (PO).
- **Limit**: in the runs shown, all counts were **0** (every item linked, every target covered), so "same as the
  reference" compares empty results. That the set queries return the **right non-empty lists** is not shown yet:
  one run on a pair with missing links (e.g. the dmCheck test structure of `test-data/vcycle-check/`, PO_CHECKS 3.1,
  or a link removed for the test) closes it. Until then dmCheck keeps the 0.1.0 method as the reference.

### Run 3: S9 editor controls (for dmDefine 0.3.0)

Upload the rebuilt `dmSpike.zip` (browser view, any test). In section **S9**: type several lines with leading spaces in
the text area, press Tab, Enter, Backspace and Ctrl+Z; type in the input; choose "two" in the drop-down; click
*Copy (navigator.clipboard)* and paste somewhere; click *Copy (execCommand)* and paste; click *Download a .yaml file*;
click *Show the values*. Report the text of the grey box (it lists the key events received, whether the page blocked
any, where Tab moves the focus, whether the drop-down change arrived, the copy and download results).

### Run 4: S7 starter generator data (for the dmDefine starter generator)

Test **S7** (not part of *All*), parameters *S7 spaces* (e.g. the spaces of your main documents, or empty = all) and
*S7 max documents*. Run it three times, once per *S7 query variant*, on the project with the most documents:

1. **C (full scan)** first, as the reference (it reads every item and every link source: it can be slow on a large
   project; if the page fails with a timeout, report it and limit the spaces).
2. **A (representatives)**: `SELECT MIN(w.c_uri) … GROUP BY` (one item per document and type, one link source per
   source document, target document, role and types).
3. **B (nested)**: the same through `IN (SELECT MIN(…) … GROUP BY …)`, in case A is refused.

Report for each: whether the page renders (or the SQL error text), the summary line (documents, with items, link
sources read, links scanned, links out of scope, count method), the time stamps (start → starter YAML), and whether
the tables of types and link combinations of A / B are the **same** as those of C (the counts differ: A and B count
representatives). Then copy the proposed starter model into a model item (or the editor's text tab) and open it with
dmDefine: report the problems listed, and whether the model is a useful starting point (roles, types, rules).

Questions answered by the run: does `sqlSearch` accept `MIN(c_uri)` with `GROUP BY` (form A) or only the nested form
(B)? Is the representative scan fast and complete on a large project? Is a Lucene count method available
(`searchInstancesCount`)? Is one role per document, one rule per observed combination, a good starter?

### Run 5: S10 dmCheck queries (spikes T1, T3 of dmCheck)

Test **S10** (not part of *All*). Parameters: *S10 source document* (space/name of the documents holding the links,
e.g. a solution specification), *S10 target document* (e.g. the customer specification), *S10 link role id* (e.g.
`satisfies`), optional source / target types. The widget always computes the result with the method of dmCheck 0.1.0
(reference, SQL forms already verified), then runs the selected set query and compares. Run it with each *S10 set
query*: **NOT IN**, **NOT EXISTS**, **Lucene** (drill-down: `queryWorkItems` with `SQL:(…)`), first on a small pair of
documents, then on the largest ones.

Report for each variant: whether the page renders (or the SQL / query error text), the line "same as the reference:
yes/no", the counts, and the time stamps (reference vs variant). Questions answered: are `NOT IN` and correlated
`NOT EXISTS` sub-selects accepted by `sqlSearch` (faster checks)? Does a Lucene `SQL:(…)` restriction accept them
(drill-down links listing the violating items in Polarion's table)?

### Run 3 (optional, S5)

Upload the rebuilt `dmSpike.zip`, then: S4 buttons 2 and 4 (PATCH unchanged; report the HTTP status and whether a new
revision appears in the item history); S5 with a named space, another project and a missing document; S3 on a code block
variant if the editor offers one (optional: a plain paste works).
