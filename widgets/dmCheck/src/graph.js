  /*
   * Data Model Check - client-side view (widget-specific part).
   *
   * tools/build-widget.py inlines shared/js/core.js and this file into render.vm, inside one IIFE.
   * Same restrictions as core.js: no dollar sign, hash sign, backslash or non-ASCII character.
   *
   * The checks run on the server (shared/vm/dm-check.vm); this code reads the results from the page model.
   * Nodes = document roles; edges = link rules between two roles grouped per pair (o = target role, left; c = source
   * role; arrow in the link direction). The edge categories are compliance states (errors, warnings, info, compliant):
   * the first state present gives the colour.
   */

  var STATES = [
    { id: 'error', name: 'errors', label: 'Errors', color: 'rgb(198,40,40)', dash: '' },
    { id: 'warning', name: 'warnings', label: 'Warnings', color: 'rgb(211,120,0)', dash: '' },
    { id: 'info', name: 'info', label: 'Info', color: 'rgb(51,103,214)', dash: '' },
    { id: 'ok', name: 'compliant', label: 'Compliant', color: 'rgb(26,127,55)', dash: '' }
  ];
  var LOOP = String.fromCharCode(8635);
  var KIND_TEXT = {
    'missing-type': 'missing type', 'too-many': 'too many items', 'unexpected-type': 'unexpected type',
    'from': 'missing link (source)', 'to': 'not covered (target)', 'cross-pair': 'cross-pair link',
    'unpaired': 'unpaired document', 'unexpected-link': 'unexpected link'
  };
  var VIOL_SHOWN = 2000;

  function parts(s, sep) {
    return (s || '').split(sep).filter(function (x) { return x !== ''; });
  }

  function splitKey(k) {
    var i = k.indexOf('/');
    return { project: k.substring(0, i), rest: k.substring(i + 1) };
  }

  // "project/space/name" -> URL of the document; "project/id" -> URL of the work item.
  function docHref(k) {
    var a = k.split('/');
    return docUrl({ project: a[0], space: a[1] || '', id: a.slice(2).join('/'), col: '' });
  }
  function itemHref(k) {
    var p = splitKey(k);
    return itemUrl(p.project, p.rest, '');
  }
  // Polarion's work item table filtered by a query (drill-down, dmCheck 0.2). The query is the one verified on 2512
  // (project.id + SQL:(...) restriction, dmSpike S10); opening it through this URL is to be checked on 2512.
  function queryHref(project, q) {
    return projectPath(project, '') + '/workitems?query=' + encodeURIComponent(q);
  }

  function copyText(text, done) {
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
  }

  function shortDoc(k, project) {
    return k.indexOf(project + '/') === 0 ? k.substring(project.length + 1) : k;
  }
  function shortItem(k, project) {
    return k.indexOf(project + '/') === 0 ? k.substring(project.length + 1) : k;
  }

  function readModel(root) {
    var project = root.dataset.project || '';
    var nodes = [];
    var byKey = {};
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-r'), function (e) {
      var d = e.dataset;
      var n = {
        key: d.k, project: project, id: d.k, title: d.title || d.k, space: '', col: '', rev: '', items: -1, el: e,
        unexp: d.unexp || 'warning',
        types: parts(d.types, ';').map(function (p) { var f = p.split('|'); return { type: f[0], min: toInt(f[1]), max: toInt(f[2]), ignored: f[3] === '1' }; }),
        docs: parts(d.docs, ';').map(function (p) { var f = p.split('|'); return { key: f[0], found: f[1] === '1' }; }),
        selfRules: []
      };
      if (n.key && !byKey[n.key]) { byKey[n.key] = n; nodes.push(n); }
    });
    var counts = {};
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dc-n'), function (e) { counts[e.dataset.k] = toInt(e.dataset.n); });
    var rules = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-l'), function (e) {
      var a = e.dataset;
      var r = {
        id: a.id, from: a.from, ft: a.ft || '', role: a.role, rname: a.rn || a.role, to: a.to, tt: a.tt || '',
        fmin: toInt(a.fmin), tmin: toInt(a.tmin), sev: a.sev || 'error', paired: a.paired === '1',
        fc: toInt(a.fc), fo: toInt(a.fo), tc: toInt(a.tc), to2: toInt(a.to2), cross: toInt(a.cross), unp: toInt(a.unp)
      };
      r.violations = ['from', 'to', 'cross-pair', 'unpaired'].reduce(function (s, k) { return s + (counts[r.id + '|' + k] || 0); }, 0);
      rules.push(r);
    });
    var viol = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dc-v'), function (e) {
      var d = e.dataset;
      viol.push({ sev: d.sev, kind: d.kind, rule: d.rule || '', doc: d.doc || '', item: d.item || '', msg: d.msg || '' });
    });
    var docs = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dc-d'), function (e) {
      var d = e.dataset;
      docs.push({ key: d.k, roles: parts(d.roles, ';'), items: toInt(d.items), bad: toInt(d.bad),
        types: parts(d.types, ';').map(function (p) { var f = p.split('|'); return { type: f[0], n: toInt(f[1]) }; }) });
    });
    var queries = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dc-q'), function (e) {
      var d = e.dataset;
      queries.push({ rule: d.rule || '', kind: d.kind, doc: d.doc || '', n: toInt(d.n), q: d.q || '' });
    });
    var probs = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-p'), function (e) {
      probs.push({ sev: e.dataset.sev, line: toInt(e.dataset.line), msg: e.dataset.msg || '' });
    });
    var edges = [];
    var edgeBy = {};
    rules.forEach(function (r) {
      if (!byKey[r.from] || !byKey[r.to]) { return; }
      if (r.from === r.to) { byKey[r.from].selfRules.push(r); return; }
      var key = r.to + '>' + r.from;
      var e = edgeBy[key];
      if (!e) { e = edgeBy[key] = { o: r.to, c: r.from, kinds: {}, meta: {}, indirect: false, samples: [], rules: [] }; edges.push(e); }
      e.rules.push(r);
    });
    edges.forEach(function (e) {
      STATES.forEach(function (s) { e.kinds[s.id] = 0; });
      e.rules.forEach(function (r) { if (r.violations) { e.kinds[r.sev] += r.violations; } });
      if (!e.kinds.error && !e.kinds.warning && !e.kinds.info) { e.meta.ok = true; }
    });
    return { nodes: nodes, byKey: byKey, rules: rules, viol: viol, docs: docs, probs: probs, edges: edges, counts: counts, queries: queries };
  }

  function ruleState(r) { return r.violations ? r.sev : 'ok'; }

  function pct(ok, n) { return n > 0 ? Math.round(100 * ok / n) + '%' : DASH; }

  function Widget(root) {
    var model = readModel(root);
    this.cats = STATES;
    initBase(this, root, model);
    var ds = root.dataset;
    this.filePrefix = 'data-model-check-';
    this.emptyText = ds.run === '1' ? 'The model defines no document role.' : (ds.note || 'Nothing checked.');
    this.isolatedText = 'Roles without rules to other roles';
    this.searchText = 'Highlight roles';
    this.arrowAtOrigin = true;
    this.run = ds.run === '1';
    this.item = { id: ds.item || '', project: ds.itemProject || this.project };
    var st = this.state;
    st.mode = 'all';
    st.counts = true;
    st.extras = [];
    st.rel = relFromData('', this.cats);
    st.filterText = '';
    st.baseLines = model.nodes.some(function (n) { return n.selfRules.length; }) ? 5 : 4;
    this.build();
    this.render(true);
  }
  extendBase(Widget);

  Widget.prototype.build = function () {
    var self = this;
    var ds = this.root.dataset;
    var m = this.model;
    if (m.probs.length) {
      var pb = el('div', { 'class': 'dc-probs' }, this.root);
      el('div', { 'class': 'dc-h' }, pb, 'Model problems (shown by Data Model Definition with their lines)');
      m.probs.forEach(function (p) {
        var row = el('div', null, pb);
        el('span', { 'class': 'dc-' + p.sev }, row, p.sev + ' ');
        el('span', null, row, (p.line > 0 ? 'line ' + p.line + ': ' : '') + p.msg);
      });
    }
    var sum = el('div', { 'class': 'dc-sum' }, this.root);
    if (!this.run) {
      el('span', { 'class': 'dc-error' }, sum, ds.note || 'Nothing checked.');
    } else {
      var n = { error: 0, warning: 0, info: 0 };
      Object.keys(m.counts).forEach(function (k) {
        var rule = k.substring(0, k.lastIndexOf('|'));
        var kind = k.substring(k.lastIndexOf('|') + 1);
        var sev = self.sevOf(rule, kind);
        n[sev] = (n[sev] || 0) + m.counts[k];
      });
      this.totals = n;
      el('span', { 'class': 'dc-chip ' + (n.error ? 'dc-error' : 'dc-ok') }, sum, n.error + ' errors');
      el('span', { 'class': 'dc-chip ' + (n.warning ? 'dc-warning' : 'dc-ok') }, sum, n.warning + ' warnings');
      el('span', { 'class': 'dc-chip ' + (n.info ? 'dc-info' : 'dc-ok') }, sum, n.info + ' info');
      el('span', { 'class': 'dc-chip' }, sum, ds.items + ' work items, ' + ds.links + ' links checked');
      if (toInt(ds.unres)) { el('span', { 'class': 'dc-chip bw-muted' }, sum, ds.unres + ' links to unreadable items skipped'); }
      if (ds.capped === '1') { el('span', { 'class': 'dc-chip dc-error' }, sum, 'Limit reached: results are incomplete'); }
    }
    var bar = el('div', { 'class': 'bw-toolbar' }, this.root);
    this.kindChecks(bar, 'Show:');
    this.searchBox(bar);
    var f = el('input', { 'class': 'bw-ctl dc-filter', type: 'search', placeholder: 'Filter violations (text)' + ELLIPSIS }, bar);
    f.addEventListener('input', function () { self.state.filterText = f.value.trim().toLowerCase(); self.render(false); });
    this.viewButtons(bar);
    if (this.item.id) {
      var a = el('a', { href: itemUrl(this.item.project, this.item.id, ''), target: '_top', title: 'Open the model work item' }, bar, 'Open model item');
      a.style.alignSelf = 'center';
    }
    this.buildAreas();
  };

  // Severity of a violation kind of a rule ("types:R" kinds: missing / too many = error, unexpected type = role setting).
  Widget.prototype.sevOf = function (rule, kind) {
    if (!rule) { return this.root.dataset.unexp || 'warning'; }
    if (rule.indexOf('types:') === 0) {
      if (kind !== 'unexpected-type') { return 'error'; }
      var n = this.model.byKey[rule.substring(6)];
      return n ? n.unexp : 'warning';
    }
    var r = this.model.rules.filter(function (x) { return x.id === rule; })[0];
    return r ? r.sev : 'error';
  };

  Widget.prototype.legend = function (box) {
    this.legendKinds(box);
    el('span', { 'class': 'bw-muted' }, box, 'Arrow: link direction (source ' + ARROW + ' target). Line labels: violations per severity. ' +
      'Click a role or a line for its results.');
  };

  Widget.prototype.compute = function () {
    var st = this.state;
    var cats = this.cats;
    var out = [];
    this.model.edges.forEach(function (e) {
      var r = restrictEdge(e, cats, st.rel);
      if (r) { r.rules = e.rules; out.push(r); }
    });
    return out;
  };

  Widget.prototype.shownViolations = function () {
    var st = this.state;
    var q = st.filterText;
    return this.model.viol.filter(function (v) {
      return st.rel[v.sev] !== false && (!q || (v.msg + ' ' + v.doc + ' ' + v.item + ' ' + v.rule + ' ' + v.kind).toLowerCase().indexOf(q) >= 0);
    });
  };

  Widget.prototype.render = function (refit) {
    this.layoutAndDraw(this.compute(), refit);
    var shown = this.shownViolations().length;
    this.status.textContent = this.model.nodes.length + ' roles, ' + this.model.rules.length + ' rules, ' + this.model.docs.length +
      ' documents checked ' + DASH + ' ' + shown + ' of ' + this.model.viol.length + ' listed violations shown';
  };

  Widget.prototype.docLabel = function (n) { return n.key; };

  Widget.prototype.roleDocs = function (n) {
    return this.model.docs.filter(function (d) { return d.roles.indexOf(n.key) >= 0; });
  };

  Widget.prototype.typeViolations = function (n) {
    var c = this.model.counts;
    var k = 'types:' + n.key;
    return { missing: (c[k + '|missing-type'] || 0) + (c[k + '|too-many'] || 0), unexpected: c[k + '|unexpected-type'] || 0 };
  };

  Widget.prototype.nodeLines = function (n) {
    var dark = 'rgb(25,35,55)';
    var grey = 'rgb(90,98,115)';
    var red = 'rgb(198,40,40)';
    var green = 'rgb(26,127,55)';
    var docs = this.roleDocs(n);
    var items = 0;
    var bad = 0;
    docs.forEach(function (d) { items += d.items; bad += d.bad; });
    var tv = this.typeViolations(n);
    var tText = !this.run ? 'Types: ' + DASH : (tv.missing || tv.unexpected ?
      'Types: ' + (tv.missing ? tv.missing + ' missing' : '') + (tv.missing && tv.unexpected ? ', ' : '') + (tv.unexpected ? tv.unexpected + ' unexpected' : '') : 'Types: compliant');
    var missingDocs = n.docs.filter(function (d) { return !d.found; }).length;
    var lines = [
      { text: n.key, weight: 600, color: dark },
      { text: n.title, weight: 400, color: dark },
      { text: this.run ? 'Items: ' + items + ', without violation: ' + pct(items - bad, items) : 'Documents: ' + n.docs.length, weight: 400, color: bad ? red : (this.run ? green : grey) },
      { text: missingDocs ? tText + ' ' + DASH + ' ' + missingDocs + ' doc. not found' : tText, weight: 400, color: tv.missing || tv.unexpected || missingDocs ? red : (this.run ? green : grey) }
    ];
    if (this.state.baseLines > 4) {
      lines.push({ text: n.selfRules.map(function (r) { return LOOP + ' ' + r.id + ': ' + (r.violations ? r.violations + ' ' + r.sev : 'compliant'); }).join(', '), weight: 400,
        color: n.selfRules.some(function (r) { return r.violations; }) ? red : green });
    }
    return lines;
  };

  Widget.prototype.onNode = function (a, n) {
    var self = this;
    a.addEventListener('click', function (ev) { ev.preventDefault(); self.showRole(n); });
  };

  Widget.prototype.ruleSummary = function (r) {
    var s = r.id + ': ' + (r.ft || 'any type') + ' ' + r.rname + ' ' + (r.tt || 'any type') + (r.paired ? ' (paired)' : '');
    if (r.fmin > 0) { s += '; sources with ' + GE_TEXT + r.fmin + ': ' + r.fo + '/' + r.fc; }
    if (r.tmin > 0) { s += '; targets with ' + GE_TEXT + r.tmin + ': ' + r.to2 + '/' + r.tc; }
    if (r.cross) { s += '; cross-pair links: ' + r.cross; }
    if (r.unp) { s += '; unpaired documents: ' + r.unp; }
    return s + (r.violations ? ' ' + DASH + ' ' + r.violations + ' ' + r.sev : ' ' + DASH + ' compliant');
  };
  var GE_TEXT = String.fromCharCode(8805);

  Widget.prototype.edgeSummary = function (e) {
    var self = this;
    return [e.c + ' ' + ARROW + ' ' + e.o].concat(e.rules.map(function (r) { return self.ruleSummary(r); }));
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

  Widget.prototype.violList = function (box, list, title) {
    var self = this;
    if (!list.length) { el('div', { 'class': 'dc-ok' }, box, title + ': none.'); return; }
    el('div', { 'class': 'bw-muted' }, box, title + ' (' + list.length + (list.length > 200 ? ', first 200' : '') + '):');
    var ul = el('ul', { 'class': 'bw-items' }, box);
    list.slice(0, 200).forEach(function (v) {
      var li = el('li', null, ul);
      el('span', { 'class': 'dc-' + v.sev }, li, v.sev + ' ');
      if (v.item) { el('a', { href: itemHref(v.item), target: '_top' }, li, shortItem(v.item, self.project)); el('span', null, li, ' '); }
      else if (v.doc) { el('a', { href: docHref(v.doc), target: '_top' }, li, shortDoc(v.doc, self.project)); el('span', null, li, ' '); }
      el('span', null, li, v.msg);
    });
  };

  // Drill-down (K9): per document, a link opening the violating items in Polarion's work item table and a Copy button
  // (paste the query into the table's query field when the link does not apply it).
  Widget.prototype.drillList = function (box, rule) {
    var self = this;
    var qs = this.model.queries.filter(function (q) { return q.rule === rule && q.n > 0; });
    if (!qs.length) { return; }
    el('div', { 'class': 'bw-muted' }, box, 'Open the items in Polarion (all of them, not only the listed ones):');
    var ul = el('ul', { 'class': 'bw-items dc-drill' }, box);
    qs.forEach(function (q) {
      var li = el('li', null, ul);
      el('span', null, li, (KIND_TEXT[q.kind] || q.kind) + ', ' + shortDoc(q.doc, self.project) + ': ');
      var p = splitKey(q.doc).project;
      el('a', { href: queryHref(p, q.q), target: '_top', title: 'Polarion work items table with the query of this check' }, li, q.n + ' item' + (q.n === 1 ? '' : 's'));
      el('span', null, li, ' ');
      var b = self.button(li, 'Copy query', 'Copy the query, to paste it into the query field of the work items table', function () {
        copyText(q.q, function (ok) { b.textContent = ok ? 'Copied' : 'Copy failed'; });
      });
    });
  };

  Widget.prototype.showDetails = function (e) {
    var self = this;
    var box = this.detailsHead('Rules ' + e.c + ' ' + ARROW + ' ' + e.o);
    e.rules.forEach(function (r) {
      el('div', { 'class': 'dc-' + ruleState(r) }, box, self.ruleSummary(r));
      self.violList(box, self.shownViolations().filter(function (v) { return v.rule === r.id; }), 'Violations of ' + r.id);
      self.drillList(box, r.id);
    });
  };

  Widget.prototype.showRole = function (n) {
    var self = this;
    var box = this.detailsHead('Role ' + n.key + ' ' + DASH + ' ' + n.title);
    var t = el('table', { 'class': 'bw-table' }, box);
    var hr = el('tr', null, t);
    ['Document', 'Counted items', 'Without violation', 'Types (items)'].forEach(function (h) { el('th', null, hr, h); });
    this.roleDocs(n).forEach(function (d) {
      var tr = el('tr', null, t);
      el('a', { href: docHref(d.key), target: '_top' }, el('td', null, tr), shortDoc(d.key, self.project));
      el('td', null, tr, String(d.items));
      el('td', null, tr, pct(d.items - d.bad, d.items));
      el('td', null, tr, d.types.map(function (x) { return x.type + ' ' + x.n; }).join(', '));
    });
    n.docs.filter(function (d) { return !d.found; }).forEach(function (d) {
      var tr = el('tr', null, t);
      el('td', { 'class': 'dc-error' }, tr, shortDoc(d.key, self.project) + ' (not found)');
    });
    this.violList(box, this.shownViolations().filter(function (v) { return v.rule === 'types:' + n.key; }), 'Item type violations');
    this.drillList(box, 'types:' + n.key);
    n.selfRules.forEach(function (r) {
      el('div', { 'class': 'dc-' + ruleState(r) }, box, self.ruleSummary(r));
      self.violList(box, self.shownViolations().filter(function (v) { return v.rule === r.id; }), 'Violations of ' + r.id);
      self.drillList(box, r.id);
    });
  };

  Widget.prototype.rows = function () {
    var self = this;
    var m = this.model;
    var viol = [['Severity', 'Check', 'Rule', 'Document', 'Work item', 'Message']];
    var vLinks = [];
    this.shownViolations().slice(0, VIOL_SHOWN).forEach(function (v) {
      var r = viol.length;
      if (v.doc) { vLinks.push({ r: r, c: 3, url: absUrl(docHref(v.doc)) }); }
      if (v.item) { vLinks.push({ r: r, c: 4, url: absUrl(itemHref(v.item)) }); }
      viol.push([v.sev, KIND_TEXT[v.kind] || v.kind, v.rule || DASH, shortDoc(v.doc, self.project), shortItem(v.item, self.project), v.msg]);
    });
    var rules = [['Rule', 'From', 'Link role', 'To', 'Documents', 'Sources checked', 'Sources compliant', 'Targets checked', 'Targets compliant', 'Cross-pair links', 'Unpaired documents', 'Violations', 'Severity', 'State']];
    m.rules.forEach(function (r) {
      rules.push([r.id, r.from + (r.ft ? ' / ' + r.ft : ''), r.rname, r.to + (r.tt ? ' / ' + r.tt : ''), r.paired ? 'paired' : 'pooled',
        r.fmin > 0 ? r.fc : '', r.fmin > 0 ? r.fo : '', r.tmin > 0 ? r.tc : '', r.tmin > 0 ? r.to2 : '', r.cross, r.unp, r.violations, r.sev, ruleState(r)]);
    });
    var docs = [['Document', 'Roles', 'Counted items', 'Items with a violation', 'Without violation', 'Types (items)']];
    var dLinks = [];
    m.docs.forEach(function (d) {
      dLinks.push({ r: docs.length, c: 0, url: absUrl(docHref(d.key)) });
      docs.push([shortDoc(d.key, self.project), d.roles.join(', '), d.items, d.bad, pct(d.items - d.bad, d.items), d.types.map(function (x) { return x.type + ' ' + x.n; }).join(', ')]);
    });
    var probs = [['Severity', 'Line', 'Problem']];
    m.probs.forEach(function (p) { probs.push([p.sev, p.line > 0 ? p.line : '', p.msg]); });
    var qs = [['Rule', 'Check', 'Document', 'Items', 'Polarion query (work items table)']];
    var qLinks = [];
    m.queries.forEach(function (q) {
      if (q.n > 0) { qLinks.push({ r: qs.length, c: 3, url: absUrl(queryHref(splitKey(q.doc).project, q.q)) }); }
      qs.push([q.rule, KIND_TEXT[q.kind] || q.kind, shortDoc(q.doc, self.project), q.n, q.q]);
    });
    return { viol: viol, vLinks: vLinks, rules: rules, docs: docs, dLinks: dLinks, probs: probs, qs: qs, qLinks: qLinks };
  };

  Widget.prototype.drawTable = function () {
    var wrap = this.table;
    wrap.textContent = '';
    var r = this.rows();
    var self = this;
    function section(title, rows, links) {
      el('div', { 'class': 'dc-h' }, wrap, title);
      var body = rows.slice(1).map(function (row, i) {
        return row.map(function (v, c) {
          var lk = (links || []).filter(function (l) { return l.r === i + 1 && l.c === c; })[0];
          return lk && v !== '' ? { text: String(v), href: lk.url } : v;
        });
      });
      self.htmlTable(rows[0], body, 'None.');
    }
    section('Violations', r.viol, r.vLinks);
    section('Rules', r.rules);
    section('Documents', r.docs, r.dLinks);
    section('Drill-down queries (open the items of a check in Polarion)', r.qs, r.qLinks);
    if (r.probs.length > 1) { section('Model problems', r.probs); }
  };

  Widget.prototype.exportExcel = function () {
    var r = this.rows();
    var sheets = [
      { name: 'Rules', rows: r.rules, widths: [10, 26, 16, 26, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] },
      { name: 'Violations', rows: r.viol, widths: [10, 22, 16, 36, 18, 90], links: r.vLinks },
      { name: 'Documents', rows: r.docs, widths: [36, 24, 12, 12, 12, 50], links: r.dLinks },
      { name: 'Queries', rows: r.qs, widths: [16, 22, 36, 8, 120], links: r.qLinks },
      { name: 'Model problems', rows: r.probs, widths: [10, 8, 90] }
    ];
    sheets[0].what = 'rules';
    this.exportWorkbook(sheets);
  };

  startWidgets('dc-root', Widget, 'Data Model Check');
