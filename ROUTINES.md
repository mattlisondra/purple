# The four research routines

Four scheduled Claude routines keep both pages current. They run in the cloud on your Claude account, work in this repository on GitHub, and push to `main`, so GitHub Pages republishes the pages a minute or two later.

| Routine | When (Toronto time) | List | What it does |
|---|---|---|---|
| PURPLE weekly funding research | Mondays 11:00am | Funding | 5 to 12 new funders, sponsors and in-kind programs; re-checks every deadline that is close or only estimated, and the oldest entries |
| PURPLE daily funding scan | Tuesday to Sunday 8:30am | Funding | News from the last 3 days; deadlines in the next 14 days; intakes opening this week |
| PURPLE weekly competitions research | Mondays 1:00pm | Competitions | New pitch competitions, labs, markets, screenplay contests and festivals; re-checks dates and premiere rules |
| PURPLE daily competitions scan | Tuesday to Sunday 9:00am | Competitions | Calls that opened or changed in the last 3 days; deadlines in the next 14 days |

## Setting them up

They were created on 16 November 2026 for `mattlisondra/purple` and are listed at https://claude.ai/code/routines. To create them again (for example on another account), either:

- **Ask Claude:** "Set up the four PURPLE routines from ROUTINES.md for the repository `mattlisondra/purple`." Claude creates them and switches on the status line, or
- **Do it yourself** at https://claude.ai/code/routines: create one routine per prompt below, pick this repository, set the schedule in the table, and allow it to push to `main`.

