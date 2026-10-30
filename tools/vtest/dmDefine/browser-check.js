// Chromium check of the dmDefine browser view rendered by DefineHarness (valid model and model with problems).
// Usage: node browser-check.js <outDir>   (needs browser.html, errors.html, pdf.html written by tools/test-widget.sh)
const { chromium } = require('playwright');
const fs = require('fs');

function expect(ok, what) {
  if (!ok) { throw new Error('CHECK FAILED: ' + what); }
  console.log('check ok: ' + what);
}

// Sheets of a downloaded workbook, read with the page's XLSX library: [{ name, rows }].
async function readBook(p, path) {
  const b64 = fs.readFileSync(path).toString('base64');
  return p.evaluate(data => {
    const wb = window.XLSX.read(data, { type: 'base64' });
    return wb.SheetNames.map(n => ({ name: n, rows: window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }) }));
  }, b64);
}

async function clickNode(p, key) {
  await p.evaluate(k => {
    const a = Array.from(document.querySelectorAll('.bw-node')).find(n => n.querySelector('title').textContent.indexOf(k + ' ') === 0);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, key);
  await p.waitForTimeout(100);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1220, height: 900 }, acceptDownloads: true });
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); } });
  const dir = process.argv[2];

  // ---------------------------------------------------------------- valid model
  await p.goto('file://' + dir + '/browser.html');
  await p.waitForTimeout(300);
  await p.screenshot({ path: dir + '/shot-graph.png', fullPage: true });
  const status = await p.textContent('.bw-status');
  console.log('status:', status);
  expect(status.startsWith('3 roles, 2 rules, 4 documents') && status.indexOf('0 errors, 0 warnings') >= 0, 'status: roles, rules, documents, no problem');
  expect((await p.textContent('.dd-probs')).indexOf('No problem found') >= 0, 'problems box: no problem');
  expect((await p.$$('.bw-node')).length === 3, 'graph: 3 role boxes');
  const labels = await p.$$eval('.bw-edge-label', els => els.map(e => e.textContent).sort());
  console.log('labels:', JSON.stringify(labels));
  expect(labels.length === 2 && labels.indexOf('satisfies') >= 0 && labels.indexOf('verifies') >= 0, 'graph: one line per pair, labelled with the link role');
  // Target role (SystemSpec) on the left: both edges start at the same x (its right side) and the arrow tip is there.
  const tips = await p.$$eval('.bw-edge', gs => gs.map(g => {
    const pts = g.querySelector('polygon').getAttribute('points').split(' ').map(s => s.split(',').map(Number));
    const d = g.querySelector('path').getAttribute('d');
    const startX = Number(d.substring(1).split(',')[0]);
    return Math.abs(pts[1][0] - startX) < 0.5;
  }));
  expect(tips.length === 2 && tips.every(x => x), 'arrows point to the target role (link direction)');
  const boxText = await p.$$eval('.bw-node', ns => ns.map(n => n.textContent).join(' | '));
  expect(boxText.indexOf('Types: subsystemRequirement ' + String.fromCharCode(8805) + '1Documents') >= 0 && boxText.indexOf('Documents: 2') >= 0, 'role box: types and documents');

  await clickNode(p, 'SubsystemReq');
  const det = await p.textContent('.bw-details');
  expect(det.indexOf('Role SubsystemReq') >= 0 && det.indexOf('Specs/Subsystem B Requirements') >= 0 && det.indexOf('L1') >= 0, 'role details: documents and rules');
  expect(await p.$eval('.bw-details a', a => a.getAttribute('href').indexOf('/wiki/Specs/Subsystem%20A%20Requirements') > 0), 'role details: document link');
  await p.evaluate(() => document.querySelector('.bw-edge .bw-hit').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(100);
  expect((await p.textContent('.bw-details')).indexOf('Rules ') === 0 || (await p.textContent('.bw-details')).indexOf('Rules ') >= 0, 'line details: rules table');

  await p.click('button:has-text("Model text")');
  const nLines = await p.$$eval('.dd-text .dd-tl', ls => ls.length);
  expect(nLines === (await p.$$eval('.dm-y', ys => ys.length)) && nLines > 40, 'model text: one row per line');
  await p.screenshot({ path: dir + '/shot-text.png', fullPage: true });

  await p.click('button:has-text("Table")');
  const heads = await p.$$eval('.bw-table-wrap .dd-h', hs => hs.map(h => h.textContent));
  expect(JSON.stringify(heads) === JSON.stringify(['Document roles', 'Link rules', 'Documents', 'Problems']), 'table view: 4 sections');
  await p.screenshot({ path: dir + '/shot-table.png', fullPage: true });

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Excel")')]);
  await dl.saveAs(dir + '/data-model.xlsx');
  const book = await readBook(p, dir + '/data-model.xlsx');
  expect(dl.suggestedFilename() === 'data-model-DMTEST.xlsx', 'Excel: file name');
  expect(JSON.stringify(book.map(s => s.name)) === JSON.stringify(['Roles', 'Item types', 'Link rules', 'Document pairs', 'Documents', 'Problems', 'Model text']), 'Excel: 7 sheets');
  expect(book[2].rows.length === 3 && book[2].rows[1][0] === 'L1' && book[2].rows[1][3] === 'satisfies', 'Excel: link rules');
  expect(book[3].rows.length === 1, 'Excel: no document pair (pooled rules only)');
  expect(book[4].rows.length === 5, 'Excel: 4 documents');

  const [svgDl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("SVG")')]);
  expect(svgDl.suggestedFilename() === 'data-model-DMTEST.svg', 'SVG export');

  // Link role filter: hiding verifies leaves one line.
  await p.click('button:has-text("Graph")');
  await p.click('label.bw-check:has-text("verifies") input');
  await p.waitForTimeout(100);
  expect((await p.$$('.bw-edge')).length === 1, 'link role filter: one line left');

  // ---------------------------------------------------------------- editor (forms) on the valid model
  await p.goto('file://' + dir + '/browser.html');
  await p.waitForTimeout(300);
  await p.click('button:has-text("Edit model")');
  expect(await p.$eval('.dd-ed', e => e.style.display !== 'none'), 'editor: opens');
  expect((await p.$$('.dd-ed-forms .dd-sec')).length === 5, 'editor: 5 form sections');
  const roleKeys = await p.$$eval('.dd-ed-forms .dd-sec:nth-child(2) .dd-card', cs => cs.map(c => c.querySelector('input').value));
  expect(JSON.stringify(roleKeys) === JSON.stringify(['SystemSpec', 'SubsystemReq', 'SystemTest']), 'editor: role cards from the model, in source order');
  expect((await p.textContent('.dd-ed-checks')).indexOf('No problem found in the forms') >= 0, 'editor: no problem in the forms');
  await p.click('button:has-text("Generate YAML")');
  const yaml1 = await p.$eval('.dd-ta', t => t.value);
  fs.writeFileSync(dir + '/roundtrip.yaml', yaml1);
  expect(yaml1.indexOf(String.fromCharCode(35) + ' Invented V-cycle data model') === 0, 'editor: header comment lines kept');
  expect(yaml1.indexOf('        - { type: subsystemRequirement, min: 1 }') > 0 && yaml1.indexOf('  SubsystemReq: ["Specs/Subsystem A Requirements", "Specs/Subsystem B Requirements"]') > 0, 'editor: YAML items and bindings');
  expect(await p.$eval('.dd-ed-text', t => t.style.display !== 'none'), 'editor: Generate YAML shows the text tab');
  // Edit: add a role with a type picked in the search-and-pick panel, check the forms, then generate.
  await p.click('.dd-ed-head button:has-text("Forms")');
  await p.click('button:has-text("+ Role")');
  const checks = await p.textContent('.dd-ed-checks');
  expect(checks.indexOf('Role Role4 lists no work item type') >= 0 && checks.indexOf('Role Role4 has no document') >= 0, 'editor: checks of a new role');
  const cards = await p.$$('.dd-ed-forms .dd-sec:nth-child(2) .dd-card');
  const last = cards[cards.length - 1];
  await (await last.$('button:has-text("+ Work item type")')).click();
  const cards2 = await p.$$('.dd-ed-forms .dd-sec:nth-child(2) .dd-card');
  await (await cards2[cards2.length - 1].$('.dd-pick')).click();
  expect(await p.$eval('.dd-pp', e => e.style.display === 'block'), 'editor: picker panel opens');
  await p.fill('.dd-pp-search', 'testc');
  const rows = await p.$$eval('.dd-pp-row', rs => rs.map(r => r.textContent));
  expect(rows.length === 1 && rows[0].indexOf('testCase') === 0, 'editor: picker search');
  await p.click('.dd-pp-row');
  expect((await p.textContent('.dd-ed-checks')).indexOf('lists no work item type') < 0, 'editor: picked type removes the check');
  await p.screenshot({ path: dir + '/shot-editor.png', fullPage: true });
  await p.click('button:has-text("Generate YAML")');
  const yaml2 = await p.$eval('.dd-ta', t => t.value);
  expect(yaml2.indexOf('    Role4:' + String.fromCharCode(10) + '      items:' + String.fromCharCode(10) + '        - { type: testCase }') > 0, 'editor: new role in the YAML');
  // Renaming a role key updates the rules and the documents that use it.
  await p.click('.dd-ed-head button:has-text("Forms")');
  const keyInput = await p.$('.dd-ed-forms .dd-sec:nth-child(2) .dd-card input');
  await keyInput.fill('Spec');
  await keyInput.dispatchEvent('change');
  await p.click('button:has-text("Generate YAML")');
  const yaml3 = await p.$eval('.dd-ta', t => t.value);
  expect(yaml3.indexOf('    Spec:') > 0 && yaml3.indexOf('to: { role: Spec, type: systemRequirement }') > 0 && yaml3.indexOf('  Spec: ["Specs/System Specification"]') > 0 && yaml3.indexOf('SystemSpec') < 0, 'editor: role rename updates rules and documents');
  const [ydl] = await Promise.all([p.waitForEvent('download'), p.click('.dd-ed-text button:has-text("Download")')]);
  expect(ydl.suggestedFilename() === 'data-model-DMTEST.yaml', 'editor: download of the YAML');

  // ---------------------------------------------------------------- model with problems
  await p.goto('file://' + dir + '/errors.html');
  await p.waitForTimeout(300);
  const probs = await p.$$eval('.dd-prob', ps => ps.map(x => x.textContent));
  console.log('problems:', probs.length);
  expect(probs.length >= 15 && probs[0].indexOf('error') === 0, 'problems box: errors first');
  expect(probs.some(x => x.indexOf('line 8') >= 0 && x.indexOf('min is greater than max') >= 0), 'problems box: line number');
  await p.click('.dd-prob .dd-line');
  await p.waitForTimeout(100);
  expect(await p.$eval('.dd-text', t => t.style.display !== 'none'), 'click on a line number opens the model text');
  expect((await p.$$('.dd-text .dd-flash')).length === 1 && (await p.$$('.dd-text .dd-bad')).length >= 8, 'model text: line highlighted, lines with problems marked');
  const errBoxes = await p.$$eval('.bw-node', ns => ns.map(n => n.textContent).join(' | '));
  expect(errBoxes.indexOf(String.fromCharCode(8635) + ' has parent') >= 0, 'role box: rule inside the role (self rule)');
  expect(errBoxes.indexOf('No document') >= 0 && errBoxes.indexOf('1 of 2 found') >= 0, 'role box: missing documents');
  await p.click('button:has-text("Edit model")');
  expect(await p.$eval('.dd-ed-head button:has-text("Forms")', b => b.disabled) && await p.$eval('.dd-ed-text', t => t.style.display !== 'none'), 'editor on a model with errors: text only');
  expect((await p.$eval('.dd-ta', t => t.value)).indexOf('colour: blue') > 0, 'editor on a model with errors: current text');
  await p.click('.dd-ed-head button:has-text("Close")');
  const cats = await p.$$eval('.bw-legend .bw-leg', ls => ls.map(l => l.textContent));
  expect(JSON.stringify(cats) === JSON.stringify(['satisfies', 'has parent']), 'legend: link roles of the drawn rules only');
  await p.screenshot({ path: dir + '/shot-errors.png', fullPage: true });

  // ---------------------------------------------------------------- paired rule
  await p.goto('file://' + dir + '/paired.html');
  await p.waitForTimeout(300);
  expect((await p.textContent('.dd-probs')).indexOf('No problem found') >= 0, 'paired: no problem');
  // Line of L2 (verifies): the edge whose tooltip summary names L2.
  await p.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.bw-edge-label'));
    const lab = labels.find(l => l.textContent === 'verifies');
    lab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await p.waitForTimeout(100);
  const pdet = await p.textContent('.bw-details');
  expect(pdet.indexOf('L2') >= 0 && pdet.indexOf('paired: Tests/STD A ' + String.fromCharCode(8594) + ' Specs/Solution Spec A') >= 0, 'paired: rule details list the pairs');
  await p.click('button:has-text("Table")');
  const pheads = await p.$$eval('.bw-table-wrap .dd-h', hs => hs.map(h => h.textContent));
  expect(pheads.indexOf('Document pairs') === 2, 'paired: table view lists the document pairs');
  const pairRows = await p.$$eval('.bw-table-wrap table', ts => ts[2].querySelectorAll('tbody tr').length);
  expect(pairRows === 2, 'paired: 2 pairs in the table');
  await p.screenshot({ path: dir + '/shot-paired.png', fullPage: true });
  await p.click('button:has-text("Graph")');
  await p.click('button:has-text("Edit model")');
  expect(await p.$$eval('.dd-pairs .dd-row', rs => rs.length) === 2, 'editor: pairs of L2 in the forms');
  await p.click('button:has-text("Generate YAML")');
  fs.writeFileSync(dir + '/roundtrip-paired.yaml', await p.$eval('.dd-ta', t => t.value));

  // ---------------------------------------------------------------- no model yet: forms on an empty model
  await p.goto('file://' + dir + '/nodoc.html');
  await p.waitForTimeout(300);
  await p.click('button:has-text("Edit model")');
  expect((await p.textContent('.dd-ed-note')).indexOf('No model yet') === 0 && (await p.$$('.dd-ed-forms .dd-card')).length === 0, 'editor without model: empty forms');
  expect((await p.textContent('.dd-ed-checks')).indexOf('Add at least one document role') >= 0, 'editor without model: check asks for a role');

  // ---------------------------------------------------------------- PDF view (static, no script)
  await p.goto('file://' + dir + '/pdf.html');
  await p.screenshot({ path: dir + '/shot-pdf.png', fullPage: true });
  expect((await p.$$('script')).length === 0 && (await p.$$('.dd-static table')).length === 2, 'PDF view: static tables, no script');

  expect(errors.length === 0, 'no JavaScript error (' + errors.join('; ') + ')');
  await b.close();
})().catch(e => { console.error(e.message || e); process.exit(1); });
