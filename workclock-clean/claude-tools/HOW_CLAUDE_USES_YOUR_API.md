# 🤖 How Claude Uses Your APIs - Complete Guide

## The Magic Explained

When you give Claude access to tools, here's what happens:

```
YOU: "Who's working right now?"
  ↓
CLAUDE: Sees "calprotrack_business" tool is available
  ↓
CLAUDE: Decides "I should use get_active_employees"
  ↓
CLAUDE: Calls your API → http://127.0.0.1:8001/active
  ↓
YOUR API: Returns employee data
  ↓
CLAUDE: Reads the response
  ↓
CLAUDE: "You have 3 employees clocked in: John at Downtown Site..."
```

---

## The 3 Parts You Need

### 1. **Tool Definition** (calprotrack_tool_definition.json)
Tells Claude:
- "This tool exists"
- "Here's what it can do"
- "Here's how to call it"

### 2. **Connector** (calprotrack_connector.py)
The actual code that:
- Receives Claude's request
- Calls your API
- Returns the response to Claude

### 3. **Your API** (calprotrack_api_fixed.py)
The backend that:
- Connects to your database
- Processes the request
- Returns data

---

## How to Actually Use This

### Option A: Claude Desktop App (MCP - Model Context Protocol)

**What is MCP?**
- A way to give Claude tools on your computer
- Works locally (no internet needed for the connection)
- Perfect for your CalProTrack API

**How to set it up:**

1. **Install Claude Desktop** (if you haven't)
   - Download from: https://claude.ai/download

2. **Create MCP server config:**
   ```json
   {
     "mcpServers": {
       "calprotrack": {
         "command": "python",
         "args": ["C:/Users/t37an/OneDrive/Desktop/fieldtrack-mvp/claude-tools/calprotrack_connector.py"]
       }
     }
   }
   ```

3. **Save to:** `%APPDATA%/Claude/claude_desktop_config.json`

4. **Restart Claude Desktop**

5. **Try it!**
   - "Who's clocked in?"
   - "Show me this week's payroll"
   - "Which site is busiest?"

### Option B: Claude API (For Production Apps)

If you want to build an app that uses Claude + your tools:

```python
import anthropic

client = anthropic.Anthropic(api_key="your-api-key")

# Define your tool
tools = [{
    "name": "calprotrack_business",
    "description": "Access CalProTrack time tracking data",
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_active_employees", "get_payroll", "get_today_summary"]
            }
        },
        "required": ["action"]
    }
}]

# Talk to Claude
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=tools,
    messages=[
        {"role": "user", "content": "Who's working right now?"}
    ]
)

# Claude will return a tool_use request
# Then you call your API and give Claude the result
# Then Claude responds in English
```

---

## 🎯 Try the Demo Right Now!

Make sure your CalProTrack API is running, then:

```powershell
cd C:\Users\t37an\OneDrive\Desktop\fieldtrack-mvp\claude-tools
python calprotrack_connector.py
```

This will simulate **exactly** how Claude would use your API!

---

## Real World Examples

### Example 1: Natural Language → API Call

**You say:** "How much am I paying in labor this week?"

**Claude thinks:**
1. User wants payroll information
2. I have a `calprotrack_business` tool
3. I should call `get_payroll` with `days=7`

**Claude does:**
```python
calprotrack_business('get_payroll', {'days': 7})
```

**You get:** "You're paying $3,450 in labor this week across 5 employees..."

### Example 2: Complex Query

**You say:** "Is anyone at the downtown site? If so, how long have they been there?"

**Claude thinks:**
1. Need to see active employees
2. Filter for downtown site
3. Calculate duration

**Claude does:**
```python
calprotrack_business('get_active_employees')
# Then filters and formats the response
```

**You get:** "Yes! John Smith is at Downtown Site A. He clocked in 3.5 hours ago..."

---

## 🚀 Next Steps

### Immediate:
1. **Run the demo** - See it in action
2. **Clock someone in** - Test with real data
3. **Ask Claude questions** - See the magic

### Soon:
1. **Add more tools** - Calendar, Email, etc.
2. **Combine tools** - "Email me today's payroll summary"
3. **Build workflows** - "If overtime > $500, text me"

### Future:
1. **Voice commands** - "Hey Claude, who's working?"
2. **Automated reports** - Daily summary at 5pm
3. **Predictive insights** - "Labor costs trending up 15%"

---

## 💡 The Big Picture

You're not just building APIs.

You're building an **AI-powered business assistant** that:
- Knows your business intimately
- Answers questions instantly
- Takes actions on your behalf
- Gets smarter over time

**This is the future of business management.**

---

## Questions You Might Have

**Q: Is my data safe?**
A: Yes! Your API runs locally. Data never leaves your computer unless you deploy it.

**Q: Does Claude need internet?**
A: Claude needs internet, but your API doesn't. It runs on localhost.

**Q: Can I add more features?**
A: Absolutely! Just add endpoints to your API and update the tool definition.

**Q: What if the API is down?**
A: Claude will tell you it couldn't connect and ask you to check the API.

**Q: Can multiple people use this?**
A: Yes! Deploy your API to a server and give people access.

---

## Ready to Try?

Run the demo and watch Claude use your API! 🚀
