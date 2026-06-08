// ============================================================
// STUDYSHIFT v3 — CLEAN + NETLIFY READY app.js
// AI proxy: /api/claude (Netlify Function or local server)
// ============================================================

/* ───────────────────────── STATE ───────────────────────── */

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

/* ───────────────────── CONFIG HELPERS ───────────────────── */

function getApiKey() {
  return window.STUDYSHIFT_CONFIG?.CLAUDE_API_KEY &&
    window.STUDYSHIFT_CONFIG.CLAUDE_API_KEY !== "YOUR_API_KEY_HERE"
    ? window.STUDYSHIFT_CONFIG.CLAUDE_API_KEY
    : null;
}

function getApiEndpoint() {
  return "/api/claude"; // Netlify Function endpoint
}

function aiAvailable() {
  return true; // proxy handles key server-side
}

/* ─────────────────────── BOOT ─────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  if (S.user.name) launch();
  setInterval(tick, 1000);
});

function loadState() {
  try {
    const r = localStorage.getItem("ss_v3");
    if (r) Object.assign(S, JSON.parse(r));
  } catch {}
}

function save() {
  try {
    const { busy, chatBusy, ...clean } = S;
    localStorage.setItem("ss_v3", JSON.stringify(clean));
  } catch {}
}

/* ───────────────── ONBOARDING ───────────────── */

function completeOnboarding() {
  const name = document.getElementById("ob-name").value.trim() || "Student";
  const city = document.getElementById("ob-city").value;
  const group = parseInt(document.getElementById("ob-group").value);

  S.user = { name, city, group };

  if (!S.tasks.length) seedTasks();

  save();
  launch();
}

function seedTasks() {
  S.tasks = [
    {
      id: uid(),
      name: "Read Chapter 7 — Organic Chemistry",
      subject: "study",
      duration: 45,
      needsPower: false,
      preferredTime: "",
      done: false,
      scheduledTime: "",
    },
    {
      id: uid(),
      name: "Online past papers — Physics",
      subject: "online",
      duration: 60,
      needsPower: true,
      preferredTime: "",
      done: false,
      scheduledTime: "",
    },
    {
      id: uid(),
      name: "Watch lecture — Mathematics",
      subject: "video",
      duration: 90,
      needsPower: true,
      preferredTime: "",
      done: false,
      scheduledTime: "",
    },
  ];
}

/* ───────────────── LAUNCH ───────────────── */

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

/* ───────────────── UI ───────────────── */

function refreshUI() {
  const u = S.user;
  const c = CITIES[u.city];

  document.getElementById("sb-av").textContent = (
    u.name?.[0] || "S"
  ).toUpperCase();

  document.getElementById("sb-uname").textContent = u.name;
  document.getElementById("sb-ucity").textContent =
    `${c.name} · Group ${u.group}`;

  const h = new Date().getHours();
  const greet =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  document.getElementById("greeting").textContent = `${greet}, ${u.name}`;
  document.getElementById("today-dt").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
}

/* ───────────────── AI CALL (FIXED) ───────────────── */

async function callClaude(messages, system, webSearch = false) {
  const endpoint = getApiEndpoint();

  const body = {
    model: window.STUDYSHIFT_CONFIG?.MODEL || "claude-sonnet-4-20250514",
    max_tokens: webSearch ? 2048 : 1024,
    system,
    messages,
  };

  if (webSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();

  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/* ───────────────── AI SCHEDULE ───────────────── */

async function fetchAISchedule() {
  if (S.busy) return;
  S.busy = true;

  const btn = document.getElementById("ai-bar-btn");
  const icon = document.getElementById("ai-bar-icon");

  btn.disabled = true;
  icon.className = "bi bi-arrow-clockwise spinning";

  const c = CITIES[S.user.city];

  const SYS = `
Return ONLY JSON:
{"hours":[0/1 x24],"source":"...","note":"..."}
`;

  const MSG = `
Load shedding for ${c.name}, Group ${S.user.group}.
Return 24-hour 0/1 schedule.
`;

  try {
    const raw = await callClaude([{ role: "user", content: MSG }], SYS, true);

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Invalid AI output");

    const parsed = JSON.parse(raw.slice(start, end + 1));

    if (!Array.isArray(parsed.hours) || parsed.hours.length !== 24)
      throw new Error("Invalid 24-hour data");

    S.aiPattern = parsed.hours;
    S.aiSource = parsed.source || "AI";

    save();
    autoSchedule();
    renderDash();

    icon.className = "bi bi-check-circle-fill";
  } catch (e) {
    console.error(e);
    setAIBarSub("Failed AI fetch — using default schedule");
    icon.className = "bi bi-exclamation-circle-fill";
  } finally {
    S.busy = false;
    btn.disabled = false;
  }
}

/* ───────────────── CHAT ───────────────── */

async function sendMsg() {
  if (S.chatBusy) return;

  const inp = document.getElementById("chat-inp");
  const msg = inp.value.trim();
  if (!msg) return;

  inp.value = "";
  S.chatBusy = true;

  addMsg("user", esc(msg));
  const thinking = addThinking();

  S.chatHistory.push({ role: "user", content: msg });

  const c = CITIES[S.user.city];

  const SYS = `
You are StudyShift AI for Pakistani students.
Be concise and practical.
`;

  try {
    const reply = await callClaude(S.chatHistory.slice(-10), SYS, true);

    thinking.remove();

    S.chatHistory.push({ role: "assistant", content: reply });
    addMsg("assistant", formatMsg(reply));
  } catch (e) {
    thinking.remove();
    addMsg("assistant", "Error: " + e.message);
  } finally {
    S.chatBusy = false;
  }
}

/* ───────────────── TASK SAFE EDIT FIX ───────────────── */

function saveTask() {
  const name = document.getElementById("t-name").value.trim();
  if (!name) return highlight("t-name");

  const i = S.editId ? S.tasks.findIndex((t) => t.id === S.editId) : -1;

  const old = i > -1 ? S.tasks[i] : null;

  const task = {
    id: old?.id || uid(),
    name,
    subject: document.getElementById("t-subj").value,
    duration: parseInt(document.getElementById("t-dur").value),
    needsPower:
      document.querySelector('input[name="npwr"]:checked').value === "yes",
    preferredTime: document.getElementById("t-time").value,
    done: old?.done || false,
    scheduledTime: "",
  };

  if (i > -1) S.tasks[i] = task;
  else S.tasks.push(task);

  save();
  autoSchedule();
  renderTasks();
  closeTaskModal();
}

/* ───────────────── SCHEDULER FIX ───────────────── */

function autoSchedule() {
  const pat = getPattern();
  const occ = {};

  S.tasks.forEach((t) => {
    if (t.done) return;
    const slot = findSlot(t, pat, occ);
    t.scheduledTime = slot !== null ? String(slot) : "";
    markOcc(occ, t);
  });

  save();
}

/* ───────────────── HELPERS ───────────────── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setAIBarSub(t) {
  const el = document.getElementById("ai-bar-sub");
  if (el) el.textContent = t;
}
