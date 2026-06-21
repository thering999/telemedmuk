# Deployment Guide

## GitHub Pages (Frontend) - Automated

### Setup (One-time)

1. **Go to Repository Settings**
   ```
   https://github.com/thering999/telemedmuk/settings/pages
   ```

2. **Configure GitHub Pages**
   - Source: **Deploy from a branch**
   - Branch: **gh-pages** (auto-created by Actions)
   - Folder: **/ (root)**
   - Click **Save**

3. **Wait for first deployment**
   - Monitor: Settings → Pages → Deployments
   - Or: Actions tab → "Deploy to GitHub Pages"
   - Time: ~2-3 minutes

### How it works

- Every push to `main` triggers auto-build + deploy
- GitHub Actions runs: `npm install → npm run build → deploy to gh-pages`
- Site goes live at: **https://thering999.github.io/telemedmuk/**

### Monitoring

```bash
# Check Actions status
gh run list --repo thering999/telemedmuk

# View workflow logs
gh run view <run-id> --repo thering999/telemedmuk
```

---

## Backend (API) - Manual Setup Required

### Prepare for Deployment

1. **Choose a platform:**
   - **Railway** (recommended) — PostgreSQL + Node.js
   - **Heroku** — Free tier ended
   - **AWS/DigitalOcean** — More complex

2. **Example: Railway**

   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login
   railway login

   # Initialize project in api/
   cd api
   railway init

   # Deploy
   railway up
   ```

3. **Update Frontend API URL**
   - In `src/lib/` or environment config
   - Set `API_BASE_URL = https://your-api.railway.app`

---

## Troubleshooting

### GitHub Pages not updating?

```bash
# Verify build works locally
npm run build

# Check Actions for errors
gh run view --repo thering999/telemedmuk
```

### Site still showing old version?

- Clear browser cache (Ctrl+Shift+Delete)
- Or hard refresh (Ctrl+F5)
- GitHub Pages CDN can take ~5 min

### gh-pages branch missing?

- Run deployment manually: push to main
- Check Actions tab for errors

---

## Environment Variables

### Frontend (Vite)

```bash
# .env.local (create locally, don't commit)
VITE_API_BASE=https://your-api.railway.app
```

### Backend (API)

```bash
# api/.env (create locally, don't commit)
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your_secret
```

---

**Status:** ✅ Frontend auto-deploying | ⏳ Backend ready for manual deploy
