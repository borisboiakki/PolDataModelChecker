# Data model format (draft v0.1)

Contract between **dmDefine** (reads, shows, validates, helps to write the model) and **dmCheck** (checks the data
against it). Status: **draft for discussion**, nothing here is verified on Polarion yet (see the spikes in the widget
specifications). Decisions of the PO (2026-10-30): YAML text block, stored in the description of a work item of a
dedicated LiveDoc, documents referred to by logical role plus binding, one project with optional cross-project documents.

## 1. Storage

- A dedicated **model LiveDoc** in the project (its location is a widget parameter).
- The model is the YAML text in the **description** of a work item of a configurable type (default `text`-like type, a
  widget parameter). The widget finds it by the document and the type, and optionally an id or title.
- **Decided (PO, 2026-10-30)**: one work item of type `text` holds the whole model, in a dedicated LiveDoc (baselines of
  the LiveDoc version the model). No restriction on who edits it for now.
- The description is rich text (HTML). The widget extracts the text of the YAML block (spike S1).
  To stay editable by hand, the YAML must be tolerant to what the editor does to it (line breaks, `&nbsp;`, quotes).

## 2. Draft schema

The text is a **YAML subset** (valid YAML): block maps and lists indented with spaces, plain or quoted scalars,
one-level flow lists `[a, b]` and flow maps `{k: v}` of scalars, `#` comments, `null`/`true`/`false`/integers. No tabs,
anchors, multi-line scalars or nested flow collections. It is parsed by the widgets in Velocity (ARCHITECTURE §3.3).

Two parts with different scopes (PO 2026-10-30: the model must be reusable, the documents are declared by the user):
- `model`: project-neutral (roles, item types, link rules): reusable;
- `bindings`: local to the checked project (role → explicit list of documents; branches/copies only if listed).

```yaml
version: 1                     # schema version
name: V-cycle model

model:
  roles:                       # logical document roles: stable names used by the rules
    SystemSpec:
      title: System specification
      items:                   # work item types of this role
        - type: systemRequirement
          min: 1               # required: at least min items per bound document (omit = allowed, not required)
        - type: heading
          ignored: true        # allowed, not counted by the rules
      unexpected_types: error  # severity for other types: error | warning | ignore
    SubsystemReq:
      title: Subsystem requirements
      items:
        - { type: subsystemRequirement, min: 1 }

  links:                       # link rules, written in the direction of storage (from = link source)
    - id: L1
      from: { role: SubsystemReq, type: subsystemRequirement }
      link_role: satisfies     # link role id (project configuration)
      to: { role: SystemSpec, type: systemRequirement }
      from_min: 1              # each from item has >= 1 such link (downstream traceability)
      to_min: 1                # each to item is targeted by >= 1 such link (upstream coverage)
      severity: error          # error | warning | info
  unexpected_links: warning    # links of a role used above, between declared documents, matching no rule

bindings:                      # local: the documents of this project (or project/space/name)
  SystemSpec: ["Specs/System Specification"]
  SubsystemReq: ["Specs/Subsystem A Requirements", "Specs/Subsystem B Requirements"]
```

Reuse by reference (dmDefine 0.2.0, ARCHITECTURE §3.4): the local item holds only

```yaml
version: 1
uses: "SYSENG/SE-12"           # project/work item id of an item holding a `model` part (one level only)
bindings:
  SystemSpec: ["Specs/System Specification"]
  SubsystemReq: ["Specs/Subsystem A Requirements"]
```

## 3. Rules for the checker (v1)

| Check | Meaning |
|---|---|
| Required item types | Every type with `min` has at least `min` items in each bound document. |
| Unexpected item types | An item whose type is not listed in its document role is reported with `unexpected_types`. |
| Required links | `from_min`/`to_min` as above, counted only for links of `link_role` between the bound documents. |
| Forbidden/unexpected links | A link of a role used by the model that goes between modelled documents but matches no rule (wrong direction, wrong target document or type) is reported. A role the model never mentions is ignored. |
| Later | Orphan items (no link at all), items in the wrong document, mandatory field values, statuses, max cardinalities. |

Link direction follows Polarion: the link is stored on the source item and points to the target (verified on 2512:
`satisfies` source = downstream item). Rules are written in the direction of storage (`from` = source).

## 4. Open points

- Binding by document type / name pattern: dropped from v1 (PO: documents are declared explicitly). May return later.
- Reuse: `uses:` one level, no local override of `model` keys in v0.2; pinning a revision (`PROJ/ID@rev`) later.
- Versioning of the model: baselines/revisions of the model LiveDoc give it for free; the checker should show the
  revision of the model it used.
- Schema evolution: `model:` number; unknown keys are warnings, not errors.
