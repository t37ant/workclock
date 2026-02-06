# 3. connector.py - Connect Claude to your server
import requests

def task_manage(action, title=None):
    if action == "create":
        requests.post("http://localhost:8000/task/create", 
                     json={"title": title})
    elif action == "list":
        return requests.get("http://localhost:8000/task/list").json()