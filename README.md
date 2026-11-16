# PURPLE funding desk

Two private pages for finding and winning money for **PURPLE**, made the same way as gausyn's `/raise` and `/competition`:

| Page | What it is for |
|---|---|
| `purple-funding.html` | Grants, funds, tax credits, in-kind help, sponsors and crowdfunding for pre-production, production and post-production, with deadlines; your budget gap; an application draft for each one |
| `purple-competitions.html` | Pitch competitions, labs, markets, screenplay contests and festivals for the finished film, with deadlines, fees, prizes and premiere rules |

It is a static site: plain HTML, CSS and JavaScript, with no build step, published with GitHub Pages from the repository `mattlisondra/purple`:

- https://mattlisondra.com/purple/purple-funding.html
- https://mattlisondra.com/purple/purple-competitions.html

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
assets/purple.css            the look (colours at the top)
assets/purple.js             everything the pages do; the password hash is at the top
data/funding.json            the researched funding list        (research runs update it)
data/competitions.json       the researched competitions list   (research runs update it)
data/*-runs.json             the log of research runs and the schedule
data/project.enc.json        the film, the budget, the timeline and the Application kit, encrypted with the password (published)
data/project.json            the same, readable; on this computer only, never published
tools/merge.cjs              adds research to a list, closes passed deadlines, logs the run
tools/check.cjs              checks the lists before they are committed
tools/seal.cjs               encrypts data/project.json into data/project.enc.json
RESEARCH-GUIDE.md            the rules every research run follows
ROUTINES.md                  the four scheduled routines (daily and weekly, for each page)
preview.bat                  opens the pages on this computer
```

## Your data stays in your browser

Statuses, notes, amounts, drafts and edits to the Application kit are saved in the browser you use (localStorage), not in the published files. Nobody else sees them, but clearing browser data or changing computers loses them. Use **Backup → Save a backup** now and then, and **Restore a backup** on another computer.

To change the kit's starting text for good (for example after you rewrite the director's statement), ask Claude to update `data/project.json`, or edit it yourself, then run `node tools/seal.cjs` and push. The pages only read the encrypted copy.

## The password

Both pages open with a password (the one you gave Claude in November 2026). The password is not written anywhere. Instead, the film's details (logline, synopses, statement, budget, team, timeline and the Application kit) are published only **encrypted with it**, in `data/project.enc.json` (AES-256-GCM, key from PBKDF2-SHA256). The page checks the password by decrypting that file, so without the password those details cannot be read, on the site or on GitHub. A browser stays unlocked for 30 days; **Lock** (Backup tab) signs it out.

- After editing `data/project.json`: `node tools/seal.cjs` (asks for the password), then commit and push.
- To change the password: `node tools/seal.cjs --new-password`, then push. Every browser asks for the new one.
- To turn the password off: set `SEALED` to `''` at the top of `assets/purple.js` and publish `data/project.json` (remove it from `.gitignore`).

**What stays readable.** The repository is public, because GitHub Pages on the free plan only works for public repositories. So these are readable by anyone who opens it on github.com:

- the funding and competitions lists (`data/*.json`), including the "why it fits PURPLE" notes;
- `RESEARCH-GUIDE.md`, whose section 1 gives the film's facts for the research routines: a one-sentence story, the producers' names, the shoot dates and places, and the budget totals;
- the code and these notes.

The screenplay, the budget spreadsheet and other documents are **never published**: `.gitignore` leaves out every `.pdf`, `.xlsx` and `.docx` in this folder, and `data/project.json`. The pages also tell search engines not to index them.

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
