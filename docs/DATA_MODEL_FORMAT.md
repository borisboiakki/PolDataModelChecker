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

```yaml
model: 1                       # schema version
name: V-cycle model
projects: [ ]                  # optional: other projects whose documents may be bound (default: this project only)

documents:                     # logical roles: stable names used by the rules
  SystemSpec:
    title: System specification
    bind:                      # PO 2026-10-30: the user lists the documents explicitly (branches/copies only if listed)
      - "Specs/System Specification"           # space/name, or "project/space/name" for another project
    items:                     # work item types allowed/required in this document
      - type: systemRequirement
        required: true         # at least min items (default min: 1 when required)
        min: 1
        max: null
      - type: heading          # allowed, ignored by the rules
        ignored: true
    unexpected_types: error    # severity for other types: error | warning | ignore

  SubsystemReq:
    title: Subsystem requirements
    bind: ["Specs/Subsystem A Requirements", "Specs/Subsystem B Requirements"]  # several documents may fill one role
    items:
      - type: subsystemRequirement
        required: true

links:                         # link rules
  - id: L1
    from: { document: SubsystemReq, type: subsystemRequirement }   # link source (stored on this item)
    role: satisfies            # link role id (Polarion project configuration)
    to:   { document: SystemSpec,   type: systemRequirement }      # link target
    from_min: 1                # each `from` item must have >= 1 such link ("required link", downstream coverage)
    to_min: 1                  # each `to` item must be targeted by >= 1 such link ("coverage" of the upstream item)
    severity: error            # error | warning | info
  - id: L2
    allow_other: false         # forbidden/unexpected links: links with this role between these documents that
    from: { document: SubsystemReq }     # match no rule are reported
    role: satisfies
    to:   { document: SystemSpec }
```

## 3. Rules for the checker (v1)

| Check | Meaning |
|---|---|
| Required item types | Every `required` type has at least `min` items in each bound document (or per role). |
| Unexpected item types | An item whose type is not listed in its document role is reported with `unexpected_types`. |
| Required links | `from_min`/`to_min` as above, counted only for links of `role` between the bound documents. |
| Forbidden/unexpected links | A link of a role used by the model that goes between modelled documents but matches no rule (wrong direction, wrong target document or type) is reported. A role the model never mentions is ignored. |
| Later | Orphan items (no link at all), items in the wrong document, mandatory field values, statuses, max cardinalities. |

Link direction follows Polarion: the link is stored on the source item and points to the target (verified on 2512:
`satisfies` source = downstream item). Rules are written in the direction of storage (`from` = source).

## 4. Open points

- Binding by document type / name pattern: dropped from v1 (PO: documents are declared explicitly). May return later.
- Inheritance between models, reuse across projects (out of scope of v1).
- Versioning of the model: baselines/revisions of the model LiveDoc give it for free; the checker should show the
  revision of the model it used.
- Schema evolution: `model:` number; unknown keys are warnings, not errors.
