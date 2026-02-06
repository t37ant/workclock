"""
CalProTrack Tool Connector
This is what runs BEHIND Claude when it uses your CalProTrack tool
"""

import requests
import json

# Your API base URL
API_BASE = "http://127.0.0.1:8001"

def calprotrack_business(action: str, parameters: dict = None):
    """
    Claude calls this function when it needs CalProTrack data
    
    Args:
        action: What to do (get_active_employees, get_payroll, etc.)
        parameters: Optional parameters (days, employee_id, etc.)
    
    Returns:
        dict: The response from your CalProTrack API
    """
    
    if parameters is None:
        parameters = {}
    
    try:
        # Route to the correct endpoint based on action
        if action == "get_active_employees":
            response = requests.get(f"{API_BASE}/active")
            
        elif action == "get_payroll":
            days = parameters.get('days', 7)
            response = requests.get(f"{API_BASE}/payroll?days={days}")
            
        elif action == "get_employee_hours":
            employee_id = parameters.get('employee_id')
            if not employee_id:
                return {"error": "employee_id is required for get_employee_hours"}
            days = parameters.get('days', 30)
            response = requests.get(f"{API_BASE}/employee/{employee_id}/hours?days={days}")
            
        elif action == "get_busy_sites":
            response = requests.get(f"{API_BASE}/sites/busy")
            
        elif action == "get_today_summary":
            response = requests.get(f"{API_BASE}/today")
            
        else:
            return {"error": f"Unknown action: {action}"}
        
        # Return the JSON response
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "error": f"API returned status {response.status_code}",
                "message": response.text
            }
            
    except requests.exceptions.ConnectionError:
        return {
            "error": "Could not connect to CalProTrack API",
            "message": "Make sure the API is running at http://127.0.0.1:8001"
        }
    except Exception as e:
        return {
            "error": "Unexpected error",
            "message": str(e)
        }


# ==================== DEMO: How Claude Would Use This ====================

def demo_claude_conversation():
    """
    This simulates how Claude would use your CalProTrack tool
    """
    
    print("=" * 70)
    print("  DEMO: CLAUDE USING YOUR CALPROTRACK API")
    print("=" * 70)
    
    # Scenario 1: User asks about active employees
    print("\n👤 USER: Who's working right now?")
    print("\n🤖 CLAUDE: Let me check your CalProTrack system...")
    print("    [Claude calls: calprotrack_business('get_active_employees')]")
    
    result = calprotrack_business('get_active_employees')
    print(f"\n📊 RESULT: {json.dumps(result, indent=2)}")
    
    if isinstance(result, list) and len(result) > 0:
        print("\n🤖 CLAUDE: You have employees currently clocked in:")
        for emp in result:
            print(f"    • {emp['name']} at {emp['site_name']} ({emp['hours_today']} hours so far)")
    else:
        print("\n🤖 CLAUDE: Nobody is currently clocked in.")
    
    # Scenario 2: User asks about payroll
    print("\n" + "=" * 70)
    print("\n👤 USER: What's my payroll looking like this week?")
    print("\n🤖 CLAUDE: I'll pull this week's payroll data...")
    print("    [Claude calls: calprotrack_business('get_payroll', {'days': 7})]")
    
    result = calprotrack_business('get_payroll', {'days': 7})
    print(f"\n📊 RESULT: {json.dumps(result, indent=2)}")
    
    if isinstance(result, list) and len(result) > 0:
        total_pay = sum(entry['total_pay'] for entry in result)
        total_hours = sum(entry['total_hours'] for entry in result)
        
        print(f"\n🤖 CLAUDE: Here's your weekly payroll summary:")
        print(f"    • Total Hours: {total_hours:.2f} hrs")
        print(f"    • Total Payroll: ${total_pay:,.2f}")
        print(f"    • Number of Employees: {len(result)}")
        for entry in result:
            print(f"      - {entry['name']}: {entry['total_hours']} hrs = ${entry['total_pay']:.2f}")
    else:
        print("\n🤖 CLAUDE: No shifts recorded this week yet.")
    
    # Scenario 3: User asks about today
    print("\n" + "=" * 70)
    print("\n👤 USER: Give me today's summary")
    print("\n🤖 CLAUDE: Getting today's business metrics...")
    print("    [Claude calls: calprotrack_business('get_today_summary')]")
    
    result = calprotrack_business('get_today_summary')
    print(f"\n📊 RESULT: {json.dumps(result, indent=2)}")
    
    if 'error' not in result:
        print(f"\n🤖 CLAUDE: Here's what happened today ({result['date']}):")
        print(f"    • Employees worked: {result['employees_worked']}")
        print(f"    • Currently active: {result['currently_active']}")
        print(f"    • Total hours: {result['total_hours']:.2f} hrs")
        print(f"    • Total labor cost: ${result['total_pay']:,.2f}")
    
    # Scenario 4: User asks which site is busiest
    print("\n" + "=" * 70)
    print("\n👤 USER: Which job site is the busiest right now?")
    print("\n🤖 CLAUDE: Checking site activity...")
    print("    [Claude calls: calprotrack_business('get_busy_sites')]")
    
    result = calprotrack_business('get_busy_sites')
    print(f"\n📊 RESULT: {json.dumps(result, indent=2)}")
    
    if isinstance(result, list) and len(result) > 0:
        busiest = result[0]
        print(f"\n🤖 CLAUDE: The busiest site right now is:")
        print(f"    📍 {busiest['site_name']}")
        print(f"    👥 {busiest['active_employees']} employees currently there")
        print(f"    ⏰ {busiest['total_hours_today']:.2f} total hours today")
    
    print("\n" + "=" * 70)
    print("  ✅ DEMO COMPLETE!")
    print("=" * 70)
    print("\n💡 This is exactly how Claude would use your API!")
    print("   You just ask questions in plain English,")
    print("   and Claude automatically calls the right endpoints.\n")


if __name__ == "__main__":
    demo_claude_conversation()
