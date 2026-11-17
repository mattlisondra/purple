// Checks data/funding.json, data/competitions.json, their run logs and the sealed
// data/project.enc.json and data/locations.enc.json before they are committed. Exit code 1 on any problem.
//
//   node tools/check.cjs                 (both lists)
//   node tools/check.cjs --list funding  (one list)
const fs = require('fs')
const path = require('path')
const { ROOT, LISTS, REGIONS, PHASES, KIT, BY, DATE, MONTH, today: todayOf, checkRuns } = require('./lib.cjs')

const today = todayOf()
const argv = process.argv.slice(2)
const only = argv[argv.indexOf('--list') + 1]
const names = argv.includes('--list') ? [only] : Object.keys(LISTS)
if (names.some(n => !LISTS[n])) { console.error(`--list must be one of: ${Object.keys(LISTS).join(', ')}`); process.exit(1) }

const problems = []
const URL_KEYS = ['url', 'apply_url', 'guidelines_url', 'contact_source']

for (const name of names) {
  const LIST = LISTS[name]
  let db
  try { db = JSON.parse(fs.readFileSync(LIST.file, 'utf8')) } catch (e) { problems.push(`${name}.json: not valid JSON (${e.message})`); continue }
  if (!DATE.test(db.updated || '')) problems.push(`${name}.json: "updated" must be a YYYY-MM-DD date`)
  if (!Array.isArray(db.items)) { problems.push(`${name}.json: "items" must be a list`); continue }
  const ids = new Set()
  for (const [n, i] of db.items.entries()) {
    const at = `${name} #${n} ${i.id || '(no id)'}`
    if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(i.id || '')) problems.push(`${at}: id must be lowercase letters, digits and dashes`)
    if (i.id && i.id.startsWith('m-')) problems.push(`${at}: ids starting with m- are kept for entries you add by hand on the page`)
    if (ids.has(i.id)) problems.push(`${at}: duplicate id`)
    ids.add(i.id)
    if (!i.name || !i.funder) problems.push(`${at}: needs name and funder`)
    if (!LIST.types.includes(i.type)) problems.push(`${at}: type must be one of ${LIST.types.join(', ')}`)
    if (!REGIONS.includes(i.region)) problems.push(`${at}: region must be one of ${REGIONS.join(', ')}`)
    if (!['A', 'B', 'C'].includes(i.priority)) problems.push(`${at}: priority must be A, B or C`)
    if (!i.why_fit) problems.push(`${at}: why_fit is empty`)
    if (!/^https?:\/\//.test(i.url || '')) problems.push(`${at}: url (the official page) is required`)
    if (!DATE.test(i.added || '')) problems.push(`${at}: added must be YYYY-MM-DD`)
    if (!BY.includes(i.added_by)) problems.push(`${at}: added_by must be one of ${BY.join(', ')} (run merge.cjs, which sets it)`)
    if (i.updated_by !== undefined && !BY.includes(i.updated_by)) problems.push(`${at}: updated_by must be one of ${BY.join(', ')}`)
    for (const k of ['checked', 'updated', 'deadline_date', 'opens', 'closed_since']) if (i[k] !== undefined && !DATE.test(i[k])) problems.push(`${at}: ${k} must be YYYY-MM-DD`)
    if (i.deadline_estimate !== undefined && !MONTH.test(i.deadline_estimate)) problems.push(`${at}: deadline_estimate must be YYYY-MM`)
    if (i.phases !== undefined && (!Array.isArray(i.phases) || i.phases.some(p => !PHASES.includes(p)))) problems.push(`${at}: phases must be a list of ${PHASES.join(', ')}`)
    for (const k of ['amount_max', 'decision_weeks']) if (i[k] !== undefined && !(typeof i[k] === 'number' && i[k] > 0)) problems.push(`${at}: ${k} must be a positive number`)
    if (i.closed_since && !i.closed_reason) problems.push(`${at}: closed_since needs closed_reason (why it is not available)`)
    if (i.deadline_date && i.deadline_date < today && !i.closed_reason && !i.rolling) problems.push(`${at}: the deadline ${i.deadline_date} has passed; run merge.cjs to mark it expired`)
    if (i.contact_email) {
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(i.contact_email)) problems.push(`${at}: contact_email looks wrong`)
      if (!/^https?:\/\//.test(i.contact_source || '')) problems.push(`${at}: an email needs contact_source, the page where it is published`)
    }
    for (const k of URL_KEYS) if (i[k] && !/^https?:\/\//.test(i[k])) problems.push(`${at}: ${k} must be a full http(s) URL`)
    if (i.evidence && (!Array.isArray(i.evidence) || i.evidence.some(u => !/^https?:\/\//.test(u)))) problems.push(`${at}: evidence must be a list of URLs`)
    if (i.questions && (!Array.isArray(i.questions) || i.questions.some(q => !q.q || !KIT.includes(q.kit)))) problems.push(`${at}: each question needs q and a kit key (${KIT.join(', ')})`)
  }
  problems.push(...checkRuns(LIST.runs))

  const count = k => Object.entries(db.items.reduce((m, i) => ((m[i[k] || '?'] = (m[i[k] || '?'] || 0) + 1), m), {})).map(([a, b]) => `${a} ${b}`).join(', ')
  const open = db.items.filter(i => i.deadline_date && !i.closed_reason).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date))
  console.log(`${name}: ${db.items.length} entries (updated ${db.updated})`)
  console.log(`  by type: ${count('type')}`)
  console.log(`  by region: ${count('region')}`)
  console.log(`  by priority: ${count('priority')}`)
  console.log(`  added by: ${count('added_by')}`)
  console.log(`  rolling: ${db.items.filter(i => i.rolling).length}; with application questions: ${db.items.filter(i => i.questions).length}`)
  console.log(`  open deadlines: ${open.map(i => `${i.deadline_date} ${i.funder}: ${i.name}`).join('; ') || 'none'}`)
  console.log(`  expired or not open now: ${db.items.filter(i => i.closed_reason).length}`)
  try {
    const runs = JSON.parse(fs.readFileSync(LIST.runs, 'utf8')).runs || []
    const last = runs[runs.length - 1]
    if (last) console.log(`  last run: ${last.at} by ${last.by}: ${last.note || ''}`.slice(0, 220))
  } catch { /* reported above */ }
}

// The private files are published only encrypted (tools/seal.cjs); the plain copies stay on Matthew's computer.
// Every sealed file must use the same salt, so one password unlocks every page.
let firstSalt = null
for (const [plain, sealed, required] of [['project.json', 'project.enc.json', true], ['locations.json', 'locations.enc.json', false]]) {
  const SEALED = path.join(ROOT, 'data', sealed), PLAIN = path.join(ROOT, 'data', plain)
  if (!fs.existsSync(SEALED)) { if (required) problems.push(sealed + ': missing (run node tools/seal.cjs)'); continue }
  try {
    const box = JSON.parse(fs.readFileSync(SEALED, 'utf8'))
    if (!(box.v === 1 && box.iter > 0 && box.salt && box.iv && box.ct)) problems.push(sealed + ': not a sealed file (run node tools/seal.cjs)')
    else if (firstSalt && box.salt !== firstSalt) problems.push(sealed + ': sealed with a different salt from project.enc.json; run node tools/seal.cjs to re-seal both')
    else firstSalt = firstSalt || box.salt
  } catch (e) { problems.push(sealed + ': not valid JSON (' + e.message + ')') }
  if (fs.existsSync(PLAIN)) {
    try { JSON.parse(fs.readFileSync(PLAIN, 'utf8').replace(/^\uFEFF/, '')) } catch (e) { problems.push(plain + ': not valid JSON (' + e.message + ')') }
    if (fs.statSync(PLAIN).mtimeMs > fs.statSync(SEALED).mtimeMs + 1000)
      console.log('Note: data/' + plain + ' changed after it was sealed. Run node tools/seal.cjs so the pages show the change.')
  }
}

if (problems.length) { console.error(`\n${problems.length} problem(s):\n` + problems.join('\n')); process.exit(1) }
console.log('OK')
