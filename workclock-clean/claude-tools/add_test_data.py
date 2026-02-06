"""
Add Test Shifts to CalProTrack Database
This creates realistic shift data so you can see the API in action!
"""

import sqlite3
from datetime import datetime, timedelta
import random

DB_PATH = "../develper/fieldtrack.db"

def add_test_shifts():
    """Add some test shifts with realistic data"""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("=" * 70)
    print("  🎬 ADDING TEST SHIFT DATA")
    print("=" * 70)
    
    # Get existing users and sites
    cursor.execute("SELECT id, name, email, hourly_rate FROM users WHERE is_active = 1")
    users = cursor.fetchall()
    
    cursor.execute("SELECT id, name FROM job_sites WHERE is_active = 1")
    sites = cursor.fetchall()
    
    if not users:
        print("❌ No users found! Can't create test data.")
        conn.close()
        return
    
    if not sites:
        print("❌ No job sites found! Can't create test data.")
        conn.close()
        return
    
    print(f"\n✅ Found {len(users)} employees and {len(sites)} job sites")
    
    # Get company_id from first user
    cursor.execute("SELECT company_id FROM users LIMIT 1")
    company_id = cursor.fetchone()[0]
    
    # Clear old test data (optional - comment out if you want to keep existing data)
    print("\n🗑️  Clearing old shifts...")
    cursor.execute("DELETE FROM shift_segments")
    cursor.execute("DELETE FROM shifts")
    
    now = datetime.now()
    shifts_created = 0
    
    # Scenario 1: Two employees currently clocked in
    print("\n📍 Creating active shifts (employees currently working)...")
    
    for i in range(min(2, len(users))):
        user = users[i]
        site = sites[i % len(sites)]
        
        # Clock in 3-5 hours ago
        hours_ago = random.uniform(3, 5)
        clock_in = now - timedelta(hours=hours_ago)
        clock_in_str = clock_in.strftime("%Y-%m-%d %H:%M:%S")
        
        # Insert shift (no clock_out_at = still active)
        cursor.execute("""
            INSERT INTO shifts (company_id, user_id, clock_in_at, clock_out_at)
            VALUES (?, ?, ?, NULL)
        """, (company_id, user[0], clock_in_str))
        
        shift_id = cursor.lastrowid
        
        # Add shift segment for current site
        cursor.execute("""
            INSERT INTO shift_segments (company_id, shift_id, job_site_id, start_at, end_at)
            VALUES (?, ?, ?, ?, NULL)
        """, (company_id, shift_id, site[0], clock_in_str))
        
        print(f"   ✅ {user[1]} clocked in at {site[1]} ({hours_ago:.1f} hours ago)")
        shifts_created += 1
    
    # Scenario 2: Completed shifts from this week
    print("\n📅 Creating completed shifts from this week...")
    
    week_start = now - timedelta(days=now.weekday())  # Monday
    
    for day_offset in range(5):  # Monday to Friday
        day = week_start + timedelta(days=day_offset)
        
        # Skip future days
        if day > now:
            continue
        
        # Each employee works 1-2 shifts this day
        for user in users:
            if random.random() > 0.7:  # 70% chance they worked
                continue
            
            # Morning shift
            clock_in = day.replace(hour=random.randint(7, 9), minute=random.randint(0, 59))
            hours_worked = random.uniform(4, 6)
            clock_out = clock_in + timedelta(hours=hours_worked)
            
            # Don't create future shifts
            if clock_in > now:
                continue
            
            # If this would still be active, end it
            if clock_out > now:
                clock_out = now - timedelta(minutes=30)
            
            clock_in_str = clock_in.strftime("%Y-%m-%d %H:%M:%S")
            clock_out_str = clock_out.strftime("%Y-%m-%d %H:%M:%S")
            
            # Random site
            site = random.choice(sites)
            
            # Insert completed shift
            cursor.execute("""
                INSERT INTO shifts (company_id, user_id, clock_in_at, clock_out_at)
                VALUES (?, ?, ?, ?)
            """, (company_id, user[0], clock_in_str, clock_out_str))
            
            shift_id = cursor.lastrowid
            
            # Add shift segment
            cursor.execute("""
                INSERT INTO shift_segments (company_id, shift_id, job_site_id, start_at, end_at)
                VALUES (?, ?, ?, ?, ?)
            """, (company_id, shift_id, site[0], clock_in_str, clock_out_str))
            
            shifts_created += 1
    
    print(f"   ✅ Created {shifts_created - 2} completed shifts")
    
    # Scenario 3: Some shifts from last week for historical data
    print("\n📊 Creating historical data from last week...")
    
    last_week = now - timedelta(days=7)
    historical_shifts = 0
    
    for day_offset in range(5):
        day = last_week + timedelta(days=day_offset)
        
        for user in users:
            if random.random() > 0.6:  # 60% attendance
                continue
            
            clock_in = day.replace(hour=random.randint(8, 10), minute=random.randint(0, 59))
            hours_worked = random.uniform(6, 9)
            clock_out = clock_in + timedelta(hours=hours_worked)
            
            clock_in_str = clock_in.strftime("%Y-%m-%d %H:%M:%S")
            clock_out_str = clock_out.strftime("%Y-%m-%d %H:%M:%S")
            
            site = random.choice(sites)
            
            cursor.execute("""
                INSERT INTO shifts (company_id, user_id, clock_in_at, clock_out_at)
                VALUES (?, ?, ?, ?)
            """, (company_id, user[0], clock_in_str, clock_out_str))
            
            shift_id = cursor.lastrowid
            
            cursor.execute("""
                INSERT INTO shift_segments (company_id, shift_id, job_site_id, start_at, end_at)
                VALUES (?, ?, ?, ?, ?)
            """, (company_id, shift_id, site[0], clock_in_str, clock_out_str))
            
            historical_shifts += 1
    
    print(f"   ✅ Created {historical_shifts} historical shifts")
    
    conn.commit()
    
    # Show summary statistics
    print("\n" + "=" * 70)
    print("  📊 DATABASE SUMMARY")
    print("=" * 70)
    
    cursor.execute("""
        SELECT COUNT(*) FROM shifts WHERE clock_out_at IS NULL
    """)
    active = cursor.fetchone()[0]
    print(f"   👥 Currently clocked in: {active}")
    
    cursor.execute("""
        SELECT 
            ROUND(SUM(
                (julianday(COALESCE(clock_out_at, datetime('now'))) - 
                 julianday(clock_in_at)) * 24
            ), 2)
        FROM shifts 
        WHERE clock_in_at >= datetime('now', '-7 days')
    """)
    weekly_hours = cursor.fetchone()[0] or 0
    print(f"   ⏰ Hours this week: {weekly_hours:.2f}")
    
    cursor.execute("""
        SELECT 
            ROUND(SUM(
                (julianday(COALESCE(s.clock_out_at, datetime('now'))) - 
                 julianday(s.clock_in_at)) * 24 * u.hourly_rate
            ), 2)
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE s.clock_in_at >= datetime('now', '-7 days')
    """)
    weekly_pay = cursor.fetchone()[0] or 0
    print(f"   💰 Payroll this week: ${weekly_pay:,.2f}")
    
    cursor.execute("""
        SELECT COUNT(*) FROM shifts
    """)
    total_shifts = cursor.fetchone()[0]
    print(f"   📋 Total shifts in database: {total_shifts}")
    
    conn.close()
    
    print("\n" + "=" * 70)
    print("  ✅ TEST DATA CREATED SUCCESSFULLY!")
    print("=" * 70)
    print("\n  🚀 Now run: python calprotrack_connector.py")
    print("     to see Claude interact with REAL data!\n")


if __name__ == "__main__":
    print("\n⚠️  WARNING: This will DELETE existing shift data!")
    print("   Make sure you're okay with this before proceeding.\n")
    
    response = input("Continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        add_test_shifts()
    else:
        print("\n❌ Cancelled. No data was modified.")
