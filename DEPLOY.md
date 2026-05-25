# Urban Gang Moments — Deploy in 3 Steps

## What's in this package

```
index.html          ← the full app (served by Vercel as the frontend)
api/upload.js       ← serverless function: pushes files to GitHub
api/files.js        ← serverless function: lists files from GitHub
vercel.json         ← Vercel routing config
package.json        ← Node 24 config
```

---

## Step 1 — Push this folder to GitHub

Make sure you're in the folder that contains index.html, then run:

```bash
git init
git add .
git commit -m "Urban Gang Moments — initial deploy"
git remote add origin https://github.com/eugineous/urbang-gang-photos.git
git push -u origin main
```

If the repo already has files, use `git push --force` or pull first.

---

## Step 2 — Deploy to Vercel

Option A — Via CLI (fastest):
```bash
npx vercel --yes
```
Follow the prompts. When asked "Which scope?", pick your account.
When asked "Link to existing project?", say No and let it create a new one.

Option B — Via dashboard:
1. Go to https://vercel.com/new
2. Import `eugineous/urbang-gang-photos`
3. Leave all settings as default
4. Click **Deploy**

---

## Step 3 — Add your GitHub Token as an Environment Variable

This is what lets the upload function push files to GitHub.

Via CLI:
```bash
npx vercel env add GITHUB_TOKEN production
```
When prompted, paste your GitHub token and press Enter.
Then redeploy: `npx vercel --prod`

Via dashboard:
1. Open your project on vercel.com
2. Go to **Settings → Environment Variables**
3. Add: `GITHUB_TOKEN` = your GitHub Personal Access Token
4. Click **Save** then **Redeploy**

---

## Done!

Your app will be live at `https://urbang-gang-photos.vercel.app` (or similar).

Share the link — anyone can open it, browse photos, upload moments.
On mobile: Safari → Share → **Add to Home Screen** to install it as an app.

---

## Security reminder

Rotate your GitHub and Vercel tokens after any public sharing.
GitHub: https://github.com/settings/tokens
Vercel: https://vercel.com/account/tokens

## How uploads work

Small files upload → `/api/upload` → pushed to `eugineous/urbang-gang-photos/media/{album}/`.
Large files are uploaded in chunks via `/api/upload-chunk` (to bypass Vercel’s request size limit) and are assembled by a GitHub Action into a GitHub Release asset (tag: `ugc`).
All files stay at original quality. Downloads use GitHub raw URLs (small) or GitHub Releases download URLs (large).
