# GitHub Project Analyzer v3

A full-stack developer tool: analyze any GitHub repo and chat with a Gemini AI assistant about it.

---

## Setup (2 minutes)

### 1. Install
```bash
cd github-analyzer
npm install
```

### 2. Add your Gemini API key

Open **`server.js`** and find **line 12**:
```js
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
```
Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key.

**Get a free key →** https://aistudio.google.com/app/apikey

Or pass it as an environment variable instead of editing the file:
```bash
GEMINI_API_KEY=AIzaSy... node server.js
```

> The AI chat shows a clear error message if the key is missing — everything else works without it.

### 3. Run
```bash
npm start
```

Open **http://localhost:3000**

---

## Why it was redirecting

The old version used `/api/analyze` as the endpoint name. If the HTML file was opened directly from the filesystem (`file://`) instead of through the Express server, `fetch('/api/analyze')` had nowhere to go and the browser fell back to external routing.

**v3 fixes:**
- All fetch calls use bare paths: `fetch('/analyze', ...)` and `fetch('/ask-ai', ...)`
- The Express server registers exactly those routes: `app.post('/analyze', ...)` and `app.post('/ask-ai', ...)`
- `document.addEventListener('submit', e => e.preventDefault())` blocks any accidental form navigation
- The `app.get('*')` catch-all always returns `index.html` — no external redirects possible

---

## Layout

```
┌─ Top Nav ────────────────────────────────────────────────────┐
│ ⬡ GitHub Project Analyzer     Understand any repo instantly  │
├──────────────────────────────────────────────────────────────┤
│ owner / repoName                                             │
│ Description…                                                 │
├──────────────────┬───────────────────────────────────────────┤
│  LEFT (main)     │  RIGHT (sticky sidebar)                   │
│                  │                                           │
│  Overview        │  ┌─ AI Repository Assistant ────────────┐ │
│  Tech Stack      │  │  Chat history                        │ │
│  Project Metrics │  │  [Explain this project]              │ │
│  Activity        │  │  [How complex is this?]              │ │
│  Contributors    │  │  [What technologies?]                │ │
│  File Tree       │  │  [Beginner friendly?]                │ │
│  Summary         │  │  [Summarize architecture]            │ │
│                  │  │                                       │ │
│                  │  │  ┌─────────────────────┐ [→]        │ │
│                  │  │  │ Ask anything…       │             │ │
│                  │  └───────────────────────────────────── ┘ │
└──────────────────┴───────────────────────────────────────────┘
```

---

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/analyze` | Fetch & analyze a GitHub repo |
| POST | `/ask-ai` | Ask Gemini about the analyzed repo |
| GET | `*` | Serve `index.html` |

---

## Stack
Node.js · Express · Vanilla JS · HTML · CSS · GitHub REST API · Google Gemini 2.0 Flash
