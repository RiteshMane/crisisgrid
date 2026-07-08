# Deploying CrisisGrid — Step-by-Step Guide

This guide takes you from "code on my laptop" to "live URL on my GitHub
profile," entirely on free tiers: **MongoDB Atlas** (database), **Render**
(backend API), and **Vercel** (frontend).

---

## Part 1 — Push the code to GitHub

1. Create a new repository on GitHub (don't initialize it with a README —
   you already have one): [github.com/new](https://github.com/new)
2. From your project's root folder (the one containing `backend/`,
   `frontend/`, `README.md`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: CrisisGrid emergency operations platform"
   git branch -M main
   git remote add origin https://github.com/<your-username>/crisisgrid.git
   git push -u origin main
   ```
3. Double-check `backend/.env` and `frontend/.env` were **not** committed
   (they're excluded by `.gitignore` — verify with `git status` before
   committing; if you see `.env` listed, stop and fix `.gitignore` first).
4. On the GitHub repo page: click the gear icon next to "About" and add a
   short description + topics (`mern`, `react`, `nodejs`, `mongodb`,
   `socketio`, `ai`, `disaster-response`) — this helps the repo show up in
   searches and looks intentional to anyone visiting your profile.

---

## Part 2 — Database: MongoDB Atlas

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a
   free account, then create a new **free M0 cluster** (any cloud
   provider/region is fine — pick one close to where you'll deploy the
   backend).
2. **Database Access** (left sidebar) → Add New Database User → set a
   username and password (save these — you'll need them in the connection
   string). Give it "Read and write to any database."
3. **Network Access** (left sidebar) → Add IP Address → **Allow Access from
   Anywhere** (`0.0.0.0/0`). This is fine for a portfolio project; a real
   production system would restrict this to the backend host's IP.
4. **Database** → Connect → Drivers → copy the connection string. It looks
   like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Add your database name to the path so all your data lands in one place:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/crisisgrid?retryWrites=true&w=majority
   ```
   Keep this string somewhere safe — you'll paste it into Render next.

---

## Part 3 — Backend: Render

1. Go to [render.com](https://render.com) and sign up (GitHub sign-in is
   easiest — it can read your repos directly).
2. **New +** → **Web Service** → connect your `crisisgrid` GitHub repo.
3. Configure:
   - **Name**: `crisisgrid-api` (or anything — this becomes part of your URL)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Environment Variables** (Render's dashboard, not a `.env` file) — add
   each of these:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string from Part 2 |
   | `JWT_ACCESS_SECRET` | a long random string (generate below) |
   | `JWT_REFRESH_SECRET` | a different long random string |
   | `JWT_ACCESS_EXPIRES` | `15m` |
   | `JWT_REFRESH_EXPIRES` | `7d` |
   | `NODE_ENV` | `production` |
   | `DEMO_MODE` | `true` (or `false` if you have a Gemini key) |
   | `GEMINI_API_KEY` | *(optional — leave blank to use the offline AI)* |
   | `CLIENT_URL` | *(fill in after Part 4 — your Vercel URL)* |

   Generate the JWT secrets locally first:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Run it twice for two different secrets.
5. Click **Create Web Service**. Render will build and deploy — watch the
   logs; you should eventually see `CrisisGrid API listening on port ...`.
6. Once live, note your backend URL, e.g. `https://crisisgrid-api.onrender.com`.
   Test it: open `https://crisisgrid-api.onrender.com/api/health` in a
   browser — you should see a JSON success response.

   > **Free tier note:** Render's free web services spin down after 15
   > minutes of inactivity and take ~30-60 seconds to wake up on the next
   > request. This is normal — mention it if a live demo feels slow to load
   > the first time.

---

## Part 4 — Frontend: Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. **Add New** → **Project** → import your `crisisgrid` repo.
3. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite (should auto-detect)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
4. **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://crisisgrid-api.onrender.com/api` (your Render URL + `/api`) |
5. Click **Deploy**. Vercel builds and gives you a URL like
   `https://crisisgrid.vercel.app`.

---

## Part 5 — Connect them

The frontend and backend now exist but don't know about each other's final
URLs yet:

1. Go back to **Render** → your backend service → Environment → set
   `CLIENT_URL` to your Vercel URL (e.g. `https://crisisgrid.vercel.app`) →
   save (this triggers a redeploy).
2. If you change the Vercel URL later (custom domain, etc.), repeat this.

---

## Part 6 — Seed the production database

Run the seed script locally, pointed at your **production** Atlas
connection string, so the demo accounts and Mumbai Flood scenario exist on
the live site too:

```bash
cd backend
# Temporarily set MONGO_URI in your local .env to the Atlas string, or:
MONGO_URI="mongodb+srv://...crisisgrid" npm run seed
```

You only need to do this once (re-run any time you want to reset the demo
data back to its original state).

---

## Part 7 — Verify end to end

1. Open your Vercel URL.
2. Log in with a demo account (e.g. `eoc@demo.crisisgrid.app` / `Demo@1234`).
3. Confirm the map loads, incidents appear, and — most importantly — open a
   second browser/incognito window, log in as the citizen account, submit a
   report, and confirm it appears **live** on the EOC dashboard without a
   refresh. That live update is the single best thing to show off.

---

## Part 8 — Put it on your GitHub profile

1. On your repo page, add the live Vercel URL to the **About** section
   (gear icon → Website field) — this shows a clickable link right under
   the repo name.
2. **Pin the repo**: go to your GitHub profile → Customize your pins →
   select `crisisgrid`. This puts it front and center on your profile page.
3. Optionally, add a short project entry to your GitHub profile README (if
   you have one) or your resume, linking both the repo and the live demo
   URL.
4. Consider adding 2-3 screenshots to the repo's `README.md` (a screenshot
   of the EOC dashboard with the live map is the strongest one) — GitHub
   renders images inline, and it's often the first thing a visitor actually
   looks at before reading any text.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend loads but API calls fail (network error) | `VITE_API_URL` wrong, or CORS blocked | Confirm the exact Render URL + `/api`; confirm `CLIENT_URL` on Render matches your exact Vercel URL (no trailing slash) |
| "MongoDB connection error" in Render logs | Wrong connection string, or IP not whitelisted | Re-check Atlas Network Access allows `0.0.0.0/0`; re-check username/password in the connection string (special characters in the password must be URL-encoded) |
| Login works but refresh logs you out | Cookies blocked cross-site | Confirm both `CLIENT_URL` (backend) and `VITE_API_URL` (frontend) use `https://`, not `http://`, once deployed |
| First request after inactivity is very slow | Render free tier spin-down | Expected behavior on the free tier — not a bug |
| Seed script can't connect | Ran locally without the production `MONGO_URI` set | Pass it inline as shown in Part 6, or temporarily edit your local `.env` |
