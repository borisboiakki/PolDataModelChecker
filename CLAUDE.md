# CLAUDE.md — Polarion data model checker

Guidance for Claude Code when working in this repository.

## Project in one paragraph

Polarion LiveReport widgets that let a key user or project admin **formalize the project data model** (the main
LiveDocs, which work item types each must contain, how those items must be linked to the items of the other main
documents) and **check the real data against it**. Typical case: the V-cycle (system specification → subsystem
requirements linked with `satisfies` → tests linked with `verifies`). Two widgets, built iteratively:

- **dmDefine** (`widgets/dmDefine/`): reads the model, shows it (graph + table), validates its syntax, helps to edit it.
- **dmCheck** (`widgets/dmCheck/`): reads the same model, checks the real documents/items/links, reports violations
  (table, Excel, graph coloured by compliance, Lucene drill-down).

Each widget has its own `SPECIFICATION.md` (requirements, decisions, open questions, spike list). The shared model
format is in `docs/DATA_MODEL_FORMAT.md` (the contract between the two widgets). `README.md` is the overview.

This repository was started from the sister repository `polarion_branches_copies_widget` (docBranches, docCoverage,
advImpact), which holds the same kind of widgets. Its code and verified findings were copied here (see below).

## Workflow (agreed with the product owner, PO)

1. **Specification first** (`widgets/<w>/SPECIFICATION.md`), PO answers recorded, open questions listed.
2. **Preliminary architecture** (`docs/ARCHITECTURE.md`), written after the spec is agreed.
3. **Spikes / diagnostic widgets** to verify every hypothesis on a real Polarion before building on it
   (plan in the specification; spike widgets in `tests/<name>-vN.N.x/`, as in the sister repo).
4. **Implementation**, incremental, one widget at a time. Never one shot.
If a task conflicts with a specification, ask; don't silently deviate. Update the spec whenever a requirement is clarified.

## Required reading before coding

1. `Polarion_Development_Guide.md` (copied from the sister repo) — read the sections that match the surface you touch:
   widget & parameters §2 · Velocity §3 (**§3.1.9 Velocity 1.4 dialect**) · Lucene §6 · SQL §7 · REST §8 · Java §9 ·
   checklist §13 · interactive widget UI on 2512 §11.7 · multi-level link traversal §3.3.
2. `docs/ARCHITECTURE.md` — architecture of this repo (preliminary: model pipeline in Velocity, YAML subset parser,
   checks in SQL + Velocity, page model, spikes). Keep it in line with the code. `docs/reference/ARCHITECTURE-docwidgets.md`
   describes the sister widgets for the parts reused unchanged (build, inlining, static view, client core).
3. `widgets/<widget>/SPECIFICATION.md` of the widget you touch, and `docs/DATA_MODEL_FORMAT.md`.

## Golden rules

- Polarion has four programming surfaces (Velocity, Polarion Scripting, Lucene/SQL, Java/REST). Decide which one a
  piece of code belongs to before writing it; don't mix idioms.
- **Nothing project-specific is hard-coded**: work item types, link roles, custom fields, document types, statuses are
  data of the model or widget parameters, resolved from the project configuration.
- Target **Polarion 2512**, stay compatible with **2612** (PO). Public Rendering API + documented SQL tables only.
  Assume nothing about 2612 columns/behaviour until verified; say plainly what is unverified.
- **Admin-deployable**: Velocity widget uploaded as a `.zip`, no server-side extension, no Java, no CDN. Entry names ≤ 30
  characters, ≤ 30 entries. JS/CSS are inlined in `render.vm` (`#include`/`#parse` cannot load `resources/`);
  only the third-party Excel library is loaded with `#loadWidgetJs("resources/xlsx.js")`.
