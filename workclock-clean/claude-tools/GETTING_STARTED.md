# SUPER SIMPLE STEP-BY-STEP GUIDE

## Step 1: Save the files
I've created two files for you:
- server.py (the API)
- test_client.py (to test it)

Download them from Claude and save them to: C:\Users\t37an\OneDrive\Desktop\develper\

## Step 2: Start the server

In PowerShell, run:
```powershell
python server.py
```

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**KEEP THIS WINDOW OPEN!** The server needs to keep running.

## Step 3: Test it (in a NEW PowerShell window)

Open a SECOND PowerShell window and run:
```powershell
cd C:\Users\t37an\OneDrive\Desktop\develper
python test_client.py
```

You'll see tasks being created, completed, and deleted!

## Step 4: See it in your browser

While the server is running, open your browser and go to:
http://127.0.0.1:8000/docs

You'll see an interactive API documentation page where you can test everything by clicking!

## What You Just Built

✅ A working REST API
✅ Create, read, update, delete tasks
✅ Automatic API documentation
✅ The foundation for all the other tools (calendar, email)

## Next Steps

Once this works:
1. Add a database (so tasks don't disappear when server restarts)
2. Add authentication (so it's your tasks, not anyone's)
3. Connect it to Claude's API (so Claude can manage tasks for you)
4. Build the calendar tool (similar pattern)
5. Build the email tool (similar pattern)

## If You Get Stuck

Common issues:

**"python: command not found"**
→ Try: `python3 server.py` instead

**"Address already in use"**
→ Port 8000 is taken, change port in server.py to 8001

**Can't connect to server**
→ Make sure server.py is still running in the other window

**Still stuck?**
→ Copy the error message and ask me!

---

## What's Actually Happening

1. server.py creates a web server that listens on port 8000
2. When you go to /task/create, it adds a task to the list
3. When you go to /task/list, it shows all tasks
4. test_client.py is just making web requests to test it

This is EXACTLY how Claude would interact with your tools:
- Claude calls /task/create with a task title
- Your server adds it to the database
- Claude gets a success response
- Done!

You've built the first piece! 🎉
