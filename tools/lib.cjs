// Shared by tools/merge.cjs and tools/check.cjs: the two lists, the allowed
// values, dates in Toronto time, reading research files, and the run log.
//
// Every research run is logged in data/<list>-runs.json, including runs that
// found nothing. The pages show the log under Updates, so you can see that the
// daily scan and the weekly research really ran.
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const LISTS = {
  funding: {
    file: path.join(ROOT, 'data', 'funding.json'),
    runs: path.join(ROOT, 'data', 'funding-runs.json'),
    types: ['Grant', 'Tax credit', 'Equity', 'Loan', 'In-kind', 'Sponsor', 'Crowdfunding', 'Wage subsidy', 'Program'],
  },
  competitions: {
    file: path.join(ROOT, 'data', 'competitions.json'),
    runs: path.join(ROOT, 'data', 'competitions-runs.json'),
    types: ['Pitch competition', 'Screenplay competition', 'Lab', 'Market', 'Festival', 'Fellowship', 'Award'],
  },
}
const REGIONS = ['Canada', 'Ontario', 'Toronto', 'Ottawa', 'Quebec', 'Alberta', 'Philippines', 'USA', 'International']
const PHASES = ['development', 'pre-production', 'production', 'post-production', 'distribution']
const KIT = ['logline', 'synopsis_short', 'synopsis_long', 'statement', 'why_now', 'audience', 'representation', 'team', 'bio', 'previous_work', 'budget', 'funding_plan', 'use_of_funds', 'schedule', 'distribution', 'cover_letter', 'sponsor_pitch', 'custom']
/** Who ran it: the daily scan, the weekly research run, or a research session in a chat. */
const BY = ['daily', 'weekly', 'research']
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/

// Your date (Toronto), so a run late in the evening is not dated tomorrow.
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** 2026-11-18 -> "18 Nov 2026" */
const humanDate = d => { const [y, m, day] = String(d).split('-').map(Number); return `${day} ${MONTHS[m - 1]} ${y}` }

/** --list funding|competitions, --by daily|weekly|research, --note "text", then the files to merge (none is fine). */
function parseArgs(argv) {
  const out = { list: '', by: 'research', note: '', files: [] }
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k]
    if (a === '--list') out.list = String(argv[++k] || '')
    else if (a.startsWith('--list=')) out.list = a.slice(7)
    else if (a === '--by') out.by = String(argv[++k] || '')
    else if (a.startsWith('--by=')) out.by = a.slice(5)
    else if (a === '--note') out.note = String(argv[++k] || '')
    else if (a.startsWith('--note=')) out.note = a.slice(7)
    else if (a.startsWith('--')) { console.error(`Unknown flag ${a}`); process.exit(1) }
    else out.files.push(a)
  }
  if (!LISTS[out.list]) { console.error(`--list must be one of: ${Object.keys(LISTS).join(', ')}`); process.exit(1) }
  if (!BY.includes(out.by)) { console.error(`--by must be one of: ${BY.join(', ')}`); process.exit(1) }
  out.note = out.note.trim().slice(0, 1500)
  return out
}

/** A research file: JSON, or text with a ```json block in it. */
function readInput(file) {
  let text = fs.readFileSync(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // a byte-order mark from some editors
  const fence = /```json\s*([\s\S]*?)```/.exec(text)
  if (fence) text = fence[1]
  return JSON.parse(text)
}

/** Adds one run to a runs file (keeps the schedule and the last 400 runs). */
function logRun(file, run) {
  const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { schedule: [], runs: [] }
  db.runs = [...(db.runs || []), run].slice(-400)
  fs.writeFileSync(file, JSON.stringify(db, null, 2) + '\n')
}

/** Problems in a runs file, for check.cjs. */
function checkRuns(file) {
  const problems = []
  const name = path.relative(ROOT, file)
  let db
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { return [`${name}: not valid JSON (${e.message})`] }
  if (!Array.isArray(db.runs)) return [`${name}: "runs" must be a list`]
  if (!Array.isArray(db.schedule)) problems.push(`${name}: "schedule" must be a list`)
  for (const [n, s] of (db.schedule || []).entries()) {
    if (!BY.includes(s.by) || !s.label || !Array.isArray(s.days) || !/^\d{2}:\d{2}$/.test(s.time || '') || !s.tz) problems.push(`${name}: schedule #${n} needs by, label, days (0 = Sunday), time (HH:MM) and tz`)
    if (s.active !== undefined && typeof s.active !== 'boolean') problems.push(`${name}: schedule #${n}: active must be true or false`)
  }
  for (const [n, r] of db.runs.entries()) {
    const at = `${name}: run #${n}`
    if (!ISO.test(r.at || '')) problems.push(`${at}: "at" must be an ISO time in UTC (2026-11-15T12:07:57Z)`)
    if (!BY.includes(r.by)) problems.push(`${at}: "by" must be one of ${BY.join(', ')}`)
    for (const k of ['added', 'updated', 'closed', 'reopened']) if (r[k] !== undefined && !Array.isArray(r[k])) problems.push(`${at}: "${k}" must be a list of ids`)
    if (r.note !== undefined && typeof r.note !== 'string') problems.push(`${at}: "note" must be text`)
  }
  for (let n = 1; n < db.runs.length; n++) if (db.runs[n].at < db.runs[n - 1].at) { problems.push(`${name}: runs must be in time order (run #${n})`); break }
  return problems
}

module.exports = { ROOT, LISTS, REGIONS, PHASES, KIT, BY, DATE, MONTH, ISO, today, now, humanDate, parseArgs, readInput, logRun, checkRuns }
