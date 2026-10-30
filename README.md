# Polarion data model checker

Siemens Polarion **LiveReport widgets** to formalize the **data model** of a project and check the real data against it.

| Widget | Purpose | Status |
|---|---|---|
| **dmDefine** — Data Model Definition | A key user / project admin formalizes the main documents, the work item types each must contain and the links between them (e.g. V-cycle: `satisfies`). Shows the model as a graph and a table, validates it, helps to write it | Specification draft ([spec](widgets/dmDefine/SPECIFICATION.md)) |
| **dmCheck** — Data Model Check | Checks the real documents, items and links against the model: required links, unexpected links, required item types. Report as table and Excel, graph coloured by compliance, drill-down queries | Specification draft ([spec](widgets/dmCheck/SPECIFICATION.md)) |

The model is a **YAML** text in the description of a work item of a dedicated LiveDoc. Format (draft):
[docs/DATA_MODEL_FORMAT.md](docs/DATA_MODEL_FORMAT.md). The two widgets are independent, so dmCheck can be tested with a
hand-written dummy model.

## Principles

- Target **Polarion 2512**, compatible with **2612** (not verified yet).
- Deployed by a Polarion admin as Velocity widget zips (Administration → Velocity Widgets); no server-side extension.
- Editing the model: copy/paste into the model work item first; REST write-back later, always with the manual fallback.
- Developed **incrementally**: specification → architecture → spikes on a real instance → implementation, one widget at a time.

## Status and plan

This repository was started from [polarion_branches_copies_widget](https://github.com/borisboiakki/polarion_branches_copies_widget)
(docBranches, docCoverage, advImpact), whose Polarion knowledge, build tooling and client core it reuses.

1. Specifications of both widgets and the model format (**draft, open questions listed**).
2. Preliminary architecture (`docs/ARCHITECTURE.md`) once the specifications are agreed.
3. Spikes (YAML in a work item description, REST write-back, SQL for the checks) with diagnostic widgets in `tests/`.
4. dmDefine 0.1.0 (read, validate, show), dmCheck 0.1.0 (the three v1 checks), then the later increments.

## Repository contents

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for Claude Code: workflow, rules, Polarion facts verified on 2512 |
| `Polarion_Development_Guide.md` | Polarion development best practices (copied from the sister repo) |
| `docs/DATA_MODEL_FORMAT.md` | Draft of the model YAML |
| `docs/reference/` | Architecture of the sister widgets (reference until `docs/ARCHITECTURE.md` exists) |
| `widgets/<widget>/SPECIFICATION.md` | Requirements, decisions, spikes and open questions of each widget |
| `shared/` | Client core, Velocity snippets, Excel library: **copied** from the sister repo, to be adapted |
| `tools/` | `build-widget.py`, `vcheck.sh` (Velocity 1.4 parse check), mock Polarion objects in `tools/vtest/mocks/` |

## Build and test (once a widget exists)

```
python3 tools/build-widget.py --widget <w>    # inline shared code, check with Velocity 1.4, write dist/<w>.zip
tools/vcheck.sh                               # parse every .vm file with Velocity 1.4
```

Requires Java (Velocity 1.4), Python 3 and, for browser checks, Node with Playwright. The test script
(`tools/test-widget.sh`) and the CI workflow (`.github/workflows/ci.yml.disabled`) come from the sister repo and are enabled
with the first widget.
