# Spike dmSpike (dmDefine 0.1.x): model item, YAML in Velocity, bindings, configuration, REST

**Status:** run 1 done on 2512 (2026-10-30, PO): S1, S2, S3 (plain paste), S5 (default space), S6, S8 ✅; S4 GET ✅,
PATCH failed on a spike bug (fixed in the widget, to re-run). Open: code-block variant, S5 named space / other project /
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

S7 (starter generator data) is left for dmDefine 0.2.

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

### Run 2 (to do)

Upload the rebuilt `dmSpike.zip`, then: S4 buttons 2 and 4 (PATCH unchanged; report the HTTP status and whether a new
revision appears in the item history); S5 with a named space, another project and a missing document; S3 on a code block
variant if the editor offers one (optional: a plain paste works).
