from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import sqlite3
import os

app = FastAPI(title="CalProTrack API", description="API to manage your time tracking business")

# Enable CORS so your website can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Path to your CalProTrack database
DB_PATH = "../develper/fieldtrack.db"

def get_db():
    """Connect to the CalProTrack database"""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail=f"Database not found at {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    return conn

# Pydantic models for response validation
class ActiveEmployee(BaseModel):
    user_id: int
    name: str
    email: str
    site_name: str
    site_address: str
    clocked_in_at: str
    hours_today: float

class PayrollEntry(BaseModel):
    user_id: int
    name: str
    email: str
    hourly_rate: float
    total_hours: float
    total_pay: float

class SiteBusyness(BaseModel):
    site_id: int
    site_name: str
    site_address: str
    active_employees: int
    total_hours_today: float

class EmployeeHours(BaseModel):
    user_id: int
    name: str
    email: str
    total_hours: float
    total_pay: float
    shift_count: int

# ==================== ENDPOINTS ====================

@app.get("/")
def root():
    """Check if API is running"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get some stats
    cursor.execute("SELECT COUNT(*) as count FROM users WHERE is_active = 1")
    active_users = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM job_sites WHERE is_active = 1")
    active_sites = cursor.fetchone()['count']
    
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM shifts 
        WHERE clock_out_at IS NULL
    """)
    currently_clocked_in = cursor.fetchone()['count']
    
    conn.close()
    
    return {
        "message": "CalProTrack API is running!",
        "stats": {
            "active_employees": active_users,
            "active_sites": active_sites,
            "currently_clocked_in": currently_clocked_in
        }
    }

@app.get("/active", response_model=List[ActiveEmployee])
def get_active_employees():
    """Get all employees currently clocked in"""
    conn = get_db()
    cursor = conn.cursor()
    
    # First get active shifts
    query = """
        SELECT 
            u.id as user_id,
            u.name,
            u.email,
            s.id as shift_id,
            s.clock_in_at as clocked_in_at,
            ROUND((julianday('now') - julianday(s.clock_in_at)) * 24, 2) as hours_today
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE s.clock_out_at IS NULL
        ORDER BY s.clock_in_at DESC
    """
    
    cursor.execute(query)
    shifts = cursor.fetchall()
    
    results = []
    for shift in shifts:
        # Get current site from most recent segment
        cursor.execute("""
            SELECT js.name as site_name, js.address as site_address
            FROM shift_segments ss
            JOIN job_sites js ON ss.job_site_id = js.id
            WHERE ss.shift_id = ? AND ss.end_at IS NULL
            ORDER BY ss.start_at DESC
            LIMIT 1
        """, (shift['shift_id'],))
        
        site = cursor.fetchone()
        if site:
            results.append({
                'user_id': shift['user_id'],
                'name': shift['name'],
                'email': shift['email'],
                'site_name': site['site_name'],
                'site_address': site['site_address'] or 'No address',
                'clocked_in_at': shift['clocked_in_at'],
                'hours_today': shift['hours_today']
            })
    
    conn.close()
    return results

@app.get("/payroll", response_model=List[PayrollEntry])
def get_payroll(days: int = 7):
    """
    Get payroll summary for the last N days
    Default: 7 days (last week)
    """
    conn = get_db()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            u.id as user_id,
            u.name,
            u.email,
            u.hourly_rate,
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24
            ), 2) as total_hours,
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24 * u.hourly_rate
            ), 2) as total_pay
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE s.clock_in_at >= datetime('now', '-' || ? || ' days')
        GROUP BY u.id, u.name, u.email, u.hourly_rate
        ORDER BY total_hours DESC
    """
    
    cursor.execute(query, (days,))
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

@app.get("/employee/{user_id}/hours", response_model=EmployeeHours)
def get_employee_hours(user_id: int, days: int = 30):
    """Get hours worked for a specific employee"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Employee {user_id} not found")
    
    query = """
        SELECT 
            u.id as user_id,
            u.name,
            u.email,
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24
            ), 2) as total_hours,
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24 * u.hourly_rate
            ), 2) as total_pay,
            COUNT(s.id) as shift_count
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE u.id = ?
          AND s.clock_in_at >= datetime('now', '-' || ? || ' days')
        GROUP BY u.id, u.name, u.email
    """
    
    cursor.execute(query, (user_id, days))
    row = cursor.fetchone()
    conn.close()
    
    if row and row['total_hours'] is not None:
        return dict(row)
    else:
        # User exists but has no shifts in this period
        return {
            "user_id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "total_hours": 0,
            "total_pay": 0,
            "shift_count": 0
        }

