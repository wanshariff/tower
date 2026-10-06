# Tower

A quiet, list-first task app for personal and freelance work. The interface lives here on GitHub Pages; **the data lives in your own Google Sheet** ("Tower Data"). Nothing is stored on this site.

- Live: https://wanshariff.github.io/tower/
- Preview with sample data (no sign-in): https://wanshariff.github.io/tower/?demo

## How it works

| Part | Where |
|---|---|
| Interface | `index.html`, `app.js` (no build step, no dependencies) |
| Master data | Google Sheet with tabs `Tasks`, `Projects`, `Files`, `Decisions` |
| Sign-in | Google Identity Services, scope `spreadsheets` only. The access token stays in memory. |
| Settings | `config.js` (OAuth client ID + sheet ID; neither is secret) |

The app reads the sheet on load and every 60 seconds, and writes one row at a time. Before every write it checks that the row still holds the same ID, so editing the sheet by hand at the same time is safe.

## One-time setup

1. **Google Cloud Console** → create a project called `Tower`.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **Google Auth Platform** (OAuth consent screen) → External → app name `Tower` → add your Gmail under **Audience → Test users**.
4. **Clients → Create client → Web application** → Authorized JavaScript origins: `https://wanshariff.github.io` → copy the Client ID.
5. Put the Client ID in `config.js` (or paste it on the setup screen; it is then saved in that browser only).
6. **Repo Settings → Pages** → Source: *Deploy from a branch* → `main` / root.

While the Google app is in *Testing* mode you will see an "unverified app" screen on first sign-in. That is expected for a personal app: click **Continue**.

## Sheet format

| Tab | Columns |
|---|---|
| Tasks | ID, List, Title, Done, Flagged, Due (YYYY-MM-DD), Priority (None/Low/Medium/High), Notes, Link, Estimate, Source, Created, Completed, Updated, Log |
| Projects | ID, Name, Color, Status, Type, Client, Home, Milestone, Notes, Order |
| Files | ID, List, Title, Kind, URL, Notes |
| Decisions | ID, List, Decision, Status (Locked/Assumed/Revised), Source, Date, Replaces |

Extra columns you add on the right are kept untouched.

## Keyboard

`↑ ↓` select · `Space` complete · `Return` rename · `i` details · `f` flag · `⌫` delete (with undo) · `n` new task · `/` search · `Esc` close
