# dmDefine — installation and configuration

**Data Model Definition** shows the project data model written as YAML in a work item, and checks it against the project
configuration. Previews below are rendered from mock data (`tools/test-widget.sh`).

## Install (Polarion administrator)

1. Download `dmDefine-N.N.N.zip` from the releases, or take `widgets/dmDefine/dist/dmDefine.zip` from the repository.
2. **Administration → Velocity Widgets → Upload** (global or project scope) and choose the zip. No server restart, no
   extension: the package holds the templates, the widget icon and the Excel library (`resources/xlsx.js`).
3. The widget appears in the widget list of LiveReport pages as *Data Model Definition*.

Target: Polarion 2512 (verified with the spike widget); 2612 not verified yet.

## Prepare the model

1. Create a LiveDoc for the model, e.g. `Model/Data Model`.
2. Add a work item of type **Text** (or another type set in the widget parameters).
3. Paste the YAML model into its description **as plain text** (Ctrl+Shift+V, or copy from a plain text editor), one
   line per line. Start from `test-data/vcycle-model.yaml` and change the roles, types, link roles and documents. A title
   or comment lines above the first key (`version:`) are allowed. The format: `docs/DATA_MODEL_FORMAT.md`.
4. Save. Baselines of the LiveDoc keep the versions of the model.

## Add the widget to a page

| Parameter | Meaning |
|---|---|
| Model document | The LiveDoc holding the model (current project) |
| Model work item type | Type of the model item (default Text) |
| Model work item id | Optional: the id of the model item, when the document holds several items of the type |
| Graph height in pixels | Height of the graph area (default 500) |

The widget reads the first item of the type with a line starting with `version:`, `model:` or `uses:`.

## Use

- **Problems** (top): errors first, then warnings, each with its line; click *line N* to see it in the model text.
- **Graph**: one box per document role (types, documents found), one line per pair of roles connected by rules, arrow
  in the link direction (source → target). Click a role or a line for the details. Rules inside one role (e.g.
  `has parent`) are listed in its box.
- Toolbar: link role filters, *Highlight roles*, zoom, *Table*, *SVG*, *Excel* (roles, item types, rules, documents,
  problems, model text), *Reload page*, *Model text*, *Copy YAML*, *Open model item*.
- To change the model: *Open model item*, edit the description, save, *Reload page*.
- PDF export: tables of problems, roles and rules.

![dmDefine graph (mock data)](preview-graph.png)

![dmDefine problems and model text (mock data)](preview-problems.png)
