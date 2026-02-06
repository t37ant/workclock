import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { db, initDb, nowIso, hoursBetween, cleanupExpiredSessions } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = __dirname;

const app = express();
app.set("trust proxy", 1);

function cookieOptions(req){
  const xfProto = (req.headers["x-forwarded-proto"] || "").toString();
  const secure = req.secure || xfProto.includes("https");
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

// Initialize database
initDb();

// Clean up expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// ============ SEED DEMO DATA ============
function seedDemo() {
  const existing = db.prepare("SELECT COUNT(*) as c FROM companies").get();
  if (existing.c > 0) return;

  const companyId = db.prepare("INSERT INTO companies(name) VALUES(?)").run("J&H Transportation").lastInsertRowid;
  
  const adminHash = bcrypt.hashSync("admin1234", 10);
  const empHash = bcrypt.hashSync("emp1234", 10);
  
  // Create admin user
  db.prepare(`INSERT INTO users(company_id, email, name, pass_hash, role, hourly_rate) 
              VALUES(?,?,?,?,?,?)`).run(companyId, "admin@jh.test", "Admin User", adminHash, "admin", 0);
  
  // Create employee user
  db.prepare(`INSERT INTO users(company_id, email, name, pass_hash, role, hourly_rate) 
              VALUES(?,?,?,?,?,?)`).run(companyId, "emp@jh.test", "Field Employee", empHash, "employee", 25.50);

  // Create job sites
  db.prepare("INSERT INTO job_sites(company_id, name, address) VALUES(?,?,?)").run(companyId, "Downtown Site A", "123 Main St, Los Angeles, CA");
  db.prepare("INSERT INTO job_sites(company_id, name, address) VALUES(?,?,?)").run(companyId, "Highway Site B", "456 Highway 101, San Diego, CA");
  db.prepare("INSERT INTO job_sites(company_id, name, address) VALUES(?,?,?)").run(companyId, "Airport Site C", "789 Airport Blvd, San Francisco, CA");

  console.log("\n🌱 Demo data seeded!");
  console.log("📧 Admin: admin@jh.test / admin1234");
  console.log("📧 Employee: emp@jh.test / emp1234\n");
}
seedDemo();
// ============ HEALTH CHECK ============
app.get("/health", (req,res)=>{
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});
app.get("/api/health", (req,res)=>{
  res.json({ status: "ok", database: "sqlite", timestamp: new Date().toISOString() });
});


// ============ AUTH MIDDLEWARE ============
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  
  const session = db.prepare("SELECT * FROM sessions WHERE token=? AND expires_at > datetime('now')").get(token);
  if (!session) return res.status(401).json({ error: "Session expired" });
  
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(session.user_id);
  if (!user) return res.status(401).json({ error: "User not found" });
  
  req.user = user;
  req.companyId = session.company_id;
  next();
}

// Admin-only middleware
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ============ AUTHENTICATION ============

// Login
app.post("/api/login", (req, res) => {
  const { companyName, email, password } = req.body;
  
  if (!companyName || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }
  
  const company = db.prepare("SELECT * FROM companies WHERE name=? COLLATE NOCASE").get(companyName.trim());
  if (!company) return res.status(400).json({ error: "Company not found" });
  
  const user = db.prepare("SELECT * FROM users WHERE company_id=? AND email=? AND is_active=1").get(company.id, email.trim().toLowerCase());
  if (!user) return res.status(400).json({ error: "Invalid credentials" });
  
  if (!bcrypt.compareSync(password, user.pass_hash)) {
    return res.status(400).json({ error: "Invalid credentials" });
  }
  
  // Create session token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
  
  db.prepare("INSERT INTO sessions(token, user_id, company_id, expires_at) VALUES(?,?,?,?)")
    .run(token, user.id, company.id, expiresAt);
  
  res.cookie("token", token, cookieOptions(req));
  res.json({ 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      role: user.role,
      hourly_rate: user.hourly_rate
    } 
  });
});

