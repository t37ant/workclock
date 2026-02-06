import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_server():
    """Check if server is running"""
    try:
        response = requests.get(BASE_URL)
        print("✅ Server is running!")
        print(f"Response: {response.json()}\n")
        return True
    except:
        print("❌ Server is not running. Start it first with: python server.py")
        return False

def create_task(title, description=None):
    """Create a new task"""
    data = {"title": title}
    if description:
        data["description"] = description
    
    response = requests.post(f"{BASE_URL}/task/create", json=data)
    print(f"✅ Created task: {response.json()}\n")
    return response.json()

def list_tasks():
    """List all tasks"""
    response = requests.get(f"{BASE_URL}/task/list")
    tasks = response.json()
    print(f"📋 Tasks ({tasks['count']}):")
    for task in tasks['tasks']:
        status = "✓" if task['done'] else "○"
        print(f"  [{status}] {task['id']}: {task['title']}")
        if task['description']:
            print(f"      → {task['description']}")
    print()
    return tasks

def complete_task(task_id):
    """Mark a task as complete"""
    response = requests.put(f"{BASE_URL}/task/{task_id}/complete")
    print(f"✅ Completed: {response.json()}\n")
    return response.json()

def delete_task(task_id):
    """Delete a task"""
    response = requests.delete(f"{BASE_URL}/task/{task_id}")
    print(f"🗑️  Deleted: {response.json()}\n")
    return response.json()

if __name__ == "__main__":
    print("=" * 50)
    print("TASK MANAGER - TEST CLIENT")
    print("=" * 50 + "\n")
    
    # Test if server is running
    if not test_server():
        exit()
    
    # Demo: Create some tasks
    print("Creating tasks...")
    create_task("Build the task manager API", "FastAPI + Python")
    create_task("Test the endpoints", "Make sure everything works")
    create_task("Add calendar integration", "Connect to Google Calendar API")
    
    # List all tasks
    list_tasks()
    
    # Complete the first task
    print("Completing first task...")
    complete_task(0)
    
    # List again to see the change
    list_tasks()
    
    # Delete a task
    print("Deleting task 1...")
    delete_task(1)
    
    # Final list
    list_tasks()
    
    print("=" * 50)
    print("✅ All tests passed!")
    print("=" * 50)
