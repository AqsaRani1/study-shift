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
const CITIES = {
  lahore: {
    name: "Lahore",
    utility: "LESCO",
    province: "Punjab",
    peak: "6–10 PM",
  },
  karachi: {
    name: "Karachi",
    utility: "K-Electric",
    province: "Sindh",
    peak: "5–9 PM",
  },
  islamabad: {
    name: "Islamabad",
    utility: "IESCO",
    province: "ICT",
    peak: "6–10 PM",
  },
};
function getGroupPattern(city, group) {
  // simple deterministic fallback pattern
  const base = Array(24).fill(1);

  for (let i = 0; i < 24; i++) {
    if ((i + group) % 6 === 0) base[i] = 0;
  }

  return base;
}
function renderDash() {
  const pat = getPattern();

  const power = pat.filter((v) => v === 1).length;
  const outage = 24 - power;

  setText("sc-power", power + "h");
  setText("sc-outage", outage + "h");
  setText("sc-tasks", S.tasks.filter((t) => !t.done).length);

  const p = document.getElementById("scf-power");
  const o = document.getElementById("scf-outage");

  if (p) p.style.width = (power / 24) * 100 + "%";
  if (o) o.style.width = (outage / 24) * 100 + "%";
}
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}
function renderSched() {}

function renderTasks() {
  const el = document.getElementById("tasks-list");
  if (!el) return;

  el.innerHTML = S.tasks
    .map(
      (t) =>
        `<div class="task">
      <b>${esc(t.name)}</b> - ${t.duration}min
    </div>`,
    )
    .join("");
}

function renderCities() {}
function addMsg(role, html) {
  console.log(role, html);
}

function addThinking() {
  return { remove: () => {} };
}

function formatMsg(t) {
  return t;
}
function tick() {
  // prevents crash (you can upgrade later)
}

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
function refreshUI() {
  const u = S.user;
  const c = CITIES?.[u.city] || { name: "Unknown", utility: "" };

  const el1 = document.getElementById("sb-uname");
  if (el1) el1.textContent = u.name;

  const el2 = document.getElementById("sb-ucity");
  if (el2) el2.textContent = `${c.name} · Group ${u.group}`;

  const h = new Date().getHours();
  const g =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const greet = document.getElementById("greeting");
  if (greet) greet.textContent = `${g}, ${u.name}`;
}