// Logout
app.post("/api/logout", (req, res) => {
  const token = req.cookies.token;
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.clearCookie("token");
  res.json({ ok: true });
});

// Get current user
app.get("/api/me", auth, (req, res) => {
  res.json({ 
    user: { 
      id: req.user.id, 
      name: req.user.name, 
      email: req.user.email, 
      role: req.user.role,
      hourly_rate: req.user.hourly_rate
    } 
  });
});

// ============ COMPANY REGISTRATION ============

// Register new company
app.post("/api/register", (req, res) => {
  const { companyName, adminName, adminEmail, adminPassword } = req.body;
  
  if (!companyName?.trim() || !adminName?.trim() || !adminEmail?.trim() || !adminPassword?.trim()) {
    return res.status(400).json({ error: "All fields required" });
  }
  
  if (adminPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  
  try {
    // Create company
    const companyResult = db.prepare("INSERT INTO companies(name) VALUES(?)").run(companyName.trim());
    const companyId = companyResult.lastInsertRowid;
    
    // Create admin user
    const passHash = bcrypt.hashSync(adminPassword, 10);
    const userResult = db.prepare(`
      INSERT INTO users(company_id, email, name, pass_hash, role, hourly_rate) 
      VALUES(?,?,?,?,?,?)
    `).run(companyId, adminEmail.trim().toLowerCase(), adminName.trim(), passHash, "admin", 0);
    
    // Create session
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");
    
    db.prepare("INSERT INTO sessions(token, user_id, company_id, expires_at) VALUES(?,?,?,?)")
      .run(token, userResult.lastInsertRowid, companyId, expiresAt);
    
    res.cookie("token", token, cookieOptions(req));
    res.json({ 
      ok: true,
      user: { 
        id: userResult.lastInsertRowid, 
        name: adminName.trim(), 
        email: adminEmail.trim().toLowerCase(), 
        role: "admin" 
      }
    });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Company name already exists" });
    }
    console.error("Registration error:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

// ============ JOB SITES ============

// Get all active job sites
app.get("/api/sites", auth, (req, res) => {
  const sites = db.prepare("SELECT * FROM job_sites WHERE company_id=? AND is_active=1 ORDER BY name").all(req.companyId);
  res.json(sites);
});

// Create job site (admin only)
app.post("/api/sites", auth, adminOnly, (req, res) => {
  const { name, address } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Site name required" });
  
  try {
    const result = db.prepare("INSERT INTO job_sites(company_id, name, address) VALUES(?,?,?)")
      .run(req.companyId, name.trim(), address?.trim() || null);
    res.json({ id: result.lastInsertRowid, name: name.trim(), address: address?.trim() || null });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Site already exists" });
    }
    res.status(500).json({ error: "Failed to create site" });
  }
});

// Update job site (admin only)
app.put("/api/sites/:id", auth, adminOnly, (req, res) => {
  const { name, address } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Site name required" });
  
  try {
    db.prepare("UPDATE job_sites SET name=?, address=? WHERE id=? AND company_id=?")
      .run(name.trim(), address?.trim() || null, req.params.id, req.companyId);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Site name already exists" });
    }
    res.status(500).json({ error: "Failed to update site" });
  }
});

// Delete/deactivate job site (admin only)
app.delete("/api/sites/:id", auth, adminOnly, (req, res) => {
  db.prepare("UPDATE job_sites SET is_active=0 WHERE id=? AND company_id=?").run(req.params.id, req.companyId);
  res.json({ ok: true });
});

// ============ USERS (ADMIN) ============

// Get all users (with pagination and search)
app.get("/api/users", auth, (req, res) => {
  const { search, limit = 20, offset = 0 } = req.query;
  
  // Employees can only get their own info
  if (req.user.role !== "admin") {
    return res.json({ 
      users: [{ 
        id: req.user.id, 
        name: req.user.name, 
        email: req.user.email, 
        role: req.user.role,
        hourly_rate: req.user.hourly_rate,
        is_active: req.user.is_active
      }],
      total: 1
    });
  }
  
  let query = "SELECT id, name, email, role, hourly_rate, is_active, created_at FROM users WHERE company_id=?";
  const params = [req.companyId];
  
  if (search?.trim()) {
    query += " AND (name LIKE ? OR email LIKE ?)";
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm);
  }
  
  const countQuery = query.replace("SELECT id, name, email, role, hourly_rate, is_active, created_at", "SELECT COUNT(*) as total");
  const total = db.prepare(countQuery).get(...params).total;
  
  query += " ORDER BY name LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));
  
  const users = db.prepare(query).all(...params);
  res.json({ users, total });
});

// Get single user
app.get("/api/users/:id", auth, (req, res) => {
  // Employees can only get their own info
  if (req.user.role !== "admin" && req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  const user = db.prepare("SELECT id, name, email, role, hourly_rate, is_active, created_at FROM users WHERE id=? AND company_id=?")
    .get(req.params.id, req.companyId);
    
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

// Create user (admin only)
app.post("/api/users", auth, adminOnly, (req, res) => {
  const { name, email, password, role, hourlyRate } = req.body;
  
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: "Name, email, and password required" });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  
  const passHash = bcrypt.hashSync(password, 10);
  const rate = parseFloat(hourlyRate) || 0;
  const userRole = role === "admin" ? "admin" : "employee";
  
  try {
    const result = db.prepare(`
      INSERT INTO users(company_id, name, email, pass_hash, role, hourly_rate) 
      VALUES(?,?,?,?,?,?)
    `).run(req.companyId, name.trim(), email.trim().toLowerCase(), passHash, userRole, rate);
    
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    console.error("Create user error:", e);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update user (admin only, or self for limited fields)
app.put("/api/users/:id", auth, (req, res) => {
  const userId = parseInt(req.params.id);
  const { name, email, password, hourlyRate, isActive, role } = req.body;
  
  // Only admins can edit other users
  if (req.user.role !== "admin" && req.user.id !== userId) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  // Employees can only change their own name and password
  if (req.user.role !== "admin") {
    const updates = [];
    const params = [];
    
    if (name?.trim()) {
      updates.push("name=?");
      params.push(name.trim());
    }
    if (password?.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      updates.push("pass_hash=?");
      params.push(bcrypt.hashSync(password, 10));
    }
    
    if (updates.length > 0) {
      params.push(userId);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id=?`).run(...params);
    }
    return res.json({ ok: true });
  }
  
  // Admin updates
  try {
    let updates = [];
    let params = [];
    
    if (name?.trim()) {
      updates.push("name=?");
      params.push(name.trim());
    }
    if (email?.trim()) {
      updates.push("email=?");
      params.push(email.trim().toLowerCase());
    }
    if (password?.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      updates.push("pass_hash=?");
      params.push(bcrypt.hashSync(password, 10));
    }
    if (hourlyRate !== undefined) {
      updates.push("hourly_rate=?");
      params.push(parseFloat(hourlyRate) || 0);
    }
    if (isActive !== undefined) {
      updates.push("is_active=?");
      params.push(isActive ? 1 : 0);
    }
    if (role && (role === "admin" || role === "employee")) {
      updates.push("role=?");
      params.push(role);
    }
    
    if (updates.length > 0) {
      params.push(userId, req.companyId);
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id=? AND company_id=?`).run(...params);
    }
    
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Email already exists" });
    }
    console.error("Update user error:", e);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete/deactivate user (admin only)
app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Prevent deleting yourself
  if (userId === req.user.id) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }
  
  db.prepare("UPDATE users SET is_active=0 WHERE id=? AND company_id=?").run(userId, req.companyId);
  
  // Delete their sessions
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  
  res.json({ ok: true });
});

// ============ TIME TRACKING ============

// Get clock-in status
app.get("/api/status", auth, (req, res) => {
  const shift = db.prepare("SELECT * FROM shifts WHERE user_id=? AND clock_out_at IS NULL ORDER BY id DESC LIMIT 1").get(req.user.id);
  
  if (!shift) return res.json({ clockedIn: false });
  
  const segment = db.prepare("SELECT * FROM shift_segments WHERE shift_id=? AND end_at IS NULL ORDER BY id DESC LIMIT 1").get(shift.id);
  const site = segment ? db.prepare("SELECT * FROM job_sites WHERE id=?").get(segment.job_site_id) : null;
  
  res.json({
    clockedIn: true,
    shiftId: shift.id,
    clockInAt: shift.clock_in_at,
    currentSite: site ? { id: site.id, name: site.name } : null,
    segmentId: segment?.id
  });
});

// Clock in
app.post("/api/clock-in", auth, (req, res) => {
  const { siteId } = req.body;
  if (!siteId) return res.status(400).json({ error: "Job site required" });
  
  // Check site exists and is active
  const site = db.prepare("SELECT * FROM job_sites WHERE id=? AND company_id=? AND is_active=1").get(siteId, req.companyId);
  if (!site) return res.status(400).json({ error: "Invalid job site" });
  
  // Check if already clocked in
  const existing = db.prepare("SELECT * FROM shifts WHERE user_id=? AND clock_out_at IS NULL").get(req.user.id);
  if (existing) return res.status(400).json({ error: "Already clocked in" });
  
  const now = nowIso();
  
  // Create shift
  const shiftResult = db.prepare("INSERT INTO shifts(company_id, user_id, clock_in_at) VALUES(?,?,?)")
    .run(req.companyId, req.user.id, now);
  
  // Create first segment
  db.prepare("INSERT INTO shift_segments(company_id, shift_id, job_site_id, start_at) VALUES(?,?,?,?)")
    .run(req.companyId, shiftResult.lastInsertRowid, siteId, now);
  
  res.json({ ok: true, shiftId: shiftResult.lastInsertRowid });
});

// Switch job site (during active shift)
app.post("/api/switch-site", auth, (req, res) => {
  const { siteId } = req.body;
  if (!siteId) return res.status(400).json({ error: "Job site required" });
  
  // Check site exists
  const site = db.prepare("SELECT * FROM job_sites WHERE id=? AND company_id=? AND is_active=1").get(siteId, req.companyId);
  if (!site) return res.status(400).json({ error: "Invalid job site" });
  
  // Get current shift
  const shift = db.prepare("SELECT * FROM shifts WHERE user_id=? AND clock_out_at IS NULL").get(req.user.id);
  if (!shift) return res.status(400).json({ error: "Not clocked in" });
  
  const now = nowIso();
  
  // End current segment
  db.prepare("UPDATE shift_segments SET end_at=? WHERE shift_id=? AND end_at IS NULL").run(now, shift.id);
  
  // Start new segment
  db.prepare("INSERT INTO shift_segments(company_id, shift_id, job_site_id, start_at) VALUES(?,?,?,?)")
    .run(req.companyId, shift.id, siteId, now);
  
  res.json({ ok: true });
});

// Clock out
app.post("/api/clock-out", auth, (req, res) => {
  const shift = db.prepare("SELECT * FROM shifts WHERE user_id=? AND clock_out_at IS NULL").get(req.user.id);
  if (!shift) return res.status(400).json({ error: "Not clocked in" });
  
  const now = nowIso();
  
  // End current segment
  db.prepare("UPDATE shift_segments SET end_at=? WHERE shift_id=? AND end_at IS NULL").run(now, shift.id);
  
  // End shift
  db.prepare("UPDATE shifts SET clock_out_at=? WHERE id=?").run(now, shift.id);
  
  res.json({ ok: true });
});

// Get today's segments for current user
app.get("/api/today-segments", auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  
  const segments = db.prepare(`
    SELECT 
      seg.id, seg.start_at, seg.end_at,
      site.name as site_name
    FROM shift_segments seg
    JOIN shifts sh ON seg.shift_id = sh.id
    JOIN job_sites site ON seg.job_site_id = site.id
    WHERE sh.user_id=? AND DATE(seg.start_at) = ?
    ORDER BY seg.start_at
  `).all(req.user.id, today);
  
  res.json(segments);
});

// Get shifts with detailed info
app.get("/api/shifts", auth, (req, res) => {
  const { start, end, userId } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Start and end dates required" });
  
  const targetUserId = userId ? parseInt(userId) : req.user.id;
  
  // Verify access - employees can only see their own
  if (req.user.role !== "admin" && targetUserId !== req.user.id) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  // Get shifts with first job site
  const shifts = db.prepare(`
    SELECT 
      s.id,
      s.clock_in_at,
      s.clock_out_at,
      (SELECT js.name FROM shift_segments seg JOIN job_sites js ON seg.job_site_id = js.id 
       WHERE seg.shift_id = s.id ORDER BY seg.start_at LIMIT 1) as site_name,
      (JULIANDAY(COALESCE(s.clock_out_at, datetime('now'))) - JULIANDAY(s.clock_in_at)) * 24 as hours_worked
    FROM shifts s
    WHERE s.user_id = ?
      AND DATE(s.clock_in_at) >= ?
      AND DATE(s.clock_in_at) <= ?
    ORDER BY s.clock_in_at DESC
  `).all(targetUserId, start, end);
  
  res.json({ shifts });
});

// ============ PAYROLL & REPORTS ============

// Get payroll summary
app.get("/api/payroll", auth, (req, res) => {
  const { start, end, userId } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Start and end dates required" });
  
  let targetUserIds = [];
  
  if (userId) {
    // Specific user requested
    if (req.user.role !== "admin" && parseInt(userId) !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    targetUserIds = [parseInt(userId)];
  } else if (req.user.role === "admin") {
    // Admin getting all employees
    const users = db.prepare("SELECT id FROM users WHERE company_id=? AND is_active=1").all(req.companyId);
    targetUserIds = users.map(u => u.id);
  } else {
    // Employee getting own data
    targetUserIds = [req.user.id];
  }
  
  const employees = [];
  let totalHours = 0;
  let totalPay = 0;
  
  for (const uid of targetUserIds) {
    const user = db.prepare("SELECT id, name, hourly_rate FROM users WHERE id=?").get(uid);
    if (!user) continue;
    
    // Calculate hours from segments
    const segments = db.prepare(`
      SELECT seg.start_at, seg.end_at
      FROM shift_segments seg
      JOIN shifts sh ON seg.shift_id = sh.id
      WHERE sh.user_id = ? AND seg.company_id = ?
        AND DATE(seg.start_at) >= ? AND DATE(seg.start_at) <= ?
        AND seg.end_at IS NOT NULL
    `).all(uid, req.companyId, start, end);
    
    let userHours = 0;
    for (const seg of segments) {
      userHours += hoursBetween(seg.start_at, seg.end_at);
    }
    
    const userPay = userHours * user.hourly_rate;
    totalHours += userHours;
    totalPay += userPay;
    
    employees.push({
      id: user.id,
      name: user.name,
      totalHours: userHours.toFixed(2),
      hourlyRate: user.hourly_rate.toFixed(2),
      totalPay: userPay.toFixed(2)
    });
  }
  
  res.json({
    employees,
    totals: {
      hours: totalHours.toFixed(2),
      pay: totalPay.toFixed(2)
    }
  });
});

// Get detailed report (admin, or employee for own data)
app.get("/api/report", auth, (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: "Start and end dates required" });
  
  const segments = db.prepare(`
    SELECT 
      seg.id, seg.start_at, seg.end_at,
      u.id as user_id, u.name as user_name, u.hourly_rate,
      site.name as site_name
    FROM shift_segments seg
    JOIN shifts sh ON seg.shift_id = sh.id
    JOIN users u ON sh.user_id = u.id
    JOIN job_sites site ON seg.job_site_id = site.id
    WHERE seg.company_id=? 
      AND DATE(seg.start_at) >= ? 
      AND DATE(seg.start_at) <= ?
    ORDER BY seg.start_at
  `).all(req.companyId, start, end);
  
  let totalHours = 0;
  let totalCost = 0;
  
  const enriched = segments.map(s => {
    const hours = s.end_at ? hoursBetween(s.start_at, s.end_at) : 0;
    const cost = hours * (s.hourly_rate || 0);
    totalHours += hours;
    totalCost += cost;
    return { ...s, hours: hours.toFixed(2), cost: cost.toFixed(2) };
  });
  
  res.json({
    segments: enriched,
    totals: {
      hours: totalHours.toFixed(2),
      cost: totalCost.toFixed(2)
    }
  });
});

// Get earnings summary for current user (for dashboard)
app.get("/api/earnings", auth, (req, res) => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Get current pay period (last 7 days)
  const segments = db.prepare(`
    SELECT seg.start_at, seg.end_at
    FROM shift_segments seg
    JOIN shifts sh ON seg.shift_id = sh.id
    WHERE sh.user_id = ? AND seg.end_at IS NOT NULL
      AND DATE(seg.start_at) >= ?
  `).all(req.user.id, weekAgo.toISOString().slice(0, 10));
  
  let totalHours = 0;
  for (const seg of segments) {
    totalHours += hoursBetween(seg.start_at, seg.end_at);
  }
  
  const hourlyRate = req.user.hourly_rate || 0;
  const grossPay = totalHours * hourlyRate;
  const taxRate = 0.22; // Estimated 22%
  const taxAmount = grossPay * taxRate;
  const netPay = grossPay - taxAmount;
  
  res.json({
    periodHours: totalHours.toFixed(2),
    hourlyRate: hourlyRate.toFixed(2),
    grossPay: grossPay.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    netPay: netPay.toFixed(2)
  });
});

