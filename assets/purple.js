/* PURPLE funding desk: the engine behind purple-funding.html and purple-competitions.html.
 *
 * The researched lists live in data/*.json (updated by the research runs, see
 * RESEARCH-GUIDE.md). What you track, your application drafts and your edits to
 * the application kit are kept in this browser only (localStorage). Use the
 * Backup tab to save them to a file now and then.
 */
(function () {
  'use strict';

  // ---------- password ----------
  // The film's details are published only encrypted, in SEALED (made from data/project.json by
  // tools/seal.cjs). The password is not stored anywhere: the page checks it by decrypting that
  // file, then this browser keeps the key for UNLOCK_DAYS. Set SEALED to '' to turn the password
  // off; the page then reads data/project.json as it is (which must then be published).
  var SEALED = 'data/project.enc.json';
  var UNLOCK_DAYS = 30;

  // ---------- the two pages ----------
  var PAGE = document.body.getAttribute('data-page') === 'competitions' ? 'competitions' : 'funding';
  var FUND = PAGE === 'funding';
  var CONF = FUND ? {
    data: 'data/funding.json', runs: 'data/funding-runs.json', one: 'opportunity', many: 'opportunities',
    status: [['new', 'Not started'], ['interested', 'Interested'], ['preparing', 'Preparing'], ['submitted', 'Submitted'], ['awarded', 'Awarded'], ['declined', 'Declined'], ['not-eligible', 'Not eligible'], ['skip', 'Skipped']],
    types: ['Grant', 'Tax credit', 'Equity', 'Loan', 'In-kind', 'Sponsor', 'Crowdfunding', 'Wage subsidy', 'Program']
  } : {
    data: 'data/competitions.json', runs: 'data/competitions-runs.json', one: 'competition', many: 'competitions',
    status: [['new', 'Not started'], ['interested', 'Interested'], ['preparing', 'Preparing'], ['submitted', 'Submitted'], ['awarded', 'Selected or won'], ['declined', 'Not selected'], ['not-eligible', 'Not eligible'], ['skip', 'Skipped']],
    types: ['Pitch competition', 'Screenplay competition', 'Lab', 'Market', 'Festival', 'Fellowship', 'Award']
  };
  var STATUS_LABEL = {}; CONF.status.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });
  var ACTIVE = { interested: 1, preparing: 1, submitted: 1, awarded: 1 };
  var DONE = { submitted: 1, awarded: 1, declined: 1, 'not-eligible': 1, skip: 1 };
  var PHASES = ['development', 'pre-production', 'production', 'post-production', 'distribution'];
  var PHASE_LABEL = FUND
    ? { development: 'Development', 'pre-production': 'Pre-production', production: 'Production', 'post-production': 'Post-production', distribution: 'Release' }
    : { development: 'Script stage', 'pre-production': 'Pre-production', production: 'In production', 'post-production': 'Rough cut or post', distribution: 'Finished film' };
  var PHASE_WORDS = { development: 'development', 'pre-production': 'pre-production', production: 'production', 'post-production': 'post-production', distribution: 'release' };
  var REGIONS = ['Canada', 'Ontario', 'Toronto', 'Ottawa', 'Quebec', 'Alberta', 'Philippines', 'USA', 'International'];
  var BYLABEL = { daily: 'Daily scan', weekly: 'Weekly research', research: 'Research session', manual: 'Added by you' };

  // ---------- small helpers ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isUrl(u) { return /^https?:\/\//i.test(String(u || '')); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function toast(t) { var el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 1800); }
  function copy(text, what) {
    function done() { toast((what || 'Text') + ' copied'); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy; select the text and copy it'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function money(n, cur) {
    if (n == null || isNaN(n)) return '';
    var s = Math.round(n).toLocaleString('en-CA');
    return (cur && cur !== 'CAD' ? (cur === 'USD' ? 'US$' : cur + ' ') : '$') + s;
  }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : null; }

  // Dates are your dates (Toronto), so nothing expires a few hours early.
  var TZ = 'America/Toronto';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function torontoDate(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  var today = torontoDate(Date.now());
  function daysTo(d) { return Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5); }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function human(d) { if (!d) return ''; var p = d.split('-').map(Number); return p[2] + ' ' + MON[p[1] - 1] + ' ' + p[0]; }
  function monthYear(d) { var p = String(d).split('-').map(Number); return MONTHS_LONG[p[1] - 1] + ' ' + p[0]; }
  function dayName(d) { var x = new Date(d + 'T12:00:00Z'); return WD[x.getUTCDay()] + ' ' + x.getUTCDate() + ' ' + MON[x.getUTCMonth()]; }
  function wall(ms) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day, h: (+p.hour) % 24, mi: +p.minute, wd: WD.indexOf(p.weekday) };
  }
  function zoned(y, m, d, h, mi) { var guess = Date.UTC(y, m - 1, d, h, mi), w = wall(guess); return guess - (Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - guess); }
  function when(ms) { var w = wall(ms); return WD[w.wd] + ' ' + w.d + ' ' + MON[w.m - 1] + ', ' + ((w.h % 12) || 12) + ':' + String(w.mi).padStart(2, '0') + (w.h < 12 ? 'am' : 'pm'); }

  // ---------- what this browser keeps ----------
  var K_TRACK = 'purple-track', K_KIT = 'purple-kit', K_DRAFTS = 'purple-drafts', K_MANUAL = 'purple-manual', K_UI = 'purple-ui-' + PAGE, K_UNLOCK = 'purple-unlocked';
  var track = load(K_TRACK, {});        // "funding:<id>" -> { status, ask, got, submitted, notes, hidden, log, name, funder, list }
  var mine = load(K_KIT, {});           // { kit: {key: text}, applicant: {...}, secured: number }
  mine.kit = mine.kit || {}; mine.applicant = mine.applicant || {};
  var drafts = load(K_DRAFTS, {});      // "funding:<id>" -> { "<set>:<n>": text }
  var manual = load(K_MANUAL, {});      // { funding: [...], competitions: [...] }
  manual.funding = manual.funding || []; manual.competitions = manual.competitions || [];
  var ui = load(K_UI, { sort: 'deadline', tab: 'list' });

  var items = [], runsDb = { schedule: [], runs: [] }, project = null, listUpdated = '', loadError = '';

  // ---------- password gate ----------
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
    function go(p) { project = p; root.classList.remove('locked'); start(); }
    if (!SEALED) { fetchJson('data/project.json').then(go, function () { go(null); }); return; }
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
        ? 'This page was opened as a file. Double-click <code>preview.bat</code> in this folder, then open <code>http://localhost:8000/' + (FUND ? 'purple-funding' : 'purple-competitions') + '.html</code>.'
        : 'The page could not load (' + esc(e.message) + '). Refresh to try again.';
    });
  }
  function lock() { try { localStorage.removeItem(K_UNLOCK); } catch (e) {} location.reload(); }

  // ---------- the application kit ----------
  var DEFAULT_OFFER = 'a thank-you credit in the end titles, your logo on our poster and press kit, thanks on our social media during the shoot and the release, and invitations to the premiere screening';
  var EXTRA = {
    inkind_letter: 'Dear {funder} team,\n\nMy name is {name}, and I am the writer and director of PURPLE, a {runtime} {form} we shoot from May to September 2027 in Ontario, Quebec, Alberta and the Philippines.\n\n{logline}\n\nWe are making the film on a budget of {total}, with a small, committed crew, and we would be very grateful for {funder}\'s support with {ask}.\n\nIn return, we would be glad to offer {offer}.\n\nI would be happy to send the script, the budget or the lookbook, or to come by and talk.\n\nThank you,\n{name}\n{contact_line}',
    sponsor_onepager: 'PURPLE: sponsorship summary\n\nThe film: {logline}\nFormat: {runtime} {form}, in {languages}. Written and directed by {name}, Toronto.\nShooting: Ontario and Quebec (May to June 2027), Alberta (July 2027), the Philippines (September 2027). Premiere: 2028.\nAudience: {audience}\n\nWhat we are asking {funder} for: {ask}\nWhat {funder} receives: {offer}\n\nBudget: {total}, with {secured} committed.\nContact: {name}, {contact_line}',
    sponsor_followup: 'Subject: Re: PURPLE, a Filipino-Canadian feature film: sponsorship\n\nHello {funder} team,\n\nI wanted to follow up on my note about PURPLE. [One line of news: casting, a grant, a location, the Kickstarter launch.]\n\nWe would still love {funder}\'s support with {ask}, and I would be happy to send our one-page summary or talk for ten minutes.\n\nThank you,\n{name}\n{contact_line}',
    festival_note: 'Dear {funder} programmers,\n\nI am pleased to submit PURPLE, my first feature as writer and director: a {runtime} {form} in {languages}.\n\n{logline}\n\n[One or two sentences on why PURPLE belongs at {funder}.]\n\nThank you for watching.\n\n{name}\n{contact_line}',
    crowd_title: 'PURPLE: a father, his son, and one last road trip\n\n[Subtitle, up to 135 characters:] Help us shoot a Filipino-Canadian feature film across Canada and the Philippines, about family, memory and the skies we leave behind.',
    crowd_story: '{synopsis_short}\n\nWhy we are making it\n{why_now}\n\n{statement}',
    crowd_budget: 'Our total budget is {total}. We have {secured} committed, and this campaign\'s goal is [goal]. Every dollar goes to the shoot: the cast, a camera, lighting and sound crew, the equipment, and getting everyone from Toronto to Ottawa, Montreal and the Rockies. If we pass our goal, the extra pays for post-production: editing, colour, sound and music.',
    crowd_rewards: '$10: Thank you. Your name on our website and a digital postcard of a purple sky.\n$25: A digital download of the finished film, plus the above.\n$50: Your name in the end credits, plus the above.\n$100: A signed poster and an online screening with a Q&A, plus the above.\n$250: Two tickets to the Toronto premiere screening, plus the above.\n$500: A "special thanks" credit in the main credits, plus the above.\n[Check what each reward costs to make and ship before you launch.]',
    crowd_risks: 'We are a small team making our first feature. The biggest risks are weather on our outdoor days, travel across three provinces, and the day in the Philippines. We have planned extra days for missed shots in Ottawa, Montreal and Alberta, [booked equipment and lodging early], and [say what experience your producers bring]. If anything changes, backers will hear it from us first, on the campaign page.',
    tech: 'Title: PURPLE\nRuntime: [final runtime] minutes\nCountry: Canada\nYear: 2028\nLanguages: English, Tagalog, French\nSubtitles: English [and French]\nShooting format: [camera and codec]\nExhibition format: DCP 2K\nAspect ratio: [ratio]\nSound: Dolby Atmos 7.1.4 [and the 5.1 or stereo versions you deliver]\nPremiere status: [available for world premiere, or where it has screened]',
    premiere_status: 'PURPLE [has not screened publicly / screened at ... on ...]. It is available for its [world / North American / Canadian] premiere. [Check this festival\'s premiere rules: a public screening in January 2028 can count as a premiere.]',
    tax_note: 'Tax credits are claimed after the film is made, by a Canadian-controlled production company, with an accountant who knows film. Before the shoot: [decide whether to incorporate a company for PURPLE], keep every receipt and contract, pay crew through the company, and note which province each person lives in. Guidelines: {guidelines}'
  };
  var KIT_DEFS = [
    ['logline', 'Logline', 'The film', 'One or two sentences: who, what they want, what is at stake.', '25 to 50 words'],
    ['synopsis_short', 'Short synopsis', 'The film', 'The story in one paragraph.', 'about 100 words'],
    ['synopsis_long', 'Long synopsis', 'The film', 'Beginning, middle and end, including the ending. Funders want the ending.', '300 to 500 words'],
    ['statement', 'Artistic or director\'s statement', 'The film', 'Why you, why this story, and how you will tell it. In your own voice.', '250 to 500 words'],
    ['why_now', 'Why this story, why now', 'The film', '', '100 to 200 words'],
    ['audience', 'Audience and impact', 'The film', '', '100 to 200 words'],
    ['representation', 'Community and representation', 'The film', 'Diversity funds ask for this. Describe yourself only in the terms you choose.', '100 to 200 words'],
    ['bio', 'Your bio', 'People', 'In the third person.', '100 to 150 words'],
    ['previous_work', 'Previous work', 'People', 'One line a film: title, year, length, your role, where it screened.', ''],
    ['team', 'Team', 'People', '', ''],
    ['budget', 'Budget summary', 'Money and plan', '{total}, {secured}, {gap} and {minimum} follow the Budget tab.', ''],
    ['funding_plan', 'Funding plan', 'Money and plan', '{applications} lists what you are preparing, have submitted or won on the Funding page.', ''],
    ['use_of_funds', 'How you will use the money', 'Money and plan', '{use} is filled in from the phases each funder pays for; {amount} from the amount you ask for.', '1 to 3 sentences'],
    ['schedule', 'Schedule', 'Money and plan', '', ''],
    ['distribution', 'Release and festival plan', 'Money and plan', '', ''],
    ['cover_letter', 'Cover letter (grants, programs, labs)', 'Letters', '', 'under 1 page'],
    ['sponsor_pitch', 'First email to a sponsor', 'Letters', '{ask} and {offer} come from each sponsor\'s card.', 'under 200 words'],
    ['sponsor_followup', 'Follow-up to a sponsor', 'Letters', '', ''],
    ['sponsor_onepager', 'One-page sponsorship summary', 'Letters', '', '1 page'],
    ['inkind_letter', 'In-kind request letter', 'Letters', '', ''],
    ['festival_note', 'Note to festival programmers', 'Letters', '', ''],
    ['crowd_title', 'Campaign title and subtitle', 'Crowdfunding', '', ''],
    ['crowd_story', 'Campaign story', 'Crowdfunding', '', ''],
    ['crowd_budget', 'Where the money goes', 'Crowdfunding', '', ''],
    ['crowd_rewards', 'Rewards', 'Crowdfunding', '', ''],
    ['crowd_risks', 'Risks and challenges', 'Crowdfunding', '', ''],
    ['tech', 'Technical details', 'Festivals', '', ''],
    ['premiere_status', 'Premiere status', 'Festivals', '', ''],
    ['tax_note', 'Tax credit checklist', 'Other', '', '']
  ];
  var KIT_LABEL = {}; KIT_DEFS.forEach(function (d) { KIT_LABEL[d[0]] = d[1]; });
  var APPLICANT_FIELDS = [['name', 'Your name'], ['role', 'Your role'], ['city', 'City'], ['email', 'Email (for signatures)'], ['phone', 'Phone (optional)'], ['link', 'Website, reel or lookbook link'], ['company', 'Production company (if any)']];

  function kitDefault(k) { if (project && project.kit && project.kit[k] != null) return project.kit[k]; return EXTRA[k] != null ? EXTRA[k] : null; }
  function kitText(k) { return mine.kit[k] != null ? mine.kit[k] : kitDefault(k); }
  function applicant() {
    var base = (project && project.applicant) || {}, out = {};
    APPLICANT_FIELDS.forEach(function (f) { out[f[0]] = mine.applicant[f[0]] != null ? mine.applicant[f[0]] : (base[f[0]] || ''); });
    return out;
  }

  // ---------- budget ----------
  function budgetNums() {
    var B = (project && project.budget) || { total: 0, secured: 0, minimum_to_shoot: 0, groups: [] };
    var secured = mine.secured != null && !isNaN(mine.secured) ? Number(mine.secured) : B.secured;
    var awarded = 0, pending = 0, preparing = 0;
    Object.keys(track).forEach(function (k) {
      var t = track[k]; if (!t || t.list !== 'funding') return;
      if (t.status === 'awarded') awarded += Number(t.got || t.ask || 0);
      else if (t.status === 'submitted') pending += Number(t.ask || t.max || 0);
      else if (t.status === 'preparing') preparing += Number(t.ask || t.max || 0);
    });
    var prod = 0, post = 0;
    (B.groups || []).forEach(function (g) { if (g.phase === 'post-production') post += g.amount; else prod += g.amount; });
    var have = secured + awarded;
    return { total: B.total, secured: secured, awarded: awarded, pending: pending, preparing: preparing, gap: Math.max(0, B.total - have), minimum: B.minimum_to_shoot, shortMin: Math.max(0, B.minimum_to_shoot - have), prod: prod, post: post };
  }

  // ---------- filling a template for one entry ----------
  function phasesOf(i) { var p = ((i && i.phases) || []).filter(function (x) { return PHASES.indexOf(x) >= 0; }); return p.length ? p : ['production']; }
  function joinWords(list) { return list.length < 2 ? (list[0] || '') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function applicationsText(cur) {
    var rows = [];
    Object.keys(track).forEach(function (k) {
      var t = track[k];
      if (!t || t.list !== 'funding' || !ACTIVE[t.status] || t.status === 'interested' || (cur && k === keyOf(cur))) return;
      var label = (t.funder ? t.funder + ', ' : '') + (t.name || k.split(':')[1]);
      var bits = [];
      if (t.status === 'awarded') bits.push('awarded' + (t.got || t.ask ? ' ' + money(t.got || t.ask) : ''));
      else { if (t.ask) bits.push(money(t.ask)); bits.push(t.status === 'submitted' ? 'submitted' + (t.submitted ? ' ' + human(t.submitted) : '') : 'in preparation'); }
      rows.push(label + ' (' + bits.join(', ') + ')');
    });
    return rows.length ? rows.join('; ') + '.' : '[List the other funders you are applying to, with amounts and dates. Mark them "Preparing" or "Submitted" on the Funding page and they appear here.]';
  }
  function ctxFor(i) {
    var b = budgetNums(), A = applicant(), film = (project && project.film) || {}, uses = (project && project.uses) || {};
    var t = i ? stateOf(i) : {}, ph = phasesOf(i);
    // What to ask for: what you typed on the card; otherwise the funder's maximum, but never more than the gap still to raise.
    var cad = i && i.amount_max && (!i.currency || i.currency === 'CAD');
    var amount = t.ask ? money(t.ask)
      : cad ? money(Math.min(i.amount_max, Math.floor(b.gap / 100) * 100) || i.amount_max)
      : (i && i.amount_max ? money(i.amount_max, i.currency) : '[amount]');
    return {
      title: film.title || 'PURPLE', form: film.form || 'narrative fiction feature', runtime: film.runtime || 'feature-length',
      genre: film.genre || '', languages: film.languages || '', city: A.city,
      funder: i ? i.funder : '[funder]', program: i ? i.name : '[program]', amount: amount,
      phase_words: joinWords(ph.map(function (p) { return PHASE_WORDS[p]; })),
      use: joinWords(ph.map(function (p) { return uses[p]; }).filter(Boolean)) || '[what this money pays for]',
      priorities: (i && (i.priorities || i.why_fit)) || '[what they look for]',
      ask: (i && i.ask) || (i && i.type === 'In-kind' ? '[the equipment or services you need, with dates]' : '[what you are asking for: cash, product, services or a location]'),
      offer: (i && i.offer) || DEFAULT_OFFER,
      deadline: (i && i.deadline) || '', guidelines: (i && (i.guidelines_url || i.url)) || '',
      total: money(b.total), secured: money(b.secured), gap: money(b.gap), minimum: money(b.minimum),
      production_total: money(b.prod), post_total: money(b.post),
      applications: applicationsText(i),
      name: A.name || '[your name]', company: A.company || '[company]',
      contact_line: [A.email, A.phone, A.link].filter(Boolean).join(' · ') || '[your email and phone]'
    };
  }
  function fill(tpl, ctx, depth) {
    depth = depth || 0;
    return String(tpl == null ? '' : tpl).replace(/\{([a-z_]+)\}/g, function (m, k) {
      if (Object.prototype.hasOwnProperty.call(ctx, k)) return ctx[k];
      var t = depth < 2 ? kitText(k) : null;
      return t != null ? fill(t, ctx, depth + 1) : m;
    });
  }
  function counts(text, limit) {
    var words = (text.trim().match(/\S+/g) || []).length, chars = text.length, todo = (text.match(/\[[^\]\n]{2,}\]/g) || []).length;
    var out = '<span>' + words + ' words · ' + chars.toLocaleString('en-CA') + ' characters</span>';
    var m = /([\d,]+)\s*(words?|characters?|chars?)/i.exec(limit || '');
    if (m) {
      var n = +m[1].replace(/,/g, ''), isWords = /^w/i.test(m[2]), have = isWords ? words : chars;
      out += have > n ? '<span class="over">' + (have - n).toLocaleString('en-CA') + ' over the limit of ' + esc(m[1]) + ' ' + (isWords ? 'words' : 'characters') + '</span>' : '<span>limit ' + esc(limit) + '</span>';
    } else if (limit) out += '<span>aim for ' + esc(limit) + '</span>';
    if (todo) out += '<span class="todo">' + todo + ' to fill in [ ]</span>';
    return out;
  }

  // ---------- entries and their state ----------
  function keyOf(i) { return PAGE + ':' + i.id; }
  function stateOf(i) { return track[keyOf(i)] || { status: 'new', notes: '', hidden: false, log: [] }; }
  function saveState(i, patch, logLine) {
    var k = keyOf(i), s = Object.assign({ status: 'new', notes: '', hidden: false, log: [] }, track[k] || {}, patch);
    s.name = i.name; s.funder = i.funder; s.list = PAGE; s.deadline_date = i.deadline_date || null;
    s.max = i.amount_max && (!i.currency || i.currency === 'CAD') ? i.amount_max : null;
    if (logLine) s.log = (s.log || []).concat([{ d: today, t: logLine }]).slice(-30);
    track[k] = s;
    if (!store(K_TRACK, track)) toast('Could not save: this browser is blocking storage');
    return s;
  }
  function all() {
    var out = items.map(function (r) { return Object.assign({ src: 'research' }, r); });
    (manual[PAGE] || []).forEach(function (m) { out.push(Object.assign({ src: 'manual', added_by: 'manual' }, m)); });
    return out;
  }
  function findById(id) { var l = all(); for (var n = 0; n < l.length; n++) if (l[n].id === id) return l[n]; return null; }

  // ---------- deadlines: open, closing soon, rolling, not announced, or expired ----------
  function nextText(i) {
    var parts = [];
    if (i.reopens) parts.push(i.reopens);
    if (i.deadline_estimate && !(i.reopens && i.reopens.indexOf(MONTHS_LONG[+i.deadline_estimate.slice(5) - 1]) >= 0)) parts.push('Expected around ' + monthYear(i.deadline_estimate + '-01') + '.');
    return parts.join(' ');
  }
  // An entry that is not open now but has a next window expected from this month on counts as
  // "date not announced" (upcoming), with the last window noted; otherwise it is expired or not open.
  function upcoming(i) { return !!(i.deadline_estimate && i.deadline_estimate >= today.slice(0, 7)); }
  function avail(i) {
    if (i.closed_reason) {
      if (upcoming(i)) return { k: 'est', last: i.closed_reason };
      return { k: 'closed', reason: i.closed_reason, next: nextText(i) };
    }
    if (i.deadline_date) {
      var n = daysTo(i.deadline_date);
      if (n < 0 && !i.rolling) {
        var passed = 'The deadline passed on ' + human(i.deadline_date) + '.';
        if (upcoming(i)) return { k: 'est', last: passed };
        return { k: 'closed', reason: passed, next: nextText(i) };
      }
      if (n >= 0) return { k: n <= 30 ? 'soon' : 'open', days: n };
    }
    if (i.rolling) return { k: 'rolling' };
    if (i.deadline_estimate) return { k: 'est' };
    return { k: 'unknown' };
  }
  function deadlineTag(i, a) {
    a = a || avail(i);
    if (a.k === 'closed') return '<span class="tag shut">' + (/deadline passed/i.test(a.reason) ? 'Expired' : 'Not open now') + '</span>';
    if (a.k === 'soon') return '<span class="tag ' + (a.days <= 7 ? 'hot' : 'soon') + '">' + (a.days === 0 ? 'Closes today' : 'Closes in ' + a.days + ' day' + (a.days === 1 ? '' : 's')) + '</span>';
    if (a.k === 'open') return '<span class="tag open">Closes ' + esc(human(i.deadline_date)) + '</span>';
    if (a.k === 'rolling') return '<span class="tag open">Rolling: apply any time</span>';
    if (a.k === 'est') return '<span class="tag est">Expected ' + esc(monthYear(i.deadline_estimate + '-01')) + ' (date not announced)</span>';
    return '<span class="tag est">Deadline: see their page</span>';
  }
  var WINDOWS = [
    ['2027-04-15', 'before the shoot starts in May 2027', 'ok'],
    ['2027-07-01', 'during the Ontario and Quebec shoot, before Alberta', ''],
    ['2027-09-01', 'before the Philippines day and post-production', ''],
    ['2028-02-01', 'during post-production', ''],
    ['9999-12-31', 'after post-production ends in February 2028', 'late']
  ];
  function timing(i, a) {
    if (!FUND || !i.decision_weeks || a.k === 'closed') return '';
    var base = i.deadline_date || (i.deadline_estimate ? i.deadline_estimate + '-15' : '');
    if (!base) return '';
    var dec = addDays(base, i.decision_weeks * 7), w = WINDOWS.filter(function (x) { return dec <= x[0]; })[0];
    var early = (i.phases || []).length && i.phases.every(function (p) { return p === 'development' || p === 'pre-production' || p === 'production'; });
    var cls = w[2] === 'ok' ? 'ok' : (early && dec > '2027-09-01' ? 'late' : w[2]);
    return '<span class="' + cls + '">Answer around ' + esc(monthYear(dec)) + '</span>, ' + esc(w[1]) + (cls === 'late' && early ? '. Too late for the shoot.' : '.');
  }

  // ---------- research runs: the status line and the Updates tab ----------
  function occurrences(s, nowMs) {
    var t = String(s.time).split(':'), w = wall(nowMs), prev = null, next = null;
    for (var k = -8; k <= 8; k++) {
      var b = new Date(Date.UTC(w.y, w.m - 1, w.d + k, 12));
      if ((s.days || []).indexOf(b.getUTCDay()) < 0) continue;
      if (s.since && b.toISOString().slice(0, 10) < s.since) continue;
      var at = zoned(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(), +t[0], +t[1]);
      if (at <= nowMs) prev = at; else if (next === null) next = at;
    }
    return { prev: prev, next: next };
  }
  function runSummary(r) {
    var parts = [];
    if ((r.added || []).length) parts.push(r.added.length + ' new');
    if ((r.updated || []).length) parts.push(r.updated.length + ' updated');
    if ((r.closed || []).length) parts.push(r.closed.length + ' expired');
    if ((r.reopened || []).length) parts.push(r.reopened.length + ' open again');
    return parts.join(', ') || 'nothing new';
  }
  function renderPulse() {
    var runs = runsDb.runs || [], nowMs = Date.now(), last = runs[runs.length - 1];
    var active = (runsDb.schedule || []).filter(function (s) { return s.active !== false; });
    var sched = active.map(function (s) { var o = occurrences(s, nowMs); return { s: s, prev: o.prev, next: o.next }; });
    var due = null; sched.forEach(function (x) { if (x.prev && (!due || x.prev > due.prev)) due = x; });
    var lastSched = null; for (var k = runs.length - 1; k >= 0; k--) if (runs[k].by !== 'research') { lastSched = runs[k]; break; }
    var state = 'ok', head;
    if (!active.length) { state = 'off'; head = 'Automatic research is not switched on yet.'; }
    else if (!due) { state = 'wait'; head = 'Scheduled runs start soon.'; }
    else if (lastSched && Date.parse(lastSched.at) >= due.prev - 60e3) head = 'On schedule.';
    else if (nowMs - due.prev < 3 * 3600e3) { state = 'wait'; head = 'The ' + due.s.label.toLowerCase() + ' of ' + when(due.prev) + ' is running; this page updates a few minutes after it reports.'; }
    else { state = 'late'; head = 'The ' + due.s.label.toLowerCase() + ' due ' + when(due.prev) + ' has not reported. Open claude.ai/code/routines: it may be paused, out of usage, or failing.'; }
    var lastLine = last ? 'Last run: <b>' + esc(BYLABEL[last.by] || last.by) + '</b>, ' + esc(when(Date.parse(last.at))) + ': ' + esc(runSummary(last)) + '.' : 'No runs recorded yet.';
    var nexts = sched.filter(function (x) { return x.next; }).sort(function (a, b) { return a.next - b.next; }).map(function (x) { return esc(x.s.label) + ' ' + esc(when(x.next)); }).join(' · ');
    var s2 = !active.length ? 'It starts once this folder is on GitHub and the daily and weekly routines in ROUTINES.md are created. Until then, ask Claude for a research session.'
      : (nexts ? 'Next: ' + nexts + ' (Toronto time).' : '');
    $('pulse').innerHTML = '<div class="pulse ' + state + '"><span class="dot"></span><div class="pl"><div><b>' + esc(head) + '</b> ' + lastLine + '</div>' +
      '<div class="s2">' + s2 + (listUpdated ? ' List last changed ' + esc(human(listUpdated)) + '.' : '') + '</div></div>' +
      '<button class="b small" data-go="updates">All updates</button></div>';
  }
  function nameButtons(ids) {
    var out = [], max = 14;
    ids.forEach(function (id, k) {
      var i = findById(id);
      var b = i ? '<button class="nmb" data-find="' + esc(id) + '">' + esc(i.funder + ': ' + i.name) + '</button>' : '<span class="nmb gone2" title="No longer on the list">' + esc(id) + '</span>';
      out.push(k < max ? b : b.replace('class="nmb', 'hidden class="nmb'));
    });
    if (ids.length > max) out.push('<button class="b small" data-more="1">and ' + (ids.length - max) + ' more</button>');
    return out.join('');
  }
  function renderRuns() {
    var runs = (runsDb.runs || []).slice().reverse();
    if (!runs.length) { $('runs').innerHTML = '<p class="muted">No runs recorded yet.</p>'; return; }
    $('runs').innerHTML = runs.map(function (r) {
      var g = '';
      [['added', 'New'], ['updated', 'Updated'], ['closed', 'Expired'], ['reopened', 'Open again']].forEach(function (x) {
        var ids = r[x[0]] || []; if (ids.length) g += '<div class="grp"><b>' + x[1] + ' (' + ids.length + '):</b>' + nameButtons(ids) + '</div>';
      });
      return '<div class="run"><div class="rh"><span class="tag by-' + esc(r.by) + '">' + esc(BYLABEL[r.by] || r.by) + '</span><b>' + esc(when(Date.parse(r.at))) + '</b><span class="muted">' + esc(runSummary(r)) + '</span></div>' +
        (r.note ? '<div class="rn">' + esc(r.note) + '</div>' : '') + g + '</div>';
    }).join('');
  }

  // ---------- banner: what needs you this week ----------
  function renderBanner() {
    var out = [];
    if (loadError) out.push('<div class="bad">' + loadError + '</div>');
    var urgent = all().filter(function (i) {
      var s = stateOf(i), a = avail(i);
      return a.k === 'soon' && a.days <= 7 && !DONE[s.status] && !s.hidden;
    }).sort(function (a, b) { return a.deadline_date.localeCompare(b.deadline_date); });
    if (urgent.length) out.push('<div class="alert"><b>Closing this week:</b> ' + urgent.map(function (i) {
      var d = avail(i).days;
      return '<button class="lnk" data-find="' + esc(i.id) + '">' + esc(i.funder + ': ' + i.name) + '</button> (' + (d === 0 ? 'today' : d === 1 ? 'tomorrow' : d + ' days') + ')';
    }).join(' · ') + '</div>');
    var prep = all().filter(function (i) { var s = stateOf(i), a = avail(i); return s.status === 'preparing' && a.k === 'soon' && a.days > 7 && a.days <= 21; });
    if (prep.length) out.push('<div>You are preparing ' + prep.map(function (i) { return '<button class="lnk" data-find="' + esc(i.id) + '">' + esc(i.name) + '</button> (closes ' + esc(dayName(i.deadline_date)) + ')'; }).join(', ') + '. Draft it this week.</div>');
    $('banner').innerHTML = out.join('');
  }

  // ---------- the list ----------
  var STAT = [
    ['all', 'All'], ['A', 'Priority A'], ['open', 'Open now'], ['soon', 'Closing in 30 days'], ['est', 'Date not announced'],
    ['closed', 'Expired or not open'], ['tracking', 'You are tracking'], ['submitted', 'Submitted'], ['new', 'New this week']
  ];
  function isNew(i) { return i.added && daysTo(i.added) >= -7; }
  function statMatch(i, k) {
    var a = avail(i), s = stateOf(i);
    switch (k) {
      case 'A': return i.priority === 'A';
      case 'open': return a.k === 'open' || a.k === 'soon' || a.k === 'rolling';
      case 'soon': return a.k === 'soon';
      case 'est': return a.k === 'est' || a.k === 'unknown';
      case 'closed': return a.k === 'closed';
      case 'tracking': return !!ACTIVE[s.status];
      case 'submitted': return s.status === 'submitted' || s.status === 'awarded';
      case 'new': return isNew(i);
      default: return true;
    }
  }
  function renderStats() {
    var l = all().filter(function (i) { return !stateOf(i).hidden; });
    $('stats').innerHTML = STAT.map(function (s) {
      var n = l.filter(function (i) { return statMatch(i, s[0]); }).length;
      return '<button class="stat' + ((ui.stat || 'all') === s[0] ? ' on' : '') + (s[0] === 'soon' && n ? ' hot' : '') + '" data-stat="' + s[0] + '"><div class="n">' + n + '</div><div class="l">' + s[1] + '</div></button>';
    }).join('');
  }
  function fillOptions() {
    var l = all();
    function opts(sel, values, labelOf) { var el = $(sel), cur = el.value, first = el.options[0].outerHTML; el.innerHTML = first + values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(labelOf ? labelOf(v) : v) + '</option>'; }).join(''); el.value = cur; }
    opts('fType', CONF.types.filter(function (t) { return l.some(function (i) { return i.type === t; }); }));
    opts('fRegion', REGIONS.filter(function (r) { return l.some(function (i) { return i.region === r; }); }));
    opts('fPhase', PHASES, function (p) { return PHASE_LABEL[p]; });
    opts('fStatus', CONF.status.map(function (s) { return s[0]; }), function (k) { return STATUS_LABEL[k]; });
    ['q', 'fType', 'fRegion', 'fPhase', 'fPri', 'fAvail', 'fStatus', 'fBy', 'sort'].forEach(function (id) { if (ui[id] != null && $(id)) $(id).value = ui[id]; });
    $('fHidden').checked = !!ui.fHidden;
    if (!$('sort').value) $('sort').value = 'deadline';
  }
  function sortKey(i) {
    var a = avail(i);
    if (a.k === 'soon' || a.k === 'open') return '1' + i.deadline_date;
    if (a.k === 'est') return '2' + i.deadline_estimate + '-15';
    if (a.k === 'rolling') return '3';
    if (a.k === 'unknown') return '4';
    return '5' + (i.deadline_estimate || '9999');
  }
  function visible() {
    var q = ($('q').value || '').trim().toLowerCase(), f = function (id) { return $(id).value; };
    var list = all().filter(function (i) {
      var s = stateOf(i), a = avail(i);
      if (s.hidden && !$('fHidden').checked) return false;
      if (!statMatch(i, ui.stat || 'all')) return false;
      if (f('fType') && i.type !== f('fType')) return false;
      if (f('fRegion') && i.region !== f('fRegion')) return false;
      if (f('fPhase') && (i.phases || []).indexOf(f('fPhase')) < 0) return false;
      if (f('fPri') && i.priority !== f('fPri')) return false;
      if (f('fStatus') && s.status !== f('fStatus')) return false;
      if (f('fBy') && (i.added_by || 'research') !== f('fBy')) return false;
      var av = f('fAvail');
      if (av === 'open' && !(a.k === 'open' || a.k === 'soon' || a.k === 'rolling')) return false;
      if (av && av !== 'open' && a.k !== av && !(av === 'est' && a.k === 'unknown')) return false;
      if (q) {
        var hay = [i.name, i.funder, i.type, i.region, i.why_fit, i.eligibility, i.amount, i.priorities, i.ask, i.prize, s.notes].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var sort = f('sort') || 'deadline', PR = { A: 0, B: 1, C: 2 };
    list.sort(function (a, b) {
      if (sort === 'pri') return (PR[a.priority] - PR[b.priority]) || sortKey(a).localeCompare(sortKey(b));
      if (sort === 'new') return String(b.added || '').localeCompare(String(a.added || '')) || a.name.localeCompare(b.name);
      if (sort === 'amount') return (b.amount_max || 0) - (a.amount_max || 0) || sortKey(a).localeCompare(sortKey(b));
      if (sort === 'name') return a.funder.localeCompare(b.funder) || a.name.localeCompare(b.name);
      return sortKey(a).localeCompare(sortKey(b)) || (PR[a.priority] - PR[b.priority]);
    });
    return list;
  }
  function metaLine(label, text, cls) { return text ? '<div class="meta' + (cls ? ' ' + cls : '') + '"><b>' + label + ':</b> ' + esc(text) + '</div>' : ''; }
  function card(i) {
    var s = stateOf(i), a = avail(i), k = keyOf(i);
    var tags = '<span class="tag p' + esc(i.priority || 'B') + '">Priority ' + esc(i.priority || 'B') + '</span>' +
      '<span class="tag">' + esc(i.type || '') + '</span><span class="tag">' + esc(i.region || '') + '</span>' +
      deadlineTag(i, a) +
      (i.amount ? '<span class="tag money">' + esc(i.amount) + '</span>' : '') +
      (i.prize && !i.amount ? '<span class="tag money">' + esc(i.prize.length > 60 ? i.prize.slice(0, 58) + '…' : i.prize) + '</span>' : '') +
      (i.opens && daysTo(i.opens) > 0 ? '<span class="tag soon">Opens ' + esc(human(i.opens)) + '</span>' : '') +
      (i.phases || []).map(function (p) { return '<span class="tag">' + esc(PHASE_LABEL[p] || p) + '</span>'; }).join('') +
      (isNew(i) ? '<span class="tag new">New this week</span>' : '') +
      (s.status !== 'new' ? '<span class="tag st">' + esc(STATUS_LABEL[s.status] || s.status) + '</span>' : '');
    var closed = a.k === 'closed' ? '<div class="closedbox"><b>' + (/deadline passed/i.test(a.reason) ? 'Expired.' : 'Not open now.') + '</b> ' + esc(a.reason) + (a.next ? '<span class="nx">Next: ' + esc(a.next) + '</span>' : '') + '</div>' : '';
    var t = timing(i, a);
    var meta = (a.last ? metaLine('Not open yet', a.last.replace(/\.?$/, '.') + ' Next call expected around ' + monthYear(i.deadline_estimate + '-01') + '; the research runs add the real date when it is published.') : '') +
      metaLine('Deadline', i.deadline) +
      (t ? '<div class="meta"><b>Timing:</b> ' + t + '</div>' : '') +
      metaLine('Decision', i.decision || i.notification) +
      metaLine('Amount', i.amount && i.amount.length > 40 ? i.amount : '') +
      metaLine('Prize', i.prize && i.prize.length > 60 ? i.prize : '') +
      metaLine('Fee', i.fee) + metaLine('Festival dates', i.festival_dates) + metaLine('Premiere rules', i.premiere) +
      metaLine('Ask them for', i.ask) + metaLine('Offer them', i.offer) +
      metaLine('Who can apply', i.eligibility) + metaLine('Watch out', i.watch_out, 'warn') +
      metaLine('How to apply', i.how_to_apply) +
      (a.k !== 'closed' && i.reopens && (!i.deadline_date || a.k === 'est') ? metaLine('Next window', i.reopens) : '');
    var more = '';
    if (i.priorities || i.tips || (i.questions || []).length || (i.evidence || []).length) {
      more = '<details class="more"><summary>What they look for, their questions, sources</summary>' +
        metaLine('They value', i.priorities) + metaLine('Tips', i.tips) +
        ((i.questions || []).length ? '<div class="meta"><b>Their application asks for:</b></div><ol>' + i.questions.map(function (q) { return '<li>' + esc(q.q) + (q.limit ? ' <span class="muted">(' + esc(q.limit) + ')</span>' : '') + '</li>'; }).join('') + '</ol>' : '') +
        ((i.evidence || []).length ? '<div class="meta"><b>Sources:</b></div><ul>' + i.evidence.filter(isUrl).map(function (u) { return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80)) + '</a></li>'; }).join('') + '</ul>' : '') +
        '</details>';
    }
    var links = '<button class="lk go" data-draft="' + esc(i.id) + '">Draft application</button>' +
      (isUrl(i.url) ? '<a class="lk" href="' + esc(i.url) + '" target="_blank" rel="noopener">Their page</a>' : '') +
      (isUrl(i.apply_url) && i.apply_url !== i.url ? '<a class="lk" href="' + esc(i.apply_url) + '" target="_blank" rel="noopener">Apply</a>' : '') +
      (isUrl(i.guidelines_url) && i.guidelines_url !== i.url ? '<a class="lk" href="' + esc(i.guidelines_url) + '" target="_blank" rel="noopener">Guidelines</a>' : '') +
      (i.contact_email ? '<a class="lk" href="mailto:' + esc(i.contact_email) + '" title="Published on ' + esc(i.contact_source || '') + '">' + esc(i.contact_email) + '</a>' : '') +
      (i.deadline_date && a.k !== 'closed' ? '<button class="lk" data-ics="' + esc(i.id) + '">Add to calendar</button>' : '') +
      (i.src === 'manual' ? '<button class="lk" data-del="' + esc(i.id) + '">Delete</button>' : '');
    var foot = (i.src === 'manual' ? 'Added by you' : 'Added by ' + (BYLABEL[i.added_by] || 'research').toLowerCase()) + (i.added ? ' on ' + human(i.added) : '') +
      (i.updated ? ' · updated ' + human(i.updated) + (i.updated_by ? ' by ' + (BYLABEL[i.updated_by] || '').toLowerCase() : '') : '') +
      (i.checked ? ' · checked ' + human(i.checked) : '');
    var side = '<label>Status<select data-f="status">' + CONF.status.map(function (x) { return '<option value="' + x[0] + '"' + (s.status === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      (FUND ? '<div class="row2"><label>Asking for ($)<input type="number" min="0" step="100" data-f="ask" value="' + esc(s.ask || '') + '" placeholder="' + esc(i.amount_max && (!i.currency || i.currency === 'CAD') ? 'up to ' + i.amount_max.toLocaleString('en-CA') : '') + '"></label>' +
        '<label>Awarded ($)<input type="number" min="0" step="100" data-f="got" value="' + esc(s.got || '') + '"' + (s.status === 'awarded' ? '' : ' disabled') + '></label></div>' : '') +
      '<label>Submitted on<input type="date" data-f="submitted" value="' + esc(s.submitted || '') + '"></label>' +
      '<label>Notes<textarea data-f="notes" placeholder="Who you talked to, what they said, what is left to do">' + esc(s.notes || '') + '</textarea></label>' +
      '<div class="btns"><button class="b small" data-act="submitted">Submitted today</button><button class="b small" data-act="hide">' + (s.hidden ? 'Unhide' : 'Hide') + '</button></div>' +
      '<div class="saved"></div>' +
      ((s.log || []).length ? '<div class="log">' + s.log.slice().reverse().map(function (l) { return esc(human(l.d)) + ': ' + esc(l.t); }).join('<br>') + '</div>' : '');
    return '<article class="card' + (a.k === 'closed' ? ' closed' : '') + (s.hidden ? ' hiddenrow' : '') + '" id="c-' + esc(i.id) + '" data-key="' + esc(k) + '" data-id="' + esc(i.id) + '">' +
      '<div><div class="nm">' + esc(i.name) + '</div><div class="rl">' + esc(i.funder) + '</div><div class="tags">' + tags + '</div>' +
      closed + '<div class="why">' + esc(i.why_fit || '') + '</div>' + meta + more + '<div class="links">' + links + '</div><div class="foot">' + esc(foot) + '</div></div>' +
      '<div class="side">' + side + '</div></article>';
  }
  function renderList() {
    var list = visible();
    var total = all().length;
    $('count').innerHTML = '<span>Showing ' + list.length + ' of ' + total + ' ' + CONF.many + '.</span>' +
      (ui.stat && ui.stat !== 'all' ? '<button class="b small" data-stat="all">Clear the box filter</button>' : '');
    $('list').innerHTML = list.length ? list.map(card).join('') : '<div class="empty">' + (total ? 'Nothing matches these filters.' : (loadError ? 'The list could not be loaded.' : 'The list is empty. The first research run fills it.')) + '</div>';
  }
  function renderAll() { renderStats(); renderList(); renderBanner(); if (FUND) renderBudget(); renderDeadlines(); }
  function remember() {
    ['q', 'fType', 'fRegion', 'fPhase', 'fPri', 'fAvail', 'fStatus', 'fBy', 'sort'].forEach(function (id) { ui[id] = $(id).value; });
    ui.fHidden = $('fHidden').checked; store(K_UI, ui);
  }

  // Card edits: saved as you type (notes) or on change (everything else).
  function onCardEdit(e, done) {
    var el = e.target, f = el.getAttribute('data-f'); if (!f) return;
    var c = el.closest('.card'), i = findById(c.getAttribute('data-id')); if (!i) return;
    var before = stateOf(i), patch = {}, line = '';
    if (f === 'status') {
      patch.status = el.value; line = 'Status: ' + STATUS_LABEL[el.value];
      if (el.value === 'submitted' && !before.submitted) patch.submitted = today;
    } else if (f === 'ask' || f === 'got') patch[f] = num(el.value);
    else patch[f] = el.value;
    saveState(i, patch, line);
    var sv = c.querySelector('.saved'); if (sv) { sv.textContent = 'Saved'; clearTimeout(sv.t); sv.t = setTimeout(function () { sv.textContent = ''; }, 1400); }
    if (done) { renderStats(); renderBanner(); if (FUND) renderBudget(); if (f === 'status') { var html = card(i), tmp = document.createElement('div'); tmp.innerHTML = html; c.replaceWith(tmp.firstChild); } }
  }

  // ---------- add your own ----------
  var ADD_FIELDS = [
    ['name', 'Name of the program or opportunity', 'text', true], ['funder', 'Organization', 'text', true],
    ['type', 'Type', 'type'], ['region', 'Where', 'region'], ['priority', 'Priority', 'pri'],
    ['amount', FUND ? 'Amount (as they say it)' : 'Prize (as they say it)', 'text'], ['amount_max', FUND ? 'Most they give ($)' : 'Cash prize ($)', 'number'],
    ['deadline_date', 'Deadline', 'date'], ['deadline', 'Deadline details', 'text'], ['url', 'Their page (https://…)', 'url'],
    ['why_fit', 'Why it fits PURPLE / notes', 'area']
  ];
  function renderAddForm() {
    $('addForm').innerHTML = ADD_FIELDS.map(function (f) {
      var input;
      if (f[2] === 'type') input = '<select id="a_type">' + CONF.types.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>';
      else if (f[2] === 'region') input = '<select id="a_region">' + REGIONS.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>';
      else if (f[2] === 'pri') input = '<select id="a_priority"><option>A</option><option selected>B</option><option>C</option></select>';
      else if (f[2] === 'area') input = '<textarea id="a_' + f[0] + '" rows="3"></textarea>';
      else input = '<input id="a_' + f[0] + '" type="' + (f[2] === 'url' ? 'url' : f[2]) + '">';
      return '<label class="' + (f[2] === 'area' || f[0] === 'name' ? 'full' : '') + '">' + esc(f[1]) + input + '</label>';
    }).join('') + '<div class="full"><label style="display:block;margin-bottom:4px">' + (FUND ? 'Pays for' : 'For a film that is at') + '</label>' +
      PHASES.map(function (p) { return '<label style="display:inline-flex;gap:5px;margin-right:12px;font-weight:400"><input type="checkbox" class="a_phase" value="' + p + '">' + esc(PHASE_LABEL[p]) + '</label>'; }).join('') + '</div>';
  }
  function saveAdd() {
    var e = { id: 'm-' + Date.now().toString(36), added: today, added_by: 'manual' };
    ADD_FIELDS.forEach(function (f) { var v = ($('a_' + f[0]).value || '').trim(); if (v) e[f[0]] = f[2] === 'number' ? num(v) : v; });
    if (!e.name || !e.funder) { toast('Add a name and an organization'); return; }
    if (e.url && !isUrl(e.url)) delete e.url;
    e.phases = Array.prototype.filter.call(document.querySelectorAll('.a_phase'), function (x) { return x.checked; }).map(function (x) { return x.value; });
    manual[PAGE].push(e); store(K_MANUAL, manual);
    $('addDlg').classList.remove('open');
    fillOptions(); renderAll(); findOne(e.id); toast('Added');
  }

  // ---------- the draft dialog ----------
  var SETS = {
    grant: [['Cover letter', 'cover_letter'], ['Logline', 'logline'], ['Short synopsis', 'synopsis_short'], ['Long synopsis', 'synopsis_long'], ['Artistic or director\'s statement', 'statement'], ['Why this story, why now', 'why_now'], ['Community and representation', 'representation'], ['Audience and impact', 'audience'], ['Your bio', 'bio'], ['Previous work', 'previous_work'], ['Team', 'team'], ['Budget summary', 'budget'], ['Funding plan (other sources)', 'funding_plan'], ['How the money will be used', 'use_of_funds'], ['Schedule', 'schedule'], ['Release plan', 'distribution']],
    tax: [['Checklist', 'tax_note'], ['Budget summary', 'budget'], ['Schedule', 'schedule'], ['Team', 'team']],
    inkind: [['Request letter', 'inkind_letter'], ['Logline', 'logline'], ['Short synopsis', 'synopsis_short'], ['Team', 'team'], ['Schedule', 'schedule']],
    sponsor: [['First email', 'sponsor_pitch'], ['One-page summary', 'sponsor_onepager'], ['Follow-up, a week later', 'sponsor_followup']],
    crowd: [['Title and subtitle', 'crowd_title'], ['Story', 'crowd_story'], ['Where the money goes', 'crowd_budget'], ['Rewards', 'crowd_rewards'], ['Risks and challenges', 'crowd_risks']],
    pitch: [['Cover letter', 'cover_letter'], ['Logline', 'logline'], ['Short synopsis', 'synopsis_short'], ['Long synopsis', 'synopsis_long'], ['Director\'s statement', 'statement'], ['Your bio', 'bio'], ['Team', 'team'], ['Budget summary', 'budget'], ['Funding plan', 'funding_plan'], ['Schedule', 'schedule']],
    screenplay: [['Logline', 'logline'], ['Short synopsis', 'synopsis_short'], ['Long synopsis', 'synopsis_long'], ['Your bio', 'bio']],
    festival: [['Note to programmers', 'festival_note'], ['Logline', 'logline'], ['Short synopsis', 'synopsis_short'], ['Long synopsis', 'synopsis_long'], ['Director\'s statement', 'statement'], ['Director bio', 'bio'], ['Credits', 'team'], ['Technical details', 'tech'], ['Premiere status', 'premiere_status']]
  };
  function standardSet(i) {
    switch (i.type) {
      case 'Tax credit': return SETS.tax;
      case 'In-kind': return SETS.inkind;
      case 'Sponsor': return SETS.sponsor;
      case 'Crowdfunding': return SETS.crowd;
      case 'Screenplay competition': return SETS.screenplay;
      case 'Festival': return SETS.festival;
      case 'Pitch competition': case 'Lab': case 'Market': case 'Fellowship': case 'Award': return SETS.pitch;
      default: return SETS.grant;
    }
  }
  var draftOf = null, draftMode = 'theirs';
  function sections(i) {
    if (draftMode === 'theirs' && (i.questions || []).length) {
      return i.questions.map(function (q) { return { label: q.q, kit: q.kit === 'custom' ? null : q.kit, limit: q.limit || '', hint: q.hint || '' }; });
    }
    return standardSet(i).map(function (x) { return { label: x[0], kit: x[1], limit: '', hint: '' }; });
  }
  function sectionText(i, sec, n) {
    var saved = (drafts[keyOf(i)] || {})[draftMode + ':' + n];
    if (saved != null) return saved;
    if (!sec.kit) return '[' + (sec.hint || 'Write this part: ' + sec.label) + ']';
    return fill(kitText(sec.kit) || '', ctxFor(i));
  }
  function openDraft(id) {
    var i = findById(id); if (!i) return;
    draftOf = i;
    draftMode = (i.questions || []).length ? (ui.draftStandard ? 'standard' : 'theirs') : 'standard';
    renderDraft();
    $('draftDlg').classList.add('open');
    $('draftDlg').scrollTop = 0;
  }
  function renderDraft() {
    var i = draftOf, a = avail(i), secs = sections(i), hasQ = (i.questions || []).length;
    $('dTitle').textContent = i.name;
    $('dSub').innerHTML = esc(i.funder) + ' · ' + esc(i.type) + (i.deadline ? ' · ' + esc(i.deadline) : '') + ' ' + deadlineTag(i, a);
    $('dNote').innerHTML = (a.k === 'closed' ? '<b>This one is not open now.</b> ' + esc(a.reason) + ' Draft it anyway, so you are ready when it reopens. ' : '') +
      (hasQ && draftMode === 'theirs' ? 'These are the sections <b>their application</b> asks for, filled in from your Application kit. ' : 'These are the <b>standard sections</b> for a ' + esc(i.type.toLowerCase()) + ', filled in from your Application kit. ' + (hasQ ? '' : 'Check their form for the exact questions and limits. ')) +
      'Edits here are saved for this ' + CONF.one + ' only. Fill in everything in [square brackets] before you send it.' +
      (hasQ ? ' <button class="lnk" id="dMode">' + (draftMode === 'theirs' ? 'Show the standard sections instead' : 'Show their questions instead') + '</button>' : '');
    $('dSecs').innerHTML = secs.map(function (sec, n) {
      var text = sectionText(i, sec, n);
      return '<div class="sec" data-n="' + n + '"><div class="sh"><b>' + esc(sec.label) + '</b>' + (sec.limit ? '<span class="muted">' + esc(sec.limit) + '</span>' : '') +
        (sec.kit ? '<span class="muted">from: ' + esc(KIT_LABEL[sec.kit] || sec.kit) + '</span>' : '') + '<span class="sp"></span>' +
        '<button class="b small" data-copy="' + n + '">Copy</button><button class="b small" data-reset="' + n + '">Reset</button></div>' +
        (sec.hint && sec.kit ? '<div class="hint">' + esc(sec.hint) + '</div>' : '') +
        '<textarea data-sec="' + n + '" rows="' + Math.min(18, Math.max(3, Math.ceil(text.length / 95) + (text.match(/\n/g) || []).length)) + '">' + esc(text) + '</textarea>' +
        '<div class="kc" data-count="' + n + '">' + counts(text, sec.limit) + '</div></div>';
    }).join('');
    $('dOpen').hidden = !isUrl(i.apply_url || i.url);
    var st = stateOf(i).status;
    $('dPrep').hidden = st === 'preparing' || !!DONE[st];
  }
  function draftSave(n, text) {
    var k = keyOf(draftOf); drafts[k] = drafts[k] || {};
    if (text == null) delete drafts[k][draftMode + ':' + n]; else drafts[k][draftMode + ':' + n] = text;
    store(K_DRAFTS, drafts);
  }

  // ---------- application kit tab ----------
  function renderKit() {
    var A = applicant(), groups = [];
    KIT_DEFS.forEach(function (d) { if (groups.indexOf(d[2]) < 0) groups.push(d[2]); });
    var todo = 0;
    KIT_DEFS.forEach(function (d) { todo += ((kitText(d[0]) || '').match(/\[[^\]\n]{2,}\]/g) || []).length; });
    var html = '<div class="panel"><h2>Application kit</h2>' +
      '<p>Write each answer once here. Every <b>Draft application</b> button builds its copy from this kit, with the funder\'s name, the amount, what the money pays for and your budget filled in. Changes are saved in this browser as you type.</p>' +
      '<p class="muted">Words in braces fill themselves in for each ' + CONF.one + ': <code class="v">{funder}</code> <code class="v">{program}</code> <code class="v">{amount}</code> <code class="v">{use}</code> <code class="v">{phase_words}</code> <code class="v">{total}</code> <code class="v">{secured}</code> <code class="v">{gap}</code> <code class="v">{applications}</code> <code class="v">{ask}</code> <code class="v">{offer}</code> <code class="v">{name}</code> <code class="v">{contact_line}</code>, and any kit section by its name, like <code class="v">{logline}</code>. Anything in [square brackets] is for you to fill in' + (todo ? ': <b>' + todo + ' left</b>.' : '.') + '</p></div>';
    html += '<div class="panel"><h3 style="margin-top:0">About you</h3><p class="muted">Used in signatures. Kept in this browser only, never in the files you publish.</p><div class="form">' +
      APPLICANT_FIELDS.map(function (f) { return '<label>' + esc(f[1]) + '<input data-app="' + f[0] + '" value="' + esc(A[f[0]] || '') + '"></label>'; }).join('') + '</div></div>';
    groups.forEach(function (g) {
      html += '<div class="panel kitgrp"><h3>' + esc(g) + '</h3>' + KIT_DEFS.filter(function (d) { return d[2] === g; }).map(function (d) {
        var text = kitText(d[0]) || '', changed = mine.kit[d[0]] != null && mine.kit[d[0]] !== kitDefault(d[0]);
        return '<div class="kf"><div class="kh"><b>' + esc(d[1]) + '</b><span class="muted">' + esc(d[4] ? 'aim for ' + d[4] : '') + '</span>' + (changed ? '<button class="b small" data-kreset="' + d[0] + '">Back to the original</button>' : '') + '</div>' +
          (d[3] ? '<div class="muted" style="font-size:12px;margin-top:2px">' + esc(d[3]) + '</div>' : '') +
          '<textarea data-kit="' + d[0] + '" rows="' + Math.min(16, Math.max(3, Math.ceil(text.length / 110) + (text.match(/\n/g) || []).length)) + '">' + esc(text) + '</textarea>' +
          '<div class="kc" data-kcount="' + d[0] + '">' + counts(text, '') + '</div></div>';
      }).join('') + '</div>';
    });
    $('kit').innerHTML = html;
  }

  // ---------- budget tab (funding page) ----------
  function renderBudget() {
    if (!FUND || !$('budget') || !project) return;
    var b = budgetNums(), B = project.budget, have = b.secured + b.awarded;
    var pct = function (n) { return Math.max(0, Math.min(100, n / b.total * 100)).toFixed(2) + '%'; };
    var phaseSum = {}; (B.groups || []).forEach(function (g) { phaseSum[g.phase] = (phaseSum[g.phase] || 0) + g.amount; });
    var open = all().filter(function (i) { var a = avail(i); return a.k !== 'closed' && !DONE[stateOf(i).status]; });
    var html = '<div class="panel"><h2>Budget and gap</h2><p>From <b>' + esc(B.source) + '</b>. The amounts awarded and pending come from what you mark on each card (Asking for, Awarded).</p>' +
      '<div class="big"><div><div class="n">' + money(b.total) + '</div><div class="l">Total budget</div></div>' +
      '<div><input id="secured" type="number" min="0" step="500" value="' + esc(b.secured) + '" aria-label="Money in hand"><div class="l">In hand (edit me)</div></div>' +
      '<div><div class="n">' + money(b.awarded) + '</div><div class="l">Awarded here</div></div>' +
      '<div><div class="n">' + money(b.pending) + '</div><div class="l">Submitted, waiting</div></div>' +
      '<div class="gap"><div class="n">' + money(b.gap) + '</div><div class="l">Still to raise</div></div></div>' +
      '<div class="bar" title="In hand, awarded, waiting, still to raise"><span class="s1" style="width:' + pct(b.secured) + '"></span><span class="s2" style="width:' + pct(b.awarded) + '"></span><span class="s3" style="width:' + pct(Math.min(b.pending, b.gap)) + '"></span></div>' +
      '<div class="legend"><span><i style="background:var(--purple)"></i>In hand</span><span><i style="background:var(--sage)"></i>Awarded</span><span><i style="background:#c9b6ef"></i>Submitted, waiting</span><span><i style="background:var(--red-wash);border:1px solid var(--line)"></i>Still to raise</span>' + (b.preparing ? '<span>Preparing: ' + money(b.preparing) + ' more</span>' : '') + '</div>' +
      '<p style="margin-top:12px"><b>Minimum to shoot:</b> about ' + money(b.minimum) + ' in cash while shooting (the spreadsheet\'s core costs at the time of filming, with cast and crew). ' + (b.shortMin ? 'You are <b>' + money(b.shortMin) + ' short</b> of that.' : '<b>Covered.</b>') + '</p></div>';
    html += '<div class="panel"><h3 style="margin-top:0">Where the money goes</h3><div class="tablewrap"><table class="t"><tr><th>Line</th><th>Phase</th><th class="n">Amount</th></tr>' +
      (B.groups || []).map(function (g) { return '<tr><td>' + esc(g.label) + '</td><td>' + esc(PHASE_LABEL[g.phase] || g.phase) + '</td><td class="n">' + money(g.amount) + '</td></tr>'; }).join('') +
      '<tr class="sum"><td>Production</td><td></td><td class="n">' + money(phaseSum.production || 0) + '</td></tr><tr class="sum"><td>Post-production</td><td></td><td class="n">' + money(phaseSum['post-production'] || 0) + '</td></tr>' +
      '<tr class="sum"><td>Total</td><td></td><td class="n">' + money(b.total) + '</td></tr></table></div>' +
      (B.deferred ? '<p class="muted">' + esc(B.deferred) + '</p>' : '') + (B.note ? '<p class="muted"><b>Note:</b> ' + esc(B.note) + '</p>' : '') + '</div>';
    html += '<div class="panel"><h3 style="margin-top:0">Cash needed for each shoot block</h3><div class="tablewrap"><table class="t"><tr><th>Block</th><th>When</th><th class="n">At least</th><th class="n">With cast and crew</th></tr>' +
      (B.blocks || []).map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td>' + esc(x.when) + '</td><td class="n">' + money(x.minimum) + '</td><td class="n">' + money(x.with_cast_crew) + '</td></tr>'; }).join('') + '</table></div></div>';
    html += '<div class="panel"><h3 style="margin-top:0">When the money is needed</h3><p class="muted">Most funders will not pay for work done before they decide, so look at the <b>Timing</b> line on each card: it says whether the answer comes before the shoot.</p><div class="tablewrap"><table class="t"><tr><th>When</th><th>What</th><th>Needed by</th><th class="n">Open for this phase</th></tr>' +
      (project.timeline || []).map(function (t) {
        var n = open.filter(function (i) { return (i.phases || []).indexOf(t.phase) >= 0; }).length;
        return '<tr><td>' + esc(monthYear(t.from + '-01')) + (t.to !== t.from ? ' to ' + esc(monthYear(t.to + '-01')) : '') + '</td><td>' + esc(t.label) + '</td><td>' + esc(human(t.need_by)) + '</td><td class="n"><button class="b small" data-phase="' + esc(t.phase) + '">' + n + ' ' + esc(PHASE_LABEL[t.phase].toLowerCase()) + '</button></td></tr>';
      }).join('') + '</table></div></div>';
    $('budget').innerHTML = html;
  }

  // ---------- deadlines tab ----------
  function renderDeadlines() {
    var l = all().filter(function (i) { return !stateOf(i).hidden; });
    var rows = [];
    l.forEach(function (i) {
      var a = avail(i);
      if (a.k === 'open' || a.k === 'soon') rows.push({ d: i.deadline_date, i: i, kind: 'deadline' });
      else if (a.k === 'est') rows.push({ d: i.deadline_estimate + '-28', i: i, kind: 'est' });
      if (i.opens && daysTo(i.opens) > 0) rows.push({ d: i.opens, i: i, kind: 'opens' });
    });
    rows.sort(function (a, b) { return a.d.localeCompare(b.d); });
    var months = {}, order = [];
    rows.forEach(function (r) { var m = r.d.slice(0, 7); if (!months[m]) { months[m] = []; order.push(m); } months[m].push(r); });
    var rolling = l.filter(function (i) { return avail(i).k === 'rolling'; });
    var recent = l.filter(function (i) { var a = avail(i); return a.k === 'closed' && i.deadline_date && daysTo(i.deadline_date) >= -60; }).sort(function (a, b) { return b.deadline_date.localeCompare(a.deadline_date); });
    function line(r) {
      var i = r.i, s = stateOf(i);
      var d = r.kind === 'est' ? '<div class="d est">' + esc(MON[+i.deadline_estimate.slice(5) - 1]) + ' (expected)</div>' : '<div class="d">' + esc(dayName(r.d)) + '</div>';
      return '<div class="dl">' + d + '<div class="x"><button data-find="' + esc(i.id) + '">' + esc(i.funder + ': ' + i.name) + '</button> <span class="muted">' + esc((r.kind === 'opens' ? 'Opens. ' : '') + [i.type, i.amount || i.prize].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="tags" style="margin:0">' + (r.kind === 'opens' ? '<span class="tag soon">Opens</span>' : deadlineTag(i)) + '<span class="tag p' + esc(i.priority) + '">' + esc(i.priority) + '</span>' + (s.status !== 'new' ? '<span class="tag st">' + esc(STATUS_LABEL[s.status]) + '</span>' : '') + '</div></div>';
    }
    var html = '<div class="panel"><h2>Deadlines</h2><p>Every date coming up, month by month. Dates marked <i>expected</i> are not announced yet; they are based on last year, and the research runs replace them as soon as the real date is published. Anything whose deadline has passed is marked expired automatically.</p>' +
      '<div class="btns"><button class="b purple" id="icsAll">Add all deadlines to your calendar (.ics)</button><span class="muted" style="font-size:12px">Each event reminds you a week before.</span></div></div>';
    html += order.length ? order.map(function (m) { return '<div class="panel month"><h3>' + esc(monthYear(m + '-01')) + '</h3>' + months[m].map(line).join('') + '</div>'; }).join('') : '<div class="panel"><p class="muted">No dated deadlines yet.</p></div>';
    if (rolling.length) html += '<div class="panel month"><h3>Any time (rolling)</h3>' + rolling.map(function (i) { return line({ d: today, i: i, kind: 'rolling' }); }).join('').replace(/<div class="d">[^<]*<\/div>/g, '<div class="d">Any time</div>') + '</div>';
    if (recent.length) html += '<div class="panel month"><h3>Expired in the last 60 days</h3>' + recent.map(function (i) { return line({ d: i.deadline_date, i: i, kind: 'closed' }); }).join('') + '</div>';
    $('deadlines').innerHTML = html;
  }
  function icsFor(list) {
    function e(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function fold(l) { var out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = ' ' + l.slice(74); } out.push(l); return out.join('\r\n'); }
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PURPLE//Funding desk//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:PURPLE deadlines'];
    list.forEach(function (i) {
      var d = i.deadline_date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + i.id + '-' + d + '@purple-funding', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(i.deadline_date, 1).replace(/-/g, ''),
        'SUMMARY:' + e('PURPLE deadline: ' + i.funder + ', ' + i.name), 'DESCRIPTION:' + e((i.deadline || '') + '\n' + (i.apply_url || i.url || '')),
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e('PURPLE deadline in a week: ' + i.name), 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  // ---------- backup tab ----------
  function exportAll() {
    var data = { exported: new Date().toISOString(), track: track, kit: mine, drafts: drafts, manual: manual };
    download('purple-funding-backup-' + today + '.json', JSON.stringify(data, null, 2), 'application/json');
  }
  function importAll(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || !d.track) throw new Error('not a backup');
        track = Object.assign({}, track, d.track || {}); mine = d.kit || mine; mine.kit = mine.kit || {}; mine.applicant = mine.applicant || {};
        drafts = Object.assign({}, drafts, d.drafts || {});
        manual = d.manual || manual; manual.funding = manual.funding || []; manual.competitions = manual.competitions || [];
        store(K_TRACK, track); store(K_KIT, mine); store(K_DRAFTS, drafts); store(K_MANUAL, manual);
        fillOptions(); renderAll(); renderKit(); toast('Backup restored');
      } catch (e) { toast('That file is not a PURPLE backup'); }
    };
    r.readAsText(file);
  }
  function exportCsv() {
    var cols = [['funder', 'Organization'], ['name', 'Name'], ['type', 'Type'], ['region', 'Where'], ['priority', 'Priority'], ['amount', FUND ? 'Amount' : 'Prize'], ['deadline_date', 'Deadline'], ['deadline', 'Deadline details'], ['_avail', 'Open?'], ['_status', 'Your status'], ['_ask', 'Asking for'], ['_got', 'Awarded'], ['_submitted', 'Submitted on'], ['_notes', 'Your notes'], ['url', 'Page']];
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [cols.map(function (c) { return c[1]; }).join(',')];
    visible().forEach(function (i) {
      var s = stateOf(i), a = avail(i);
      var ex = { _avail: { closed: 'Expired or not open', soon: 'Closing soon', open: 'Open', rolling: 'Rolling', est: 'Date not announced', unknown: 'See their page' }[a.k], _status: STATUS_LABEL[s.status], _ask: s.ask || '', _got: s.got || '', _submitted: s.submitted || '', _notes: s.notes || '' };
      rows.push(cols.map(function (c) { return q(c[0].charAt(0) === '_' ? ex[c[0]] : i[c[0]]); }).join(','));
    });
    download('purple-' + PAGE + '-' + today + '.csv', '\ufeff' + rows.join('\r\n'), 'text/csv');
  }

  // ---------- tabs and finding one ----------
  var TABS = FUND ? ['list', 'deadlines', 'budget', 'kit', 'updates', 'backup'] : ['list', 'deadlines', 'kit', 'updates', 'backup'];
  function showTab(name) {
    if (TABS.indexOf(name) < 0) name = 'list';
    TABS.forEach(function (k) { $('tab-' + k).hidden = k !== name; });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    ui.tab = name; store(K_UI, ui);
    if (name === 'kit') renderKit();
    if (history.replaceState) history.replaceState(null, '', name === 'list' ? location.pathname : '#' + name);
    window.scrollTo(0, 0);
  }
  function findOne(id) {
    showTab('list');
    var el = $('c-' + id);
    if (!el) {
      ui.stat = 'all'; ['q', 'fType', 'fRegion', 'fPhase', 'fPri', 'fAvail', 'fStatus', 'fBy'].forEach(function (x) { $(x).value = ''; });
      var i = findById(id); if (i && stateOf(i).hidden) $('fHidden').checked = true;
      remember(); renderStats(); renderList(); el = $('c-' + id);
    }
    if (!el) { toast('No longer on the list'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 1600);
  }

  // ---------- events ----------
  function wire() {
    document.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest('.tab'))) { showTab(x.getAttribute('data-tab')); return; }
      if ((x = t.closest('[data-go]'))) { showTab(x.getAttribute('data-go')); return; }
      if ((x = t.closest('[data-stat]'))) { ui.stat = x.getAttribute('data-stat'); store(K_UI, ui); renderStats(); renderList(); return; }
      if ((x = t.closest('[data-find]'))) { $('draftDlg').classList.remove('open'); findOne(x.getAttribute('data-find')); return; }
      if ((x = t.closest('[data-more]'))) { Array.prototype.forEach.call(x.parentNode.querySelectorAll('[hidden]'), function (h) { h.hidden = false; }); x.remove(); return; }
      if ((x = t.closest('[data-phase]'))) { showTab('list'); ui.stat = 'open'; $('fPhase').value = x.getAttribute('data-phase'); remember(); renderStats(); renderList(); return; }
      if ((x = t.closest('[data-draft]'))) { openDraft(x.getAttribute('data-draft')); return; }
      if ((x = t.closest('[data-ics]'))) { var i1 = findById(x.getAttribute('data-ics')); if (i1) download('purple-deadline-' + i1.id + '.ics', icsFor([i1]), 'text/calendar'); return; }
      if ((x = t.closest('[data-del]'))) {
        var id = x.getAttribute('data-del');
        if (!confirm('Delete this ' + CONF.one + ' you added?')) return;
        manual[PAGE] = manual[PAGE].filter(function (m) { return m.id !== id; }); store(K_MANUAL, manual); renderAll(); return;
      }
      if ((x = t.closest('[data-act]'))) {
        var c = x.closest('.card'), i2 = findById(c.getAttribute('data-id')), act = x.getAttribute('data-act');
        if (act === 'submitted') saveState(i2, { status: 'submitted', submitted: today }, 'Submitted');
        if (act === 'hide') { var h = !stateOf(i2).hidden; saveState(i2, { hidden: h }, h ? 'Hidden' : 'Unhidden'); }
        renderAll(); return;
      }
      if (t.id === 'dClose' || t.id === 'draftDlg') { $('draftDlg').classList.remove('open'); return; }
      if (t.id === 'addClose' || t.id === 'addDlg') { $('addDlg').classList.remove('open'); return; }
      if (t.id === 'dMode') { draftMode = draftMode === 'theirs' ? 'standard' : 'theirs'; ui.draftStandard = draftMode === 'standard'; store(K_UI, ui); renderDraft(); return; }
      if ((x = t.closest('[data-copy]'))) { var ta = document.querySelector('[data-sec="' + x.getAttribute('data-copy') + '"]'); copy(ta.value, 'Section'); return; }
      if ((x = t.closest('[data-reset]'))) {
        var n = x.getAttribute('data-reset');
        if (!confirm('Replace this section with the text from your kit?')) return;
        draftSave(n, null); renderDraft(); return;
      }
      if (t.id === 'dAll') {
        var secs = sections(draftOf);
        copy(secs.map(function (s, k) { return s.label.toUpperCase() + '\n\n' + document.querySelector('[data-sec="' + k + '"]').value; }).join('\n\n\n'), 'Whole draft');
        return;
      }
      if (t.id === 'dOpen') { window.open(draftOf.apply_url || draftOf.url, '_blank', 'noopener'); return; }
      if (t.id === 'dPrep') { saveState(draftOf, { status: 'preparing' }, 'Status: Preparing'); renderAll(); renderDraft(); toast('Marked as preparing'); return; }
      if ((x = t.closest('[data-kreset]'))) { delete mine.kit[x.getAttribute('data-kreset')]; store(K_KIT, mine); renderKit(); return; }
      if (t.id === 'addBtn') { renderAddForm(); $('addDlg').classList.add('open'); setTimeout(function () { $('a_name').focus(); }, 30); return; }
      if (t.id === 'addSave') { saveAdd(); return; }
      if (t.id === 'csvBtn' || t.id === 'csvBtn2') { exportCsv(); return; }
      if (t.id === 'lockBtn' || t.id === 'lockBtn2') { lock(); return; }
      if (t.id === 'expBtn') { exportAll(); return; }
      if (t.id === 'icsAll') {
        var list = all().filter(function (i) { var a = avail(i); return (a.k === 'open' || a.k === 'soon') && !stateOf(i).hidden; });
        if (!list.length) { toast('No dated deadlines'); return; }
        download('purple-' + PAGE + '-deadlines.ics', icsFor(list), 'text/calendar'); return;
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('draftDlg').classList.remove('open'); $('addDlg').classList.remove('open'); } });
    ['q'].forEach(function (id) { $(id).addEventListener('input', function () { remember(); renderList(); }); });
    ['fType', 'fRegion', 'fPhase', 'fPri', 'fAvail', 'fStatus', 'fBy', 'sort', 'fHidden'].forEach(function (id) { $(id).addEventListener('change', function () { remember(); renderList(); }); });
    $('list').addEventListener('change', function (e) { onCardEdit(e, true); });
    $('list').addEventListener('input', function (e) { if (e.target.getAttribute('data-f') === 'notes') onCardEdit(e, false); });
    $('dSecs').addEventListener('input', function (e) {
      var n = e.target.getAttribute('data-sec'); if (n == null) return;
      draftSave(n, e.target.value);
      $('dSecs').querySelector('[data-count="' + n + '"]').innerHTML = counts(e.target.value, sections(draftOf)[n].limit);
    });
    $('kit').addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-kit'), a = e.target.getAttribute('data-app');
      if (k) { mine.kit[k] = e.target.value; $('kit').querySelector('[data-kcount="' + k + '"]').innerHTML = counts(e.target.value, ''); }
      if (a) mine.applicant[a] = e.target.value;
      if (k || a) { clearTimeout(wire.t); wire.t = setTimeout(function () { store(K_KIT, mine); }, 250); }
    });
    if (FUND) $('budget').addEventListener('change', function (e) {
      if (e.target.id === 'secured') { mine.secured = num(e.target.value); store(K_KIT, mine); renderBudget(); toast('Saved'); }
    });
    $('impFile').addEventListener('change', function (e) { if (e.target.files[0]) importAll(e.target.files[0]); e.target.value = ''; });
  }

  // ---------- start ----------
  function fetchJson(url) {
    return fetch(url + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); });
  }
  function start() {
    wire();
    var asFile = location.protocol === 'file:';
    Promise.all([fetchJson(CONF.data), fetchJson(CONF.runs).catch(function () { return { schedule: [], runs: [] }; })])
      .then(function (r) { items = r[0].items || []; listUpdated = r[0].updated || ''; runsDb = r[1] || runsDb; })
      .catch(function (err) {
        loadError = asFile
          ? 'This page was opened as a file, so the browser will not let it read its lists. Double-click <code>preview.bat</code> in this folder, then open <code>http://localhost:8000/' + (FUND ? 'purple-funding' : 'purple-competitions') + '.html</code>. On GitHub Pages it works on its own.'
          : 'The lists could not be loaded (' + esc(err.message) + '). Refresh the page; if it keeps happening, check that the data folder was published.';
      })
      .then(function () {
        fillOptions(); renderPulse(); renderRuns(); renderAll();
        var want = (location.hash || '').slice(1) || ui.tab || 'list';
        showTab(want);
        setInterval(function () { var t = torontoDate(Date.now()); if (t !== today) { today = t; renderAll(); } renderPulse(); }, 60e3);
      });
  }
  gate(start);
})();
