# ⏱️ CalProTrack

**Professional time tracking system for California field workers**

A complete web-based time tracking solution with mobile app, admin portal, and real-time business insights dashboard.

---

## 🚀 Features

### For Employees (Mobile App)
- ⏰ **Quick Clock In/Out** - One-tap time tracking
- 📍 **Job Site Switching** - Switch between multiple sites during shift
- 💰 **Earnings Tracking** - View hours and pay in real-time
- 📱 **Progressive Web App** - Install on any device like a native app
- 🔒 **Secure Authentication** - Company-based login system

### For Admins (Web Portal)
- 👥 **Team Management** - Add/edit employees, set rates, manage access
- 📊 **Real-Time Insights** - Live dashboard with business metrics
- 💵 **Payroll Reports** - Generate detailed payroll breakdowns
- 📈 **Site Activity** - Track which job sites are busiest
- 📥 **Export Options** - Excel, PDF, and CSV export for all reports
- 🎨 **Dark/Light Mode** - Comfortable viewing in any environment

### Business Intelligence Dashboard
- 📅 **Today's Summary** - Hours worked, labor cost, active employees
- 💰 **Weekly Payroll** - Real-time payroll calculations
- 🟢 **Live Employee Feed** - See who's working right now
- 📍 **Site Rankings** - Identify busiest job sites
- 🔄 **Auto-Refresh** - Updates every 30 seconds

---

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ installed
- Python 3.8+ (for API features)

### Installation

```bash
# Clone the repository
git clone https://github.com/t37ant/workclock.git
cd workclock

# Install dependencies
npm install

# Start the server
npm start
```

Visit:
- **Mobile App:** http://localhost:3000
- **Admin Portal:** http://localhost:3000/portal

### Demo Credentials
- **Admin:** admin@jh.test / admin1234
- **Employee:** emp@jh.test / emp1234
- **Company:** J&H Transportation

---

## 🔌 Business Intelligence API (Optional)

Enable real-time insights in the admin portal:

```bash
# Start the API
cd claude-tools
python calprotrack_api_fixed.py
```

The Insights tab will now show live data! 📊

---

## 📁 Project Structure

```
workclock/
├── server.js              # Express server & API routes
├── db.js                  # SQLite database configuration
├── index.html             # Mobile time tracking app
├── portal.html            # Admin dashboard
├── portal.js              # Portal functionality
├── portal.css             # Portal styling
├── app.js                 # Mobile app logic
├── styles.css             # Mobile app styling
├── fieldtrack.db          # SQLite database
├── manifest.json          # PWA configuration
├── sw.js                  # Service worker
└── claude-tools/          # Business intelligence API
    ├── calprotrack_api_fixed.py
    └── add_test_data.py
```

---

## 🌐 Deployment

### Deploy to Render

1. **Push to GitHub** (already done!)
2. **Connect to Render:**
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - New → Web Service
   - Connect your repository
   - Build Command: `npm install`
   - Start Command: `node server.js`

3. **Deploy!** ✅

---

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- SQLite database
- bcrypt authentication
- cookie-based sessions

**Frontend:**
- Vanilla JavaScript (no frameworks!)
- Responsive CSS with dark mode
- Progressive Web App (PWA)

**API (Optional):**
- Python FastAPI
- Real-time data endpoints

---

## 📊 Database Schema

- **companies** - Multi-tenant company accounts
- **users** - Employees and admins with authentication
- **job_sites** - Work locations
- **shifts** - Clock in/out records
- **shift_segments** - Detailed time at each site
- **sessions** - Secure login sessions

---

## 🔐 Security Features

- ✅ bcrypt password hashing
- ✅ Secure cookie-based sessions
- ✅ Company-based data isolation
- ✅ Role-based access control (admin/employee)
- ✅ SQL injection prevention
- ✅ XSS protection

---

## 📱 Mobile App Features

The PWA can be installed on any device:

```
1. Visit site in browser
2. Click "Add to Home Screen"
3. Launch like a native app!
```

Works on:
- iOS (Safari)
- Android (Chrome)
- Desktop (Chrome, Edge)

---

## 🎨 Customization

### Change Company Info
Edit demo data in `server.js` (line 42+)

### Modify Branding
- Logo: Update SVG in HTML files
- Colors: Edit CSS variables in `portal.css` and `styles.css`
- Company name: Update in `server.js` seed function

---

## 📈 Roadmap

- [ ] GPS location tracking
- [ ] Geofencing for job sites
- [ ] Photo uploads for clock in/out
- [ ] Overtime calculations
- [ ] PTO/vacation tracking
- [ ] Mobile notifications
- [ ] QuickBooks integration

---

## 🤝 Contributing

This is a personal project, but suggestions are welcome!

---

## 📄 License

MIT License - feel free to use for your own projects

---

## 👨‍💻 Author

**Anthony Ross**
- GitHub: [@t37ant](https://github.com/t37ant)
- Email: T37ant@gmail.com

---

## 🎉 Acknowledgments

Built with determination, coffee, and a lot of learning! ☕

Special thanks to Claude AI for assistance with development.

---

**⭐ Star this repo if you find it useful!**
