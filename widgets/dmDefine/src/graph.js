  /*
   * Data Model Definition - client-side view (widget-specific part).
   *
   * tools/build-widget.py inlines shared/js/core.js and this file into render.vm, inside one IIFE.
   * Same restrictions as core.js: no dollar sign, hash sign, backslash or non-ASCII character.
   *
   * The model is parsed and validated on the server (shared/vm/dm-*.vm); this code only reads the page model.
   * Nodes = document roles. Edges = link rules between two different roles, grouped per pair:
   * o = target role (left), c = source role; the arrow follows the link direction (arrowAtOrigin).
   * Rules between items of the same role are listed in the role box.
   */

  var ROLE_STYLES = [
    { color: 'rgb(51,103,214)', dash: '' },
    { color: 'rgb(198,40,40)', dash: '9,5' },
    { color: 'rgb(26,127,55)', dash: '2,4' },
    { color: 'rgb(142,68,173)', dash: '6,3' },
    { color: 'rgb(211,84,0)', dash: '12,4,2,4' }
  ];
  var GE = String.fromCharCode(8805);
  var LOOP = String.fromCharCode(8635);
  var NL = String.fromCharCode(10);
  var SEVERITIES = ['error', 'warning', 'info'];

  function parts(s, sep) {
    return (s || '').split(sep).filter(function (x) { return x !== ''; });
  }

  function readModel(root) {
    var nodes = [];
    var byKey = {};
    var project = root.dataset.project || '';
    var rEls = root.querySelectorAll('.bw-model .dm-r');
    for (var i = 0; i < rEls.length; i++) {
      var d = rEls[i].dataset;
      var n = {
        key: d.k, project: project, id: d.k, title: d.title || d.k, space: '', col: '', rev: '', items: -1,
        line: toInt(d.line), unexp: d.unexp || 'warning', bound: d.bound === '1', el: rEls[i],
        types: parts(d.types, ';').map(function (p) {
          var f = p.split('|');
          return { type: f[0], min: toInt(f[1]), max: toInt(f[2]), ignored: f[3] === '1' };
        }),
        docs: parts(d.docs, ';').map(function (p) {
          var f = p.split('|');
          return { decl: f[0], project: f[1] || project, space: f[2] || '', name: f[3] || '', found: f[4] === '1', title: f[5] || '' };
        }),
        selfRules: []
      };
      if (n.key && !byKey[n.key]) { byKey[n.key] = n; nodes.push(n); }
    }
    var rules = [];
    var lEls = root.querySelectorAll('.bw-model .dm-l');
    for (var j = 0; j < lEls.length; j++) {
      var a = lEls[j].dataset;
      rules.push({
        id: a.id, from: a.from, ft: a.ft || '', role: a.role, rname: a.rn || a.role, to: a.to, tt: a.tt || '',
        fmin: toInt(a.fmin), tmin: toInt(a.tmin), sev: a.sev || 'error', line: toInt(a.line),
        fsev: a.fsev || a.sev || 'error', tsev: a.tsev || a.sev || 'error',
        paired: a.paired === '1',
        pairs: parts(a.pairs, ';').map(function (p) { var f = p.split('|'); return { s: f[0], t: f[1] || '' }; })
      });
    }
    var probs = [];
    var pEls = root.querySelectorAll('.bw-model .dm-p');
    for (var k = 0; k < pEls.length; k++) {
      var p = pEls[k].dataset;
      probs.push({ sev: p.sev, line: toInt(p.line), msg: p.msg || '' });
    }
    probs.sort(function (x, y) {
      return SEVERITIES.indexOf(x.sev) - SEVERITIES.indexOf(y.sev) || x.line - y.line;
    });
    var lines = [];
    var yEls = root.querySelectorAll('.bw-model .dm-y');
    for (var m = 0; m < yEls.length; m++) { lines.push(yEls[m].getAttribute('data-t') || ''); }

    // Rules between two different roles -> one edge per pair; same role -> listed in the role box.
    var edges = [];
    var edgeBy = {};
    rules.forEach(function (r) {
      if (!byKey[r.from] || !byKey[r.to] || !r.role) { return; }
      r.drawn = true;
      if (r.from === r.to) { byKey[r.from].selfRules.push(r); return; }
      var key = r.to + '>' + r.from;
      var e = edgeBy[key];
      if (!e) {
        e = edgeBy[key] = { o: r.to, c: r.from, kinds: {}, meta: {}, indirect: false, samples: [], rules: [] };
        edges.push(e);
      }
      e.kinds[r.role] = (e.kinds[r.role] || 0) + 1;
      e.rules.push(r);
    });
    return { nodes: nodes, byKey: byKey, rules: rules, probs: probs, lines: lines, edges: edges };
  }

  // Link roles of the drawn rules (both roles defined), in order of appearance, one line style each (the styles repeat
  // after five).
  function readCats(rules) {
    var cats = [];
    var seen = {};
    rules.forEach(function (r) {
      if (!r.drawn || seen[r.role]) { return; }
      seen[r.role] = true;
      var st = ROLE_STYLES[cats.length % ROLE_STYLES.length];
      cats.push({ id: r.role, name: r.rname, label: r.rname, color: st.color, dash: st.dash });
    });
    return cats;
  }

  function endText(role, type) {
    return role + (type ? ' / ' + type : '');
  }

  function typeText(t) {
    var s = t.type;
    if (t.ignored) { return s + ' (ignored)'; }
    if (t.min >= 0) { s += ' ' + GE + t.min; }
    if (t.max >= 0) { s += ' max ' + t.max; }
    return s;
  }

  // Counted types for the role box (ignored types are in the details); "+N" when they do not fit.
  function boxTypes(n) {
    var shown = n.types.filter(function (t) { return !t.ignored; }).map(typeText);
    var text = shown.join(', ');
    for (var k = shown.length - 1; text.length > 28 && k > 0; k--) {
      text = shown.slice(0, k).join(', ') + ' +' + (shown.length - k);
    }
    return text;
  }

  function ruleText(r) {
    var s = r.id + ': ' + (r.ft || 'any type') + ' ' + r.rname + ' ' + (r.tt || 'any type');
    if (r.fmin > 0) { s += '; each source item ' + GE + r.fmin; }
    if (r.tmin > 0) { s += '; each target item ' + GE + r.tmin; }
    if (r.paired) { s += '; paired documents (' + r.pairs.length + ')'; }
    return s + ' (' + sevText(r) + ')';
  }

  // "error", or "sources: info, targets: error" when the sides differ (D17).
  function sevText(r) {
    if (r.fsev === r.sev && r.tsev === r.sev) { return r.sev; }
    var p = [];
    if (r.fmin > 0 || r.fsev !== r.sev) { p.push('sources: ' + r.fsev); }
    if (r.tmin > 0 || r.tsev !== r.sev) { p.push('targets: ' + r.tsev); }
    if (r.paired) { p.push('pairs: ' + r.sev); }
    return p.join(', ');
  }

  // "pooled" or "paired: source -> target; ..." (documents of the current project as space/name).
  function pairsText(r) {
    if (!r.paired) { return 'pooled'; }
    return 'paired: ' + r.pairs.map(function (p) { return p.s + ' ' + ARROW + ' ' + p.t; }).join('; ');
  }

  function Widget(root) {
    var model = readModel(root);
    this.cats = readCats(model.rules);
    initBase(this, root, model);
    var ds = root.dataset;
    this.filePrefix = 'data-model-';
    this.emptyText = 'The model defines no document role.';
    this.isolatedText = 'Roles without rules to other roles';
    this.searchText = 'Highlight roles';
    this.arrowAtOrigin = true;
    this.item = { id: ds.item || '', project: ds.itemProject || this.project, rev: ds.rev || '' };
    // uses: reference (0.4.0): roles and rules come from another work item ("project/id").
    this.uses = ds.uses || '';
    this.usesRev = ds.usesRev || '';
    this.unexp = ds.unexp || 'ignore';
    var st = this.state;
    st.mode = 'all';
    st.counts = false;
    st.extras = [];
    st.rel = relFromData('', this.cats);
    st.baseLines = model.nodes.some(function (n) { return n.selfRules.length; }) ? 5 : 4;
    this.build();
    this.render(true);
  }
  extendBase(Widget);

  Widget.prototype.build = function () {
    var self = this;
    this.probBox = el('div', { 'class': 'dd-probs' }, this.root);
    this.drawProblems();
    var bar = el('div', { 'class': 'bw-toolbar' }, this.root);
    if (this.cats.length) { this.kindChecks(bar, 'Link roles:'); }
    this.searchBox(bar);
    this.viewButtons(bar);
    var more = el('span', { 'class': 'bw-btns' }, bar);
    this.button(more, 'Model text', 'Show or hide the YAML text of the model with line numbers', function () { self.toggleText(); });
    this.button(more, 'Copy YAML', 'Copy the YAML text of the model to the clipboard', function () { self.copyYaml(); });
    this.editBtn = this.button(more, 'Edit model', 'Edit the model with forms or as YAML text, then copy it into the model work item', function () {
      if (!self.editor) { self.editor = new Editor(self); }
      self.editor.toggle();
    });
    if (this.item.id) {
      var a = el('a', { href: itemUrl(this.item.project, this.item.id, ''), target: '_top', title: 'Open the model work item to edit the model' }, more, 'Open model item');
      if (this.uses) {
        var sl = this.uses.indexOf('/');
        var u = el('a', { href: itemUrl(this.uses.substring(0, sl), this.uses.substring(sl + 1), ''), target: '_top', title: 'Open the referenced model (roles and rules), used through uses:' }, more, 'Open referenced model');
        u.style.alignSelf = 'center';
      }
      a.style.alignSelf = 'center';
    }
    this.buildAreas();
    this.textBox = el('div', { 'class': 'dd-text' }, null);
    this.textBox.style.display = 'none';
    this.root.insertBefore(this.textBox, this.view);
    this.drawText();
  };

  Widget.prototype.legend = function (box) {
    this.legendKinds(box);
    el('span', { 'class': 'bw-muted' }, box, 'Arrow: link direction (source ' + ARROW + ' target), target roles on the left. ' +
      'Click a role or a line for the details.');
  };

  Widget.prototype.problemCounts = function () {
    var c = { error: 0, warning: 0, info: 0 };
    this.model.probs.forEach(function (p) { c[p.sev] = (c[p.sev] || 0) + 1; });
    return c;
  };

  Widget.prototype.drawProblems = function () {
    var self = this;
    var box = this.probBox;
    var probs = this.model.probs;
    box.textContent = '';
    if (!probs.length) {
      box.className = 'dd-probs dd-ok';
      box.textContent = 'No problem found in the model.';
      return;
    }
    box.className = 'dd-probs';
    probs.forEach(function (p) {
      var row = el('div', { 'class': 'dd-prob' }, box);
      el('span', { 'class': 'dd-sev dd-sev-' + p.sev }, row, p.sev);
      if (p.line > 0) {
        var ln = el('span', { 'class': 'dd-line', title: 'Show the line in the model text' }, row, 'line ' + p.line);
        ln.addEventListener('click', function () { self.showLine(p.line); });
      }
      el('span', null, row, p.msg);
    });
  };

  Widget.prototype.drawText = function () {
    var box = this.textBox;
    var bad = {};
    this.model.probs.forEach(function (p) { if (p.line > 0) { (bad[p.line] = bad[p.line] || []).push(p.sev + ': ' + p.msg); } });
    box.textContent = '';
    this.textLines = [];
    var self = this;
    this.model.lines.forEach(function (t, i) {
      var no = i + 1;
      var div = el('div', { 'class': 'dd-tl' + (bad[no] ? ' dd-bad' : '') }, box);
      el('span', { 'class': 'dd-no' }, div, String(no));
      el('span', null, div, t);
      if (bad[no]) { div.title = bad[no].join(NL); }
      self.textLines.push(div);
    });
    if (!this.model.lines.length) { el('div', { 'class': 'bw-muted dd-tl' }, box, 'No model text.'); }
  };

  Widget.prototype.toggleText = function (show) {
    var on = show === undefined ? this.textBox.style.display === 'none' : show;
    this.textBox.style.display = on ? '' : 'none';
  };

  Widget.prototype.showLine = function (no) {
    this.toggleText(true);
    var div = this.textLines[no - 1];
    if (!div) { return; }
    this.textLines.forEach(function (d) { d.classList.remove('dd-flash'); });
    div.classList.add('dd-flash');
    this.textBox.scrollTop = Math.max(0, div.offsetTop - this.textBox.offsetTop - 40);
  };

  Widget.prototype.copyYaml = function () {
    var self = this;
    var text = this.model.lines.join(NL) + NL;
    function done(ok) {
      self.status.textContent = self.statusText() + ' ' + DASH + ' ' + (ok ? 'Model text copied to the clipboard.' : 'Copy failed: select the text in Model text and copy it.');
    }
    function fallback() {
      var ta = el('textarea', null, document.body);
      ta.value = text;
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  };

  Widget.prototype.compute = function () {
    var st = this.state;
    var cats = this.cats;
    var edges = [];
    this.model.edges.forEach(function (e) {
      var r = restrictEdge(e, cats, st.rel);
      if (!r) { return; }
      r.rules = e.rules.filter(function (x) { return st.rel[x.role]; });
      edges.push(r);
    });
    return edges;
  };

  Widget.prototype.statusText = function () {
    var c = this.problemCounts();
    var nDocs = 0;
    this.model.nodes.forEach(function (n) { nDocs += n.docs.length; });
    return this.model.nodes.length + ' roles, ' + this.model.rules.length + ' rules, ' + nDocs + ' documents ' + DASH + ' ' +
      c.error + ' errors, ' + c.warning + ' warnings ' + DASH + ' links matching no rule: ' + this.unexp;
  };

  Widget.prototype.render = function (refit) {
    this.layoutAndDraw(this.compute(), refit);
    this.status.textContent = this.statusText();
  };

  Widget.prototype.docLabel = function (n) { return n.key; };

  Widget.prototype.nodeLines = function (n) {
    var dark = 'rgb(25,35,55)';
    var grey = 'rgb(90,98,115)';
    var found = n.docs.filter(function (d) { return d.found; }).length;
    var docText = !n.docs.length ? 'No document' :
      (found === n.docs.length ? 'Documents: ' + found : 'Documents: ' + found + ' of ' + n.docs.length + ' found');
    var lines = [
      { text: n.key, weight: 600, color: dark },
      { text: n.title, weight: 400, color: dark },
      { text: 'Types: ' + (boxTypes(n) || DASH), weight: 400, color: grey },
      { text: docText, weight: 400, color: found === n.docs.length && n.docs.length ? grey : 'rgb(198,40,40)' }
    ];
    if (this.state.baseLines > 4) {
      lines.push({ text: n.selfRules.length ? LOOP + ' ' + n.selfRules.map(function (r) { return r.rname; }).join(', ') : '', weight: 400, color: grey });
    }
    return lines;
  };

  Widget.prototype.onNode = function (a, n) {
    var self = this;
    a.addEventListener('click', function (ev) { ev.preventDefault(); self.showRole(n); });
  };

  Widget.prototype.edgeSummary = function (e) {
    return [e.c + ' ' + ARROW + ' ' + e.o].concat(e.rules.map(ruleText));
  };

  Widget.prototype.detailsHead = function (title) {
    var box = this.details;
    box.textContent = '';
    box.style.display = 'block';
    var head = el('div', { 'class': 'bw-details-head' }, box);
    el('span', null, head, title);
    var close = this.button(head, 'Close', 'Close the details', function () { box.style.display = 'none'; });
    close.style.marginLeft = '12px';
    return box;
  };

  Widget.prototype.ruleTable = function (box, rules) {
    var self = this;
    var t = el('table', { 'class': 'bw-table' }, box);
    var hr = el('tr', null, t);
    ['Id', 'From (source)', 'Link role', 'To (target)', 'Min per source item', 'Min per target item', 'Severity', 'Documents', 'Line'].forEach(function (h) {
      el('th', null, hr, h);
    });
    rules.forEach(function (r) {
      var tr = el('tr', null, t);
      [r.id, endText(r.from, r.ft), r.rname, endText(r.to, r.tt), r.fmin, r.tmin, sevText(r), pairsText(r)].forEach(function (v) { el('td', null, tr, String(v)); });
      var td = el('td', null, tr);
      var ln = el('span', { 'class': 'dd-line' }, td, String(r.line));
      ln.addEventListener('click', function () { self.showLine(r.line); });
    });
  };

  Widget.prototype.showDetails = function (e) {
    var box = this.detailsHead('Rules ' + e.c + ' ' + ARROW + ' ' + e.o);
    this.ruleTable(box, e.rules);
  };

  Widget.prototype.showRole = function (n) {
    var self = this;
    var box = this.detailsHead('Role ' + n.key + ' ' + DASH + ' ' + n.title);
    el('div', { 'class': 'bw-muted' }, box, 'Work item types (other types: ' + n.unexp + '):');
    var ul = el('ul', { 'class': 'bw-items' }, box);
    n.types.forEach(function (t) { el('li', null, ul, typeText(t)); });
    if (!n.types.length) { el('li', null, ul, DASH); }
    el('div', { 'class': 'bw-muted' }, box, 'Documents:');
    var ud = el('ul', { 'class': 'bw-items' }, box);
    n.docs.forEach(function (d) {
      var li = el('li', null, ud);
      if (d.found) {
        el('a', { href: docUrl({ project: d.project, space: d.space, id: d.name, col: '' }), target: '_top' }, li, d.decl);
        el('span', { 'class': 'bw-muted' }, li, ' ' + DASH + ' ' + d.title);
      } else {
        el('span', null, li, d.decl);
        el('span', { 'class': 'bw-error' }, li, ' (not found)');
      }
    });
    if (!n.docs.length) { el('li', { 'class': 'bw-error' }, ud, 'No document declared in bindings.'); }
    var rules = this.model.rules.filter(function (r) { return r.from === n.key || r.to === n.key; });
    if (rules.length) {
      el('div', { 'class': 'bw-muted' }, box, 'Rules of this role:');
      this.ruleTable(box, rules);
    }
    var ln = el('span', { 'class': 'dd-line' }, el('div', null, box), 'Line ' + n.line + ' of the model text');
    ln.addEventListener('click', function () { self.showLine(n.line); });
  };

  Widget.prototype.rows = function () {
    var m = this.model;
    var self = this;
    var roles = [['Role', 'Title', 'Work item types', 'Other types', 'Documents', 'Line']];
    var types = [['Role', 'Type', 'Min', 'Max', 'Ignored']];
    var docs = [['Role', 'Declared', 'Project', 'Space', 'Document', 'Found', 'Title']];
    var docLinks = [];
    m.nodes.forEach(function (n) {
      roles.push([n.key, n.title, n.types.map(typeText).join(', '), n.unexp, n.docs.map(function (d) { return d.decl; }).join(', '), n.line]);
      n.types.forEach(function (t) { types.push([n.key, t.type, t.min >= 0 ? t.min : '', t.max >= 0 ? t.max : '', t.ignored ? 'yes' : '']); });
      n.docs.forEach(function (d) {
        if (d.found) { docLinks.push({ r: docs.length, c: 1, url: absUrl(docUrl({ project: d.project, space: d.space, id: d.name, col: '' })) }); }
        docs.push([n.key, d.decl, d.project, d.space, d.name, d.found ? 'yes' : 'no', d.title]);
      });
    });
    var rules = [['Id', 'From role', 'From type', 'Link role', 'Link role name', 'To role', 'To type', 'Min per source item', 'Min per target item', 'Severity', 'Severity of sources', 'Severity of targets', 'Documents', 'Line']];
    var pairs = [['Rule', 'Source document (from role)', 'Target document (to role)']];
    m.rules.forEach(function (r) {
      rules.push([r.id, r.from, r.ft, r.role, r.rname, r.to, r.tt, r.fmin, r.tmin, r.sev, r.fsev, r.tsev, r.paired ? 'paired' : 'pooled', r.line]);
      r.pairs.forEach(function (p) { pairs.push([r.id, p.s, p.t]); });
    });
    var probs = [['Severity', 'Line', 'Problem']];
    m.probs.forEach(function (p) { probs.push([p.sev, p.line > 0 ? p.line : '', p.msg]); });
    var text = [['Line', 'Text']];
    m.lines.forEach(function (t, i) { text.push([i + 1, t]); });
    var itemUrlAbs = self.item.id ? absUrl(itemUrl(self.item.project, self.item.id, '')) : '';
    return { roles: roles, types: types, docs: docs, docLinks: docLinks, rules: rules, pairs: pairs, probs: probs, text: text, itemUrl: itemUrlAbs };
  };

  Widget.prototype.drawTable = function () {
    var wrap = this.table;
    wrap.textContent = '';
    var r = this.rows();
    var self = this;
    function section(title, rows, links) {
      el('div', { 'class': 'dd-h' }, wrap, title);
      var body = rows.slice(1).map(function (row, i) {
        return row.map(function (v, c) {
          var lk = (links || []).filter(function (l) { return l.r === i + 1 && l.c === c; })[0];
          return lk ? { text: String(v), href: lk.url } : v;
        });
      });
      self.htmlTable(rows[0], body, 'None.');
    }
    section('Document roles', r.roles);
    section('Link rules', r.rules);
    if (r.pairs.length > 1) { section('Document pairs', r.pairs); }
    section('Documents', r.docs, r.docLinks);
    section('Problems', r.probs);
  };

  Widget.prototype.exportExcel = function () {
    var r = this.rows();
    var sheets = [
      { name: 'Roles', rows: r.roles, widths: [18, 30, 50, 12, 50, 8] },
      { name: 'Item types', rows: r.types, widths: [18, 26, 8, 8, 10] },
      { name: 'Link rules', rows: r.rules, widths: [10, 18, 24, 18, 22, 18, 24, 12, 12, 10, 10, 8] },
      { name: 'Document pairs', rows: r.pairs, widths: [10, 45, 45] },
      { name: 'Documents', rows: r.docs, widths: [18, 40, 18, 18, 30, 8, 40], links: r.docLinks },
      { name: 'Problems', rows: r.probs, widths: [10, 8, 90] },
      { name: 'Model text', rows: r.text, widths: [8, 100] }
    ];
    sheets[0].what = 'document roles';
    this.exportWorkbook(sheets);
  };

  startWidgets('dd-root', Widget, 'Data Model Definition');
