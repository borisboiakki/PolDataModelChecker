# Checks to run on Polarion 2512 (to-do list for the PO)

Everything below is built and tested locally (Velocity 1.4 on mock Polarion objects, Chromium), but **not yet run on a
Polarion instance**. Run the checks in this order when you have time; for each one, report the result as text (not
screenshots or PDF exports: the repository is public). Findings are then recorded in the specification and in
`tests/dmSpike-v0.1.x/spike-tests.md`.

Last update: 2026-10-30, dmDefine 0.4.0.

## 1. Spike widget dmSpike (upload `tests/dmSpike-v0.1.x/spike-widget/dmSpike.zip`)

| # | Check | What to report | Needed for |
|---|---|---|---|
| 1.1 | **S9 editor controls**, browser view, section S9: type several lines with leading spaces in the text area, press Tab, Enter, Backspace, Ctrl+Z; type in the input; choose "two" in the drop-down; click both Copy buttons (paste somewhere each time), *Download a .yaml file*, *Show the values* | The text of the grey S9 box | dmDefine 0.3.0 editor |
| 1.2 | **S5 other forms** (test *S5*): in *Documents to resolve*, a document of a named space (`Space/Name`), a document of **another project** (`PROJECT/Space/Name`) and a document that does not exist | Found yes/no per document | bindings to documents of other projects (0.4.0) |

## 2. dmDefine (upload `widgets/dmDefine/dist/dmDefine.zip`)

Use a model with the names of your project (start from `test-data/vcycle-model.yaml` or the examples of
`docs/MODELING_GUIDE.md`).

| # | Check | Expected | Version |
|---|---|---|---|
| 2.1 | Upload; the widget and its icon in the widget list | upload accepted | 0.1.0 |
| 2.2 | Parameters: model document, type Text by default; the model item found **without** the id parameter (model text starting with comment lines) | the graph of the model | 0.1.0 |
| 2.3 | A correct model: no problem; graph, role and line details, *Model text* (line numbers equal to the lines of the editor, empty lines counted once), *Table*, *Excel*, *SVG* | as described in `docs/dmDefine/install.md` | 0.1.0 |
| 2.4 | Mistakes on purpose: unknown type, unknown link role, missing document, wrong indentation | each problem with the right line | 0.1.0 |
| 2.5 | PDF export of the page | problems, roles and rules tables | 0.1.0 |
| 2.6 | Pairs: use case 3 of the modelling guide (names adapted); then a pair written the wrong way round, and a document left out of the pairs | no problem; then an error and a warning | 0.2.0 |
| 2.7 | **Editor**: *Edit model* on your model: forms prefilled; change something with the pickers (type, link role, document), *Generate YAML*, *Copy*; paste into the model item as plain text (Ctrl+Shift+V), save, *Reload page* | the change is shown, no problem | 0.3.0 |
| 2.8 | Editor with no model: a page with the widget and no model document selected (or an empty model document): *Edit model*, add a role, a type, a document, *Generate YAML*, paste into a new Text item, select that document in the parameters | the new model is shown | 0.3.0 |
| 2.9 | Editor on a model with an error: only the *YAML text* tab | forms disabled, text shown | 0.3.0 |
| 2.10 | **uses:** in project B, a Text item with `version: 1`, `uses: "A/ID"` (ID = the model item of project A) and `bindings:` with documents of project B | roles and rules of A, documents of B, header "roles and rules from A/ID (revision …)", link *Open referenced model* | 0.4.0 |
| 2.11 | uses: mistakes: a wrong id; `uses:` together with a local `model:` part | an error each | 0.4.0 |
| 2.12 | uses: *Edit model*: roles and rules read only, documents and pairs editable; *Generate YAML* keeps `uses:` | as described | 0.4.0 |
| 2.13 | A binding to a document of another project (`PROJECT/Space/Name`) | found, link opens it | 0.4.0 |

## 3. Later (not needed now)

- REST *Save to Polarion* (dmDefine, later increment): PATCH of a changed model and read-back, revision in the history,
  a user without edit rights, an instance with the REST token disabled (list in `tests/dmSpike-v0.1.x/spike-tests.md`).
- Polarion 2612: repeat 1.1, 2.2, 2.3, 2.7 and the dmSpike runs 1–2 (S1, S3, S4).
