# Data model format (version 1)

Contract between **dmDefine** (reads, shows, validates, helps to write the model) and **dmCheck** (checks the data
against it). Status: **version 1**, implemented by dmDefine 0.1.0 (`shared/vm/dm-yaml.vm` parses it, `shared/vm/dm-model.vm`
validates it). Storage and parsing verified on 2512 (dmSpike run 1). Decisions of the PO (2026-10-30): YAML text block, stored in the description of a work item of a
dedicated LiveDoc, documents referred to by logical role plus binding, one project with optional cross-project documents.

## 1. Storage

- A dedicated **model LiveDoc** in the project (its location is a widget parameter).
- The model is the YAML text in the **description** of a work item of a configurable type (default `text`-like type, a
  widget parameter). The widget finds it by the document and the type, and optionally an id or title.
- **Decided (PO, 2026-10-30)**: one work item of type `text` holds the whole model, in a dedicated LiveDoc (baselines of
  the LiveDoc version the model). No restriction on who edits it for now.
- The description is rich text (HTML). Paste the YAML as plain text (one line per line); Polarion stores it as one
  `<span>` per line with `<br/>` separators and keeps the indentation (verified on 2512, dmSpike run 1). The widget
  turns it back into text lines; an empty line counts once, so line numbers match the editor.

## 2. Schema

The text is a **YAML subset** (valid YAML): block maps and lists indented with spaces, plain or quoted scalars,
one-level flow lists `[a, b]` and flow maps `{k: v}` of scalars, `#` comments, `null`/`true`/`false`/integers. No tabs,
anchors, multi-line scalars or nested flow collections. Keys are plain words (`A-Z a-z 0-9 _ -`, no dot: role names
are keys). Text before the
first top-level key (a title, an explanation) is ignored. It is parsed by the widgets in Velocity (ARCHITECTURE §3.3).
A complete example: `test-data/vcycle-model.yaml`; use cases with examples: `docs/MODELING_GUIDE.md`.

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

### 2.1 Several documents per role: pooled or paired (PO 2026-10-30)

A role can hold several documents (e.g. two solution specifications, several test specifications). For each link rule
the documents are either:

- **pooled** (default): the documents of a role form one set. `from_min` / `to_min` count the links to or from **any**
  document of the other role. Nothing to write: a rule without an entry in `pairs:` is pooled.
- **paired**: the rule has an entry in the local `pairs:` section, a list of `[source document, target document]`
  (source = document of the rule's `from` role, where the link is stored; target = document of its `to` role). Only the
  links between the two documents of a pair count. A link between documents of the two roles that are not paired is a
  **cross-pair link**; a document of the two roles that is in no pair is **unpaired**. Both are reported with the
  rule's severity. A document may appear in several pairs.

```yaml
bindings:
  SolutionSpec: ["Specs/Solution Spec A", "Specs/Solution Spec B"]
  SolutionSTD: ["Tests/STD A", "Tests/STD B"]
pairs:                         # local, like bindings; one entry per paired rule id
  L2:                          # L2: SolutionSTD verifies SolutionSpec
    - ["Tests/STD A", "Specs/Solution Spec A"]
    - ["Tests/STD B", "Specs/Solution Spec B"]
```

Documents are written as in `bindings` (`name`, `space/name` or `project/space/name`) and must be declared there under
the rule's roles. `pairs` is local to the checked project (not part of the reusable `model`). A document name must not
contain a comma (the entries of `[ ]` are separated by commas). Status: **dmDefine 0.2.0 validates and shows it**
(the rule id exists; each entry has two documents; the source document is declared for the rule's `from` role and the
target for its `to` role; duplicates; documents in no pair are listed as warnings, since dmCheck will report them as
unpaired). dmCheck will evaluate it (planned, 0.1.0). dmDefine 0.1.0 ignored `pairs` with a warning. Examples of the use cases: `docs/MODELING_GUIDE.md`.

### Keys, defaults and validation (dmDefine 0.2.0)

| Path | Value | Default | Checked |
|---|---|---|---|
| `version` | `1` | 1 (warning when missing) | other values: warning |
| `name`, `description` | text | — | — |
| `model.roles.<Role>` | block: `title`, `items`, `unexpected_types`, `description` | — | required: at least one role |
| `…title` | text | the role key | — |
| `…items[]` | `type` (required), `min`, `max` (whole numbers), `ignored` (`true`/`false`), `description` | min/max: none | type exists in the project; min ≤ max; type listed once |
| `…unexpected_types` | `error`, `warning`, `ignore` | `warning` | value |
| `model.links[]` | `id`, `from`, `link_role`, `to`, `from_min`, `to_min`, `severity`, `description` | id: `L<n>` (warning) | id unique |
| `…from`, `…to` | `{ role: R, type: T }` (type optional = any type of the role) | — | role defined; type listed in the role (warning) and in the project |
| `…link_role` | link role id | — | exists in the project; the graph shows its name |
| `…from_min`, `…to_min` | whole numbers | 0 | value |
| `…severity` | `error`, `warning`, `info` | `error` | value |
| `model.unexpected_links` | `error`, `warning`, `info`, `ignore` | `ignore` | value |
| `bindings.<Role>` | document or list of documents: `name` (default space), `space/name`, `project/space/name` | — | role defined; document exists; declared once; a role without document: warning |
| `uses` | — | — | not supported in 0.1.0 (error) |
| `pairs.<rule id>[]` | `[source document, target document]` | rule pooled | rule id exists; source declared for the `from` role, target for the `to` role; duplicates (warning); documents of the two roles in no pair (warning) (§2.1, dmDefine 0.2.0) |

Unknown keys are warnings (ignored). Problems carry the line of the model text.

## 3. Rules for the checker (v1)

| Check | Meaning |
|---|---|
| Required item types | Every type with `min` has at least `min` items in each bound document. |
| Unexpected item types | An item whose type is not listed in its document role is reported with `unexpected_types`. |
| Required links | `from_min`/`to_min` as above, counted only for links of `link_role` between the bound documents: any document of the other role (pooled) or the paired documents only (paired, §2.1). |
| Pairs (paired rules) | Cross-pair links and unpaired documents, with the rule's severity (§2.1). |
| Forbidden/unexpected links | A link of a role used by the model that goes between modelled documents but matches no rule (wrong direction, wrong target document or type) is reported. A role the model never mentions is ignored. |
| Later | Orphan items (no link at all), items in the wrong document, mandatory field values, statuses, max cardinalities. |

Link direction follows Polarion: the link is stored on the source item and points to the target (verified on 2512:
`satisfies` source = downstream item). Rules are written in the direction of storage (`from` = source).

## 4. Open points

- Binding by document type / name pattern: dropped from v1 (PO: documents are declared explicitly). May return later.
- Reuse: `uses:` one level, no local override of `model` keys in v0.2; pinning a revision (`PROJ/ID@rev`) later.
- Versioning of the model: baselines/revisions of the model LiveDoc give it for free; the checker should show the
  revision of the model it used.
- Schema evolution: the `version:` number; unknown keys are warnings, not errors.
- Documents of another project in `bindings` (`project/space/name`) are resolved by the same SQL query, but this form
  is not verified on 2512 yet (dmSpike S5 run 3), and their types are validated against the current project only.
