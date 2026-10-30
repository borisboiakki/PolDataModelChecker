  /*
   * Data Model Definition - model editor (dmDefine 0.3.0, SPECIFICATION D9 and 7.8). Inlined before graph.js.
   *
   * The forms start from the model parsed on the server: the path maps of shared/vm/dm-yaml.vm are written to the page
   * model (dm-v elements), so there is no YAML parser in the browser. toYaml() writes the YAML subset of
   * docs/DATA_MODEL_FORMAT.md, which the server parser reads back. Pickers are buttons with a search-and-pick panel
   * (guide 11.7), not select elements. Same restrictions as core.js: no dollar sign, hash sign, backslash, non-ASCII.
   */

  var ED_UNEXP_TYPES = ['error', 'warning', 'ignore'];
  var ED_RULE_SEV = ['error', 'warning', 'info'];
  var ED_SAME = 'as the rule';
  var ED_SIDE_SEV = [ED_SAME].concat(ED_RULE_SEV);
  var ED_UNEXP_LINKS = ['ignore', 'info', 'warning', 'error'];
  // Character checks instead of anchored regular expressions (the build forbids the dollar sign in inlined JS).
  var ED_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  var ED_DIGITS = '0123456789';
  // Values written without quotes; flow values ({ } and [ ]) must also avoid commas and brackets (server parser).
  var ED_PLAIN_CHARS = ED_KEY_CHARS + '.()/ +';
  // Same start keys as the server parser (dm-yaml.vm): lines before the first one are the header (kept as they are).
  var ED_START_KEYS = ['version', 'name', 'model', 'uses', 'bindings', 'description'];

  function edOnly(v, chars) {
    for (var i = 0; i < v.length; i++) { if (chars.indexOf(v.charAt(i)) < 0) { return false; } }
    return true;
  }
  function edIsKey(v) { return !!v && edOnly(v, ED_KEY_CHARS); }
  function edIsInt(v) { return !!v && v.length <= 6 && edOnly(v, ED_DIGITS); }
  function edIsPlain(v) { return !!v && edOnly(v, ED_PLAIN_CHARS); }
  function edIsStart(line) {
    return ED_START_KEYS.some(function (k) {
      return line.indexOf(k + ':') === 0 && (line.length === k.length + 1 || line.charAt(k.length + 1) === ' ');
    });
  }
  var ED_PICK_CAP = 300;
  var NLC = String.fromCharCode(10);

  function edSplit(s, sep) {
    return (s || '').split(sep).filter(function (x) { return x !== ''; });
  }

  // ------------------------------------------------------------------ model from the page model

  function edPaths(root) {
    var P = {};
    var els = root.querySelectorAll('.bw-model .dm-v');
    for (var i = 0; i < els.length; i++) {
      var d = els[i].dataset;
      P[d.p] = { k: d.k, v: d.v || '', n: toInt(d.n), keys: edSplit(d.keys, ';') };
    }
    return P;
  }

  function edModelFromPaths(P) {
    function pv(p) { var e = P[p]; return e && e.k === 'scalar' ? e.v : ''; }
    function pk(p) { var e = P[p]; return e && e.k === 'map' ? e.keys : []; }
    function pn(p) { var e = P[p]; return e && e.k === 'list' ? e.n : 0; }
    function range(n) { var r = []; for (var i = 0; i < n; i++) { r.push(i); } return r; }
    var M = edEmptyModel();
    M.version = pv('version') || '1';
    M.name = pv('name');
    M.description = pv('description');
    M.unexpLinks = pv('model.unexpected_links');
    M.uses = pv('uses');
    M.roles = pk('model.roles').map(function (key) {
      var b = 'model.roles.' + key;
      return {
        key: key, title: pv(b + '.title'), description: pv(b + '.description'), unexp: pv(b + '.unexpected_types'),
        items: range(pn(b + '.items')).map(function (i) {
          var ip = b + '.items[' + i + ']';
          return { type: pv(ip + '.type'), min: pv(ip + '.min'), max: pv(ip + '.max'), ignored: pv(ip + '.ignored') === 'true', description: pv(ip + '.description') };
        })
      };
    });
    M.links = range(pn('model.links')).map(function (i) {
      var lp = 'model.links[' + i + ']';
      return {
        id: pv(lp + '.id'), fromRole: pv(lp + '.from.role'), fromType: pv(lp + '.from.type'), linkRole: pv(lp + '.link_role'),
        toRole: pv(lp + '.to.role'), toType: pv(lp + '.to.type'), fmin: pv(lp + '.from_min'), tmin: pv(lp + '.to_min'),
        sev: pv(lp + '.severity'), fsev: pv(lp + '.from_severity'), tsev: pv(lp + '.to_severity'), description: pv(lp + '.description')
      };
    });
    pk('bindings').forEach(function (role) {
      var bp = 'bindings.' + role;
      var e = P[bp];
      if (e && e.k === 'list') { M.bindings[role] = range(e.n).map(function (i) { return pv(bp + '[' + i + ']'); }).filter(function (x) { return x; }); }
      else if (e && e.k === 'scalar' && e.v) { M.bindings[role] = [e.v]; }
    });
    pk('pairs').forEach(function (rule) {
      var pp = 'pairs.' + rule;
      M.pairs[rule] = range(pn(pp)).map(function (i) { return [pv(pp + '[' + i + '][0]'), pv(pp + '[' + i + '][1]')]; });
    });
    return M;
  }

  function edEmptyModel() {
    return { version: '1', name: '', description: '', unexpLinks: '', uses: '', roles: [], links: [], bindings: {}, pairs: {} };
  }

  // Header (lines before the first top-level key) and what the forms cannot keep: inner comments and unknown keys.
  function edTextInfo(lines, probs) {
    var start = -1;
    for (var i = 0; i < lines.length && start < 0; i++) { if (edIsStart(lines[i])) { start = i; } }
    var header = start < 0 ? [] : lines.slice(0, start);
    var comments = 0;
    if (start >= 0) {
      lines.slice(start).forEach(function (l) {
        var t = l.trim();
        var c = t.indexOf(' ' + HASH);
        if (t.indexOf(HASH) === 0) { comments++; }
        else if (c > 0 && t.substring(0, c).indexOf('"') < 0 && t.substring(0, c).indexOf("'") < 0) { comments++; }
      });
    }
    var unknown = probs.filter(function (p) { return p.msg.indexOf('Unknown key ') === 0; }).map(function (p) {
      return p.msg.substring(12).replace(' (ignored).', '');
    });
    return { header: header, comments: comments, unknown: unknown };
  }

  // ------------------------------------------------------------------ YAML writer

  function edQuote(v) {
    if (v !== '' && v.trim() === v && edIsPlain(v) && v.charAt(0) !== '-') { return v; }
    if (v.indexOf('"') < 0) { return '"' + v + '"'; }
    if (v.indexOf("'") < 0) { return "'" + v + "'"; }
    return '"' + v.split('"').join("'") + '"';
  }

  function edFlowSafe(v) {
    return v === '' || (edIsPlain(v) && v.trim() === v);
  }

  function edDocQuote(v) {
    return v.indexOf('"') < 0 ? '"' + v + '"' : "'" + v + "'";
  }

  // A document can be written inside [ ] (bindings, pairs): no comma or bracket, not both quote characters.
  function edDocFlowSafe(v) {
    for (var i = 0; i < v.length; i++) { if (',[]{}'.indexOf(v.charAt(i)) >= 0) { return false; } }
    return !(v.indexOf('"') >= 0 && v.indexOf("'") >= 0);
  }

  function edYaml(M, header) {
    var L = (header || []).slice();
    function kv(ind, key, v) { if (v !== '' && v !== undefined && v !== null) { L.push(ind + key + ': ' + edQuote(String(v))); } }
    L.push('version: ' + (M.version || '1'));
    kv('', 'name', M.name);
    kv('', 'description', M.description);
    if (M.uses) {
      // uses: the roles and rules stay in the referenced item; only the local part is written.
      L.push('uses: ' + edDocQuote(M.uses));
    } else {
    L.push('');
    L.push('model:');
    L.push('  roles:');
    M.roles.forEach(function (r) {
      L.push('    ' + r.key + ':');
      kv('      ', 'title', r.title);
      kv('      ', 'description', r.description);
      if (r.items.length) {
        L.push('      items:');
        r.items.forEach(function (it) {
          var f = [['type', it.type], ['min', it.min], ['max', it.max], ['ignored', it.ignored ? 'true' : '']].filter(function (x) { return x[1] !== ''; });
          var flow = !it.description && f.every(function (x) { return edFlowSafe(x[1]); });
          if (flow) {
            L.push('        - { ' + f.map(function (x) { return x[0] + ': ' + x[1]; }).join(', ') + ' }');
          } else {
            f.forEach(function (x, i) { L.push((i === 0 ? '        - ' : '          ') + x[0] + ': ' + edQuote(x[1])); });
            if (!f.length) { L.push('        - type: ""'); }
            kv('          ', 'description', it.description);
          }
        });
      }
      kv('      ', 'unexpected_types', r.unexp);
    });
    if (M.links.length) {
      L.push('  links:');
      M.links.forEach(function (k) {
        L.push('    - id: ' + edQuote(k.id || 'L'));
        L.push('      from: { role: ' + k.fromRole + (k.fromType ? ', type: ' + k.fromType : '') + ' }');
        kv('      ', 'link_role', k.linkRole);
        L.push('      to: { role: ' + k.toRole + (k.toType ? ', type: ' + k.toType : '') + ' }');
        kv('      ', 'from_min', k.fmin);
        kv('      ', 'to_min', k.tmin);
        kv('      ', 'severity', k.sev);
        kv('      ', 'from_severity', k.fsev);
        kv('      ', 'to_severity', k.tsev);
        kv('      ', 'description', k.description);
      });
    }
    kv('  ', 'unexpected_links', M.unexpLinks);
    }
    var bound = M.roles.filter(function (r) { return (M.bindings[r.key] || []).length; });
    if (bound.length) {
      L.push('');
      L.push('bindings:');
      bound.forEach(function (r) {
        var docs = M.bindings[r.key];
        if (docs.every(edDocFlowSafe)) {
          L.push('  ' + r.key + ': [' + docs.map(edDocQuote).join(', ') + ']');
        } else {
          L.push('  ' + r.key + ':');
          docs.forEach(function (d) { L.push('    - ' + edDocQuote(d)); });
        }
      });
    }
    var paired = M.links.filter(function (k) { return k.id && M.pairs[k.id] && M.pairs[k.id].length; });
    if (paired.length) {
      L.push('');
      L.push('pairs:');
      paired.forEach(function (k) {
        L.push('  ' + k.id + ':');
        M.pairs[k.id].forEach(function (p) { L.push('    - [' + edDocQuote(p[0]) + ', ' + edDocQuote(p[1]) + ']'); });
      });
    }
    return L;
  }

  // ------------------------------------------------------------------ checks in the forms (the server checks again)

  function edValidate(M, typeIds, roleIds) {
    var out = [];
    function add(sev, msg) { out.push({ sev: sev, msg: msg }); }
    var keys = {};
    if (M.uses) {
      if (M.uses.indexOf('@') >= 0 || M.uses.split('/').length > 2 || !M.uses.split('/').every(function (x) { return edOnly(x, ED_KEY_CHARS + '.') && x; })) {
        add('error', 'Reuse: write the model work item as project/id (e.g. SYSENG/SE-12) or id.');
      }
      if (!M.roles.length) { add('info', 'The roles and rules of ' + M.uses + ' appear after the YAML is pasted and the page reloaded; then choose the documents.'); }
      M.roles.forEach(function (r) { keys[r.key] = true; if (!(M.bindings[r.key] || []).length) { add('warning', 'Role ' + r.key + ' has no document.'); } });
    }
    if (!M.uses && !M.roles.length) { add('error', 'Add at least one document role.'); }
    M.roles.forEach(function (r, i) {
      if (M.uses) { return; }
      var name = r.key || ('role ' + (i + 1));
      if (!edIsKey(r.key)) { add('error', 'Role ' + name + ': the key must be made of letters, digits, _ and - (no space).'); }
      if (keys[r.key]) { add('error', 'Role key ' + r.key + ' is used twice.'); }
      keys[r.key] = true;
      if (!r.items.length) { add('warning', 'Role ' + name + ' lists no work item type.'); }
      r.items.forEach(function (it) {
        if (!it.type) { add('error', 'Role ' + name + ': a work item type is not chosen.'); }
        else if (typeIds.length && typeIds.indexOf(it.type) < 0) { add('error', 'Role ' + name + ': type ' + it.type + ' does not exist in the project.'); }
        ['min', 'max'].forEach(function (f) { if (it[f] !== '' && !edIsInt(it[f])) { add('error', 'Role ' + name + ', type ' + it.type + ': ' + f + ' must be a whole number.'); } });
        if (edIsInt(it.min) && edIsInt(it.max) && toInt(it.min) > toInt(it.max)) { add('error', 'Role ' + name + ', type ' + it.type + ': min is greater than max.'); }
      });
      if (!(M.bindings[r.key] || []).length) { add('warning', 'Role ' + name + ' has no document.'); }
    });
    var ids = {};
    M.links.forEach(function (k, i) {
      var name = k.id || ('rule ' + (i + 1));
      if (M.uses) { ids[k.id] = true; }
      if (M.uses) { edCheckPairs(M, k, name, add); return; }
      if (!edIsKey(k.id)) { add('error', 'Rule ' + name + ': the id must be made of letters, digits, _ and -.'); }
      if (ids[k.id]) { add('error', 'Rule id ' + k.id + ' is used twice.'); }
      ids[k.id] = true;
      if (!keys[k.fromRole]) { add('error', 'Rule ' + name + ': choose the source role (from).'); }
      if (!keys[k.toRole]) { add('error', 'Rule ' + name + ': choose the target role (to).'); }
      if (!k.linkRole) { add('error', 'Rule ' + name + ': choose the link role.'); }
      else if (roleIds.length && roleIds.indexOf(k.linkRole) < 0) { add('error', 'Rule ' + name + ': link role ' + k.linkRole + ' does not exist in the project.'); }
      ['fmin', 'tmin'].forEach(function (f) { if (k[f] !== '' && !edIsInt(k[f])) { add('error', 'Rule ' + name + ': the minimum must be a whole number.'); } });
      edCheckPairs(M, k, name, add);
    });
    return out;
  }

  function edCheckPairs(M, k, name, add) {
      var pairs = M.pairs[k.id];
      if (pairs) {
        if (!pairs.length) { add('warning', 'Rule ' + name + ' is paired but has no pair.'); }
        pairs.forEach(function (p) {
          if (!p[0] || !p[1]) { add('error', 'Rule ' + name + ': a pair has no source or no target document.'); return; }
          if ((M.bindings[k.fromRole] || []).indexOf(p[0]) < 0) { add('error', 'Rule ' + name + ': ' + p[0] + ' is not a document of role ' + k.fromRole + '.'); }
          if ((M.bindings[k.toRole] || []).indexOf(p[1]) < 0) { add('error', 'Rule ' + name + ': ' + p[1] + ' is not a document of role ' + k.toRole + '.'); }
          if (!edDocFlowSafe(p[0]) || !edDocFlowSafe(p[1])) { add('error', 'Rule ' + name + ': a document of a pair contains a comma or a bracket (not possible in pairs).'); }
        });
      }
  }

  // ------------------------------------------------------------------ editor

  function Editor(w) {
    var root = w.root;
    var ds = root.dataset;
    var self = this;
    this.w = w;
    this.project = w.project;
    this.types = [];
    this.linkRoles = [];
    this.docs = [];
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-ct'), function (e) { self.types.push({ id: e.dataset.id, label: e.dataset.id + ' ' + DASH + ' ' + e.dataset.n }); });
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-cr'), function (e) { self.linkRoles.push({ id: e.dataset.id, label: e.dataset.id + ' ' + DASH + ' ' + e.dataset.n }); });
    Array.prototype.forEach.call(root.querySelectorAll('.bw-model .dm-pd'), function (e) {
      var d = e.dataset;
      var id = d.s === '_default' ? d.n : d.s + '/' + d.n;
      self.docs.push({ id: id, label: id + (d.t && d.t !== d.n ? ' ' + DASH + ' ' + d.t : '') });
    });
    [this.types, this.linkRoles, this.docs].forEach(function (l) { l.sort(function (a, b) { return a.id.localeCompare(b.id); }); });
    this.hasText = ds.text === '1';
    this.formsOk = !this.hasText || toInt(ds.errors) === 0;
    var info = edTextInfo(w.model.lines, w.model.probs);
    this.header = info.header;
    this.info = info;
    this.reset();
    this.build();
  }

  Editor.prototype.reset = function () {
    this.M = this.hasText && this.formsOk ? edModelFromPaths(edPaths(this.w.root)) : edEmptyModel();
  };

  Editor.prototype.build = function () {
    var self = this;
    var box = this.box = el('div', { 'class': 'dd-ed' }, null);
    box.style.display = 'none';
    this.w.root.insertBefore(box, this.w.textBox);
    var head = el('div', { 'class': 'dd-ed-head' }, box);
    el('b', null, head, 'Edit the model');
    this.tabForms = this.w.button(head, 'Forms', 'Edit the model with forms', function () { self.show('forms'); });
    this.tabText = this.w.button(head, 'YAML text', 'The YAML text to copy into the model work item', function () { self.show('text'); });
    this.w.button(head, 'Close', 'Close the editor (the edits stay until the page is reloaded)', function () { self.toggle(false); });
    this.note = el('div', { 'class': 'bw-muted dd-ed-note' }, box);
    this.formBox = el('div', { 'class': 'dd-ed-forms' }, box);
    this.textPane = el('div', { 'class': 'dd-ed-text' }, box);
    this.buildText();
    this.pop = el('div', { 'class': 'dd-pp' }, this.w.root);
    this.pop.style.display = 'none';
    document.addEventListener('click', function (ev) { if (self.pop.style.display !== 'none' && !self.pop.contains(ev.target)) { self.closePop(); } });
    this.renderForms();
    this.show(this.formsOk ? 'forms' : 'text');
  };

  Editor.prototype.toggle = function (on) {
    var show = on === undefined ? this.box.style.display === 'none' : on;
    this.box.style.display = show ? '' : 'none';
    if (!show) { this.closePop(); }
  };

  Editor.prototype.show = function (tab) {
    if (tab === 'forms' && !this.formsOk) { tab = 'text'; }
    this.tab = tab;
    this.formBox.style.display = tab === 'forms' ? '' : 'none';
    this.textPane.style.display = tab === 'text' ? '' : 'none';
    this.tabForms.classList.toggle('dd-on', tab === 'forms');
    this.tabText.classList.toggle('dd-on', tab === 'text');
    this.tabForms.disabled = !this.formsOk;
    var n = [];
    if (!this.formsOk) {
      n.push('The model has errors (see the problems above): the forms are available when the model reads without errors. ' +
        'Correct the YAML text below, copy it into the model work item and reload the page.');
    } else if (!this.hasText) {
      n.push('No model yet: fill in the forms, then Generate YAML and paste the text into a new work item of the model document.');
    }
    if (this.formsOk && this.hasText && (this.info.comments || this.info.unknown.length)) {
      n.push('The YAML generated by the forms keeps the lines above version: and the description fields, but drops ' +
        (this.info.comments ? this.info.comments + ' comment line(s) inside the model' : '') +
        (this.info.comments && this.info.unknown.length ? ' and ' : '') +
        (this.info.unknown.length ? 'the unknown key(s) ' + this.info.unknown.join(', ') : '') + '.');
    }
    this.note.textContent = n.join(' ');
    this.note.style.display = n.length ? '' : 'none';
  };

  // ------------------------------------------------------------------ small controls

  Editor.prototype.input = function (parent, value, placeholder, onInput, width, onChange) {
    var i = el('input', { type: 'text', 'class': 'dd-in', placeholder: placeholder || '' }, parent);
    i.value = value || '';
    if (width) { i.style.width = width + 'px'; }
    i.addEventListener('input', function () { onInput(i.value.trim()); });
    if (onChange) { i.addEventListener('change', function () { onChange(i.value.trim()); }); }
    return i;
  };

  // Segmented buttons; current '' = default (shown active, not written to the YAML until clicked).
  Editor.prototype.seg = function (parent, values, current, dflt, onPick) {
    var wrap = el('span', { 'class': 'dd-seg' }, parent);
    var btns = [];
    values.forEach(function (v) {
      var b = el('button', { type: 'button', 'class': 'dd-seg-b', title: v === dflt ? 'default' : '' }, wrap, v);
      b.addEventListener('click', function () {
        onPick(v);
        btns.forEach(function (x) { x.classList.toggle('dd-on', x === b); });
      });
      if ((current || dflt) === v) { b.classList.add('dd-on'); }
      btns.push(b);
    });
    return wrap;
  };

  Editor.prototype.label = function (parent, text) {
    return el('span', { 'class': 'dd-lab' }, parent, text);
  };

  Editor.prototype.remove = function (parent, title, onClick) {
    var b = el('button', { type: 'button', 'class': 'bw-btn dd-rm', title: title }, parent, 'Remove');
    b.addEventListener('click', onClick);
    return b;
  };

  // Button that opens a search-and-pick panel. options() -> [{ id, label }]; free: a typed value can be used.
  Editor.prototype.picker = function (parent, value, placeholder, options, onPick, free) {
    var self = this;
    var b = el('button', { type: 'button', 'class': 'dd-pick' + (value ? '' : ' dd-empty') }, parent, value || placeholder);
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      self.openPop(b, options(), free, function (id) {
        onPick(id);
        b.textContent = id || placeholder;
        b.classList.toggle('dd-empty', !id);
      });
    });
    return b;
  };

  Editor.prototype.openPop = function (anchor, opts, free, onPick) {
    var self = this;
    var pop = this.pop;
    pop.textContent = '';
    var r0 = this.w.root.getBoundingClientRect();
    var r1 = anchor.getBoundingClientRect();
    pop.style.left = Math.max(0, r1.left - r0.left) + 'px';
    pop.style.top = (r1.bottom - r0.top + 2) + 'px';
    pop.style.display = 'block';
    var search = el('input', { type: 'text', 'class': 'dd-in dd-pp-search', placeholder: free ? 'Search, or type space/name' + ELLIPSIS : 'Search' + ELLIPSIS }, pop);
    var list = el('div', { 'class': 'dd-pp-list' }, pop);
    function draw() {
      var q = search.value.trim().toLowerCase();
      list.textContent = '';
      var shown = opts.filter(function (o) { return !q || o.label.toLowerCase().indexOf(q) >= 0; });
      if (free && search.value.trim() && !opts.some(function (o) { return o.id === search.value.trim(); })) {
        var use = el('div', { 'class': 'dd-pp-row dd-pp-free' }, list, 'Use "' + search.value.trim() + '"');
        use.addEventListener('click', function () { var v = search.value.trim(); self.closePop(); onPick(v); });
      }
      shown.slice(0, ED_PICK_CAP).forEach(function (o) {
        var row = el('div', { 'class': 'dd-pp-row' }, list, o.label);
        row.addEventListener('click', function () { self.closePop(); onPick(o.id); });
      });
      if (shown.length > ED_PICK_CAP) { el('div', { 'class': 'bw-muted' }, list, (shown.length - ED_PICK_CAP) + ' more: refine the search.'); }
      if (!shown.length && !free) { el('div', { 'class': 'bw-muted' }, list, 'Nothing found.'); }
    }
    search.addEventListener('input', draw);
    search.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { self.closePop(); } });
    pop.addEventListener('click', function (ev) { ev.stopPropagation(); });
    draw();
    search.focus();
  };

  Editor.prototype.closePop = function () { this.pop.style.display = 'none'; };

  // ------------------------------------------------------------------ forms

  Editor.prototype.roleOptions = function () {
    return this.M.roles.filter(function (r) { return r.key; }).map(function (r) { return { id: r.key, label: r.key + (r.title ? ' ' + DASH + ' ' + r.title : '') }; });
  };

  // Types for a link end: any type, the types of the role first, then the other types of the project.
  Editor.prototype.typeOptions = function (roleKey) {
    var role = this.M.roles.filter(function (r) { return r.key === roleKey; })[0];
    var own = role ? role.items.map(function (i) { return i.type; }).filter(function (t) { return t; }) : [];
    var opts = [{ id: '', label: '(any type of the role)' }];
    own.forEach(function (t) { opts.push({ id: t, label: t + ' (in the role)' }); });
    this.types.forEach(function (t) { if (own.indexOf(t.id) < 0) { opts.push(t); } });
    return opts;
  };

  Editor.prototype.renameRole = function (oldKey, newKey) {
    var M = this.M;
    if (!oldKey || oldKey === newKey) { return; }
    M.links.forEach(function (k) {
      if (k.fromRole === oldKey) { k.fromRole = newKey; }
      if (k.toRole === oldKey) { k.toRole = newKey; }
    });
    if (M.bindings[oldKey]) { M.bindings[newKey] = M.bindings[oldKey]; delete M.bindings[oldKey]; }
  };

  Editor.prototype.renderForms = function () {
    var self = this;
    var M = this.M;
    var box = this.formBox;
    box.textContent = '';
    if (!this.formsOk) { return; }
    var changed = function () { self.renderChecks(); };
    var rerender = function () { self.renderForms(); };

    // General
    var g = this.section(box, 'General');
    var row = el('div', { 'class': 'dd-row' }, g);
    this.label(row, 'Name');
    this.input(row, M.name, 'e.g. V-cycle model', function (v) { M.name = v; changed(); }, 260);
    this.label(row, 'Description');
    this.input(row, M.description, 'optional', function (v) { M.description = v; changed(); }, 360);
    if (M.uses || !M.roles.length) {
      row = el('div', { 'class': 'dd-row' }, g);
      this.label(row, 'Reuse the roles and rules of');
      this.input(row, M.uses, 'project/id of a model work item (optional)', function (v) { M.uses = v; changed(); }, 260, function () { rerender(); });
      el('span', { 'class': 'bw-muted' }, row, M.uses ? 'The roles and rules are edited in that work item; here: documents and pairs.' : 'Empty: the model is written here.');
    }
    if (!M.uses) {
      row = el('div', { 'class': 'dd-row' }, g);
      this.label(row, 'Links that match no rule');
      this.seg(row, ED_UNEXP_LINKS, M.unexpLinks, 'ignore', function (v) { M.unexpLinks = v; changed(); });
    }

    if (M.uses) {
      var us = this.section(box, 'Roles and rules (from ' + M.uses + ', read only here)');
      M.roles.forEach(function (r) {
        el('div', { 'class': 'bw-muted' }, us, r.key + (r.title ? ' ' + DASH + ' ' + r.title : '') + ': ' + (r.items.map(function (i) { return i.type; }).join(', ') || DASH));
      });
      M.links.forEach(function (k) {
        el('div', { 'class': 'bw-muted' }, us, k.id + ': ' + k.fromRole + ' ' + k.linkRole + ' ' + k.toRole);
      });
    }
    // Roles
    var rs = M.uses ? null : this.section(box, 'Document roles');
    M.roles.forEach(function (r, ri) {
      if (M.uses) { return; }
      var card = el('div', { 'class': 'dd-card' }, rs);
      var top = el('div', { 'class': 'dd-row' }, card);
      self.label(top, 'Role key');
      self.input(top, r.key, 'e.g. SystemSpec', function (v) { r.key = v; }, 150, function (v) { self.renameRole(r.oldKey || '', v); r.oldKey = v; rerender(); });
      r.oldKey = r.key;
      self.label(top, 'Title');
      self.input(top, r.title, 'e.g. System specification', function (v) { r.title = v; changed(); }, 220);
      self.remove(top, 'Remove this role (its documents too; rules that use it must be corrected)', function () {
        M.roles.splice(ri, 1);
        delete M.bindings[r.key];
        rerender();
      });
      var r2 = el('div', { 'class': 'dd-row' }, card);
      self.label(r2, 'Other work item types');
      self.seg(r2, ED_UNEXP_TYPES, r.unexp, 'warning', function (v) { r.unexp = v; changed(); });
      self.label(r2, 'Description');
      self.input(r2, r.description, 'optional', function (v) { r.description = v; changed(); }, 260);
      var t = el('table', { 'class': 'bw-table dd-items' }, card);
      var hr = el('tr', null, t);
      ['Work item type', 'Min per document', 'Max', 'Ignored', ''].forEach(function (h) { el('th', null, hr, h); });
      r.items.forEach(function (it, ii) {
        var tr = el('tr', null, t);
        self.picker(el('td', null, tr), it.type, 'choose a type', function () { return self.types; }, function (v) { it.type = v; changed(); });
        self.input(el('td', null, tr), it.min, '', function (v) { it.min = v; changed(); }, 50);
        self.input(el('td', null, tr), it.max, '', function (v) { it.max = v; changed(); }, 50);
        var cb = el('input', { type: 'checkbox', title: 'Allowed in the role but not counted by the rules (e.g. headings)' }, el('td', null, tr));
        cb.checked = it.ignored;
        cb.addEventListener('change', function () { it.ignored = cb.checked; changed(); });
        self.remove(el('td', null, tr), 'Remove this type', function () { r.items.splice(ii, 1); rerender(); });
      });
      self.w.button(card, '+ Work item type', 'Add a work item type to the role', function () { r.items.push({ type: '', min: '', max: '', ignored: false, description: '' }); rerender(); });
    });
    if (!M.uses) this.w.button(rs, '+ Role', 'Add a document role', function () {
      M.roles.push({ key: 'Role' + (M.roles.length + 1), title: '', description: '', unexp: '', items: [] });
      rerender();
    });

    // Link rules
    var ls = M.uses ? null : this.section(box, 'Link rules (from = link source, where the link is stored; to = link target)');
    M.links.forEach(function (k, ki) {
      if (M.uses) { return; }
      var card = el('div', { 'class': 'dd-card' }, ls);
      var top = el('div', { 'class': 'dd-row' }, card);
      self.label(top, 'Id');
      self.input(top, k.id, 'e.g. L1', function (v) { k.id = v; }, 80, function (v) {
        if (k.oldId && M.pairs[k.oldId] && k.oldId !== v) { M.pairs[v] = M.pairs[k.oldId]; delete M.pairs[k.oldId]; }
        k.oldId = v;
        rerender();
      });
      k.oldId = k.id;
      self.remove(top, 'Remove this rule (and its pairs)', function () { delete M.pairs[k.id]; M.links.splice(ki, 1); rerender(); });
      var r2 = el('div', { 'class': 'dd-row' }, card);
      self.label(r2, 'From');
      self.picker(r2, k.fromRole, 'source role', function () { return self.roleOptions(); }, function (v) { k.fromRole = v; rerender(); });
      self.picker(r2, k.fromType, '(any type)', function () { return self.typeOptions(k.fromRole); }, function (v) { k.fromType = v; changed(); });
      self.label(r2, 'link role');
      self.picker(r2, k.linkRole, 'choose a link role', function () { return self.linkRoles; }, function (v) { k.linkRole = v; changed(); });
      self.label(r2, 'To');
      self.picker(r2, k.toRole, 'target role', function () { return self.roleOptions(); }, function (v) { k.toRole = v; rerender(); });
      self.picker(r2, k.toType, '(any type)', function () { return self.typeOptions(k.toRole); }, function (v) { k.toType = v; changed(); });
      var r3 = el('div', { 'class': 'dd-row' }, card);
      self.label(r3, 'Min links per source item');
      self.input(r3, k.fmin, '0', function (v) { k.fmin = v; changed(); }, 50);
      self.label(r3, 'per target item');
      self.input(r3, k.tmin, '0', function (v) { k.tmin = v; changed(); }, 50);
      self.label(r3, 'Severity');
      self.seg(r3, ED_RULE_SEV, k.sev, 'error', function (v) { k.sev = v; changed(); });
      self.label(r3, 'Description');
      self.input(r3, k.description, 'optional', function (v) { k.description = v; changed(); }, 220);
      // Severity per side (D17): empty = the rule's severity.
      var r4 = el('div', { 'class': 'dd-row' }, card);
      self.label(r4, 'Severity of source items without link');
      self.seg(r4, ED_SIDE_SEV, k.fsev || ED_SAME, ED_SAME, function (v) { k.fsev = v === ED_SAME ? '' : v; changed(); });
      self.label(r4, 'of target items not covered');
      self.seg(r4, ED_SIDE_SEV, k.tsev || ED_SAME, ED_SAME, function (v) { k.tsev = v === ED_SAME ? '' : v; changed(); });
    });
    if (!M.uses) this.w.button(ls, '+ Rule', 'Add a link rule', function () {
      var n = M.links.length + 1;
      var used = M.links.map(function (k) { return k.id; });
      while (used.indexOf('L' + n) >= 0) { n++; }
      M.links.push({ id: 'L' + n, fromRole: '', fromType: '', linkRole: '', toRole: '', toType: '', fmin: '', tmin: '', sev: '', fsev: '', tsev: '', description: '' });
      rerender();
    });

    // Documents
    var dsx = this.section(box, 'Documents of each role');
    M.roles.forEach(function (r) {
      if (!r.key) { return; }
      var row2 = el('div', { 'class': 'dd-row' }, dsx);
      self.label(row2, r.key);
      var docs = M.bindings[r.key] || [];
      docs.forEach(function (d, di) {
        var chip = el('span', { 'class': 'dd-chip' }, row2, d + ' ');
        var x = el('button', { type: 'button', 'class': 'dd-chip-x', title: 'Remove this document' }, chip, 'x');
        x.addEventListener('click', function () { docs.splice(di, 1); M.bindings[r.key] = docs; rerender(); });
      });
      self.picker(row2, '', '+ Document', function () {
        return self.docs.filter(function (o) { return docs.indexOf(o.id) < 0; });
      }, function (v) { if (v && docs.indexOf(v) < 0) { docs.push(v); M.bindings[r.key] = docs; } rerender(); }, true);
    });
    if (!M.roles.length) { el('div', { 'class': 'bw-muted' }, dsx, 'Add a role first.'); }

    // Pairs
    var ps = this.section(box, 'Paired documents (optional, per rule; without pairs the documents of a role are pooled)');
    M.links.forEach(function (k) {
      if (!k.id) { return; }
      var card = el('div', { 'class': 'dd-row' }, ps);
      var lab = el('label', { 'class': 'bw-check' }, card);
      var cb = el('input', { type: 'checkbox' }, lab);
      cb.checked = !!M.pairs[k.id];
      el('span', null, lab, k.id + ' (' + (k.fromRole || '?') + ' ' + ARROW + ' ' + (k.toRole || '?') + '): paired');
      cb.addEventListener('change', function () {
        if (cb.checked) { M.pairs[k.id] = M.pairs[k.id] || []; } else { delete M.pairs[k.id]; }
        rerender();
      });
      if (!M.pairs[k.id]) { return; }
      var list = el('div', { 'class': 'dd-pairs' }, ps);
      M.pairs[k.id].forEach(function (p, pi) {
        var pr = el('div', { 'class': 'dd-row' }, list);
        self.picker(pr, p[0], 'source document (' + (k.fromRole || '?') + ')', function () {
          return (M.bindings[k.fromRole] || []).map(function (d) { return { id: d, label: d }; });
        }, function (v) { p[0] = v; changed(); });
        el('span', null, pr, ARROW);
        self.picker(pr, p[1], 'target document (' + (k.toRole || '?') + ')', function () {
          return (M.bindings[k.toRole] || []).map(function (d) { return { id: d, label: d }; });
        }, function (v) { p[1] = v; changed(); });
        self.remove(pr, 'Remove this pair', function () { M.pairs[k.id].splice(pi, 1); rerender(); });
      });
      self.w.button(list, '+ Pair', 'Add a pair [source document, target document]', function () { M.pairs[k.id].push(['', '']); rerender(); });
    });
    if (!M.links.length) { el('div', { 'class': 'bw-muted' }, ps, 'Add a rule first.'); }

    // Checks and actions
    this.checks = el('div', { 'class': 'dd-ed-checks' }, box);
    var act = el('div', { 'class': 'dd-row' }, box);
    this.w.button(act, 'Generate YAML', 'Write the YAML text of the edited model (YAML text tab)', function () { self.generate(); });
    this.w.button(act, 'Undo all edits', 'Go back to the model read from the model work item', function () {
      if (window.confirm('Discard all the edits made in the forms?')) { self.reset(); self.renderForms(); }
    });
    this.renderChecks();
  };

  Editor.prototype.section = function (parent, title) {
    var s = el('div', { 'class': 'dd-sec' }, parent);
    el('div', { 'class': 'dd-h' }, s, title);
    return s;
  };

  Editor.prototype.problems = function () {
    return edValidate(this.M, this.types.map(function (t) { return t.id; }), this.linkRoles.map(function (r) { return r.id; }));
  };

  Editor.prototype.renderChecks = function () {
    if (!this.checks) { return; }
    var probs = this.problems();
    var box = this.checks;
    box.textContent = '';
    if (!probs.length) { el('div', { 'class': 'dd-sev-info' }, box, 'No problem found in the forms.'); return; }
    probs.forEach(function (p) {
      var row = el('div', { 'class': 'dd-prob' }, box);
      el('span', { 'class': 'dd-sev dd-sev-' + p.sev }, row, p.sev);
      el('span', null, row, p.msg);
    });
  };

  // ------------------------------------------------------------------ YAML text

  Editor.prototype.buildText = function () {
    var self = this;
    var p = this.textPane;
    el('div', { 'class': 'bw-muted' }, p, 'To apply the model: Copy, open the model work item, select its whole description, ' +
      'paste as plain text (Ctrl+Shift+V), save, then Reload page. Edits made here are not read back into the forms.');
    this.ta = el('textarea', { 'class': 'dd-ta', spellcheck: 'false', rows: 22 }, p);
    this.ta.value = this.w.model.lines.join(NLC) + (this.w.model.lines.length ? NLC : '');
    var row = el('div', { 'class': 'dd-row' }, p);
    this.w.button(row, 'Copy', 'Copy the YAML text to the clipboard', function () { self.copy(); });
    this.w.button(row, 'Download', 'Download the YAML text as a file', function () {
      download(new Blob([self.ta.value], { type: 'text/plain' }), 'data-model-' + (self.project || 'project') + '.yaml');
    });
    if (this.w.item.id) {
      el('a', { href: itemUrl(this.w.item.project, this.w.item.id, ''), target: '_blank', title: 'Open the model work item in a new tab' }, row, 'Open model item');
    }
    this.saveBtn = this.w.button(row, 'Save to Polarion', 'Write this text into the description of the model work item (REST API)', function () { self.save(); });
    this.saveBtn.style.display = 'none';
    this.copied = el('span', { 'class': 'bw-muted' }, row, '');
    this.restInfo = el('div', { 'class': 'bw-muted dd-rest' }, p, '');
    this.probeRest();
  };

  // ------------------------------------------------------------------ Save to Polarion (REST, dmDefine 0.5.0, SPEC D10)
  // Optional: the button is shown only when the session REST token exists and a GET of the model item answers 200
  // (verified on 2512, dmSpike S4: GET 200 with the token, 401 without; PATCH of the description 204). Copy and paste
  // always stay available. Before the PATCH the item is read again: if its text changed since the page was loaded, the
  // user is asked. After the PATCH the item is read back and compared.

  function restToken() {
    try { return top.getRestApiToken && typeof top.getRestApiToken === 'function' ? top.getRestApiToken() : null; } catch (e) { return null; }
  }

  function restUrl(project, id, withFields) {
    return '/polarion/rest/v1/projects/' + encodeURIComponent(project) + '/workitems/' + encodeURIComponent(id) +
      (withFields ? '?fields[workitems]=description' : '');
  }

  function restCall(method, url, token, body) {
    var h = { 'Accept': 'application/json', 'X-Polarion-REST-Token': token };
    if (body) { h['Content-Type'] = 'application/json'; }
    return fetch(url, { method: method, headers: h, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); });
  }

  // Description HTML -> text lines, as shared/vm/dm-read.vm does on the server.
  function htmlToLines(html) {
    var NB = String.fromCharCode(160);
    var t = String(html || '').split(NB).join(' ').split(String.fromCharCode(13)).join('');
    t = t.replace(/<span[^>]*>[ ]*<br[^>]*>[ ]*<.span>/gi, '');
    t = t.split(String.fromCharCode(10)).join('@NL@');
    t = t.replace(/<br[^>]*>/gi, '@NL@').replace(/<.(p|div|li|pre|h[1-6]|tr)>/gi, '@NL@').replace(/<[^>]*>/g, '');
    t = t.split('&nbsp;').join(' ').split('&' + HASH + '160;').join(' ').split('&lt;').join('<').split('&gt;').join('>');
    t = t.split('&quot;').join('"').split('&' + HASH + '34;').join('"').split('&' + HASH + '39;').join("'").split('&apos;').join("'");
    t = t.split('&amp;').join('&');
    var lines = t.split('@NL@');
    while (lines.length && lines[lines.length - 1].trim() === '') { lines.pop(); }
    return lines;
  }

  // Text -> description HTML: one line per br, characters escaped, leading spaces as non-breaking spaces (as the
  // Polarion editor keeps the indentation, dmSpike S1).
  function linesToHtml(text) {
    var lines = String(text).split(String.fromCharCode(13)).join('').split(String.fromCharCode(10));
    while (lines.length && lines[lines.length - 1].trim() === '') { lines.pop(); }
    return lines.map(function (l) {
      var i = 0;
      while (i < l.length && l.charAt(i) === ' ') { i++; }
      var body = l.substring(i).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
      return new Array(i + 1).join('&nbsp;') + body + '<br/>';
    }).join('');
  }

  function sameLines(a, b) {
    var x = a.map(function (l) { return l.replace(/ +/g, ' ').trim(); });
    var y = b.map(function (l) { return l.replace(/ +/g, ' ').trim(); });
    return x.join('|') === y.join('|') && a.map(function (l) { return l.length - l.replace(/^ +/, '').length; }).join(',') ===
      b.map(function (l) { return l.length - l.replace(/^ +/, '').length; }).join(',');
  }

  function restError(st, txt) {
    var detail = '';
    try { var j = JSON.parse(txt); detail = j.errors && j.errors[0] ? (j.errors[0].detail || j.errors[0].title || '') : ''; } catch (e) { detail = ''; }
    var why = st === 401 ? 'the REST API refused the session token' :
      st === 403 ? 'no permission to change this work item (or the REST endpoint is not allowed for you)' :
      st === 404 ? 'the model work item was not found' :
      st === 409 ? 'the work item was changed or locked by someone else' : 'HTTP ' + st;
    return why + (detail ? ' (' + detail + ')' : '');
  }

  Editor.prototype.probeRest = function () {
    var self = this;
    var w = this.w;
    var info = this.restInfo;
    function off(msg) { self.rest = null; info.textContent = 'Save to Polarion is not available: ' + msg + '. Use Copy and paste the text into the model work item.'; }
    if (w.root.dataset.rest === 'off') { off('switched off in the widget parameters'); return; }
    if (!w.item.id) { off('there is no model work item yet (create a Text work item in the model document, paste the text, then Save works on the next page load)'); return; }
    var token = restToken();
    if (!token) { off('no REST token in this session (the REST API token may be disabled on this server)'); return; }
    info.textContent = 'Checking the REST API' + ELLIPSIS;
    restCall('GET', restUrl(w.item.project, w.item.id, true), token).then(function (r) {
      if (r.status !== 200) { off(restError(r.status, r.text)); return; }
      self.rest = { token: token };
      self.saveBtn.style.display = '';
      info.textContent = 'Save to Polarion writes the text into the description of ' + w.item.project + '/' + w.item.id +
        ' (a new revision; the history keeps the previous one).';
    }, function (e) { off('the REST API could not be reached (' + e + ')'); });
  };

  Editor.prototype.save = function () {
    var self = this;
    var w = this.w;
    if (!this.rest) { return; }
    var text = this.ta.value;
    var url = restUrl(w.item.project, w.item.id, false);
    var target = w.item.project + '/' + w.item.id;
    var token = restToken() || this.rest.token;
    var msg = this.copied;
    msg.textContent = 'Reading the model work item' + ELLIPSIS;
    restCall('GET', restUrl(w.item.project, w.item.id, true), token).then(function (r) {
      if (r.status !== 200) { msg.textContent = 'Not saved: ' + restError(r.status, r.text) + '.'; return null; }
      var current = [];
      try { current = htmlToLines(JSON.parse(r.text).data.attributes.description.value); } catch (e) { current = []; }
      var changed = !sameLines(current, w.model.lines);
      var q = changed ?
        'The description of ' + target + ' was changed since this page was loaded (by you or someone else). Replace it anyway with this text?' :
        'Replace the description of ' + target + ' with this text? (A new revision; the history keeps the previous one.)';
      if (!window.confirm(q)) { msg.textContent = 'Not saved.'; return null; }
      msg.textContent = 'Saving' + ELLIPSIS;
      var body = { data: { type: 'workitems', id: target, attributes: { description: { type: 'text/html', value: linesToHtml(text) } } } };
      return restCall('PATCH', url, token, body).then(function (p) {
        if (p.status !== 204 && p.status !== 200) { msg.textContent = 'Not saved: ' + restError(p.status, p.text) + '.'; return null; }
        return restCall('GET', restUrl(w.item.project, w.item.id, true), token).then(function (g) {
          var back = [];
          try { back = htmlToLines(JSON.parse(g.text).data.attributes.description.value); } catch (e) { back = []; }
          var want = String(text).split(String.fromCharCode(13)).join('').split(String.fromCharCode(10));
          while (want.length && want[want.length - 1].trim() === '') { want.pop(); }
          var ok = g.status === 200 && sameLines(back, want);
          msg.textContent = ok ? 'Saved to ' + target + '. Reload page to read the new model.' :
            'Saved, but the text read back differs from the text sent: open the model work item and check it.';
          self.saved = ok;
          if (ok && window.confirm('Saved. Reload the page now to read the new model?')) { window.location.reload(); }
          return null;
        });
      });
    }).catch(function (e) { msg.textContent = 'Not saved: the REST API could not be reached (' + e + ').'; });
  };

  Editor.prototype.generate = function () {
    var probs = this.problems().filter(function (p) { return p.sev === 'error'; });
    this.ta.value = edYaml(this.M, this.header).join(NLC) + NLC;
    this.show('text');
    this.copied.textContent = probs.length ? 'Generated with ' + probs.length + ' error(s) reported by the forms: the widget will list them after the paste.' : 'Generated from the forms.';
  };

  Editor.prototype.copy = function () {
    var self = this;
    var text = this.ta.value;
    function done(ok) { self.copied.textContent = ok ? 'Copied to the clipboard.' : 'Copy failed: select the text and copy it (Ctrl+C).'; }
    function fallback() {
      self.ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); }
    else { fallback(); }
  };
