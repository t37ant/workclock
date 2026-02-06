import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8001"

def print_section(title):
    """Print a nice section header"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_connection():
    """Test if the API is running"""
    try:
        response = requests.get(BASE_URL)
        data = response.json()
        print("✅ CalProTrack API is running!")
        print(f"   📊 Active Employees: {data['stats']['active_employees']}")
        print(f"   📍 Active Sites: {data['stats']['active_sites']}")
        print(f"   ⏰ Currently Clocked In: {data['stats']['currently_clocked_in']}")
        return True
    except Exception as e:
        print(f"❌ Could not connect to API: {e}")
        print("   Make sure you run: python calprotrack_api.py")
        return False

def get_active_employees():
    """Show who's currently clocked in"""
    print_section("WHO'S WORKING RIGHT NOW?")
    
    response = requests.get(f"{BASE_URL}/active")
    employees = response.json()
    
    if not employees:
        print("   Nobody is clocked in right now.")
        return
    
    for emp in employees:
        print(f"\n   👤 {emp['name']} ({emp['email']})")
        print(f"      📍 Site: {emp['site_name']}")
        print(f"      📫 Address: {emp['site_address']}")
        print(f"      ⏰ Clocked in at: {emp['clocked_in_at']}")
        print(f"      ⏱️  Hours so far: {emp['hours_today']} hrs")

def get_payroll():
    """Get this week's payroll"""
    print_section("THIS WEEK'S PAYROLL (Last 7 Days)")
    
    response = requests.get(f"{BASE_URL}/payroll?days=7")
    payroll = response.json()
    
    if not payroll:
        print("   No shifts in the last 7 days.")
        return
    
    total_hours = 0
    total_pay = 0
    
    for entry in payroll:
        print(f"\n   👤 {entry['name']}")
        print(f"      📧 {entry['email']}")
        print(f"      💵 Rate: ${entry['hourly_rate']}/hr")
        print(f"      ⏰ Hours: {entry['total_hours']} hrs")
        print(f"      💰 Pay: ${entry['total_pay']:.2f}")
        
        total_hours += entry['total_hours']
        total_pay += entry['total_pay']
    
    print(f"\n   {'─' * 50}")
    print(f"   📊 TOTALS:")
    print(f"      ⏰ Total Hours: {total_hours:.2f} hrs")
    print(f"      💰 Total Payroll: ${total_pay:.2f}")

def get_employee_hours(user_id=None):
    """Get hours for a specific employee"""
    if user_id is None:
        # Get first employee
        response = requests.get(f"{BASE_URL}/employees")
        employees = response.json()['employees']
        if not employees:
            print("   No employees found.")
            return
        user_id = employees[0]['id']
    
    print_section(f"EMPLOYEE #{user_id} - LAST 30 DAYS")
    
    response = requests.get(f"{BASE_URL}/employee/{user_id}/hours?days=30")
    data = response.json()
    
    print(f"\n   👤 {data['name']}")
    print(f"   📧 {data['email']}")
    print(f"   📅 Shifts: {data['shift_count']}")
    print(f"   ⏰ Total Hours: {data['total_hours']} hrs")
    print(f"   💰 Total Pay: ${data['total_pay']:.2f}")

def get_busy_sites():
    """Show which sites are busiest"""
    print_section("BUSIEST SITES TODAY")
    
    response = requests.get(f"{BASE_URL}/sites/busy")
    sites = response.json()
    
    if not sites:
        print("   No site activity.")
        return
    
    for i, site in enumerate(sites, 1):
        print(f"\n   #{i} 📍 {site['site_name']}")
        print(f"      📫 {site['site_address']}")
        print(f"      👥 Active Now: {site['active_employees']} employees")
        print(f"      ⏰ Hours Today: {site['total_hours_today']:.2f} hrs")

def get_today_summary():
    """Get today's summary"""
    print_section("TODAY'S SUMMARY")
    
    response = requests.get(f"{BASE_URL}/today")
    data = response.json()
    
    print(f"\n   📅 Date: {data['date']}")
    print(f"   👥 Employees Who Worked: {data['employees_worked']}")
    print(f"   ⏰ Currently Active: {data['currently_active']}")
    print(f"   ⏱️  Total Hours: {data['total_hours']:.2f} hrs")
    print(f"   💰 Total Pay: ${data['total_pay']:.2f}")

def main():
    print("\n" + "=" * 60)
    print("  🚀 CALPROTRACK API - BUSINESS INSIGHTS")
    print("=" * 60)
    
    # Test connection
    if not test_connection():
        return
    
    # Run all reports
    get_today_summary()
    get_active_employees()
    get_payroll()
    get_busy_sites()
    get_employee_hours()
    
    print("\n" + "=" * 60)
    print("  ✅ ALL REPORTS GENERATED!")
    print("=" * 60)
    print("\n  💡 TIP: Open http://127.0.0.1:8001/docs")
    print("     to try the interactive API playground!\n")

if __name__ == "__main__":
    main()
