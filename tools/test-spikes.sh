#!/usr/bin/env bash
# Velocity 1.4 parse check and smoke test of the spike widgets on mocks, then rebuild of their upload zips.
# Usage: tools/test-spikes.sh [outDir]   (default: /tmp/dm-spike-test)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-/tmp/dm-spike-test}"
lib="$root/tools/.lib"
cp="$lib/velocity-1.4.jar:$lib/commons-collections-3.2.2.jar:$lib/commons-lang-2.6.jar:$lib/oro-2.0.8.jar"
echo "=== dmSpike"
w="$root/tests/dmSpike-v0.1.x/spike-widget"
"$root/tools/vcheck.sh" "$w/dmSpike/"*.vm
mkdir -p "$out/dmSpike/cls"
javac -nowarn -cp "$cp" -d "$out/dmSpike/cls" "$root/tools/vtest/dmSpike/DmSpikeHarness.java" 2>&1 | grep -v '^Picked up\|^Note:' || true
java -cp "$out/dmSpike/cls:$cp" DmSpikeHarness "$w/dmSpike" "$out/dmSpike" "$root/test-data/vcycle-model.yaml" 2>&1 | grep -v '^Picked up'
# Upload package: folder dmSpike/ at the zip root, Deflated, fixed order and dates (reproducible).
python3 - "$w" <<'PY'
import os, sys, zipfile
base = sys.argv[1]
with zipfile.ZipFile(os.path.join(base, 'dmSpike.zip'), 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(os.path.join(base, 'dmSpike'))):
        info = zipfile.ZipInfo('dmSpike/' + f, (2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, open(os.path.join(base, 'dmSpike', f), 'rb').read())
PY
echo "zip: $w/dmSpike.zip; rendered pages in $out/dmSpike"
