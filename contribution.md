# Contributing to NavIC (frontend + backend)

NavIC CBTMS is our college bus tracking project.
- **NavIC-frontend**: the web app (React, Vite, Leaflet map).
- **NavIC-backend**: the server (Python, FastAPI, PostgreSQL, and a TCP receiver for tracking devices).

**The golden rule: never change `main` directly.** You make your own branch, push it, and open a Pull Request (PR). Hassaan reviews and merges it.

---

## Which repo do I change?

| I want to change... | Repo |
|---|---|
| What users see: pages, buttons, colours, the map | NavIC-frontend |
| Data, calculations, reports, alerts, login, the API | NavIC-backend |
| A feature that needs both (e.g. a new page that needs new data) | Open an Issue in both repos first, so we agree on the API before coding |

---

## One-time setup (about 15 minutes)

**1. Accept the invite** from the GitHub email (or github.com/notifications). Do it for each repo you were invited to.

**2. Install the tools.**
- Git: https://git-scm.com/downloads
- GitHub CLI: https://cli.github.com
- VS Code: https://code.visualstudio.com
- Frontend: Node.js (LTS) from https://nodejs.org
- Backend: Python 3 from https://python.org (the README lists the version)

Open a terminal (Windows: "Git Bash", Mac: "Terminal").

**3. Sign in to GitHub.**
```bash
gh auth login
```
Choose GitHub.com, then HTTPS, then "Login with a web browser". Copy the code it shows, press Enter, and paste the code in the browser.

**4. Tell git who you are (and hide your real email).**
Go to https://github.com/settings/emails, tick **Keep my email addresses private**, and copy the address that looks like `12345+yourname@users.noreply.github.com`. Then:
```bash
git config --global user.name "Your Name"
git config --global user.email "12345+yourname@users.noreply.github.com"
```

**5. Download the project.** Put both repos side by side in one folder:
```bash
mkdir NavIC && cd NavIC
git clone https://github.com/CorbenZen/NavIC-backend.git
git clone https://github.com/CorbenZen/NavIC-frontend.git
```
Frontend friends also need the backend running, so clone both.

---

## Run it

Start the **backend first**, then the **frontend**. Use two terminals.

**Terminal 1: backend.** Open `NavIC-backend/README.md` and follow it. It covers the Python environment, the `.env` file (copy `.env.example` to `.env` and edit the values), and the database. The backend needs PostgreSQL. The database is the trickiest part, so ask in the group if you get stuck.

**Terminal 2: frontend.**
```bash
cd NavIC-frontend
npm install
cp .env.example .env      # only if the README says you need it
npm run dev
```
Open http://localhost:5173. You should see the NavIC sign-in page.

**Good to know:** we don't have the real tracking hardware yet, so all vehicle data is simulated. Admin accounts for local testing are set in your own `.env` (see the backend README). Use a throwaway password. Once signed in as admin, open **Live tracking** and press **Start** in the Simulation box to get moving buses.

---

## Where things live

**Frontend**
| Folder | What's in it |
|---|---|
| `react-jsx/` | Pages and components (example: `react-jsx/pages/fleet/Devices.jsx`) |
| `javascript-services/` | Talking to the backend (`api.js`) |
| `css-styles/global/` | Global styles and the light/dark theme colours |
| `leaflet-react/` | The map |
| `public/` | Logo, icons, manifest, service worker |
| `scripts/` | Helper scripts, for example the browser smoke test |
| `docs/` | Documentation |

**Backend**
| Folder | What's in it |
|---|---|
| `backend/` | The FastAPI app: API routes, database models, logic |
| `navic_tcp/` | Receives data from tracking devices over TCP |
| `config/` | Settings |
| `scripts/` | Helper scripts (for example the NMEA replay tool) |
| `tests/` | Automated tests |
| `docs/` | Documentation (API notes) |
| `pyproject.toml` | Python dependencies and tool settings |

