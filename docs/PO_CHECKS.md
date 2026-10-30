# Checks to run on Polarion 2512 (to-do list for the PO)

Everything below is built and tested locally (Velocity 1.4 on mock Polarion objects, Chromium), but **not yet run on a
Polarion instance**. Run the checks in this order when you have time; for each one, report the result as text (not
screenshots or PDF exports: the repository is public). Findings are then recorded in the specification and in
`tests/dmSpike-v0.1.x/spike-tests.md`.

Last update: 2026-10-30, dmDefine 0.5.0, dmCheck 0.1.0, dmSpike S7 and S10; §1 done; §2 done (dmDefine 0.5.0 verified).

## 1. Spike widget dmSpike (upload `tests/dmSpike-v0.1.x/spike-widget/dmSpike.zip`)

| # | Check | What to report | Needed for |
|---|---|---|---|
| 1.1 | ✅ **Done 2026-10-30** (run 3: everything works; Tab moves the focus to the next control). **S9 editor controls**, browser view, section S9: type several lines with leading spaces in the text area, press Tab, Enter, Backspace, Ctrl+Z; type in the input; choose "two" in the drop-down; click both Copy buttons (paste somewhere each time), *Download a .yaml file*, *Show the values* | The text of the grey S9 box | dmDefine 0.3.0 editor |
| 1.2 | ✅ **Done 2026-10-30** (named space and other project found, missing document "no"). **S5 other forms** (test *S5*): in *Documents to resolve*, a document of a named space (`Space/Name`), a document of **another project** (`PROJECT/Space/Name`) and a document that does not exist | Found yes/no per document | bindings to documents of other projects (0.4.0) |
| 1.3 | ✅ **Done 2026-10-30** (all three variants render, tables identical, B 80 ms / C 650 ms; the starter YAML is shown by dmDefine). **S7 starter generator data** (test *S7*, three runs: variant C, then A, then B; see run 4 of `tests/dmSpike-v0.1.x/spike-tests.md`) on your largest project | Page renders or SQL error; summary line; time stamps; same types and link combinations for A/B as for C; the proposed starter model opened in dmDefine (problems, usefulness) | dmDefine starter generator |
| 1.4 | ✅ **Done 2026-10-30** (three variants accepted, same as the reference, 1–3 ms; but every count was 0). **S10 dmCheck queries** (test *S10*; run 5 of `tests/dmSpike-v0.1.x/spike-tests.md`): source document, target document, link role; variants NOT IN, NOT EXISTS, Lucene | Page renders or error text; "same as the reference: yes/no"; counts; time stamps | dmCheck (faster checks 0.2, drill-down K9) |
| 1.4b | ✅ **Done 2026-10-30** (two links removed: reference 2 + 2 items, Lucene/NOT IN the same ids). **S10 once more on a pair with missing links** (e.g. after 3.1, the test structure: source `Solution Spec`-like document with items without `satisfies` link), NOT IN then NOT EXISTS then Lucene | "same as the reference: yes/no" with **non-zero** counts | dmCheck 0.2 (can wait until 3.1) |

## 2. dmDefine (upload `widgets/dmDefine/dist/dmDefine.zip`)

Use a model with the names of your project (start from `test-data/vcycle-model.yaml` or the examples of
`docs/MODELING_GUIDE.md`).

