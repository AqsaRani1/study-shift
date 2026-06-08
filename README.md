# ⚡ StudyShift
### AI-powered study planner that works around Pakistan's load shedding

> Built for DeveloperWeek NY 2026 Hackathon

---

## What it does

StudyShift helps Pakistani students plan study sessions around daily load shedding.
It uses Claude AI (with web search) to fetch real-time outage schedules and
auto-schedules tasks into power-available windows.

**10 cities covered · AI live data · Conflict detection · Auto-reschedule**

---

## ⚡ Quick Start (3 steps)

### Step 1 — Add your API key

Open `config.js` and replace `YOUR_API_KEY_HERE` with your Claude API key:

```js
window.STUDYSHIFT_CONFIG = {
  CLAUDE_API_KEY: 'sk-ant-api03-YOUR-REAL-KEY-HERE',
  ...
};
```

Get a free key at: https://console.anthropic.com
New accounts get free credits. Takes 2 minutes.

### Step 2 — Open the app

Just open `index.html` in any modern browser (Chrome, Firefox, Edge).
No server needed. No npm. No build step.

```
double-click index.html   ← that's it
```

### Step 3 — Test it

1. Fill in your name, city (e.g. Lahore), and group (e.g. 4)
2. Click **Launch StudyShift**
3. On the Dashboard, click **Fetch Live Data** — Claude AI will search
   the web for today's real schedule
4. Add a task, watch it get auto-scheduled into a power window
5. Go to **AI Assistant** and ask: *"What's today's load shedding schedule?"*

---

## Project Structure

```
studyshift/
├── index.html     ← Main app (all pages)
├── style.css      ← All styles (dark editorial theme)
├── app.js         ← App logic + Claude API integration
├── data.js        ← City data + schedule helpers
├── config.js      ← YOUR API KEY GOES HERE (never commit this)
├── .gitignore     ← Excludes config.js from git
└── README.md      ← This file
```

---

## Security — How the API key is protected

- The key lives **only** in `config.js` on your local machine
- `config.js` is listed in `.gitignore` — it will **never** be committed to GitHub
- When deploying, set the key as an **environment variable** in Netlify/Vercel
- The app uses the official Anthropic browser API with CORS headers

**For hackathon demo deployment:**
1. Deploy all files **except** `config.js` to Netlify/GitHub Pages
2. In Netlify: Site Settings → Environment Variables → add `CLAUDE_API_KEY`
3. Or for quick demo: temporarily include a key with spending limits set

---

## Features

| Feature | Description |
|---|---|
| AI Live Schedule | Claude searches the web for today's real outage times |
| Smart Scheduler | Auto-places tasks in power-available windows |
| Conflict Detection | Flags tasks that overlap with outages |
| Auto-Fix | One click reschedules all conflicting tasks |
| Weekly View | 7-day schedule with best study windows |
| AI Chat | Ask anything about load shedding or study planning |
| 10 Cities | Lahore, Karachi, Islamabad, Faisalabad, Multan, Peshawar, Quetta, Sialkot, Gujranwala, Hyderabad |
| Offline Fallback | Static schedules when AI is unavailable |
| Mobile Responsive | Works on phone, tablet, desktop |
| LocalStorage | All data persists between sessions |

---

## Tech Stack

- **HTML / CSS / JavaScript** — no framework, no build step
- **Claude API** (claude-sonnet-4-20250514) with web_search tool
- **Bootstrap Icons** for all iconography
- **Google Fonts** — Syne (display) + DM Sans (body)

---

## Submitting to Hackathon

### Deploy (2 minutes)
1. Go to **netlify.com** → Sign up free
2. Drag the entire `studyshift/` folder onto Netlify drop zone
3. Your URL: `studyshift.netlify.app` (rename in site settings)

### Devpost submission
- **Project name:** StudyShift
- **Tagline:** AI study planner that works around Pakistan's load shedding
- **Live URL:** your-netlify-url.netlify.app
- **Video:** 60-second screen recording (see demo script below)
- **Challenges:** name.com Domain Roulette + Overall Winner

### Demo video script (60 seconds)
```
0-5s:  "220 million Pakistanis face up to 12 hours of outages daily.
        Students lose their study time with the electricity."
5-15s: [Show onboarding] "StudyShift sets up in seconds."
15-30s:[Dashboard] "The AI fetches today's real schedule from the web."
30-45s:[Add task] "Tasks auto-schedule into power windows."
45-55s:[Conflict + auto-fix] "Conflicts are flagged and fixed with one click."
55-60s:[AI chat] "Ask the AI anything. StudyShift — study smarter."
```

---

## Notes on Real Data

Load shedding schedules in Pakistan change frequently. The AI fetch button
uses Claude with web search to find the most current schedule from utility
websites and news sources. This is more reliable than any static dataset.

Official utility websites for manual verification:
- LESCO (Lahore): lesco.com.pk
- IESCO (Islamabad): iesco.com.pk  
- K-Electric (Karachi): ke.com.pk
- FESCO (Faisalabad): fesco.com.pk
- MEPCO (Multan): mepco.com.pk

---

*Built with Claude AI · DeveloperWeek NY 2026 Hackathon*
