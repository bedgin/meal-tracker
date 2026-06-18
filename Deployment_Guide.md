# Deploying the Meal Tracker to Vercel — Beginner's Guide

This guide walks you from zero to a live, testable app. You only do the one-time setup (Parts 1–4) once. After that, deploying a change is just "push to GitHub" (Part 5).

---

## The big picture (how Vercel testing works)

Vercel connects to a **GitHub repository** (a copy of the code stored on GitHub.com). From then on:

- Every time code is pushed to the **main branch**, Vercel rebuilds and updates your **production** site automatically.
- Every time code is pushed to a **different branch** (or a Pull Request is opened), Vercel builds a separate **Preview** deployment with its own private URL — perfect for testing a change before it goes live.

So the "deploy for testing" loop is: change code → push to GitHub → Vercel auto-builds → you open the URL. No manual upload step.

---

## Part 1 — Put the code on GitHub (one time)

The app code needs to live in a GitHub repo for Vercel to read it.

1. Create a free account at https://github.com if you don't have one.
2. Click the **+** (top right) → **New repository**. Name it `meal-tracker`, keep it **Private**, and create it.
3. GitHub will show you commands to push existing code. From the project folder on your computer, run (in a terminal):

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/meal-tracker.git
   git push -u origin main
   ```

   (If I'm building the code for you, I can set up the git files and tell you exactly what to run.)

> **Important:** make sure there's a `.gitignore` file that excludes `node_modules` and `.env*`. Secrets must never be pushed to GitHub — they go into Vercel directly (Part 4).

---

## Part 2 — Set up the database (one time)

This app needs a Postgres database. Vercel no longer hosts Postgres itself — you add one through the **Vercel Marketplace** (Neon is the recommended option and has a free tier). Vercel automatically wires the connection into your app.

1. In the Vercel dashboard, go to the **Storage** tab → **Create Database**.
2. Choose **Neon** (Serverless Postgres) and follow the prompts (the free plan is fine for testing).
3. When asked, **connect it to your project**. Vercel will automatically inject the database connection string as an environment variable (typically `DATABASE_URL`) — you don't have to copy/paste it.

---

## Part 3 — Import the project into Vercel (one time)

1. Sign in at https://vercel.com using **"Continue with GitHub"** (this links the two accounts).
2. Click **Add New… → Project**.
3. Find your `meal-tracker` repo in the list and click **Import**. (The first time, you'll authorize Vercel to access your GitHub repos — you can grant access to just this one.)
4. Vercel auto-detects that it's a **Next.js** app and fills in the build settings for you. You don't need to change them.
5. **Before clicking Deploy**, add the environment variables (Part 4).

---

## Part 4 — Add environment variables (one time, with occasional additions)

Environment variables are the secret values the app needs that should never be in the code. In the import screen (or later under **Project → Settings → Environment Variables**), add:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Database connection (auto-added in Part 2 if you connected Neon to the project) |
| `USDA_API_KEY` | Your free key for the nutrition lookup — get one at https://fdc.nal.usda.gov/api-key-signup.html |
| `NEXTAUTH_SECRET` | A random string used to secure logins. Generate one by running `openssl rand -base64 32` in a terminal |
| `NEXTAUTH_URL` | Your site's URL (e.g. `https://meal-tracker.vercel.app`) — set after the first deploy when you know the URL |

Notes:
- Vercel lets you set different values for **Production**, **Preview**, and **Development**. For testing, applying them to all three is simplest.
- Anything that should be readable in the browser must start with `NEXT_PUBLIC_`. Secrets (API keys, DB URL) must **not** have that prefix.
- After adding or changing a variable, you must **redeploy** for it to take effect (Vercel will offer a "Redeploy" button).

Then click **Deploy**. The first build takes a couple of minutes. When it finishes you'll get a live URL like `https://meal-tracker.vercel.app`.

---

## Part 5 — Deploying changes (the everyday loop)

Once Parts 1–4 are done, getting new code or fixes live for testing is just:

```bash
git add .
git commit -m "Describe the change"
git push
```

Vercel detects the push and rebuilds automatically within a minute or two. Refresh your URL to see the change.

To test something risky **without** touching the live site, push it to a branch instead of main:

```bash
git checkout -b my-test
git push -u origin my-test
```

Vercel creates a separate **Preview URL** for that branch. When you're happy, merge it into main (on GitHub) and it goes to production.

---

## Watching a deploy / troubleshooting

- The **Deployments** tab in your Vercel project shows every build, its status, and **build logs**. If a deploy fails, the red log entry tells you why (often a missing environment variable or a code error).
- A successful deploy shows a green check and a clickable URL.
- If the app loads but errors at runtime (e.g. database not connecting), check **Project → Settings → Environment Variables** and the **Runtime Logs** / **Logs** tab.

---

## Quick reference

- **Live site updates** → push to `main`
- **Safe test environment** → push to any other branch → use the Preview URL
- **Changed a secret/API key** → update it in Vercel Settings → Redeploy
- **Build failed** → read the build log in the Deployments tab

That's everything you need for the build-test-deploy cycle. If you run into a specific error message during any step, paste it to me and I'll tell you exactly what to do.