| # | Check | Expected | Version |
|---|---|---|---|
| 2.1 | ✅ **Done 2026-10-30** (upload accepted, widget loads). Upload; the widget and its icon in the widget list | upload accepted | 0.1.0 |
| 2.2 | ✅ **Done 2026-10-30** (model interpreted correctly). Parameters: model document, type Text by default; the model item found **without** the id parameter (model text starting with comment lines) | the graph of the model | 0.1.0 |
| 2.3 | ✅ **Done 2026-10-30** (everything fine). A correct model: no problem; graph, role and line details, *Model text* (line numbers equal to the lines of the editor, empty lines counted once), *Table*, *Excel*, *SVG* | as described in `docs/dmDefine/install.md` | 0.1.0 |
| 2.4 | ✅ **Done 2026-10-30** (errors identified correctly). Mistakes on purpose: unknown type, unknown link role, missing document, wrong indentation | each problem with the right line | 0.1.0 |
| 2.5 | ✅ **Done 2026-10-30** (PDF, SVG and Copy YAML work). PDF export of the page | problems, roles and rules tables | 0.1.0 |
| 2.6 | ✅ **Done 2026-10-30** (pairs work). Pairs: use case 3 of the modelling guide (names adapted); then a pair written the wrong way round, and a document left out of the pairs | no problem; then an error and a warning | 0.2.0 |
| 2.7 | ✅ **Done 2026-10-30** (editor round trip works). **Editor**: *Edit model* on your model: forms prefilled; change something with the pickers (type, link role, document), *Generate YAML*, *Copy*; paste into the model item as plain text (Ctrl+Shift+V), save, *Reload page* | the change is shown, no problem | 0.3.0 |
| 2.8 | ✅ **Done 2026-10-30** (new model from the empty editor works). Editor with no model: a page with the widget and no model document selected (or an empty model document): *Edit model*, add a role, a type, a document, *Generate YAML*, paste into a new Text item, select that document in the parameters | the new model is shown | 0.3.0 |
| 2.9 | ✅ **Done 2026-10-30** (as expected). Editor on a model with an error: only the *YAML text* tab | forms disabled, text shown | 0.3.0 |
| 2.10 | ✅ **Done 2026-10-30** (as expected). **uses:** in project B, a Text item with `version: 1`, `uses: "A/ID"` (ID = the model item of project A) and `bindings:` with documents of project B | roles and rules of A, documents of B, header "roles and rules from A/ID (revision …)", link *Open referenced model* | 0.4.0 |
| 2.11 | ✅ **Done 2026-10-30** (an error each). uses: mistakes: a wrong id; `uses:` together with a local `model:` part | an error each | 0.4.0 |
| 2.12 | ✅ **Done 2026-10-30** (as expected). uses: *Edit model*: roles and rules read only, documents and pairs editable; *Generate YAML* keeps `uses:` | as described | 0.4.0 |
| 2.13 | ✅ **Done 2026-10-30** (found, link opens it). A binding to a document of another project (`PROJECT/Space/Name`) | found, link opens it | 0.4.0 |
| 2.14 | ✅ **Done 2026-10-30** (changed model saved and shown after reload). **Save to Polarion**: *Edit model* → *YAML text*: the button *Save to Polarion* is shown and the line below names the model item. Change something (e.g. the name), *Save to Polarion*, accept; then *Reload page* | "Saved to P/ID"; after reload the change is shown, no problem | 0.5.0 |
| 2.15 | ✅ **Done 2026-10-30** (indentation kept, new revision in the history). After 2.14: open the model work item: the description shows the YAML with its indentation; its **history** shows a new revision | indentation kept, new revision | 0.5.0 |
| 2.16 | ✅ **Done 2026-10-30** (warning shown). Save twice without reloading the page (or change the item in another tab first) | a warning "was changed since this page was loaded" | 0.5.0 |
| 2.17 | ✅ **Done 2026-10-30** (user without edit rights: **no Save button**, so the token or the GET of the model item is refused for that user; the reason is the line under the YAML text, to note if seen). With a user who can read but not edit the model item | Save shown, then "Not saved: no permission …" (or Save not shown) | 0.5.0 |
| 2.18 | ✅ **Done 2026-10-30** (no Save button). Widget parameter *Save to Polarion* = Off | no Save button, "switched off in the widget parameters" | 0.5.0 |

## 3. dmCheck (upload `widgets/dmCheck/dist/dmCheck.zip`)

| # | Check | Expected | Version |
|---|---|---|---|
| 3.1 | In the sandbox project, create the test structure of `test-data/vcycle-check/structure.md` (5 documents, ~20 items, links; adapt the type and role names) and a model item with `test-data/vcycle-check/model.yaml` (adapted) | dmDefine shows the model with no problem | dmCheck 0.1.0 |
| 3.2 | dmCheck on that model (same parameters as dmDefine) | summary 4 errors, 7 warnings; the 11 expected violations of `structure.md` (and nothing else); counters as listed there; L1 red, L2 orange | dmCheck 0.1.0 |
| 3.3 | Line and role details, *Table*, *Filter violations*, *Show* checkboxes, *Excel*; links to work items and documents open them | as described in `docs/dmCheck/install.md` | dmCheck 0.1.0 |
| 3.4 | PDF export of the page | rules, documents, violations tables | dmCheck 0.1.0 |
| 3.5 | dmCheck on a real model of your largest project | rendering time (seconds), no "limit reached"; the violations make sense | dmCheck 0.1.0 |
| 3.6 | A model with an error (e.g. an unknown link role) | the problems, "The model has errors", nothing checked | dmCheck 0.1.0 |

## 4. Decisions to confirm (dmCheck, proposed in `widgets/dmCheck/SPECIFICATION.md` §7)

| # | Question | Proposal |
|---|---|---|
| 4.1 | Items not counted (headings…) | no extra parameter: types with `ignored: true` in the model are not counted; types not listed are "unexpected types"; a rule end without type counts the listed, not ignored types |
| 4.2 | Severity and score | the model's severities; compliance % per rule (per side) and per document; graph red / orange / green |
| 4.3 | Storable report | live report + Excel + PDF export of the page; no snapshot work item in v1 |

## 5. Later (not needed now)

- On an instance where the REST API token is disabled: no Save button, "no REST token in this session".
- Polarion 2612: repeat 1.1, 2.2, 2.3, 2.7 and the dmSpike runs 1–2 (S1, S3, S4).
