# 🚀 Deployment Guide

## Local Development

### 1. Clone & Install
```bash
git clone https://github.com/t37ant/workclock.git
cd workclock
npm install
```

### 2. Start Server
```bash
npm start
# or
node server.js
```

### 3. Access Apps
- Mobile: http://localhost:3000
- Portal: http://localhost:3000/portal

---

## Deploy to Render

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Deploy to Render"
git push
```

### Step 2: Create Render Service
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository: `t37ant/workclock`

### Step 3: Configure Service
- **Name:** workclock
- **Region:** Oregon (US West)
- **Branch:** main
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Instance Type:** Free or Starter

### Step 4: Deploy
Click **Create Web Service** - Render will auto-deploy!

Your app will be live at: `https://your-service.onrender.com`

---

## Environment Variables (Optional)

If you need custom configuration:

```bash
PORT=3000
NODE_ENV=production
```

Set these in Render:
- Dashboard → Your Service → Environment
- Add key-value pairs

---

## Deploy Business Intelligence API (Optional)

To make the Insights dashboard work on production:

### Option 1: Deploy to Render (Separate Service)
```bash
# Create new Python service
# Use claude-tools folder
# Start command: python calprotrack_api_fixed.py
```

### Option 2: Deploy to Railway
```bash
railway init
railway up
```

Then update `portal.js`:
```javascript
// Change this line:
const INSIGHTS_API = 'http://127.0.0.1:8001';

// To your deployed API:
const INSIGHTS_API = 'https://your-api.onrender.com';
```

---

## Database

### SQLite (Current)
✅ Simple, no setup needed
✅ Perfect for small teams (<100 employees)
⚠️ File-based, included in deployment

### Upgrade to PostgreSQL (For Scale)
If you grow large, migrate to PostgreSQL:
1. Render → Add PostgreSQL database
2. Update `db.js` to use PostgreSQL
3. Migrate schema and data

---

## Custom Domain

1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Render: Settings → Custom Domains
3. Add your domain
4. Update DNS records at your registrar

---

## SSL Certificate

✅ Automatic! Render provides free SSL for all services.

Your app will be on `https://` automatically.

---

## Monitoring

### Built-in Health Checks
Render automatically monitors:
- Service uptime
- Response times
- Error rates

### View Logs
Dashboard → Your Service → Logs

### Notifications
Settings → Notifications
- Email alerts on failures
- Slack integration available

---

## Scaling

### Free Tier
- ✅ Fine for testing
- ⚠️ Spins down after 15min inactivity
- ⚠️ Slow cold starts

### Starter Tier ($7/month)
- ✅ Always on
- ✅ Faster
- ✅ Better for production

### Scale Up
As you grow:
- Instance Type → Professional ($25/month)
- Add background workers
- Add PostgreSQL database

---

## Troubleshooting

### "Application failed to respond"
- Check logs for errors
- Verify `PORT` environment variable
- Ensure `node server.js` works locally

### "Database locked"
- SQLite limitation with high traffic
- Upgrade to PostgreSQL for production

### Insights API not working
- API must be deployed separately
- Update API URL in `portal.js`
- Check CORS settings

---

## Backup Strategy

### Automatic (Render)
- ✅ Deploys from Git (version controlled)
- ✅ Easy rollback to previous versions

### Database Backups
```bash
# Download database from server
# Store in safe location
# Automate with cron job
```

---

## Security Checklist

Before going live:
- [ ] Change demo passwords
- [ ] Review user roles
- [ ] Enable HTTPS (automatic on Render)
- [ ] Set secure cookie flags
- [ ] Review rate limiting
- [ ] Test authentication flows

---

## Performance Tips

1. **Enable caching** (Render settings)
2. **Compress responses** (already enabled in Express)
3. **Optimize images** (icons are already optimized)
4. **Use CDN** for static assets (optional)

---

## Cost Estimate

### Small Team (1-20 employees)
- **Free Tier:** $0/month ✅
- **Starter:** $7/month (recommended)

### Medium Team (20-100 employees)
- **Starter + PostgreSQL:** $14/month
- **Professional:** $25/month

### Large Team (100+ employees)
- **Professional + DB:** $32/month
- **Multiple instances:** $50-100/month

---

**Need help?** Check the logs or open an issue on GitHub!
