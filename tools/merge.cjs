// Adds researched entries to data/funding.json or data/competitions.json and
// logs the run in data/<list>-runs.json, which the page shows under Updates.
//
//   node tools/merge.cjs --list funding --by weekly --note "What this run found" new.json [more.json …]
//   node tools/merge.cjs --list competitions --by daily --note "Nothing new today."   (no file: only logs the run)
//
// --by is "daily" (the daily scan), "weekly" (the weekly research) or
// "research" (a research session in a chat; the default). Every run is logged,
// including runs that found nothing, so you can see that the scans ran.
//
// Each input file is a JSON array of entries (or {"items": [...]}, or a file
// containing a ```json block). The entry format is in RESEARCH-GUIDE.md.
// - A new entry gets an id, "added" and "added_by".
// - An entry already on the list (same id, or same funder and name) is updated
//   field by field. Nothing already filled in is blanked. It gets "updated"
//   and "updated_by" when something changed, and "checked" either way.
//
// Deadlines:
// - "deadline_date" (YYYY-MM-DD) is the next closing date, when one is published.
// - Once that date has passed, this script marks the entry closed
//   ("closed_since", "closed_reason"). The page shows it as expired and says why.
// - A later deadline_date (or "rolling": true) opens it again.
// - "closed_reason" can also be given directly: a program on pause, a fund
//   that ended, no open window. "reopens" says when the next window is expected.
//
// Run tools/check.cjs afterwards.
const fs = require('fs')
const { LISTS, REGIONS, PHASES, KIT, DATE, MONTH, today: todayOf, now, humanDate, parseArgs, readInput, logRun } = require('./lib.cjs')

const { list: listName, by, note, files } = parseArgs(process.argv.slice(2))
const LIST = LISTS[listName]
const today = todayOf()

const TEXT = ['name', 'funder', 'type', 'region', 'amount', 'currency', 'priority', 'why_fit', 'priorities', 'eligibility', 'watch_out',
  'deadline', 'deadline_date', 'deadline_estimate', 'opens', 'decision', 'reopens', 'closed_since', 'closed_reason',
  'url', 'apply_url', 'guidelines_url', 'contact_email', 'contact_source', 'how_to_apply', 'tips',
  'fee', 'prize', 'festival_dates', 'premiere', 'notification', 'ask', 'offer']
const KEYS = [...TEXT, 'phases', 'amount_max', 'decision_weeks', 'rolling', 'questions', 'evidence']

// One spelling each, so the page's filters work.
const REGION = { federal: 'Canada', national: 'Canada', 'canada (federal)': 'Canada', on: 'Ontario', 'ontario, canada': 'Ontario', 'city of toronto': 'Toronto', qc: 'Quebec', québec: 'Quebec', montreal: 'Quebec', montréal: 'Quebec', ab: 'Alberta', ph: 'Philippines', us: 'USA', 'u.s.': 'USA', 'united states': 'USA', global: 'International', worldwide: 'International' }
const PHASE = { dev: 'development', script: 'development', 'pre production': 'pre-production', preproduction: 'pre-production', prep: 'pre-production', shoot: 'production', shooting: 'production', post: 'post-production', 'post production': 'post-production', postproduction: 'post-production', completion: 'post-production', 'rough cut': 'post-production', release: 'distribution', festivals: 'distribution', 'finished film': 'distribution', marketing: 'distribution', exhibition: 'distribution' }
const TYPE = Object.fromEntries(LIST.types.map(t => [t.toLowerCase(), t]))
Object.assign(TYPE, { 'tax-credit': 'Tax credit', sponsorship: 'Sponsor', 'in kind': 'In-kind', crowdfund: 'Crowdfunding', 'pitch': 'Pitch competition', 'screenplay': 'Screenplay competition', 'screenwriting competition': 'Screenplay competition', 'project market': 'Market', 'co-production market': 'Market', 'film festival': 'Festival' })

const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const idOf = i => slug([i.funder, i.name].filter(Boolean).join(' ')).slice(0, 80).replace(/-+$/, '') || 'entry'
const unescape = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
const norm = v => (typeof v === 'string' ? unescape(v.trim()) : Array.isArray(v) ? v.map(norm) : v)
/** What counts as a change: everything except the bookkeeping dates. */
const snap = o => JSON.stringify({ ...o, checked: undefined, updated: undefined, updated_by: undefined })
const num = v => { const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined }

