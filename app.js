// ============================================================
// STUDYSHIFT v2 — FIXED VERSION (Netlify + Local safe)
// ============================================================

// ── STATE ──
const S = {
  user: { name: "", city: "lahore", group: 4 },
  tasks: [],
  aiPattern: null,
  aiSource: "",
  weekOffset: 0,
  taskFilter: "all",
  editId: null,
  chatHistory: [],
  busy: false,
  chatBusy: false,
};

// ── API KEY ──
function getApiKey() {
  return window.STUDYSHIFT_CONFIG?.CLAUDE_API_KEY || null;
}

function aiAvailable() {
  return !!getApiKey() || location.hostname.includes("localhost");
}

// ── BOOT ──
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  if (S.user.name) launch();
  setInterval(tick, 1000);
});

// ── STORAGE ──
function loadState() {
  try {
    const r = localStorage.getItem("ss_v3");
    if (r) Object.assign(S, JSON.parse(r));
  } catch (e) {}
}

function save() {
  try {
    const { busy, chatBusy, ...d } = S;
    localStorage.setItem("ss_v3", JSON.stringify(d));
  } catch (e) {}
}

// ─────────────────────────────────────────────
// 🔴 FIX #1: MISSING FUNCTION (CRITICAL)
// ─────────────────────────────────────────────
function getPattern() {
  return S.aiPattern || getGroupPattern(S.user.city, S.user.group);
}

// ── SAFE API ENDPOINT DETECTION ──
function getApiEndpoint() {
  // Netlify
  if (
    location.hostname.includes("netlify") ||
    location.hostname.includes("localhost")
  ) {
    return "/api/claude";
  }
  // fallback
  return "/api/claude";
}

// ─────────────────────────────────────────────
// 🔴 FIX #2: SINGLE CLEAN CLAUDE FUNCTION
// ─────────────────────────────────────────────
async function callClaude(messages, system, webSearch = false) {
  const cfg = window.STUDYSHIFT_CONFIG || {};
  const endpoint = getApiEndpoint();

  const body = {
    model: cfg.MODEL || "claude-sonnet-4-20250514",
    max_tokens: webSearch ? 2048 : 1024,
    system,
    messages,
  };

  if (webSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const headers = { "Content-Type": "application/json" };

  // If NOT using Netlify proxy → send key
  if (!endpoint.startsWith("/api/")) {
    const key = getApiKey();
    if (!key) throw new Error("Missing API key in config.js");
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Network error: API server not reachable");
  }

  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch {}

    throw new Error(`API Error ${res.status}: ${errText || "Request failed"}`);
  }

  const data = await res.json();

  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ─────────────────────────────────────────────
// FIXED AI USAGE WRAPPER
// ─────────────────────────────────────────────
async function safeClaude(messages, system, webSearch = false) {
  if (!aiAvailable()) {
    throw new Error("AI not configured. Add API key or run Netlify function.");
  }
  return await callClaude(messages, system, webSearch);
}

// ─────────────────────────────────────────────
// LOAD + LAUNCH
// ─────────────────────────────────────────────
function launch() {
  document.getElementById("onboarding").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  refreshUI();
  autoSchedule();
  renderDash();
  renderSched();
  renderTasks();
  renderCities();
  tick();
}

// ─────────────────────────────────────────────
// FIX SAFE AUTO SCHEDULE
// ─────────────────────────────────────────────
function autoSchedule() {
  const pat = getPattern(); // FIXED
  const occ = {};

  S.tasks.forEach((t) => {
    if (t.done) return;

    const slot = findSlot(t, pat, occ);
    t.scheduledTime = slot !== null ? String(slot) : "";

    if (slot !== null) markOcc(occ, t);
  });

  save();
}

// ─────────────────────────────────────────────
// FIX SLOT FINDING SAFETY
// ─────────────────────────────────────────────
function findSlot(task, pat, occ) {
  const now = new Date().getHours();

  for (let h = now; h < 24; h++) {
    if (fits(task, pat, occ, h)) return h;
  }

  for (let h = 0; h < now; h++) {
    if (fits(task, pat, occ, h)) return h;
  }

  return null;
}

function fits(task, pat, occ, sh) {
  const eh = Math.min(sh + Math.ceil(task.duration / 60), 24);

  for (let h = sh; h < eh; h++) {
    if (task.needsPower && pat[h] === 0) return false;
    if (occ[h]) return false;
  }
  return true;
}

function markOcc(occ, t) {
  const sh = +t.scheduledTime;
  const eh = Math.min(sh + Math.ceil(t.duration / 60), 24);

  for (let h = sh; h < eh; h++) {
    occ[h] = true;
  }
}

// ─────────────────────────────────────────────
// AI SCHEDULE (FIXED ERROR HANDLING)
// ─────────────────────────────────────────────
async function fetchAISchedule() {
  try {
    const c = CITIES[S.user.city];

    const SYS = `Return ONLY JSON: {"hours":[0/1 x24],"source":"","note":""}`;
    const MSG = `Load shedding ${c.name} group ${S.user.group}`;

    const raw = await safeClaude([{ role: "user", content: MSG }], SYS, true);

    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

    if (!Array.isArray(json.hours) || json.hours.length !== 24) {
      throw new Error("Invalid AI schedule");
    }

    S.aiPattern = json.hours;
    S.aiSource = json.source || "AI";

    save();
    autoSchedule();
    renderDash();
  } catch (e) {
    console.error(e);
  }
}

// ─────────────────────────────────────────────
// CHAT SAFE CALL
// ─────────────────────────────────────────────
async function sendMsg() {
  if (S.chatBusy) return;

  const inp = document.getElementById("chat-inp");
  const msg = inp.value.trim();
  if (!msg) return;

  S.chatBusy = true;
  inp.value = "";

  addMsg("user", esc(msg));
  const thinking = addThinking();

  try {
    const SYS = "You are a helpful student assistant.";
    const reply = await safeClaude(
      [...S.chatHistory, { role: "user", content: msg }],
      SYS,
      true,
    );

    thinking.remove();
    addMsg("assistant", formatMsg(reply));
  } catch (e) {
    thinking.remove();
    addMsg("assistant", "Error: " + e.message);
  }

  S.chatBusy = false;
}

// ─────────────────────────────────────────────
// BASIC UI HELPERS (UNCHANGED SAFE)
// ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36);
}

function esc(s) {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
