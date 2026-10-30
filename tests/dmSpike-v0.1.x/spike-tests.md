# Spike dmSpike (dmDefine 0.1.x): model item, YAML in Velocity, bindings, configuration, REST

**Status:** plan and run sheet, 2026-10-30. **Not run yet** on a Polarion instance. The widget is checked locally with
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

(none yet)
