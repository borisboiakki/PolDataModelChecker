# Polarion data model checker

Siemens Polarion **LiveReport widgets** to formalize the **data model** of a project and check the real data against it.

| Widget | Purpose | Status | Docs |
|---|---|---|---|
| <img src="docs/dmDefine/icon.svg" width="32" alt=""> **dmDefine** — Data Model Definition | A key user / project admin formalizes the main documents (roles), the work item types each must contain and the links between them (e.g. V-cycle: `satisfies`). Shows the model as a graph and tables, validates it against the project configuration, lists the problems with their line | **0.1.0** (built and tested on mocks; to validate on 2512) | [install](docs/dmDefine/install.md) · [specification](widgets/dmDefine/SPECIFICATION.md) |
| **dmCheck** — Data Model Check | Checks the real documents, items and links against the model: required links, unexpected links, required item types. Report as table and Excel, graph coloured by compliance, drill-down queries | Specification draft | [specification](widgets/dmCheck/SPECIFICATION.md) |

![dmDefine preview rendered from the sample model (mock data)](docs/dmDefine/preview-graph.png)

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
2. Preliminary architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (**draft, to be revised after the spikes**).
3. Spikes with diagnostic widgets in `tests/`: **dmSpike** ([run sheet](tests/dmSpike-v0.1.x/spike-tests.md)) for the
   model item, the YAML parser in Velocity, bindings, configuration and REST (**done on 2512: model reading, parser, configuration and REST GET/PATCH confirmed**); SQL of the checks later.
4. **dmDefine 0.1.0** (read, validate, show): built; next dmCheck spike (SQL of the checks) and dmCheck 0.1.0.

## Repository contents

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for Claude Code: workflow, rules, Polarion facts verified on 2512 |
| `Polarion_Development_Guide.md` | Polarion development best practices (copied from the sister repo) |
| `docs/DATA_MODEL_FORMAT.md` | Draft of the model YAML |
| `docs/ARCHITECTURE.md` | Preliminary architecture (model pipeline, parser, checks, page model, spikes) |
| `docs/reference/` | Architecture of the sister widgets (reference for the reused parts) |
| `widgets/<widget>/SPECIFICATION.md` | Requirements, decisions, spikes and open questions of each widget |
| `shared/` | Client core, Velocity snippets, Excel library: **copied** from the sister repo, to be adapted |
| `widgets/<widget>/src/`, `dist/`, `VERSION` | Widget sources, generated package (`dist/<widget>.zip`, committed), version |
| `docs/<widget>/` | Install guide, previews, icon source |
| `tools/` | `build-widget.py`, `test-widget.sh`, `test-spikes.sh`, `vcheck.sh`; harnesses and mocks in `tools/vtest/` (`dmmocks/` for this repo, `mocks/` copied from the sister repo) |
| `tests/dmSpike-v0.1.x/` | Spike widget and run sheet for dmDefine 0.1.x |
| `test-data/` | Invented sample model (`vcycle-model.yaml`) |

## Build and test

```
python3 tools/build-widget.py                 # all widgets: inline shared code, check with Velocity 1.4, write the zips
tools/test-widget.sh [widget|all] [outDir]    # build + Velocity 1.4 render on mock data + Chromium checks (+ spikes)
tools/test-spikes.sh                          # spike widgets: parse check, smoke test, zip rebuild
tools/vcheck.sh                               # parse every .vm file with Velocity 1.4
```

Requires Java (Velocity 1.4), Python 3 and Node with Playwright (browser checks).

## Continuous integration and releases

- **CI** (`.github/workflows/ci.yml`): on every push and pull request, runs `tools/test-widget.sh all` and checks that the
  committed `widgets/*/dist` and spike zips match the sources.
- **Release** (`.github/workflows/release.yml`): each widget has its own version in `widgets/<widget>/VERSION`. Publish a
  GitHub release with the tag **`<widget>-vN.N.N`** (e.g. `dmDefine-v0.1.0`); the workflow tests the widget, stamps the
  version and attaches `<widget>-N.N.N.zip`.