- Respect PDF/print: no JS or external stylesheets there (static server-side SVG + tables).
- Interactive path within the 10 s render budget: heavy work in SQL, never loop over all work items in Velocity.
- **REST write-back is optional**: the REST API is not always reachable from a widget, so every editing feature must
  have a manual fallback (copy/paste into the model work item). REST push is a later increment, to spike first.
- Use `@document` selectors via `getModelObject()`, not Lucene built from option ids (guide §2.1).
- Check `isUnresolvable()` before using ANY referenced object (document author, `branchedFrom`, link target…): every
  other call on an unresolvable object throws.

## Verified Polarion facts reused from the sister repo (all on a 2512 instance)

Do not present unverified items as fact in code comments or docs. 2612 is **not verified** for any of these.

- **Velocity dialect = Velocity 1.4** (guide §3.1.9): no map literals `{}` (use `$objectFactory.newMap()`), list literals
  `[]` fine; `#[[ ]]#`, `#break`, `$foreach` do nothing; no method chain split across lines; no backslash in Velocity
  string literals (put `-` last in a regex class); no directive names in plain text/HTML/JS; avoid `$` in inline JS;
  arithmetic reliable on Integer only; `#set($x = $obj.get())` with a null result keeps the old value (reset first);
  Java arrays have no methods (store tuples as lists).
- **Always run `tools/vcheck.sh` before committing a `.vm` change** (parses every template with Velocity 1.4; needs Java;
  downloads the jars to `tools/.lib/` on first use).
- Parameters: `$parameters.<customEnum>.singleValue` returns the option id as a String; multi-value enums are read with
  `values()` (each a `ProxyEnumOption`, `id()` = option id; shared macro `bwOptionIds`). `workitem-link-role`,
  `workitem-type` and `@project` multi-selectors work; `$factory.enumeration("…", "workitem-link-role").values(["x"])`
  preselects defaults. `@document` selector lists the **current project's** documents only. `getModelObject()` →
  `ProxyDocument` (`isUnresolvable()`), `getOldApi()` → Open API `Module` (`getModuleFolder()` = `_default` for the default
  space, `getId()`); `getReference().spaceId()` is empty.
- Project link roles with name and opposite name: `$trackerService.getTrackerProject(id).getWorkItemLinkRoleEnum().getAllOptions()`.
- Data access: `$trackerService.getDataService().sqlSearch(sql)` returns `IModule`/`IWorkItem` objects fast (`DISTINCT`,
  `GROUP BY … HAVING`, nested `IN (SELECT …)` and `WITH RECURSIVE` accepted on 2512). Tables: `MODULE` (`C_ID`,
  `C_MODULENAME`, `C_MODULEFOLDER`, `FK_URI_BRANCHEDFROM`, `FK_URI_DERIVEDFROM`), `WORKITEM` (`FK_URI_MODULE`),
  `STRUCT_WORKITEM_LINKEDWORKITEMS`. `$trackerService.queryWorkItems(query, "id")` accepts `document.id:"Name"` and `SQL:(…)`.
- **Link direction**: a link is stored on the **source** item (`fk_uri_p_workitem`) and points to the **target**
  (`fk_uri_workitem`). `satisfies`: source = downstream item, target = upstream (customer) item. Open API
  `getLinkedWorkItemsStructsDirect()` = outgoing links of an item; `getLinkedWorkItemsStructsBack()` = incoming
  (`getLinkedItem()` = link source). Lucene `linkedWorkItemsOf` follows incoming links only.
- **Collections** (`$transaction.context().contextCollection()`): null outside a collection and in the Polarion PDF
  export; `searchBySql(...).collection($ref)` on `col_module` / `col_workitem` / `col_struct_workitem_linkedworkitems`
  gives documents/items/links at pinned revisions (including upstream collections).
- Browser inline JS runs in the browser view (not in PDF export); static inline SVG renders in PDF.
- Excel export: `xlsx-js-style` in `shared/resources/xlsx.js`, loaded with `#loadWidgetJs`; widget icon = `icon.png`
  (608 x 405) at the package root.
