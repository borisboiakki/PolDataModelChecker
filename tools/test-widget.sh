#!/usr/bin/env bash
# Build each widget, render it with Velocity 1.4 against mock Polarion objects, then load the browser and PDF output
# in Chromium (Playwright), take screenshots and test the interactions. "all" also runs tools/test-spikes.sh.
# Usage: tools/test-widget.sh [widget|all] [outDir]      (defaults: all, /tmp/dm-widget-test)
# Per widget: tools/vtest/<widget>/*Harness.java (main class = that file; arguments widgetDir outDir repoRoot) and
# tools/vtest/<widget>/browser-check.js. Mocks: tools/vtest/dmmocks/DmMocks.java, compiled with every harness.
# The harness writes <name>-fragment.html files; each is wrapped into <name>.html here.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
which="${1:-all}"
base="${2:-/tmp/dm-widget-test}"
if [ "$which" = all ]; then
  mapfile -t widgets < <(cd "$root/tools/vtest" && for d in */; do [ -d "$root/widgets/${d%/}" ] && echo "${d%/}"; done)
else
  widgets=("$which")
fi
lib="$root/tools/.lib"   # Velocity 1.4 jars, downloaded by tools/vcheck.sh (run by the build)
cp="$lib/velocity-1.4.jar:$lib/commons-collections-3.2.2.jar:$lib/commons-lang-2.6.jar:$lib/oro-2.0.8.jar"
for w in "${widgets[@]}"; do
  echo "=== $w"
  out="$base/$w"
  rm -rf "$out" && mkdir -p "$out/cls"
  python3 "$root/tools/build-widget.py" --widget "$w"
  main="$(cd "$root/tools/vtest/$w" && ls *Harness.java | head -1)"
  javac -nowarn -cp "$cp" -d "$out/cls" "$root/tools/vtest/dmmocks/DmMocks.java" "$root/tools/vtest/$w/"*.java 2>&1 | grep -v '^Picked up\|^Note:' || true
  java -cp "$out/cls:$cp" "${main%.java}" "$root/widgets/$w/dist/$w" "$out" "$root" 2>&1 | grep -v '^Picked up'
  for f in "$out"/*-fragment.html; do
    name="$(basename "$f" -fragment.html)"
    { printf '<!doctype html><html><head><meta charset="utf-8"><title>%s</title></head><body style="margin:16px;width:1180px">' "$name"
      cat "$f"; echo '</body></html>'; } > "$out/$name.html"
    # Polarion turns the directive into a script tag; emulate it (the Velocity 1.4 harness leaves it as text).
    sed -i 's|#loadWidgetJs("resources/xlsx.js")|<script src="resources/xlsx.js"></script>|' "$out/$name.html"
  done
  mkdir -p "$out/resources" && cp "$root/widgets/$w/dist/$w/resources/xlsx.js" "$out/resources/"
  node "$root/tools/vtest/$w/browser-check.js" "$out"
  # Round trip of the editor (dmDefine): the YAML generated in the browser is read again by the Velocity pipeline.
  if [ -f "$out/roundtrip.yaml" ]; then
    java -cp "$out/cls:$cp" "${main%.java}" --roundtrip "$root/widgets/$w/dist/$w" "$out" "$root" 2>&1 | grep -v '^Picked up'
  fi
  echo "Screenshots and exports in $out"
done
if [ "$which" = all ]; then
  "$root/tools/test-spikes.sh" "$base/spikes"
fi
