# 🏛️ Lamak Hospitality Unit — Setup & Deployment Guide

## What You Have
- **Frontend**: Single-page app (HTML/CSS/JS) → `public/index.html`
- **Backend**: Netlify Serverless Functions → `netlify/functions/`
- **Database**: Supabase (PostgreSQL) → `supabase-schema.sql`
- **Hosting**: Netlify (free tier)

---

## Step 1 — Set Up Supabase (Database)

1. Go to **https://supabase.com** → Sign up (free)
2. Click **"New Project"** → Name it `lamak-hospitality`
3. Choose a region close to Nigeria (e.g. **EU West** or **US East**)
4. Set a strong database password → **Save it somewhere**
5. Wait for project to provision (~2 minutes)
6. Go to **SQL Editor** (left sidebar)
7. Click **"New Query"**
8. Open the file `supabase-schema.sql` from this project
9. **Copy ALL of it** → Paste into the SQL editor → Click **Run**
10. You should see "Success. No rows returned."

### Get Your Keys
- Go to **Settings → API** in Supabase
- Copy:
  - **Project URL** → this is your `SUPABASE_URL`
  - **service_role key** (under "Project API keys") → this is your `SUPABASE_SERVICE_KEY`
  - ⚠️ Keep the service_role key SECRET — never put it in frontend code

---

## Step 2 — Deploy to Netlify

### Option A: Deploy via GitHub (Recommended)

1. Push this project to a GitHub repository:
   ```bash
   cd lamak-hospitality
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/lamak-hospitality.git
   git push -u origin main
   ```

2. Go to **https://netlify.com** → Sign up (free)
3. Click **"Add new site" → "Import an existing project"**
4. Connect your GitHub account → Select the repo
5. Build settings (should auto-detect):
   - **Build command**: (leave empty)
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
6. Click **"Deploy site"**

### Option B: Deploy via Netlify CLI (from WSL)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install project dependencies
cd lamak-hospitality
npm install

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

---

## Step 3 — Set Environment Variables

In Netlify → Your Site → **Site Settings → Environment Variables**

Add these three:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...your service role key...` |
| `JWT_SECRET` | Any long random string, e.g. `lamak2025secretkey_changethis_abc123xyz` |

After adding, go to **Deploys → Trigger deploy → Deploy site** to apply.

---

## Step 4 — First Login

Your default admin account:
- **Email**: `admin@lamak.edu.ng`
- **Password**: `password`

⚠️ **Change this password immediately** after first login!

To change the admin password:
1. Login with the default credentials
2. Use the "Forgot Password" feature to reset it
3. Or go to Supabase → Table Editor → users → edit the admin row

---

## Step 5 — First Steps as Admin

1. **Create Subunits** → Admin Panel → Subunits → Create Subunit
2. **Open Registration** → Members can now register and select their subunit
3. **Post First Announcement** → Announcements → Post Announcement
4. **Add Events** → Events → Add Event
5. **Upload Attendance** → Attendance → Upload Excel (format: Email, Present columns)

---

## Excel Attendance Format

Your Excel file should have this column structure:

| Email | Present | Name (optional) |
|-------|---------|-----------------|
| member@email.com | TRUE | John Doe |
| other@email.com | FALSE | Jane Smith |

The system matches by email to find the user.

---

## Features Summary

| Feature | Status |
|---------|--------|
| Member Registration with Subunit dropdown | ✅ |
| Admin Login | ✅ |
| Dashboard with live stats | ✅ |
| Member management (add/edit/status) | ✅ |
| Attendance tracking & upload | ✅ |
| Attendance leaderboard | ✅ |
| Global Chat (multi-channel) | ✅ |
| Announcements with pin | ✅ |
| Event calendar | ✅ |
| Subunit management | ✅ |
| Analytics + charts | ✅ |
| Member profiles + customization | ✅ |
| Role & status management | ✅ |
| Notifications | ✅ |
| Audit log | ✅ |
| Dark/Light mode toggle | ✅ |
| Mobile responsive | ✅ |
| Password reset | ✅ |
| JWT Authentication | ✅ |

---

## Local Development (WSL/Ubuntu)

```bash
# Install dependencies
cd lamak-hospitality
npm install

# Create your .env file
cp .env.example .env
# Edit .env with your Supabase credentials

# Run locally
npx netlify dev
# → Opens at http://localhost:8888
```

---

## Troubleshooting

**"Unauthorized" errors?**
→ Make sure SUPABASE_SERVICE_KEY is set in Netlify environment variables

**Functions not working?**
→ Check Netlify → Functions tab → Click a function → View logs

**Database errors?**
→ Go to Supabase → Logs → API Logs to see SQL errors

**CORS errors?**
→ All functions return CORS headers — make sure you're calling `/api/...` not the function URL directly

---

## Support
Built for Lamak University Chapel — Hospitality Unit
