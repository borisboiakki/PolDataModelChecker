// Chromium check of the dmCheck browser view rendered by CheckHarness (test structure of test-data/vcycle-check).
// Usage: node browser-check.js <outDir>   (needs browser.html, model-error.html, pdf.html written by tools/test-widget.sh)
const { chromium } = require('playwright');
const fs = require('fs');

function expect(ok, what) {
  if (!ok) { throw new Error('CHECK FAILED: ' + what); }
  console.log('check ok: ' + what);
}

async function readBook(p, path) {
  const b64 = fs.readFileSync(path).toString('base64');
  return p.evaluate(data => {
    const wb = window.XLSX.read(data, { type: 'base64' });
    return wb.SheetNames.map(n => ({ name: n, rows: window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) }));
  }, b64);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1220, height: 900 }, acceptDownloads: true });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); } });
  const dir = process.argv[2];

  await p.goto('file://' + dir + '/browser.html');
  await p.waitForTimeout(300);
  await p.screenshot({ path: dir + '/shot-graph.png', fullPage: true });
  const chips = await p.$$eval('.dc-chip', cs => cs.map(c => c.textContent));
  console.log('summary:', JSON.stringify(chips));
  expect(chips[0] === '4 errors' && chips[1] === '7 warnings' && chips[2] === '0 info' && chips[3] === '20 work items, 12 links checked', 'summary: 4 errors, 7 warnings (structure.md), items and links');
  expect((await p.$$('.bw-node')).length === 3, 'graph: 3 roles');
  const edges = await p.$$eval('.bw-edge path:first-child', ps => ps.map(x => x.getAttribute('stroke')));
  expect(edges.length === 2 && edges.indexOf('rgb(198,40,40)') >= 0 && edges.indexOf('rgb(211,120,0)') >= 0, 'graph: L1 red (errors), L2 orange (warnings)');
  const labels = await p.$$eval('.bw-edge-label', ls => ls.map(l => l.textContent).sort());
  console.log('labels:', JSON.stringify(labels));
  expect(JSON.stringify(labels) === JSON.stringify(['errors 3', 'warnings 6']), 'graph: violations per severity on the lines');
  const boxes = await p.$$eval('.bw-node', ns => ns.map(n => n.textContent).join(' | '));
  expect(boxes.indexOf('Items: 5, without violation: 60%') >= 0 && boxes.indexOf('Types: 1 unexpected') >= 0, 'role box: customer specification (5 counted items, 2 with a violation; 1 unexpected type)');
  expect(boxes.indexOf(String.fromCharCode(8635) + ' P1: compliant') >= 0, 'role box: rule inside the role (P1 compliant)');

  // Details of a line and of a role.
  await p.evaluate(() => Array.from(document.querySelectorAll('.bw-edge-label')).find(l => l.textContent === 'warnings 6').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(100);
  const det = await p.textContent('.bw-details');
  expect(det.indexOf('L2:') >= 0 && det.indexOf('(paired)') > 0 && det.indexOf('cross-pair links: 1') > 0 && det.indexOf('Violations of L2 (6)') > 0, 'line details: L2 counters and its 6 violations');
  expect(await p.$$eval('.bw-details a', as => as.some(a => a.getAttribute('href').indexOf('workitem?id=STA-3') > 0)), 'line details: work item links');
  // Drill-down (dmCheck 0.2): L2 from STD A (STA-3, STA-4), to Solution Spec A (SPA-4, SPA-5) and Solution Spec B (SPB-3).
  const drill = await p.$$eval('.bw-details .dc-drill li', lis => lis.map(li => ({ t: li.textContent, h: li.querySelector('a').getAttribute('href') })));
  expect(drill.length === 3 && drill.some(d => d.t.indexOf('missing link (source), Tests/STD A: 2 items') === 0) &&
    drill.some(d => d.t.indexOf('not covered (target), Specs/Solution Spec A: 2 items') === 0) &&
    drill.some(d => d.t.indexOf('not covered (target), Specs/Solution Spec B: 1 item') === 0), 'line details: drill-down per document with counts');
  const dq = decodeURIComponent(drill[0].h.substring(drill[0].h.indexOf('?query=') + 7));
  expect(drill[0].h.indexOf('/project/DMTEST/workitems?query=') > 0 && dq.indexOf('project.id:DMTEST AND SQL:(SELECT w.c_uri FROM workitem w') === 0 && dq.indexOf(' NOT IN (SELECT l.fk_uri_p_workitem') > 0,
    'line details: drill-down link = work items table with the Lucene SQL query');
  await p.click('.bw-details .dc-drill li button');
  await p.waitForTimeout(200);
  expect(['Copied', 'Copy failed'].indexOf(await p.textContent('.bw-details .dc-drill li button')) >= 0, 'line details: Copy query answers');
  await p.evaluate(() => Array.from(document.querySelectorAll('.bw-node')).find(n => n.querySelector('title').textContent.indexOf('CustomerSpec') === 0).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
  await p.waitForTimeout(100);
  const rdet = await p.textContent('.bw-details');
  expect(rdet.indexOf('Role CustomerSpec') === 0 && rdet.indexOf('CUS-6: type information is not listed in role CustomerSpec.') > 0, 'role details: documents and the unexpected type');
  expect(rdet.indexOf('unexpected type, Specs/Customer Specification: 1 item') > 0, 'role details: drill-down of the unexpected type');

  // Table view, filters.
  await p.click('button:has-text("Table")');
  const vrows = async () => p.$$eval('.bw-table-wrap table', ts => ts[0].querySelectorAll('tbody tr').length);
  expect(await vrows() === 11, 'table: 11 violations');
  await p.fill('.dc-filter', 'STA-3');
  await p.waitForTimeout(100);
  expect(await vrows() === 2, 'table: text filter (STA-3: missing link and cross-pair link)');
  await p.fill('.dc-filter', '');
  await p.click('label.bw-check:has-text("Warnings") input');
  await p.waitForTimeout(100);
  expect(await vrows() === 4, 'table: warnings hidden, 4 errors left');
  await p.click('label.bw-check:has-text("Warnings") input');
  await p.screenshot({ path: dir + '/shot-table.png', fullPage: true });

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Excel")')]);
  await dl.saveAs(dir + '/check.xlsx');
  const book = await readBook(p, dir + '/check.xlsx');
  expect(JSON.stringify(book.map(s => s.name)) === JSON.stringify(['Rules', 'Violations', 'Documents', 'Queries', 'Model problems']), 'Excel: 5 sheets');
  expect(book[3].rows.length === 13 && book[3].rows.filter(r => String(r[4]).indexOf('SQL:(') > 0).length === 12, 'Excel: 12 drill-down queries');
  expect(book[1].rows.length === 12 && book[0].rows.length === 4 && book[2].rows.length === 6, 'Excel: 11 violations, 3 rules, 5 documents');

  // Exploded view (K17): documents in role frames, pooled L1 arrows to the CustomerSpec frame, L2 per pair, cross-pair dotted.
  await p.goto('file://' + dir + '/browser.html');
  await p.waitForTimeout(300);
  await p.click('.bw-viewsw button:has-text("Exploded")');
  await p.waitForTimeout(200);
  const xlab = await p.$$eval('.bw-edge-label', ls => ls.map(l => l.textContent).sort());
  console.log('exploded labels:', JSON.stringify(xlab));
  expect(JSON.stringify(xlab) === JSON.stringify(['L1 errors 1', 'L1 errors 1', 'L2 warnings 1', 'L2 warnings 4', 'cross-pair 1']), 'exploded view: arrows per document / pair with their violations (structure.md)');
  const xdocs = await p.$$eval('.bw-doc', ds => ds.map(d => d.textContent));
  expect(xdocs.length === 5 && xdocs.some(t => t.indexOf('STD B') === 0 && t.indexOf('without violation: 100%') > 0) &&
    xdocs.some(t => t.indexOf('Customer Specification') === 0 && t.indexOf('L1: 1 not covered') > 0), 'exploded view: documents with their counts and violations');
  await p.screenshot({ path: dir + '/shot-exploded.png', fullPage: true });
  await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.bw-toolbar label')).find(x => x.textContent.indexOf('Warnings') >= 0); l.querySelector('input').click(); });
  await p.waitForTimeout(200);
  const xlab2 = await p.$$eval('.bw-edge-label', ls => ls.map(l => l.textContent).sort());
  expect(JSON.stringify(xlab2) === JSON.stringify(['L1 errors 1', 'L1 errors 1']), 'exploded view: Show filters the arrows (warnings hidden)');

  // Severity per side (K18): L1 sources info / targets error, L2 targets error / sources warning.
  await p.goto('file://' + dir + '/sides.html');
  await p.waitForTimeout(300);
  const ssum = await p.$$eval('.dc-sum .dc-chip', cs => cs.map(c => c.textContent));
  console.log('sides summary:', JSON.stringify(ssum));
  expect(ssum[0] === '5 errors' && ssum[1] === '4 warnings' && ssum[2] === '2 info', 'severity per side: summary 5 errors, 4 warnings, 2 info');
  const slabels = await p.$$eval('.bw-edge-label', ls => ls.map(l => l.textContent).sort());
  console.log('sides labels:', JSON.stringify(slabels));
  expect(JSON.stringify(slabels) === JSON.stringify(['errors 1 + info 2', 'errors 3 + warnings 3']), 'severity per side: line labels per severity (both lines red: worst severity found)');
  await p.evaluate(() => Array.from(document.querySelectorAll('.bw-edge-label')).find(l => l.textContent.indexOf('info') >= 0).dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(100);
  const sdet = await p.textContent('.bw-details');
  expect(sdet.indexOf('(sources: info, targets: error)') > 0 && sdet.indexOf('1 error, 2 info') > 0, 'severity per side: L1 details (severities and violations per severity)');

  // Model with an error: nothing checked.
  await p.goto('file://' + dir + '/model-error.html');
  await p.waitForTimeout(300);
  expect((await p.textContent('.dc-sum')).indexOf('The model has errors') === 0 && (await p.textContent('.dc-probs')).indexOf('nosuchrole') > 0, 'model with an error: problems shown, nothing checked');
  await p.screenshot({ path: dir + '/shot-error.png', fullPage: true });

  await p.goto('file://' + dir + '/pdf.html');
  expect((await p.$$('script')).length === 0 && (await p.$$('.dc-static table')).length === 3, 'PDF view: static tables, no script');
  await p.screenshot({ path: dir + '/shot-pdf.png', fullPage: true });

  expect(errors.length === 0, 'no JavaScript error (' + errors.join('; ') + ')');
  await b.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
