# Spike of dmDefine 0.1.x — model item, YAML parser in Velocity, bindings, REST

Diagnostic widget and test plan used to verify, on Polarion 2512 (later 2612), the hypotheses of `docs/ARCHITECTURE.md`
§9 before dmDefine 0.1.0 is built.

| Path | Content |
|---|---|
| `spike-tests.md` | Questions S1–S8, setup, run sheet, findings |
| `spike-widget/dmSpike/` | Diagnostic widget (sources). Read-only, except the explicit REST PATCH button (writes the description back unchanged, after a confirmation) |
| `spike-widget/dmSpike.zip` | Upload package (folder `dmSpike/` at the zip root, Deflated), rebuilt by `tools/test-spikes.sh` |

Local check: `tools/test-spikes.sh` parses the templates with Velocity 1.4, renders them on mocks
(`tools/vtest/dmSpike/DmSpikeHarness.java`, including the sample model `test-data/vcycle-model.yaml`) and rebuilds the zip.
The mocks check the template logic only; Polarion's behaviour is what the spike measures.
Raw results from Polarion are **not committed** (public repository); only the findings are kept.