If you're not sure where something is, search for it in VS Code (Ctrl+Shift+F) or ask.

---

## Your first contribution (every time)

**1. Get the latest code.**
```bash
git checkout main
git pull
```
**2. Make your own branch.**
```bash
git checkout -b feature/short-description
```
**3. Make ONE small change** in VS Code.

**4. Check it before you share it.**
- **Frontend:** run `npm run check` (lint and build). Look at your change in **light mode AND dark mode** and in a narrow window. Use the shared components and theme colours instead of hardcoding colours.
- **Backend:** run `ruff check backend navic_tcp tests`, then `pytest`. If you add logic, add a test for it.

If the checks fail before you changed anything, tell Hassaan.

**5. Save and upload.**
```bash
git status               # read what you changed
git add -A
git commit -m "fix: short description of what you changed"
git push -u origin feature/short-description
```
Start commit messages with `feat:` (new thing), `fix:` (bug) or `docs:` (text only).

**6. Open a Pull Request.** git prints a link after the push. Open it, or click **Compare & pull request** on the repo page. Write what you changed and how you tested it (add a screenshot for UI changes), add `@CorbenZen`, and click **Create pull request**.

**7. After review.** If Hassaan asks for changes, edit the files, then `git add -A`, `git commit -m "..."`, `git push`. The PR updates itself. After it's merged:
```bash
git checkout main
git pull
```

---

## Project rules

1. Never push to `main`. One small change per PR.
2. **Never commit** `.env` files, passwords, tokens, database dumps (`.sql`), or screenshots showing real names, emails or USNs.
3. **Never fake data.** Simulated data stays labelled as simulated. If a value isn't reported, show "Not reported", not a made-up number.
4. Admin-only features stay admin-only, and the backend must check it (hiding a button isn't enough). Changing login or permissions? Ask first.
5. Reuse what exists: shared UI components (Badge, SearchInput, EmptyState, Avatar...) and the theme colours. Don't create a second version of something.
6. Don't use `git push --force`. Not sure? Ask first.

---

## Ideas for your first PR

**Frontend**
- Check each page in light mode for hard-to-read text and fix it.
- Add a friendly empty state or loading message where a page is blank.
- Improve the Live tracking layout on a phone-sized window.
- Add accessible labels to icon-only buttons.

**Backend**
- Add tests for report/trip edge cases (for example a vehicle sitting still, so many fixes share one position).
- Improve API error messages.
- Extend `docs/API.md` for one area.
- Have an idea for a new report or filter? Open an Issue first.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| `Permission denied`, `403`, or `repository not found` | You haven't accepted the invite or you're not signed in. Accept it, then run `gh auth login` again. |
| `Author identity unknown` | Do setup step 4. |
| You edited files while on `main` | Run `git checkout -b feature/my-change` (your edits come along), then continue from step 5. |
| GitHub rejects your push to `main` | You committed on `main` by mistake. Run `git checkout -b feature/my-change`, then `git push -u origin feature/my-change` and open a PR. After the PR is merged, fix local `main`: `git checkout main`, `git fetch`, `git reset --hard origin/main` (only after your branch is pushed). |
| The PR says "This branch has conflicts" | `git checkout main`, `git pull`, `git checkout feature/my-change`, `git merge main`. Git marks the clashing parts with `<<<<<<<`, `=======`, `>>>>>>>`. Edit the file so only the final code remains and delete the marker lines. Then `git add -A`, `git commit -m "merge main"`, `git push`. |
| `npm install` or the backend won't start | Copy the whole error and send it to Hassaan, with the step you were on. |
| Anything else | Send the full error message to Hassaan. Don't try random commands from the internet. |

## Prefer clicking? GitHub Desktop
Download it from https://desktop.github.com and sign in. Then **File, Clone repository**, pick the repo. Next, **Current Branch, New Branch**. Edit in VS Code. In GitHub Desktop, write a summary and click **Commit**, then **Publish branch**, then **Create Pull Request**.
