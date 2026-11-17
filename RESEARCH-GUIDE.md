# Research guide: finding money for PURPLE

Rules for every research run that adds to the two lists: the daily scans, the weekly research and any research session in a chat. Read all of it before searching.

| List | File | Page |
|---|---|---|
| Funding: grants, funds, tax credits, in-kind help, sponsors, crowdfunding | `data/funding.json` | `purple-funding.html` |
| Competitions: pitch competitions, screenplay contests, labs, markets, festivals | `data/competitions.json` | `purple-competitions.html` |

## 1. The film

| | |
|---|---|
| Title | **PURPLE** |
| Form | Narrative fiction feature (65-page script, so about 65 to 75 minutes; final runtime not yet known) |
| Writer and director | Matthew Lisondra, Toronto, Ontario. First feature. Was the AD on the short *Quiet Father* (Toronto, 2025) |
| Story | A Filipino-Canadian father, secretly dying, takes his 11-year-old son on a road trip from Toronto through Ottawa, Montreal and the Rockies, to his family and his late wife's memory, and finally home to the Philippines |
| Languages | English, Tagalog and French (subtitled) |
| Communities | Filipino-Canadian story, cast and director (racialized / BPOC creators) |
| Producers | Johnson Luong (producer and AD), Dinitha Vithanage, Brandon Worden |
| Shoot | May to June 2027 (Ottawa, Montreal), July 2027 (Alberta: Banff, Lake Louise, Jasper Dark Sky Preserve), September 2027 (the Philippines, with a local crew) |
| Post-production | September 2027 to February 2028; first screening planned for early January 2028 |
| Budget | $47,335 in total: $31,335 production, $16,000 post. About $16,000 is in hand, so the gap is about $31,000. The minimum cash needed while shooting is about $27,400 |
| Company | No production company, distributor or broadcaster confirmed yet. Treat the applicant as an individual Toronto artist unless an entry needs a company; then say so in `watch_out` |

## 2. What to look for

**Funding list.** Anything that pays for, or gives in kind, part of PURPLE's development, pre-production, production, post-production or release, open to a Toronto-based Canadian filmmaker:

- Arts councils and public funds: Canada Council for the Arts, Telefilm Canada (including Talent to Watch), the Canadian Independent Screen Fund for BPOC Creators, the NFB, Ontario Arts Council, Ontario Creates, Toronto Arts Council, Canadian Heritage, wage programs such as Canada Summer Jobs.
- Tax credits: federal (CPTC, CAVCO), Ontario (OFTTC), and any for shooting in Quebec, Alberta or the Philippines.
- Private and industry funds, foundations, broadcaster and streamer funds, diversity funds, Filipino-Canadian and Asian-Canadian programs.
- In-kind help: camera and lighting rental programs, post-production and sound houses, colour, DCP, festival sponsorships with equipment prizes.
- Sponsors: businesses whose customers are Filipino-Canadian; airlines, car rental and tourism boards on the route (Ottawa, Montreal, Banff, Lake Louise, Jasper, the Philippines); locations in the script (Canadian Museum of Nature, Notre-Dame Basilica, Parks Canada). Only those with a published way to ask for sponsorship or community support.
- Crowdfunding platforms that work for Canadian filmmakers, and any matching programs.
- The Philippines: Film Development Council of the Philippines (location incentives, co-production funds), NCCA, Department of Tourism.

**Competitions list.** Anything that gives money, in-kind services, mentorship or exposure for PURPLE at some stage:

- Pitch competitions and project markets (Canada, Asia, international) for fiction features.
- Screenplay competitions and fellowships with real prizes and a good name.
- Labs (writing, directing, producing) for first features, especially for racialized or Asian creators.
- Festivals for the finished film in 2028 (Canadian, Asian-Canadian, Filipino, Asian-American and top international), with their submission deadlines, fees and premiere rules.

**Not wanted:** programs only for documentaries, TV series, web series, animation or games; programs only for residents of other provinces or countries (unless PURPLE shoots there and can qualify); programs that ended; paid "competitions" with no reputation.

## 3. Fit and priority

- **A**: PURPLE can apply now (or by spring 2027) as an individual Toronto artist, and it could pay for a real part of the gap.
- **B**: a good fit, but needs something first (a corporation, a distributor or broadcaster, a co-producer, a recommender, a finished film) or comes later.
- **C**: a long shot, small, or far off.

`why_fit` says, in one or two sentences, why this one suits PURPLE specifically. `watch_out` says what could make PURPLE ineligible or what it needs first. Be honest: an entry that does not fit is better left out than added with a weak reason.

## 4. Deadlines (most important)

- `deadline_date` (YYYY-MM-DD) is the **next** published closing date. Only from the funder's own page, never guessed.
- `deadline` (text) is the full rule in words, with the time and time zone: "2 Feb 2027, 11:59pm ET (three intakes a year)".
- If the next date is not published yet, leave out `deadline_date`. Give `deadline_estimate` (YYYY-MM, the month expected from past years) and say in `reopens` what happened last time ("Last intake closed 1 Oct 2026; next expected October 2027").
- `rolling: true` when applications are taken at any time. Then give the lead time in `deadline` ("Apply at least 8 weeks before you need the money").
- `opens` (YYYY-MM-DD) when the intake opens on a known date.
- `decision` (text) and `decision_weeks` (number) for how long the answer takes, when published.
- The merge script closes any entry whose `deadline_date` has passed (`closed_since`, `closed_reason`). A later `deadline_date` opens it again. For a program with no open window, give `closed_reason` yourself and say when it reopens in `reopens`.
- Re-check dates on every weekly run. Dates move.