function clean(raw) {
  const e = {}
  for (const k of KEYS) {
    const v = raw[k]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    e[k] = norm(v)
  }
  if (e.type) e.type = TYPE[String(e.type).toLowerCase()] || e.type
  if (e.region) e.region = REGIONS.find(r => r.toLowerCase() === String(e.region).toLowerCase()) || REGION[String(e.region).toLowerCase()] || e.region
  if (e.phases !== undefined) {
    const arr = (Array.isArray(e.phases) ? e.phases : String(e.phases).split(/[,/]/)).map(p => String(p).trim().toLowerCase())
    e.phases = [...new Set(arr.map(p => (PHASES.includes(p) ? p : PHASE[p])).filter(Boolean))].sort((a, b) => PHASES.indexOf(a) - PHASES.indexOf(b))
    if (!e.phases.length) delete e.phases
  }
  for (const k of ['amount_max', 'decision_weeks']) if (e[k] !== undefined) { e[k] = num(e[k]); if (e[k] === undefined) delete e[k] }
  if (e.rolling !== undefined) e.rolling = e.rolling === true || e.rolling === 'true'
  if (e.rolling === false) delete e.rolling
  for (const k of ['deadline_date', 'opens', 'closed_since']) if (e[k] && !DATE.test(e[k])) delete e[k]
  if (e.deadline_estimate && !MONTH.test(e.deadline_estimate)) e.deadline_estimate = String(e.deadline_estimate).slice(0, 7)
  if (e.deadline_estimate && !MONTH.test(e.deadline_estimate)) delete e.deadline_estimate
  if (e.priority !== undefined && !['A', 'B', 'C'].includes(String(e.priority).toUpperCase())) delete e.priority
  else if (e.priority) e.priority = String(e.priority).toUpperCase()
  if (e.contact_email && !e.contact_source) delete e.contact_email // only addresses with a source page
  if (e.evidence && !Array.isArray(e.evidence)) e.evidence = [e.evidence]
  if (e.evidence) e.evidence = e.evidence.filter(u => /^https?:\/\//.test(u))
  if (e.questions) {
    e.questions = (Array.isArray(e.questions) ? e.questions : []).map(q => (typeof q === 'string' ? { q } : q)).filter(q => q && q.q).map(q => {
      const o = { q: norm(String(q.q)) }
      if (q.limit) o.limit = norm(String(q.limit))
      o.kit = KIT.includes(q.kit) ? q.kit : 'custom'
      if (q.hint) o.hint = norm(String(q.hint))
      return o
    })
    if (!e.questions.length) delete e.questions
  }
  return e
}

const original = fs.existsSync(LIST.file) ? fs.readFileSync(LIST.file, 'utf8') : ''
const db = original ? JSON.parse(original) : { updated: today, items: [] }
const items = db.items
const byId = new Map(items.map(i => [i.id, i]))
const byPair = new Map(items.map(i => [slug(i.funder) + '|' + slug(i.name), i]))
const closedBefore = new Set(items.filter(i => i.closed_reason).map(i => i.id))

const added = [], updated = []
for (const file of files) {
  const data = readInput(file)
  for (const raw of Array.isArray(data) ? data : (data.items || [])) {
    if (!raw || typeof raw !== 'object') continue
    const e = clean(raw)
    if (!e.name || !e.funder) { console.warn(`  skipped (needs name and funder): ${e.name || e.funder || JSON.stringify(raw).slice(0, 80)}`); continue }
    const id = idOf(e)
    const existing = byId.get(id) || byPair.get(slug(e.funder) + '|' + slug(e.name))
    if (existing) {
      const was = snap(existing)
      for (const [k, v] of Object.entries(e)) {
        if (k === 'evidence') existing.evidence = [...new Set([...(existing.evidence || []), ...v])].slice(0, 8)
        else existing[k] = v
      }
      // A closing date still ahead (or a rolling intake) opens a closed entry again, unless this input closes it.
      const ahead = (e.deadline_date && e.deadline_date >= today) || e.rolling
      if (ahead && !e.closed_reason && existing.closed_reason) {
        delete existing.closed_since
        delete existing.closed_reason
      }
      if (e.deadline_date && e.deadline_date >= today) delete existing.deadline_estimate
      if (snap(existing) !== was) {
        existing.updated = today
        existing.updated_by = by
        if (!updated.includes(existing.id)) updated.push(existing.id)
      }
      existing.checked = today
    } else {
      let uid = id, n = 2
      while (byId.has(uid)) uid = `${id}-${n++}`
      const rec = { id: uid, added: today, added_by: by, checked: today, priority: 'B', ...e }
      items.push(rec)
      byId.set(uid, rec)
      byPair.set(slug(rec.funder) + '|' + slug(rec.name), rec)
      added.push(uid)
    }
  }
}

// Deadlines that have passed: expired, and why.
for (const i of items) {
  if (i.deadline_date && i.deadline_date < today && !i.closed_reason && !i.rolling) {
    i.closed_since = i.deadline_date
    i.closed_reason = `The deadline passed on ${humanDate(i.deadline_date)}.`
  }
  if (i.closed_reason && !i.closed_since) i.closed_since = today
}
const closed = items.filter(i => i.closed_reason && !closedBefore.has(i.id)).map(i => i.id)
const reopened = [...closedBefore].filter(id => byId.get(id) && !byId.get(id).closed_reason)

db.items = items
let text = JSON.stringify(db, null, 2) + '\n'
if (text !== original) {
  db.updated = today
  text = JSON.stringify(db, null, 2) + '\n'
  fs.writeFileSync(LIST.file, text)
}

const summary = [
  added.length && `${added.length} new`,
  updated.length && `${updated.length} updated`,
  closed.length && `${closed.length} expired`,
  reopened.length && `${reopened.length} open again`,
].filter(Boolean).join(', ') || 'Nothing new'
logRun(LIST.runs, { at: now(), by, added, updated, closed, reopened, note: note || `${summary}.` })
console.log(`${listName}.json: ${summary.toLowerCase()}; ${items.length} in total. Run logged (by ${by}).`)
for (const id of closed) console.log(`  expired: ${id}: ${byId.get(id).closed_reason}`)
for (const id of reopened) console.log(`  open again: ${id}`)
