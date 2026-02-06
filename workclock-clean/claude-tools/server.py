from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Task Manager API")

# Simple in-memory storage (resets when server restarts)
tasks = []

class Task(BaseModel):
    title: str
    description: Optional[str] = None
    done: bool = False

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    done: bool

@app.get("/")
def root():
    return {"message": "Task Manager API is running!", "tasks_count": len(tasks)}

@app.post("/task/create")
def create_task(task: Task):
    task_id = len(tasks)
    task_data = {
        "id": task_id,
        "title": task.title,
        "description": task.description,
        "done": task.done
    }
    tasks.append(task_data)
    return {"status": "created", "task": task_data}

@app.get("/task/list")
def list_tasks():
    return {"tasks": tasks, "count": len(tasks)}

@app.get("/task/{task_id}")
def get_task(task_id: int):
    if task_id < len(tasks):
        return tasks[task_id]
    return {"error": "Task not found"}

@app.put("/task/{task_id}/complete")
def complete_task(task_id: int):
    if task_id < len(tasks):
        tasks[task_id]["done"] = True
        return {"status": "completed", "task": tasks[task_id]}
    return {"error": "Task not found"}

@app.delete("/task/{task_id}")
def delete_task(task_id: int):
    if task_id < len(tasks):
        deleted = tasks.pop(task_id)
        # Reindex remaining tasks
        for i, task in enumerate(tasks):
            task["id"] = i
        return {"status": "deleted", "task": deleted}
    return {"error": "Task not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