## 5. Every entry

```json
{
  "name": "Explore and Create: Research and Creation",
  "funder": "Canada Council for the Arts",
  "type": "Grant",
  "region": "Canada",
  "phases": ["development", "pre-production"],
  "amount": "Up to $25,000",
  "amount_max": 25000,
  "currency": "CAD",
  "priority": "A",
  "why_fit": "Why it suits PURPLE.",
  "priorities": "What the funder says it values, in its own terms, one to three sentences.",
  "eligibility": "Who can apply, in short.",
  "watch_out": "What could make PURPLE ineligible, or what it needs first.",
  "deadline": "Text, with time and time zone.",
  "deadline_date": "2027-02-02",
  "deadline_estimate": "2027-02",
  "rolling": false,
  "opens": "2026-12-01",
  "decision": "About 4 months after the deadline.",
  "decision_weeks": 16,
  "reopens": "When the next window is expected.",
  "url": "https://the official program page",
  "apply_url": "https://the portal or form",
  "guidelines_url": "https://the guidelines",
  "contact_email": "only if published",
  "contact_source": "https://the page where that email is published",
  "how_to_apply": "The steps, including any registration lead time.",
  "questions": [
    { "q": "The question or section, as the form asks it", "limit": "2,000 characters", "kit": "synopsis_long" }
  ],
  "tips": "Advice from the guidelines, juries or past recipients.",
  "evidence": ["https://sources"]
}
```

Only `name`, `funder`, `type`, `region`, `priority`, `why_fit` and `url` are required. Leave out what you do not know; never write "N/A" or "unknown".

**Types.** Funding: `Grant`, `Tax credit`, `Equity`, `Loan`, `In-kind`, `Sponsor`, `Crowdfunding`, `Wage subsidy`, `Program`. Competitions: `Pitch competition`, `Screenplay competition`, `Lab`, `Market`, `Festival`, `Fellowship`, `Award`.

**Regions.** `Canada`, `Ontario`, `Toronto`, `Ottawa`, `Quebec`, `Alberta`, `Philippines`, `USA`, `International`.

**Phases.** Any of `development`, `pre-production`, `production`, `post-production`, `distribution`. For competitions: a script stage is `development`, a rough cut is `post-production`, a finished film is `distribution`.

**Amounts.** `amount` in words as the funder says it. `amount_max` as a number in `currency` (CAD unless stated), only when there is a published maximum or prize.

**Competitions also have:** `fee` (entry fee, text), `prize` (text), `festival_dates` (text), `premiere` (premiere or status rules, text), `notification` (text).

**Sponsors also have:** `ask` (what to ask them for: cash, flights, a van, food, product, a location) and `offer` (what they get: credit, logo on the poster, screening tickets, posts). Only a published way to reach them: a sponsorship form, a community-giving page, or a published email.

**Questions.** When the guidelines or the form list the sections asked for, copy each one into `questions` with its length limit. Map each to the application kit with `kit`, one of: `logline`, `synopsis_short`, `synopsis_long`, `statement` (artistic or director's statement), `why_now`, `audience` (audience and impact), `representation` (community, culture and representation), `team`, `bio`, `previous_work`, `budget`, `funding_plan`, `use_of_funds`, `schedule`, `distribution`, `cover_letter`, `sponsor_pitch`. When none fits, use `"kit": "custom"` and add a `hint` with what to write. The page uses these to build a copy-and-paste draft for each entry.

## 6. Sources and contact rules

- Every entry needs `url`, the funder's own page. Put other sources in `evidence`.
- Only emails the organization publishes, with `contact_source`. Never guess an address.
- Facts must be current: the program still exists and its page was updated for the 2026 to 2027 cycle, or say in `watch_out` that it could not be confirmed.
- Today's date is in Toronto time. Write dates as YYYY-MM-DD.

## 7. How a run adds what it found

1. Write what you found as a JSON array to a file (for example `new.json`), one object per entry, in the form above. An entry already on the list (same funder and name) is updated field by field; nothing already filled in is blanked.
2. Merge, saying who ran it and what was found:
   ```
   node tools/merge.cjs --list funding --by weekly --note "What this run found" new.json
   node tools/merge.cjs --list competitions --by daily --note "Nothing new today."
   ```
   `--by` is `daily`, `weekly` or `research`. Run it even when nothing was found, so the page shows that the scan ran. It also closes every deadline that has passed.
3. Check: `node tools/check.cjs` (exit code 1 means a problem; fix it).
4. Commit the data files together (`data/*.json`) and push to `main`.

Never edit `added`, `added_by`, `checked`, `updated` or `updated_by` by hand; the merge sets them. Never touch `data/project.enc.json` or `data/locations.enc.json` (the film's details and the locations and schedule, encrypted with the site password); only people change them, with tools/seal.cjs.
