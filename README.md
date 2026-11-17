# PURPLE funding desk

Three private pages for **PURPLE**: two for finding and winning money (made the same way as gausyn's `/raise` and `/competition`) and one for locations and the shooting schedule:

| Page | What it is for |
|---|---|
| `purple-funding.html` | Grants, funds, tax credits, in-kind help, sponsors and crowdfunding for pre-production, production and post-production, with deadlines; your budget gap; an application draft for each one |
| `purple-competitions.html` | Pitch competitions, labs, markets, screenplay contests and festivals for the finished film, with deadlines, fees, prizes and premiere rules |
| `purple-locations.html` | Every location in the script with researched options (why it fits, permission, cost, risks, links), the scene breakdown, a rough day-by-day shooting schedule in four arcs, four budget versions broken down by arc, and the permit and child-performer rules for each province and the Philippines |

It is a static site: plain HTML, CSS and JavaScript, with no build step, published with GitHub Pages from the repository `mattlisondra/purple`:

- https://mattlisondra.com/purple/purple-funding.html
- https://mattlisondra.com/purple/purple-competitions.html
- https://mattlisondra.com/purple/purple-locations.html

## What each page does

- **The list.** Each card says why it fits PURPLE, the amount or prize, who can apply, what to watch out for, and the deadline. Tags show **Closes in N days** (red in the last week), **Rolling**, **Expected (date not announced)** or **Expired**. Expired entries say when they closed and when the next window is expected. Filter by type, place, phase, priority, open or expired, and your status.
- **Tracking.** On each card: your status (interested, preparing, submitted, awarded…), the amount you ask for, what you were awarded, the date you submitted, and notes.
- **Draft application.** Builds a copy-and-paste draft for that funder from your **Application kit**. It fills in the funder's name, the amount, what the money pays for (from the phases it funds), your budget numbers, and your other applications. When the research found the funder's actual questions and word limits, the draft follows them and counts words against each limit. Anything in [square brackets] is for you to fill in. Sponsors get an email, a one-page summary and a follow-up; crowdfunding gets the campaign page; festivals get the programmer note, technical details and premiere status.
- **Deadlines.** Every date month by month, plus a calendar file (.ics) with a reminder a week before each one.
- **Budget** (funding page). From `Budget Breakdown_v6 - JUNE 2026.xlsx`: $47,335 in total, what is in hand (edit it), awarded and waiting (from your cards), what is still to raise, the minimum cash to shoot, and when money is needed for each phase.
- **Updates.** Every research run, including the ones that found nothing, and a status line at the top: green when the scheduled research reports on time, red when it does not.

## Try it on this computer

Double-click **`preview.bat`**. It opens http://localhost:8000/purple-funding.html (it needs Python, which is installed). Opening the HTML file directly does not work, because browsers do not let a page opened as a file read its lists.

## Where things are

```
purple-funding.html          the funding page
purple-competitions.html     the competitions page
purple-locations.html        the locations and schedule page
assets/purple.css            the look (colours at the top)
assets/purple.js             everything the funding and competitions pages do
assets/locations.js          everything the locations page does
data/funding.json            the researched funding list        (research runs update it)
data/competitions.json       the researched competitions list   (research runs update it)
data/*-runs.json             the log of research runs and the schedule
data/project.enc.json        the film, the budget, the timeline and the Application kit, encrypted with the password (published)
data/project.json            the same, readable; on this computer only, never published
data/locations.enc.json      scenes, locations, schedule and rules, encrypted with the password (published)
data/locations.json          the same, readable; on this computer only, never published (it has the house address)
tools/merge.cjs              adds research to a list, closes passed deadlines, logs the run
tools/check.cjs              checks the lists before they are committed
tools/seal.cjs               encrypts data/project.json and data/locations.json into their .enc.json copies
RESEARCH-GUIDE.md            the rules every research run follows
ROUTINES.md                  the four scheduled routines (daily and weekly, for each page)
preview.bat                  opens the pages on this computer
```

## Your data stays in your browser

Statuses, notes, amounts, drafts and edits to the Application kit are saved in the browser you use (localStorage), not in the published files. Nobody else sees them, but clearing browser data or changing computers loses them. Use **Backup → Save a backup** now and then, and **Restore a backup** on another computer.

To change the kit's starting text for good (for example after you rewrite the director's statement), ask Claude to update `data/project.json`, or edit it yourself, then run `node tools/seal.cjs` and push. The pages only read the encrypted copy.

