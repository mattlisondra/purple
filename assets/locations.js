/* PURPLE locations and shooting schedule: the engine behind purple-locations.html.
 *
 * Everything on this page (the scene breakdown, location options, schedule and rules) is in
 * data/locations.json on the director's computer and is published only encrypted, as
 * data/locations.enc.json (made by tools/seal.cjs with the site password). The password is the
 * same as the other pages: unlocking one unlocks all of them in this browser.
 * Your shortlist marks and notes on the options are kept in this browser only.
 */
(function () {
  'use strict';
  if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) { location.replace('https:' + location.href.slice(5)); return; }

  var SEALED = 'data/locations.enc.json';
  var UNLOCK_DAYS = 30;
  var K_UNLOCK = 'purple-unlocked', K_MARKS = 'purple-locs', K_UI = 'purple-ui-locations';

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isUrl(u) { return /^https?:\/\//i.test(String(u || '')); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 1800); }
  function fetchJson(url) { return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); }); }
  function pages(e8) { e8 = Math.round(e8 || 0); var w = Math.floor(e8 / 8), r = e8 % 8; return (w ? w : '') + (w && r ? ' ' : '') + (r ? r + '/8' : '') || '0'; }
  function mins(t) { var m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function hm(n) { var h = Math.floor(n / 60), m = Math.round(n % 60); return h + (m ? ':' + String(m).padStart(2, '0') : '') + ' h'; }
  function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function links(list) {
    return (list || []).filter(function (l) { return l && isUrl(l.url); }).map(function (l) {
      return '<a class="lk" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label || 'Link') + '</a>';
    }).join('');
  }
  function para(t) { return t ? '<p>' + esc(t) + '</p>' : ''; }
  function rich(t) { // **bold** only, after escaping
    return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }

  var D = null;                               // the decrypted data
  var marks = load(K_MARKS, {});              // "<loc>|<option name>" -> { s: 'short'|'booked'|'no', note: '' }
  var ui = load(K_UI, { tab: 'plan' });
  var SC = {}, LOC = {}, CAST = {}, ARC = {}, DAYOF = {};

  // ---------- password gate (same key as the other pages) ----------
  function canCrypt() { return !!(window.crypto && crypto.subtle && window.isSecureContext !== false); }
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function keyFromPassword(pw, box) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(box.salt), iterations: box.iter }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
    });
  }
  function openBox(key, box) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct)).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  function gate(start) {
    var root = document.documentElement;
    function go(p) { D = p; root.classList.remove('locked'); start(); }
    var f = $('gateForm'), input = $('gatePw'), err = $('gateErr'), btn = f.querySelector('button');
    function ask(box) {
      root.classList.add('locked');
      if (!canCrypt()) { err.innerHTML = 'This page can only be unlocked over <code>https://</code> or on <code>http://localhost</code>.'; return; }
      setTimeout(function () { input.focus(); }, 50);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
        keyFromPassword(input.value.trim(), box).then(function (key) {
          return openBox(key, box).then(function (p) {
            return crypto.subtle.exportKey('raw', key).then(function (raw) {
              store(K_UNLOCK, { k: b64(raw), salt: box.salt, until: Date.now() + UNLOCK_DAYS * 864e5 });
              return p;
            });
          });
        }).then(function (p) { input.value = ''; btn.disabled = false; btn.textContent = 'Enter'; go(p); },
          function () { btn.disabled = false; btn.textContent = 'Enter'; err.textContent = 'That is not the password.'; input.select(); });
      });
    }
    fetchJson(SEALED).then(function (box) {
      var u = load(K_UNLOCK, null);
      if (!(u && u.k && u.salt === box.salt && u.until > Date.now() && canCrypt())) return ask(box);
      crypto.subtle.importKey('raw', unb64(u.k), 'AES-GCM', false, ['decrypt'])
        .then(function (key) { return openBox(key, box); })
        .then(go, function () { try { localStorage.removeItem(K_UNLOCK); } catch (e) {} ask(box); });
    }, function (e) {
      root.classList.add('locked');
      btn.disabled = true;
      err.innerHTML = location.protocol === 'file:'
        ? 'This page was opened as a file. Double-click <code>preview.bat</code> in this folder, then open <code>http://localhost:8000/purple-locations.html</code>.'
        : 'The page could not load (' + esc(e.message) + '). Refresh to try again.';
    });
  }
  function lock() { try { localStorage.removeItem(K_UNLOCK); } catch (e) {} location.reload(); }

  // ---------- indexes ----------
  function partOf(ref) { var m = String(ref).match(/^(\d+)([A-Z]?)$/); return m ? { n: +m[1], part: m[2] || '' } : null; }
  function index() {
    (D.scenes || []).forEach(function (s) { SC[s.n] = s; });
    (D.locations || []).forEach(function (l) { LOC[l.key] = l; });
    (D.cast || []).forEach(function (c) { CAST[c.id] = c; });
    (D.arcs || []).forEach(function (a) { ARC[a.id] = a; });
    var parts = {};
    blocks().forEach(function (b) {
      b.days.forEach(function (d) {
        (d.scenes || []).forEach(function (r) { var p = partOf(r); if (!p) return; (DAYOF[p.n] = DAYOF[p.n] || []).push(d.id); if (p.part) parts[p.n] = (parts[p.n] || 0) + 1; });
      });
    });
    index.parts = parts;
  }
  function blocks() { return (D.schedule && D.schedule.blocks) || []; }
  function e8Of(ref) {
    var p = partOf(ref); if (!p || !SC[p.n]) return 0;
    if (!p.part) return SC[p.n].e8;
    return SC[p.n].e8 / (index.parts[p.n] || 1);
  }
  function castOf(refs) {
    var seen = {}, out = [];
    refs.forEach(function (r) { var p = partOf(r), s = p && SC[p.n]; (s ? s.cast : []).forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } }); });
    return out;
  }
  function castName(id) { var c = CAST[id]; return c ? c.name : id; }
  function castChips(ids) {
    return ids.map(function (id) { var c = CAST[id] || {}; return '<span class="tag' + (c.child ? ' kid' : '') + (c.lead ? ' lead' : '') + '" title="' + esc(c.note || '') + '">' + esc(c.name || id) + '</span>'; }).join('');
  }
  function isNight(s) { return !!s.night; }
  function sceneChip(ref) {
    var p = partOf(ref), s = p && SC[p.n]; if (!s) return '<span class="sc">' + esc(ref) + '</span>';
    return '<span class="sc' + (isNight(s) ? ' nt' : '') + '" title="' + esc(s.head + ' · p.' + s.page + ' · ' + pages(s.e8) + ' pg') + '">' + esc(ref) + '</span>';
  }

  // ---------- The plan ----------
  function arcStats(id) {
    var e8 = 0, n = 0;
    (D.scenes || []).forEach(function (s) { if (s.arc === id) { e8 += s.e8; n++; } });
    var days = 0, extra = 0;
    blocks().forEach(function (b) { if (b.arc === id) b.days.forEach(function (d) { if (d.kind === 'optional') extra++; else if (d.kind !== 'travel') days++; }); });
    return { e8: e8, n: n, days: days, extra: extra };
  }
  function renderPlan() {
    var h = '';
    h += '<div class="panel"><h2>' + esc(D.title || 'Locations and schedule') + '</h2>' + (D.intro || []).map(function (t) { return '<p>' + rich(t) + '</p>'; }).join('') +
      '<div class="foot">Updated ' + esc(D.updated || '') + '. Scene numbers are ours, in script order; page numbers are the PDF\'s (the title page is page 1).</div></div>';
    h += '<div class="arcs">';
    (D.arcs || []).forEach(function (a) {
      var st = arcStats(a.id);
      h += '<div class="arc arc-' + esc(a.id) + '"><div class="an">Arc ' + esc(a.n) + '</div><div class="at">' + esc(a.name) + '</div><div class="ar">' + esc(a.route) + '</div>' +
        '<div class="anum"><div><b>' + (st.days || '–') + (st.extra ? '<small>+' + st.extra + '</small>' : '') + '</b><span>shoot days</span></div><div><b>' + pages(st.e8) + '</b><span>pages</span></div><div><b>' + st.n + '</b><span>scenes</span></div></div>' +
        '<div class="aw"><b>When:</b> ' + esc(a.when) + '</div>' + (a.base ? '<div class="aw"><b>Base:</b> ' + esc(a.base) + '</div>' : '') +
        '<p>' + rich(a.summary) + '</p>' + (a.travel ? '<div class="aw"><b>Moves:</b> ' + esc(a.travel) + '</div>' : '') +
        '<div class="btns" style="margin-top:8px"><button class="b small" data-golocs="' + esc(a.id) + '">Locations</button><button class="b small" data-gosched="' + esc(a.id) + '">Days</button></div></div>';
    });
    h += '</div>';
    if (D.totals) h += '<div class="panel"><h2>How many days</h2>' + (D.totals || []).map(function (t) { return '<p>' + rich(t) + '</p>'; }).join('') + '</div>';
    if ((D.decisions || []).length) {
      h += '<div class="panel"><h2>Decisions to make</h2><p class="muted">What the plan assumes, and what to settle first. Each has a recommendation; change it and the schedule changes with it.</p><ol class="dec">';
      D.decisions.forEach(function (d) { h += '<li><b>' + esc(d.q) + '</b><div class="rec"><span class="tag pA">Recommended</span> ' + rich(d.rec) + '</div>' + (d.why ? '<div class="muted">' + rich(d.why) + '</div>' : '') + '</li>'; });
      h += '</ol></div>';
    }
    if ((D.flags || []).length) {
      h += '<div class="panel"><h2>Watch out</h2><ul class="flags">' + D.flags.map(function (f) { return '<li class="' + esc(f.level || 'warn') + '">' + rich(f.t) + '</li>'; }).join('') + '</ul></div>';
    }
    var cal = [];
    blocks().forEach(function (b) { b.days.forEach(function (d) { if (d.iso) cal.push({ d: d, arc: b.arc }); }); });
    cal.sort(function (a, b) { return a.d.iso < b.d.iso ? -1 : a.d.iso > b.d.iso ? 1 : 0; });
    if (cal.length) {
      h += '<div class="panel"><h2>In calendar order</h2><p class="muted">The arcs are numbered by story, but the Philippines and the winter day come first in the calendar.</p><div class="tablewrap"><table class="t cal"><tbody>' +
        cal.map(function (c) { var d = c.d, e8 = 0; (d.scenes || []).forEach(function (r) { e8 += e8Of(r); }); return '<tr><td class="n">' + esc(d.date) + '</td><td><span class="dotarc arc-' + esc(c.arc) + '"></span><button class="lnk" data-day="' + esc(d.id) + '">' + esc(d.id) + '</button></td><td>' + esc(d.title) + '</td><td class="muted">' + esc(d.kind === 'travel' ? 'travel' : (d.call ? d.call + '-' + d.wrap : '')) + '</td><td class="n">' + (e8 ? pages(e8) + ' pg' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    }
    if (D.light && D.light.rows) {
      h += '<div class="panel"><h2>Light</h2><p class="muted">' + esc(D.light.note || '') + '</p><div class="tablewrap"><table class="t"><thead><tr><th>Where</th><th>Date</th><th class="n">Sunrise</th><th class="n">Sunset</th><th class="n">Civil dusk</th><th class="n">Nautical dusk</th><th class="n">Truly dark</th></tr></thead><tbody>' +
        D.light.rows.map(function (r) { return '<tr><td>' + esc(r.place) + '</td><td>' + esc(r.label || r.date) + '</td><td class="n">' + esc(r.rise) + '</td><td class="n">' + esc(r.set) + '</td><td class="n">' + esc(r.civil) + '</td><td class="n">' + esc(r.naut) + '</td><td class="n">' + esc(r.astro) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (D.light.moon ? '<p class="muted" style="margin-top:10px">' + rich(D.light.moon) + '</p>' : '') + '</div>';
    }
    (D.checks || []).forEach(function (c) {
      var lab = { ok: 'Checks out', wrong: 'Wrong', closed: 'Closed', notfound: 'Not found', unconfirmed: 'Not confirmed' };
      h += '<div class="panel"><h2>' + esc(c.title) + '</h2>' + (c.intro ? '<p class="muted">' + rich(c.intro) + '</p>' : '') + '<div class="tablewrap"><table class="t checks"><tbody>' +
        (c.items || []).map(function (it) { return '<tr><td><b>' + esc(it.item) + '</b></td><td><span class="tag st-' + esc(it.status) + '">' + esc(lab[it.status] || it.status) + '</span></td><td>' + rich(it.note) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    });
    $('plan').innerHTML = h;
  }

  // ---------- Locations ----------
  function markKey(l, o) { return l.key + '|' + o.name; }
  function locText(l) {
    var s = [l.title, l.where, l.needs, l.pick, l.fake, (l.notes || []).join(' ')];
    (l.scenes || []).forEach(function (n) { if (SC[n]) s.push(SC[n].head); });
    (l.options || []).forEach(function (o) { s.push(o.name, o.area, o.fit, o.legal, o.practical, o.cost, o.risk); });
    return s.join(' ').toLowerCase();
  }
  function renderLocs() {
    var q = $('lq').value.trim().toLowerCase(), arc = $('lArc').value, mine = $('lMine').value;
    ui.lq = $('lq').value; ui.lArc = arc; ui.lMine = mine; store(K_UI, ui);
    var list = (D.locations || []).filter(function (l) {
      if (arc && l.arc !== arc) return false;
      if (q && locText(l).indexOf(q) < 0) return false;
      if (mine && !(l.options || []).some(function (o) { var m = marks[markKey(l, o)]; return m && m.s === mine; })) return false;
      return true;
    });
    var nOpt = 0; list.forEach(function (l) { nOpt += (l.options || []).length; });
    $('lcount').innerHTML = list.length + ' location' + (list.length === 1 ? '' : 's') + ' · ' + nOpt + ' options' + (q || arc || mine ? ' <button class="lnk" id="lclear">Show all</button>' : '');
    var h = '', lastArc = null;
    list.forEach(function (l) {
      if (l.arc !== lastArc) { var a = ARC[l.arc] || {}; h += '<h2 class="arch arc-' + esc(l.arc) + '">Arc ' + esc(a.n || '') + ' · ' + esc(a.name || l.arc) + '<span>' + esc(a.route || '') + '</span></h2>'; lastArc = l.arc; }
      var e8 = 0, refs = l.scenes || [];
      refs.forEach(function (n) { if (SC[n]) e8 += SC[n].e8; });
      var days = {}; refs.forEach(function (n) { (DAYOF[n] || []).forEach(function (d) { days[d] = 1; }); });
      h += '<div class="loc" id="loc-' + esc(l.key) + '"><div class="lh"><div><div class="nm">' + esc(l.title) + '</div><div class="rl">' + esc(l.where || '') + ' · ' + refs.length + ' scene' + (refs.length === 1 ? '' : 's') + ', ' + pages(e8) + ' pages' +
        (Object.keys(days).length ? ' · shot on ' + Object.keys(days).map(function (d) { return '<button class="lnk" data-day="' + esc(d) + '">' + esc(d) + '</button>'; }).join(', ') : '') + '</div></div></div>' +
        '<div class="scs">' + refs.map(function (n) { var s = SC[n]; return s ? '<div class="scl"><span class="sc' + (s.night ? ' nt' : '') + '">' + s.n + '</span><span class="sh">' + esc(s.head) + '</span><span class="muted">p.' + s.page + ' · ' + pages(s.e8) + '</span></div>' : ''; }).join('') + '</div>' +
        (l.needs ? '<div class="needs"><b>What the scene needs.</b> ' + rich(l.needs) + '</div>' : '') +
        (l.pick ? '<div class="pick"><b>Our pick.</b> ' + rich(l.pick) + '</div>' : '') +
        (l.fake ? '<div class="fake"><b>Fake it or double it.</b> ' + rich(l.fake) + '</div>' : '') +
        ((l.notes || []).length ? '<ul class="lnotes">' + l.notes.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="opts">' + (l.options || []).map(function (o, i) { return optHtml(l, o, i); }).join('') + '</div></div>';
    });
    $('locs').innerHTML = h || '<div class="empty">Nothing matches.</div>';
  }
  var CONF_LABEL = { verified: 'Checked on an official page', likely: 'Likely; confirm with them', unverified: 'Not confirmed yet' };
  function optHtml(l, o, i) {
    var m = marks[markKey(l, o)] || {};
    var mapsq = o.maps || o.maps_query || (o.name + ' ' + (o.area || ''));
    return '<details class="opt' + (m.s ? ' m-' + m.s : '') + '"' + (ui.openAll ? ' open' : '') + '><summary><span class="onum">' + (i + 1) + '</span><span class="oname">' + esc(o.name) + '</span><span class="oarea">' + esc(o.area || '') + '</span>' +
      (o.confidence ? '<span class="tag cf-' + esc(o.confidence) + '">' + esc(CONF_LABEL[o.confidence] || o.confidence) + '</span>' : '') +
      (m.s ? '<span class="tag mk">' + ({ short: 'Shortlist', booked: 'Booked', no: 'Ruled out' })[m.s] + '</span>' : '') + '</summary>' +
      '<div class="ob">' +
      (o.fit ? '<div class="meta"><b>Why it fits:</b> ' + rich(o.fit) + '</div>' : '') +
      (o.legal ? '<div class="meta"><b>Permission:</b> ' + rich(o.legal) + '</div>' : '') +
      (o.practical ? '<div class="meta"><b>On the day:</b> ' + rich(o.practical) + '</div>' : '') +
      (o.cost ? '<div class="meta"><b>Cost:</b> ' + rich(o.cost) + '</div>' : '') +
      (o.risk ? '<div class="meta warn"><b>Risk:</b> ' + rich(o.risk) + '</div>' : '') +
      '<div class="links"><a class="lk go" href="' + esc(mapUrl(mapsq)) + '" target="_blank" rel="noopener">Map</a>' + links(o.links) + '</div>' +
      '<div class="mine"><select data-mark="' + esc(markKey(l, o)) + '"><option value="">Mark…</option><option value="short"' + (m.s === 'short' ? ' selected' : '') + '>Shortlist</option><option value="booked"' + (m.s === 'booked' ? ' selected' : '') + '>Booked</option><option value="no"' + (m.s === 'no' ? ' selected' : '') + '>Ruled out</option></select>' +
      '<input data-mnote="' + esc(markKey(l, o)) + '" placeholder="Your note (kept in this browser)" value="' + esc(m.note || '') + '"></div>' +
      '</div></details>';
  }

  // ---------- Schedule ----------
  function dayHours(d) { var c = mins(d.call), w = mins(d.wrap); if (c == null || w == null) return null; if (w <= c) w += 1440; return w - c; }
  function renderSched() {
    var S = D.schedule || {}, h = '';
    h += '<div class="panel"><h2>Shooting schedule (rough)</h2>' + (S.intro || []).map(function (t) { return '<p>' + rich(t) + '</p>'; }).join('') +
      ((S.principles || []).length ? '<h3>How it is built</h3><ul class="princ">' + S.principles.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    var limit = (S.limits && S.limits.day) || 660, turn = (S.limits && S.limits.turnaround) || 720;
    var jump = '<div class="jump">' + blocks().map(function (b) { return '<button class="b small" data-gosched="' + esc(b.arc) + '">' + esc(b.title) + '</button>'; }).join('') + '</div>';
    h += jump;
    var allDays = []; blocks().forEach(function (b) { b.days.forEach(function (d) { if ((d.scenes || []).length) allDays.push(d); }); });
    var who = (D.cast || []).map(function (c) { var ds = allDays.filter(function (d) { return castOf(d.scenes).indexOf(c.id) >= 0; }); return { c: c, ds: ds }; }).filter(function (x) { return x.ds.length; });
    h += '<details class="panel castdays"><summary><b>Who works which days</b> <span class="muted">(' + who.length + ' parts)</span></summary><div class="tablewrap"><table class="t"><tbody>' +
      who.map(function (x) { return '<tr><td><b>' + esc(x.c.name) + '</b><div class="muted">' + esc(x.c.note || '') + '</div></td><td class="n">' + x.ds.length + ' day' + (x.ds.length === 1 ? '' : 's') + '</td><td>' + x.ds.map(function (d) { return '<button class="lnk" data-day="' + esc(d.id) + '">' + esc(d.id) + '</button>'; }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    blocks().forEach(function (b) {
      var a = ARC[b.arc] || {}, be8 = 0, nd = 0;
      b.days.forEach(function (d) { (d.scenes || []).forEach(function (r) { be8 += e8Of(r); }); if (d.kind !== 'travel' && d.kind !== 'optional') nd++; });
      h += '<div class="block arc-' + esc(b.arc) + '" id="blk-' + esc(b.arc) + '"><div class="bh"><div><div class="an">Arc ' + esc(a.n || '') + '</div><h2>' + esc(b.title) + '</h2><div class="rl">' + esc(b.when || '') + ' · ' + nd + ' shoot day' + (nd === 1 ? '' : 's') + ' · ' + pages(be8) + ' pages</div></div></div>' +
        ((b.notes || []).length ? '<ul class="bnotes">' + b.notes.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>' : '');
      var prev = null;
      b.days.forEach(function (d) {
        var e8 = 0; (d.scenes || []).forEach(function (r) { e8 += e8Of(r); });
        var hrs = dayHours(d), cast = castOf(d.scenes || []);
        var chips = '';
        if (hrs != null) chips += '<span class="tag ' + (hrs > limit ? 'bad' : 'okk') + '">' + esc(d.call) + ' to ' + esc(d.wrap) + ' · ' + hm(hrs) + (hrs > limit ? ' (over ' + hm(limit) + ')' : '') + '</span>';
        if (prev && mins(prev.wrap) != null && mins(d.call) != null) {
          var apart = (prev.iso && d.iso) ? Math.round((Date.parse(d.iso) - Date.parse(prev.iso)) / 864e5) : 1;
          if (apart <= 1) {
            var pw = mins(prev.wrap), pc = mins(prev.call); if (pw <= pc) pw += 1440;
            var gap = apart * 1440 + mins(d.call) - pw;
            chips += '<span class="tag ' + (gap < turn ? 'bad' : 'okk') + '">Rest since ' + esc(prev.id) + ': ' + hm(gap) + (gap < turn ? ' (under ' + hm(turn) + ')' : '') + '</span>';
          } else chips += '<span class="tag">' + apart + ' days after ' + esc(prev.id) + '</span>';
        }
        if (e8) chips += '<span class="tag">' + pages(e8) + ' pages</span>';
        if (d.kind) chips += '<span class="tag k-' + esc(d.kind) + '">' + esc(({ travel: 'Travel only', 'travel-shoot': 'Travel and shoot', day: 'Day', split: 'Split day (into the night)', night: 'Night', early: 'Early start', optional: 'Optional', unit: 'Small unit' })[d.kind] || d.kind) + '</span>';
        h += '<div class="day" id="day-' + esc(d.id) + '"><div class="dh"><span class="did">' + esc(d.id) + '</span><div class="dt"><b>' + esc(d.title) + '</b><div class="rl">' + esc(d.date || '') + (d.where ? ' · ' + esc(d.where) : '') + '</div></div></div>' +
          '<div class="tags">' + chips + '</div>' +
          (d.sun ? '<div class="meta"><b>Light:</b> ' + esc(d.sun) + '</div>' : '') +
          ((d.scenes || []).length ? '<div class="meta"><b>Scenes:</b> ' + d.scenes.map(sceneChip).join(' ') + '</div>' : '') +
          (cast.length ? '<div class="meta"><b>Cast:</b> ' + castChips(cast) + '</div>' : '') +
          (d.child ? '<div class="meta kidline"><b>Child hours:</b> ' + rich(d.child) + '</div>' : '') +
          (d.moves ? '<div class="meta"><b>Moves:</b> ' + rich(d.moves) + '</div>' : '') +
          ((d.plan || []).length ? '<table class="t plan"><tbody>' + d.plan.map(function (r) { return '<tr><td class="tm">' + esc(r[0]) + '</td><td>' + rich(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : '') +
          ((d.notes || []).length ? '<ul class="dnotes">' + d.notes.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>' : '') +
          '</div>';
        if (d.kind !== 'optional' && d.kind !== 'travel') prev = d;
      });
      h += '</div>';
    });
    $('sched').innerHTML = h;
  }

  // ---------- Scenes ----------
  function renderScenes() {
    var q = $('sq').value.trim().toLowerCase(), arc = $('sArc').value, who = $('sCast').value, tod = $('sTime').value;
    var list = (D.scenes || []).filter(function (s) {
      if (arc && s.arc !== arc) return false;
      if (who && (s.cast || []).indexOf(who) < 0) return false;
      if (tod === 'night' && !s.night) return false;
      if (tod === 'day' && s.night) return false;
      if (q && (s.head + ' ' + (s.note || '') + ' ' + (LOC[s.loc] ? LOC[s.loc].title : '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var e8 = 0; list.forEach(function (s) { e8 += s.e8; });
    $('scount').textContent = list.length + ' scenes · ' + pages(e8) + ' pages';
    var h = '<table class="t scenes"><thead><tr><th>#</th><th>Pg</th><th>Scene</th><th class="n">Length</th><th>Cast</th><th>Shot at</th><th>Day</th></tr></thead><tbody>';
    list.forEach(function (s) {
      var l = LOC[s.loc], a = ARC[s.arc] || {};
      h += '<tr class="' + (s.night ? 'nt' : '') + '"><td><span class="sc' + (s.night ? ' nt' : '') + '">' + s.n + '</span></td><td>' + s.page + '</td><td><b>' + esc(s.head) + '</b>' + (s.note ? '<div class="muted">' + rich(s.note) + '</div>' : '') + '</td><td class="n">' + pages(s.e8) + '</td><td>' + castChips(s.cast || []) + '</td><td>' +
        (l ? '<button class="lnk shotat" data-loc="' + esc(l.key) + '"><span class="dotarc arc-' + esc(s.arc) + '"></span>' + esc(l.title) + '</button>' : esc(s.loc || '')) + '</td><td>' +
        (DAYOF[s.n] || []).map(function (d) { return '<button class="lnk" data-day="' + esc(d) + '">' + esc(d) + '</button>'; }).join(', ') + '</td></tr>';
    });
    h += '</tbody></table>';
    $('scenes').innerHTML = h;
  }

  // ---------- Budget versions ----------
  function money(n) { var neg = n < 0; n = Math.abs(n || 0); var s = '$' + (Math.round(n * 100) % 100 ? n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-CA')); return neg ? '-' + s : s; }
  function money0(n) { return '$' + Math.round(n || 0).toLocaleString('en-CA'); }
  var ARC_ORDER = ['east', 'gta', 'alberta', 'ph'];
  function arcName(id) { var a = ARC[id] || {}; return 'Arc ' + (a.n || '') + ' · ' + (a.name || id); }
  function budgetTable(lines, split) {
    return '<div class="tablewrap"><table class="t btab"><thead><tr><th>Item</th><th class="n">Qty × rate</th><th class="n">Total</th>' + (split ? '<th class="n">At the shoot</th><th class="n">Later</th><th class="n">In kind</th>' : '') + '</tr></thead><tbody>' +
      lines.map(function (l) {
        return '<tr><td>' + esc(l.item) + (l.est ? ' <span class="est">est.</span>' : '') + (l.note ? '<div class="muted">' + esc(l.note) + '</div>' : '') + '</td><td class="n muted">' + (l.qty != null ? l.qty + ' ' + esc(l.unit) + (l.qty === 1 ? '' : 's') + ' × ' + money(l.rate) : '') + '</td><td class="n">' + money(l.amount) + '</td>' +
          (split ? '<td class="n">' + (l.now ? money(l.now) : '–') + '</td><td class="n later">' + (l.later ? money(l.later) : '–') + '</td><td class="n kind">' + (l.kind ? money(l.kind) : '–') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function sumRow(label, t, split) {
    return '<div class="bsum"><b>' + esc(label) + '</b><span>' + money(t.total) + '</span>' + (split ? '<span class="muted">at the shoot ' + money0(t.now) + ' · later ' + money0(t.later) + ' · in kind ' + money0(t.kind) + '</span>' : '') + '</div>';
  }
  function renderBudget() {
    var Bd = D.budget; if (!Bd) { $('budget').innerHTML = '<div class="empty">No budget versions yet.</div>'; return; }
    var vs = Bd.versions, cur = ui.bv && vs.some(function (v) { return v.id === ui.bv; }) ? ui.bv : 'v3';
    var h = '<div class="panel"><h2>Budget versions</h2>' + (Bd.intro || []).map(function (t) { return '<p>' + rich(t) + '</p>'; }).join('') + '</div>';
    h += '<div class="panel"><h2>The versions side by side</h2><p class="muted">Production by arc at its real cost; "At the shoot" is the cash needed while shooting; post-production is $16,000 in every version. Click a row to open it.</p><div class="tablewrap"><table class="t bcomp"><thead><tr><th>Version</th><th class="n">Shoot days</th>' +
      ARC_ORDER.map(function (a) { return '<th class="n">' + esc(arcName(a)) + '</th>'; }).join('') + '<th class="n">Insurance, contingency</th><th class="n">Production</th><th class="n">At the shoot</th><th class="n">Later</th><th class="n">In kind</th><th class="n">Total cash with post</th></tr></thead><tbody>' +
      vs.map(function (v) {
        var p = v.totals.production;
        return '<tr class="' + (v.id === cur ? 'on' : '') + '" data-bv="' + esc(v.id) + '"><td><b>' + esc(v.name) + '</b><div class="muted">' + esc(v.badge || '') + '</div></td><td class="n">' + v.daysCanada + ' + ' + v.days.ph + '</td>' +
          ARC_ORDER.map(function (a) { return '<td class="n">' + (v.parts[a] ? money0(v.parts[a].t.total) : '–') + '</td>'; }).join('') +
          '<td class="n">' + money0(v.all.t.total) + '</td><td class="n"><b>' + money0(p.total) + '</b></td><td class="n"><b>' + money0(p.now) + '</b></td><td class="n later">' + (p.later ? money0(p.later) : '–') + '</td><td class="n kind">' + (p.kind ? money0(p.kind) : '–') + '</td><td class="n"><b>' + money0(v.totals.cash) + '</b></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted" style="margin-top:8px">Shoot days are Canada + the Philippines (travel-only days not counted).</p></div>';
    h += '<div class="vtabs">' + vs.map(function (v) { return '<button class="b' + (v.id === cur ? ' dark' : '') + '" data-bv="' + esc(v.id) + '">' + esc(v.name.split(' · ')[0]) + ' · ' + esc(v.name.split(' · ')[1] || '') + '</button>'; }).join('') + '</div>';
    var v = vs.filter(function (x) { return x.id === cur; })[0], split = v.totals.production.later > 0 || v.totals.production.kind > 0, p = v.totals.production;
    h += '<div class="panel bver"><div class="an">' + esc(v.badge || '') + '</div><h2>' + esc(v.name) + '</h2><p>' + rich(v.summary) + '</p>';
    h += '<div class="big"><div><div class="n">' + money0(v.totals.grand) + '</div><div class="l">Real cost (production ' + money0(p.total) + ' + post ' + money0(v.totals.post) + ')</div></div>' +
      '<div><div class="n">' + money0(v.totals.cash) + '</div><div class="l">Cash needed (at the shoot ' + money0(p.now) + ' + post)</div></div>' +
      '<div><div class="n">' + money0(p.later) + '</div><div class="l">Paid later (deal memos)</div></div>' +
      '<div><div class="n">' + money0(p.kind) + '</div><div class="l">In kind or free (to secure)</div></div>' +
      '<div><div class="n">' + v.daysCanada + ' + ' + v.days.ph + '</div><div class="l">Shoot days: East ' + v.days.east + ', GTA ' + v.days.gta + ', Alberta ' + v.days.alberta + ', Philippines ' + v.days.ph + '</div></div></div>';
    if (v.phases) {
      h += '<div class="phases">' + v.phases.map(function (ph) {
        var ok = ph.t.now <= ph.budgetCash;
        return '<div class="phase ' + (ok ? 'ok' : 'short') + '"><b>' + esc(ph.title) + '</b><div class="muted">' + esc(ph.when) + '</div><div class="pnum">' + money0(ph.t.now) + ' <span>at the shoot, of ' + money0(ph.budgetCash) + (ok ? ' (fits, ' + money0(ph.budgetCash - ph.t.now) + ' spare)' : ' (short by ' + money0(ph.t.now - ph.budgetCash) + ')') + '</span></div><div class="muted">Real cost ' + money0(ph.t.total) + ' · later ' + money0(ph.t.later) + ' · in kind ' + money0(ph.t.kind) + '</div></div>';
      }).join('') + '</div>';
    }
    if (v.cashNote) h += '<p>' + rich(v.cashNote) + '</p>';
    if ((v.rules || []).length) h += '<h3>How the cash fits</h3><ul class="princ">' + v.rules.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>';
    if (v.schedule) h += '<h3>Day by day</h3><p>The full day-by-day plan is the <button class="lnk" data-gosched="east">Schedule tab</button>.</p>';
    if ((v.dayplan || []).length) h += '<h3>Day by day</h3><table class="t dplan"><tbody>' + v.dayplan.map(function (d) { return '<tr><td class="tm"><span class="dotarc arc-' + esc(d.arc) + '"></span>' + esc(d.label) + '</td><td>' + esc(d.text) + '</td></tr>'; }).join('') + '</tbody></table>';
    if ((v.cuts || []).length) h += '<h3>What is cut or simplified (compared with the full plan)</h3><ul class="princ">' + v.cuts.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>';
    h += '<h3>Breakdown by arc</h3>';
    ARC_ORDER.forEach(function (a) {
      var pt = v.parts[a]; if (!pt) return;
      h += '<details class="barc arc-' + esc(a) + '" open><summary><span class="dotarc arc-' + esc(a) + '"></span><b>' + esc(arcName(a)) + '</b> <span class="muted">' + v.days[a] + ' shoot day' + (v.days[a] === 1 ? '' : 's') + '</span><span class="bt">' + money(pt.t.total) + (split ? ' <span class="muted">· at the shoot ' + money0(pt.t.now) + '</span>' : '') + '</span></summary>' + budgetTable(pt.lines, split) + sumRow('Arc total', pt.t, split) + '</details>';
    });
    if (v.all.lines.length) h += '<details class="barc" open><summary><b>Whole production</b><span class="bt">' + money(v.all.t.total) + '</span></summary>' + budgetTable(v.all.lines, split) + '</details>';
    h += sumRow('Production', p, split);
    h += '<details class="barc"><summary><b>Post-production</b> <span class="muted">(the same in every version)</span><span class="bt">' + money(v.post.t.total) + '</span></summary>' + budgetTable(v.post.lines, false) + '</details>';
    h += '<div class="bsum grand"><b>Total</b><span>' + money(v.totals.grand) + '</span><span class="muted">cash needed ' + money0(v.totals.cash) + '</span></div>';
    if ((v.notes || []).length) h += '<ul class="lnotes">' + v.notes.map(function (t) { return '<li>' + rich(t) + '</li>'; }).join('') + '</ul>';
    h += '</div>';
    h += '<div class="panel"><h2>Rates used</h2><p class="muted">From Budget Breakdown v6. All cast non-ACTRA.</p><table class="t"><tbody>' + (Bd.rates || []).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $('budget').innerHTML = h;
  }

  // ---------- Rules ----------
  function renderRules() {
    var h = '';
    (D.rules || []).forEach(function (r) {
      h += '<div class="panel"><h2>' + esc(r.region) + '</h2>' + (r.intro ? '<p>' + rich(r.intro) + '</p>' : '') +
        (r.items || []).map(function (it) { return '<div class="rule"><b>' + esc(it.topic) + '.</b> ' + rich(it.text) + (it.links && it.links.length ? '<div class="links">' + links(it.links) + '</div>' : '') + '</div>'; }).join('') + '</div>';
    });
    $('rules').innerHTML = h || '<div class="empty">No rules yet.</div>';
  }

  // ---------- tabs and events ----------
  var TABS = ['plan', 'locs', 'sched', 'budget', 'scenes', 'rules'];
  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = 'plan';
    TABS.forEach(function (k) { $('tab-' + k).hidden = k !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    ui.tab = name; store(K_UI, ui);
    if (history.replaceState) history.replaceState(null, '', name === 'plan' ? location.pathname : '#' + name);
    window.scrollTo(0, 0);
  }
  function scrollToEl(id) {
    var el = $(id); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600);
  }
  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest('.tab'))) { showTab(x.getAttribute('data-tab')); return; }
      if ((x = t.closest('[data-golocs]'))) { $('lArc').value = x.getAttribute('data-golocs'); $('lq').value = ''; $('lMine').value = ''; renderLocs(); showTab('locs'); return; }
      if ((x = t.closest('[data-gosched]'))) { showTab('sched'); setTimeout(function () { scrollToEl('blk-' + x.getAttribute('data-gosched')); }, 30); return; }
      if ((x = t.closest('[data-day]'))) { showTab('sched'); setTimeout(function () { scrollToEl('day-' + x.getAttribute('data-day')); }, 30); return; }
      if ((x = t.closest('[data-loc]'))) { $('lArc').value = ''; $('lq').value = ''; $('lMine').value = ''; renderLocs(); showTab('locs'); setTimeout(function () { scrollToEl('loc-' + x.getAttribute('data-loc')); }, 30); return; }
      if (t.id === 'lclear') { $('lq').value = ''; $('lArc').value = ''; $('lMine').value = ''; renderLocs(); return; }
      if (t.id === 'openAll') { ui.openAll = !ui.openAll; store(K_UI, ui); t.textContent = ui.openAll ? 'Close every option' : 'Open every option'; renderLocs(); return; }
      if ((x = t.closest('[data-bv]'))) { ui.bv = x.getAttribute('data-bv'); store(K_UI, ui); renderBudget(); var bv = document.querySelector('.bver'); if (bv && t.closest('.bcomp')) bv.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (t.id === 'lockBtn') { lock(); return; }
      if (t.id === 'printBtn') { window.print(); return; }
    });
    $('lq').addEventListener('input', renderLocs);
    ['lArc', 'lMine'].forEach(function (id) { $(id).addEventListener('change', renderLocs); });
    $('sq').addEventListener('input', renderScenes);
    ['sArc', 'sCast', 'sTime'].forEach(function (id) { $(id).addEventListener('change', renderScenes); });
    $('locs').addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-mark'); if (!k) return;
      var m = marks[k] || {}; m.s = e.target.value || undefined; marks[k] = m; store(K_MARKS, marks); toast('Saved in this browser'); renderLocs();
    });
    $('locs').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-mnote'); if (!k) return;
      var m = marks[k] || {}; m.note = e.target.value; marks[k] = m;
      clearTimeout(wire.t); wire.t = setTimeout(function () { store(K_MARKS, marks); }, 300);
    });
  }
  function fillSelects() {
    var arcs = (D.arcs || []).map(function (a) { return '<option value="' + esc(a.id) + '">Arc ' + esc(a.n) + ' · ' + esc(a.name) + '</option>'; }).join('');
    $('lArc').innerHTML = '<option value="">Every arc</option>' + arcs;
    $('sArc').innerHTML = '<option value="">Every arc</option>' + arcs;
    $('sCast').innerHTML = '<option value="">Anyone</option>' + (D.cast || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
    $('lq').value = ui.lq || ''; $('lArc').value = ui.lArc || ''; $('lMine').value = ui.lMine || '';
    $('openAll').textContent = ui.openAll ? 'Close every option' : 'Open every option';
  }
  function start() {
    if (!D || !D.scenes) { $('banner').innerHTML = '<div class="bad">The locations file opened but is empty.</div>'; return; }
    index(); wire(); fillSelects();
    renderPlan(); renderLocs(); renderSched(); renderBudget(); renderScenes(); renderRules();
    showTab((location.hash || '').slice(1) || ui.tab || 'plan');
  }
  gate(start);
})();