@app.get("/sites/busy", response_model=List[SiteBusyness])
def get_busy_sites():
    """Get sites ranked by current activity and hours worked today"""
    conn = get_db()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            js.id as site_id,
            js.name as site_name,
            js.address as site_address,
            COUNT(DISTINCT CASE 
                WHEN ss.end_at IS NULL AND s.clock_out_at IS NULL THEN s.user_id 
            END) as active_employees,
            ROUND(SUM(
                CASE 
                    WHEN date(ss.start_at) = date('now')
                    THEN (julianday(COALESCE(ss.end_at, datetime('now'))) - 
                          julianday(ss.start_at)) * 24
                    ELSE 0
                END
            ), 2) as total_hours_today
        FROM job_sites js
        LEFT JOIN shift_segments ss ON js.id = ss.job_site_id
        LEFT JOIN shifts s ON ss.shift_id = s.id
        WHERE js.is_active = 1
        GROUP BY js.id, js.name, js.address
        ORDER BY active_employees DESC, total_hours_today DESC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

@app.get("/sites")
def get_all_sites():
    """Get list of all active job sites"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, address, created_at
        FROM job_sites
        WHERE is_active = 1
        ORDER BY name
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return {"sites": [dict(row) for row in rows]}

@app.get("/employees")
def get_all_employees():
    """Get list of all active employees"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, email, hourly_rate, role, created_at
        FROM users
        WHERE is_active = 1
        ORDER BY name
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    return {"employees": [dict(row) for row in rows]}

@app.get("/today")
def get_today_summary():
    """Get summary of today's activity"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Total hours today
    cursor.execute("""
        SELECT 
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24
            ), 2) as total_hours
        FROM shifts s
        WHERE date(s.clock_in_at) = date('now')
    """)
    total_hours = cursor.fetchone()['total_hours'] or 0
    
    # Employees who worked today
    cursor.execute("""
        SELECT COUNT(DISTINCT user_id) as count
        FROM shifts
        WHERE date(clock_in_at) = date('now')
    """)
    employees_today = cursor.fetchone()['count']
    
    # Currently clocked in
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM shifts
        WHERE clock_out_at IS NULL
    """)
    currently_active = cursor.fetchone()['count']
    
    # Total pay today
    cursor.execute("""
        SELECT 
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24 * u.hourly_rate
            ), 2) as total_pay
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE date(s.clock_in_at) = date('now')
    """)
    total_pay = cursor.fetchone()['total_pay'] or 0
    
    conn.close()
    
    return {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "total_hours": total_hours,
        "employees_worked": employees_today,
        "currently_active": currently_active,
        "total_pay": total_pay
    }

if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🚀 CalProTrack API Starting...")
    print("=" * 60)
    print(f"📊 Connecting to database: {DB_PATH}")
    
    # Test database connection
    try:
        conn = get_db()
        print("✅ Database connected successfully!")
        conn.close()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        exit(1)
    
    print("")
    print("Available endpoints:")
    print("  • http://127.0.0.1:8001/docs - Interactive API docs")
    print("  • http://127.0.0.1:8001/active - Who's clocked in now")
    print("  • http://127.0.0.1:8001/payroll - Last week's payroll")
    print("  • http://127.0.0.1:8001/today - Today's summary")
    print("  • http://127.0.0.1:8001/sites/busy - Busiest sites")
    print("")
    print("=" * 60)
    
    uvicorn.run(app, host="127.0.0.1", port=8001)