## The locations page

- **The plan**: the four arcs (East, GTA, Alberta, the Philippines) with their days and pages, how many days and why, the decisions to make, what to watch out for, the light and moon for each block's dates, every day in calendar order, and the check of the Montreal list.
- **Locations**: one card per place in the script: the scenes, what the scene needs, our pick, how to fake or double it, and 2 to 6 real options, each with why it fits, the permission it needs, the day's practicalities, cost, risk, a map link and official links, tagged by how sure the research is. Mark options as shortlisted, booked or ruled out, with a note (kept in this browser).
- **Schedule**: every day with call and wrap, light, scenes, cast, child hours, moves and an hour-by-hour plan. The page works out each day's length and the rest since the previous day, and turns them red if a day runs over 11 hours or the rest is under 12. **Who works which days** lists every part.
- **Budget**: four versions side by side and line by line, each broken down by arc: **v1** the spreadsheet as it is; **v2** the full plan on the Schedule tab (every exterior at the real place); **v3** the same money as today ($47,335) with every real exterior; **v4** starting with the $16,000 in hand (Arcs 1 and 2 now, 3 and 4 when funded). Each line shows what is paid at the shoot, what is paid later and what has to come in kind. All cast non-ACTRA, at the spreadsheet's rates.
- **Scenes**: all 104 scenes with page, length in eighths, cast, where each is shot and on which day; filter by arc, cast member or day and night.
- **Permits and rules**: by province (and the Philippines), with official links.

To change it (a new option, a booked location, a moved day), ask Claude to edit `data/locations.json`, or edit it yourself, then `node tools/seal.cjs` and push.

## The password

All three pages open with a password (the one you gave Claude in November 2026). The password is not written anywhere. Instead, the film's details (logline, synopses, statement, budget, team, timeline and the Application kit) and the locations page (scenes, locations, schedule, the house address) are published only **encrypted with it**, in `data/project.enc.json` and `data/locations.enc.json` (AES-256-GCM, key from PBKDF2-SHA256, the same salt for both, so one unlock opens every page). The page checks the password by decrypting, so without the password those details cannot be read, on the site or on GitHub. A browser stays unlocked for 30 days; **Lock** (top right, or the Backup tab) signs it out of all three pages.

- After editing `data/project.json` or `data/locations.json`: `node tools/seal.cjs` (asks for the password; files that did not change are left alone), then commit and push.
- To change the password: `node tools/seal.cjs --new-password`, then push. Every browser asks for the new one.
- To turn the password off: set `SEALED` to `''` at the top of `assets/purple.js` and publish `data/project.json` (remove it from `.gitignore`).

**What stays readable.** The repository is public, because GitHub Pages on the free plan only works for public repositories. So these are readable by anyone who opens it on github.com:

- the funding and competitions lists (`data/*.json`), including the "why it fits PURPLE" notes;
- `RESEARCH-GUIDE.md`, whose section 1 gives the film's facts for the research routines: a one-sentence story, the producers' names, the shoot dates and places, and the budget totals;
- the code and these notes.

The screenplay, the budget spreadsheet and other documents are **never published**: `.gitignore` leaves out every `.pdf`, `.xlsx` and `.docx` in this folder, and `data/project.json` and `data/locations.json`. The pages also tell search engines not to index them.

## Publishing

The folder is a git repository connected to https://github.com/mattlisondra/purple (public). GitHub Pages publishes `main` (root folder) to https://mattlisondra.com/purple/ (`mattlisondra.github.io` redirects to mattlisondra.com, so every Pages site on the account lives there). To publish a change:

```
node tools/check.cjs
git add -A
git commit -m "What changed"
git pull --rebase
git push
```

Pull before pushing: the research routines push to `main` too. The pages update a minute or two after a push. Then set up the routines (see [ROUTINES.md](ROUTINES.md)) so the lists update daily and weekly.

## Research by hand

Ask Claude for a research session at any time ("find more sponsors for the Alberta shoot", "check every deadline in the next two months"). It follows [RESEARCH-GUIDE.md](RESEARCH-GUIDE.md) and adds what it finds with:

```
node tools/merge.cjs --list funding --by research --note "what this run found" new.json
node tools/check.cjs
```