- Unresolvable references: see golden rules.

NOT verified for this project (to settle by spikes, see the specifications): how the **description** of a work item
(HTML rich text) is read from Velocity and what its markup looks like for a YAML block; whether a YAML parser can be
embedded (Velocity side or JS side); whether the REST API can be called from the widget with the user's session (auth,
CSRF, permissions) on 2512/2612; document type / custom field based document binding.

## Repository layout

```
CLAUDE.md                      this file
README.md                      overview, build, workflow
Polarion_Development_Guide.md  Polarion best practices (copied from the sister repo, do not edit casually)
docs/DATA_MODEL_FORMAT.md      draft of the model YAML (contract between dmDefine and dmCheck)
docs/ARCHITECTURE.md           architecture of this repo (preliminary, revised after the spikes)
docs/reference/                architecture document of the sister widgets (reference for the reused parts)
widgets/<w>/src/               widget sources (as in the sister repo: render.vm with markers "## BW_SHARED <file>" and
                               "## BW_INLINE_JS", parameters.vm, graph.js, widget.properties, details.vm, description.vm, icon.png)
widgets/<w>/dist/              generated by tools/build-widget.py; never edit by hand
widgets/<w>/VERSION            N.N.N;   widgets/<w>/SPECIFICATION.md
shared/js/core.js              client core copied from the sister repo (layout, SVG, toolbar, table, exports)
shared/vm/*.vm                 Velocity snippets inlined at BW_SHARED markers (copied; adapt/extend for the model)
shared/resources/              xlsx.js + LICENSE (third-party, unchanged)
tools/                         build-widget.py, vcheck.sh + VCheck.java (copied); tools/vtest/mocks/ = mock Polarion
                               objects (WidgetHarness.java, CollectionMocks.java); per-widget harness in tools/vtest/<w>/
tests/<name>-vN.N.x/           spikes: spike-tests.md (plan + findings) and diagnostic widget; dmSpike-v0.1.x = model
                               item, YAML parser prototype, bindings, configuration, REST (smoke test + zip:
                               tools/test-spikes.sh, harness tools/vtest/dmSpike/DmSpikeHarness.java)
test-data/                     invented sample models and structures (vcycle-model.yaml; later the dummy model of dmCheck)
.github/workflows/             CI (ci.yml.disabled until tools/test-widget.sh exists; copy from the sister repo then)
```

`shared/` and `tools/` are **snapshots** of the sister repo. A fix made there is not propagated automatically: note it in
the commit and tell the PO (open question: git submodule or a common package later). `tools/test-widget.sh` and the
browser/harness checks are not copied yet: write them with the first widget (use the sister repo's as template).

## Working conventions

- Develop on the branch assigned for the session; small descriptive commits; no PRs unless asked.
- Shared code: a change in `shared/` affects every widget; rebuild/test all and bump each changed widget's version.
- Each widget has its own root class (`dd-root` for dmDefine, `dc-root` for dmCheck) so two widgets on a page never read
  each other's page model.
- `core.js` and `graph.js` must not contain `$`, `#`, backslashes or non-ASCII characters (the build enforces it).
- **Versioning**: `widgets/<w>/VERSION` N.N.N (patch = fix, minor = feature, major = incompatible). Releases are GitHub
  releases tagged `<w>-vN.N.N`.
- **No customer or project-specific data in the repo**; it is public. Never commit raw results from the PO's instance
  (PDF, PNG, Excel, JSON): they carry company templates. Keep only the findings in the docs. Test data are anonymised or
  invented (V-cycle examples).
- After editing `tests/dmSpike-v0.1.x/spike-widget/dmSpike/`, run `tools/test-spikes.sh` (parse check, harness, zip rebuild)
  and commit the zip with the sources.
- Before finishing work, run guide §13 and say plainly what could not be tested (no Polarion instance in the sandbox).
