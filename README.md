# Lõma Production Studio

A real web app (React + Supabase) for Lõma's product costing, raw materials, stock, production log, and sales — the same app you've been using, now with a proper backend so code updates never touch your data again.

## How it's built

- **Frontend**: React (Vite) — the part you'll deploy to Netlify.
- **Backend/database**: Supabase (a hosted Postgres database) — where all your actual data lives, completely separate from the code.

This separation is the whole point: from now on, improving the app (new features, fixes) only touches the *code* on GitHub/Netlify. Your products, materials, stock, production log, and sales stay untouched in Supabase no matter how many times the app is updated.

---

## Part 1 — Set up Supabase (your database)

1. Go to **supabase.com** and sign up (free tier is enough for this).
2. Click **New project**. Pick any name (e.g. "loma-production"), set a database password (save it somewhere), pick the region closest to you, and create it. Wait ~2 minutes for it to finish provisioning.
3. Once it's ready, go to the **SQL Editor** (left sidebar) → **New query**.
4. Open the file **`supabase-schema.sql`** from this project, copy all of it, paste it into the SQL editor, and click **Run**. This creates all the tables.
5. Open a **New query** again, this time paste in **`supabase-data.sql`** (also included in this project) and click **Run**. This loads in your real, existing data — all your costed products, raw materials, production log, and July sales — so the app opens with everything already there.
6. Go to **Project Settings → API** (left sidebar, gear icon). You'll need two values from this page in Part 3:
   - **Project URL**
   - **anon public** key (a long string)

---

## Part 2 — Put the code on GitHub

1. Go to **github.com**, sign in (or create a free account).
2. Click **New repository**. Name it something like `loma-production-studio`. Keep it **Private** if you don't want it public. Don't add a README (this project already has one).
3. On your computer, unzip this project folder, then in a terminal inside that folder run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/loma-production-studio.git
   git push -u origin main
   ```
   (GitHub will show you these exact commands on the empty repo's page too — you can copy them from there instead.)

   No terminal on hand? GitHub also lets you drag-and-drop the whole unzipped folder onto the "Upload files" screen of a new repo — a little slower to update in future, but works for a one-time upload.

---

## Part 3 — Deploy on Netlify

1. Go to **netlify.com**, sign up, and choose **"Import from Git"** / **"Add new site" → "Import an existing project"**.
2. Connect your GitHub account and pick the `loma-production-studio` repository.
3. Netlify will auto-detect the build settings from `netlify.toml` (build command `npm run build`, publish folder `dist`) — you shouldn't need to change anything there.
4. Before deploying, go to **Site settings → Environment variables** and add:
   - `VITE_SUPABASE_URL` → paste your Supabase Project URL from Part 1
   - `VITE_SUPABASE_ANON_KEY` → paste your Supabase anon public key from Part 1
5. Click **Deploy site**. In about a minute, Netlify gives you a live URL (something like `loma-production-studio.netlify.app`) — that's your app, live on the internet.
6. Optional: in **Site settings → Domain management**, you can rename the auto-generated subdomain to something nicer, or connect a custom domain if you have one.

---

## From now on: how updates work

- **To change your data** (add a product, log a sale, etc.): just use the app normally at your Netlify URL. This goes straight to Supabase.
- **To change the app itself** (new feature, fix, design tweak): the code gets updated and pushed to GitHub, Netlify automatically rebuilds and redeploys within a minute or two — and your Supabase data is never touched by this process. This is the whole problem we were having before, permanently solved.

## Local development (optional)

If you ever want to run the app on your own computer before deploying:
```
npm install
cp .env.example .env
# edit .env and paste in your Supabase URL + anon key
npm run dev
```

## Notes on team access

Right now, anyone with your Netlify URL can view and edit everything — same as the artifact link you were using before, just faster and permanent. If you want actual logins (so only your 3 team members can get in, or so you can see who's editing without the name-prompt), Supabase has a built-in Auth system that can be added later — just ask when you're ready for that.