// Get currently active employees (admin only)
app.get("/api/active-now", auth, adminOnly, (req, res) => {
  const activeShifts = db.prepare(`
    SELECT 
      s.id as shift_id,
      s.clock_in_at,
      u.id as user_id,
      u.name as user_name,
      site.name as site_name
    FROM shifts s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN shift_segments seg ON seg.shift_id = s.id AND seg.end_at IS NULL
    LEFT JOIN job_sites site ON seg.job_site_id = site.id
    WHERE s.company_id = ? AND s.clock_out_at IS NULL
    ORDER BY s.clock_in_at DESC
  `).all(req.companyId);
  
  res.json(activeShifts);
});

// ============ COMPANY SETTINGS (Admin) ============

// Get company info
app.get("/api/company", auth, adminOnly, (req, res) => {
  const company = db.prepare("SELECT * FROM companies WHERE id=?").get(req.companyId);
  res.json(company);
});

// Update company name
app.put("/api/company", auth, adminOnly, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Company name required" });
  
  try {
    db.prepare("UPDATE companies SET name=? WHERE id=?").run(name.trim(), req.companyId);
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Company name already exists" });
    }
    res.status(500).json({ error: "Failed to update company" });
  }
});

// ============ SERVE FRONTEND ============

// Serve login page as home
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

// Serve other pages
app.get("/login", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "register.html"));
});

app.get("/app", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "app.html"));
});

// Serve admin portal
app.get("/portal", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "portal.html"));
});

// ============ START SERVER ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     ⏱️  CalProTrack - Time Tracking System                 ║
║                                                            ║
║     🚀 Server running on http://localhost:${PORT}             ║
║                                                            ║
║     📱 Mobile App:  http://localhost:${PORT}                  ║
║     💼 Admin Portal: http://localhost:${PORT}/portal          ║
║                                                            ║
║     Demo Credentials:                                      ║
║     📧 Admin: admin@jh.test / admin1234                    ║
║     📧 Employee: emp@jh.test / emp1234                     ║
║     🏢 Company: J&H Transportation                         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