Then, in `data/funding-runs.json` and `data/competitions-runs.json`, set `"active": true` on each schedule entry and add `"since": "<the first day it runs, YYYY-MM-DD>"`. The status line at the top of each page turns green when the runs report on time, amber while a run is due, and red when a scheduled run has not reported (open https://claude.ai/code/routines to see why: paused, out of usage, or failing).

Each run uses your Claude plan's usage. If that matters, switch the two daily competitions scans to three times a week (Tuesday, Thursday, Saturday) and change `"days"` to `[2, 4, 6]` to match.

---

## Prompt: PURPLE weekly funding research

```
You are the weekly funding researcher for PURPLE, an independent Filipino-Canadian feature film made from Toronto. You work in this repository. This is the week's deep run, so be thorough: plan on about 30 to 40 searches and page fetches, and work through section 2 of the guide (What to look for) one type at a time before deciding there is nothing new.

1. Read RESEARCH-GUIDE.md in full (section 1 has the film's budget and timeline), then data/funding.json for what is already on the list. Today's date is in Toronto time.
2. Re-check on the funders' own pages:
   - every entry whose deadline_date is in the next 60 days (still open? date or rules changed?),
   - every entry with a deadline_estimate in the next 4 months (has the real date been announced? if so set deadline_date),
   - every entry with closed_reason whose reopens text suggests it may be open again,
   - the 10 entries with the oldest "checked" date.
   Update amounts, eligibility, questions and links when they changed. If a program ended, give closed_reason.
3. Find 5 to 12 new opportunities not yet on the list: grants, funds, tax credits, in-kind help, sponsors and crowdfunding that PURPLE can really use. Look first at what pays for pre-production and production before May 2027, then post-production (September 2027 to February 2028). Use the "what to look for" list in the guide, and follow its fit, priority, deadline and source rules exactly. Fill "questions" from the application form whenever it is published.
4. Write the new and changed entries (only the fields you checked) as one JSON array to /tmp/new.json.
5. Run: node tools/merge.cjs --list funding --by weekly --note "<2 to 4 sentences: what is new, what changed, and every deadline in the next 30 days>" /tmp/new.json
   If you found nothing, run the same command without /tmp/new.json, with a note saying what you checked.
6. Run: node tools/check.cjs  (fix anything it reports and run it again until it prints OK).
7. Commit only the data folder, every time, even on a quiet day (the pages show each run): git add data && git commit -m "Weekly funding research: <one line> (<YYYY-MM-DD>)". Then git pull --rebase origin main and git push origin HEAD:main. If the push is refused, pull --rebase and push once more; if it is still refused, push to a branch named funding-research-<YYYY-MM-DD> and say so at the end.
8. Finish with one short paragraph: what is new, what changed, and every deadline in the next 30 days.
```

## Prompt: PURPLE daily funding scan

```
You are the daily funding scanner for PURPLE, an independent Filipino-Canadian feature film made from Toronto. You work in this repository. Keep this run short: about 10 to 15 searches.

1. Read RESEARCH-GUIDE.md (sections 1, 4, 5 and 7 at least) and data/funding.json. Today's date is in Toronto time.
2. Look for news from the last 3 days: Canadian film funding calls that opened, new programs, deadline changes, programs paused or ended. Check the main funders' news pages: Canada Council for the Arts, Telefilm Canada, the Canadian Independent Screen Fund, Ontario Arts Council, Ontario Creates, Toronto Arts Council, Canadian Heritage, the NFB, and the Film Development Council of the Philippines.
3. Re-check on the funders' own pages every entry whose deadline_date is in the next 14 days, and every entry whose "opens" date is in the next 7 days.
4. Only real, sourced changes or clearly fitting new entries go into /tmp/new.json (a JSON array, in the guide's format).
5. Run: node tools/merge.cjs --list funding --by daily --note "<1 to 3 sentences: what changed, and any deadline in the next 7 days>" /tmp/new.json
   If nothing changed, run it without /tmp/new.json and with --note "Nothing new today." plus the deadlines in the next 7 days, if any.
6. Run: node tools/check.cjs  (fix anything it reports).
7. Commit only the data folder, every time, even on a quiet day (the pages show each run): git add data && git commit -m "Daily funding scan: <one line> (<YYYY-MM-DD>)". Then git pull --rebase origin main and git push origin HEAD:main. If the push is refused, pull --rebase and push once more; if it is still refused, push to a branch named funding-scan-<YYYY-MM-DD> and say so at the end.
8. Finish with one short paragraph: what changed, or "Nothing new today.", and any deadline in the next 7 days.
```

## Prompt: PURPLE weekly competitions research

```
You are the weekly competitions researcher for PURPLE, an independent Filipino-Canadian feature film made from Toronto (finished script; shooting May to September 2027; post-production to February 2028; first screening planned January 2028). You work in this repository. This is the week's deep run, so be thorough: plan on about 30 to 40 searches and page fetches, and work through section 2 of the guide (What to look for) one type at a time before deciding there is nothing new.

1. Read RESEARCH-GUIDE.md in full (section 1 has the film's facts), then data/competitions.json for what is already on the list. Today's date is in Toronto time.
2. Re-check on the organizers' own pages (or their FilmFreeway pages):
   - every entry whose deadline_date is in the next 60 days,
   - every entry with a deadline_estimate in the next 4 months (has the call opened? set deadline_date, fee and dates),
   - every festival's premiere rules and fees when the new call is published,
   - the 10 entries with the oldest "checked" date.
3. Find 4 to 10 new entries not yet on the list: pitch competitions, project markets, labs, fellowships, reputable screenplay competitions, and festivals for the finished film in 2028 (Canadian, Asian-Canadian, Filipino, Asian-American, youth sections and top international). Follow the guide's fit, priority, deadline and source rules exactly, and give fee, prize, festival_dates, premiere and notification. In watch_out, say how a public screening in January 2028 affects premiere eligibility.
4. Write the new and changed entries as one JSON array to /tmp/new.json.
5. Run: node tools/merge.cjs --list competitions --by weekly --note "<2 to 4 sentences: what is new, what changed, and every deadline in the next 30 days>" /tmp/new.json
   If you found nothing, run it without /tmp/new.json, with a note saying what you checked.
6. Run: node tools/check.cjs  (fix anything it reports and run it again until it prints OK).
7. Commit only the data folder, every time, even on a quiet day (the pages show each run): git add data && git commit -m "Weekly competitions research: <one line> (<YYYY-MM-DD>)". Then git pull --rebase origin main and git push origin HEAD:main. If the push is refused, pull --rebase and push once more; if it is still refused, push to a branch named competitions-research-<YYYY-MM-DD> and say so at the end.
8. Finish with one short paragraph: what is new, what changed, and every deadline in the next 30 days.
```

## Prompt: PURPLE daily competitions scan

```
You are the daily competitions scanner for PURPLE, an independent Filipino-Canadian feature film made from Toronto. You work in this repository. Keep this run short: about 8 to 12 searches.

1. Read RESEARCH-GUIDE.md (sections 1, 4, 5 and 7 at least) and data/competitions.json. Today's date is in Toronto time.
2. Look for calls that opened or changed in the last 3 days: pitch competitions, labs, markets, screenplay competitions and festival submissions relevant to a Canadian fiction feature, especially Canadian, Asian-Canadian and Filipino ones.
3. Re-check on the organizers' pages every entry whose deadline_date is in the next 14 days (early-bird and regular deadlines, fees).
4. Only real, sourced changes or clearly fitting new entries go into /tmp/new.json (a JSON array, in the guide's format).
5. Run: node tools/merge.cjs --list competitions --by daily --note "<1 to 3 sentences>" /tmp/new.json
   If nothing changed, run it without /tmp/new.json and with --note "Nothing new today." plus the deadlines in the next 7 days, if any.
6. Run: node tools/check.cjs  (fix anything it reports).
7. Commit only the data folder, every time, even on a quiet day (the pages show each run): git add data && git commit -m "Daily competitions scan: <one line> (<YYYY-MM-DD>)". Then git pull --rebase origin main and git push origin HEAD:main. If the push is refused, pull --rebase and push once more; if it is still refused, push to a branch named competitions-scan-<YYYY-MM-DD> and say so at the end.
8. Finish with one short paragraph: what changed, or "Nothing new today.", and any deadline in the next 7 days.
```
