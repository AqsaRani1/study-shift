// ============================================================
// STUDYSHIFT v2 — app.js
// Full Claude API integration. API key from config.js only.
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

function getApiKey() {
  return window.STUDYSHIFT_CONFIG &&
    window.STUDYSHIFT_CONFIG.CLAUDE_API_KEY &&
    window.STUDYSHIFT_CONFIG.CLAUDE_API_KEY !== "YOUR_API_KEY_HERE"
    ? window.STUDYSHIFT_CONFIG.CLAUDE_API_KEY
    : null;
}
// AI available if key in config OR running via local proxy (server.py handles key)
function aiAvailable() {
  const o = window.location.origin;
  const isLocal =
    o === "null" || o.includes("localhost") || o.includes("127.0.0.1");
  return !!getApiKey() || isLocal;
}

// ── BOOT ──
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  if (S.user.name) launch();
  setInterval(tick, 1000);
});

function loadState() {
  try {
    const r = localStorage.getItem("ss_v3");
    if (r) Object.assign(S, JSON.parse(r));
    S.busy = false;
    S.chatBusy = false;
  } catch (e) {}
}
function save() {
  try {
    const { busy, chatBusy, ...d } = S;
    localStorage.setItem("ss_v3", JSON.stringify(d));
  } catch (e) {}
}

// ── ONBOARDING ──
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
      name: "Watch video lecture — Mathematics",
      subject: "video",
      duration: 90,
      needsPower: true,
      preferredTime: "",
      done: false,
      scheduledTime: "",
    },
  ];
}
function showGroupHelp() {
  document.getElementById("group-help").classList.remove("hidden");
}

// ── LAUNCH ──
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

function refreshUI() {
  const u = S.user;
  const c = CITIES[u.city];
  document.getElementById("sb-av").textContent = u.name[0].toUpperCase();
  document.getElementById("sb-uname").textContent = u.name;
  document.getElementById("sb-ucity").textContent =
    `${c.name} · Group ${u.group}`;
  document.getElementById("sched-sub").textContent =
    `${c.name} · Group ${u.group}`;
  const h = new Date().getHours();
  const g =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = `${g}, ${u.name}`;
  document.getElementById("today-dt").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  document.getElementById("tip-body").textContent =
    TIPS[~~(Math.random() * TIPS.length)];
  // AI status
  const ok = aiAvailable();
  const dot = document.getElementById("sb-ai-dot");
  const txt = document.getElementById("sb-ai-txt");
  if (dot) dot.className = "bi bi-circle-fill sb-ai-dot" + (ok ? "" : " off");
  if (txt) txt.textContent = ok ? "AI Ready" : "No API key in config.js";
}

// ── TICK ──
function tick() {
  const pat = getPattern();
  const now = new Date();
  const h = now.getHours();
  const isPower = pat[h] === 1;

  let nxtMins = null;
  for (let i = 1; i <= 24; i++) {
    if (pat[(h + i) % 24] !== pat[h]) {
      nxtMins = i * 60 - now.getMinutes();
      break;
    }
  }

  const statusLabel = isPower ? "Power available" : "Load shedding active";
  const nxtLabel = nxtMins
    ? `${isPower ? "Outage" : "Power"} in ${~~(nxtMins / 60)}h ${nxtMins % 60}m`
    : "—";

  // sidebar dot
  const spd = document.getElementById("spc-dot");
  if (spd) {
    spd.className = "spc-dot" + (isPower ? "" : " off");
    document.getElementById("spc-status").textContent = statusLabel;
    document.getElementById("spc-next").textContent = nxtLabel;
  }

  // topbar
  const tpwr = document.getElementById("topbar-pwr");
  const tdot = document.getElementById("topbar-dot");
  const ttxt = document.getElementById("topbar-txt");
  if (tpwr) {
    tpwr.className = "topbar-pwr" + (isPower ? "" : " off");
    if (tdot) tdot.className = "bi bi-circle-fill";
    if (ttxt) ttxt.textContent = isPower ? "On" : "Off";
  }

  // power pill
  const pp = document.getElementById("power-pill");
  if (pp) {
    pp.className = "power-pill" + (isPower ? "" : " off");
    document.getElementById("pp-txt").textContent = statusLabel;
  }

  // countdown
  if (nxtMins !== null) {
    const hh = String(~~(nxtMins / 60)).padStart(2, "0");
    const mm = String(nxtMins % 60).padStart(2, "0");
    const ss = String(59 - now.getSeconds()).padStart(2, "0");
    const el = document.getElementById("sc-cd");
    if (el) el.textContent = `${hh}:${mm}:${ss}`;
    const lbl = document.getElementById("sc-cd-lbl");
    if (lbl)
      lbl.textContent = isPower ? "Until next outage" : "Until power returns";
  }
}

function getPattern() {
  return S.aiPattern || getGroupPattern(S.user.city, S.user.group);
}

// ── DASHBOARD ──
function renderDash() {
  const pat = getPattern();
  const st = getPowerStats(pat);
  setText("sc-power", st.power + "h");
  setText("sc-outage", st.outage + "h");
  setText("sc-tasks", S.tasks.filter((t) => !t.done).length);
  setTimeout(() => {
    setWidth("scf-power", (st.power / 24) * 100 + "%");
    setWidth("scf-outage", (st.outage / 24) * 100 + "%");
  }, 100);
  renderTimeline(pat);
  renderTodayPlan(pat);
  checkConflicts(pat);
  const note = document.getElementById("ai-src-note");
  if (S.aiPattern && S.aiSource) {
    note.classList.remove("hidden");
    setText("ai-src-txt", `Live AI data · ${S.aiSource}`);
  } else {
    note.classList.add("hidden");
  }
}

function renderTimeline(pat) {
  const bar = document.getElementById("tl-bar");
  if (!bar) return;
  const h = new Date().getHours();
  const thrs = new Set(
    S.tasks.filter((t) => t.scheduledTime).map((t) => +t.scheduledTime),
  );
  bar.innerHTML = "";
  pat.forEach((v, i) => {
    const s = document.createElement("div");
    s.className = `tl-slot ${v ? "power" : "off"}${i === h ? " now" : ""}${thrs.has(i) ? " has-task" : ""}`;
    const tasks = S.tasks.filter(
      (t) => t.scheduledTime && +t.scheduledTime === i,
    );
    let tt = `${fmtHour(i)} — ${v ? "Power on" : "Outage"}`;
    if (tasks.length)
      tt += ` · ${tasks.map((t) => t.name.slice(0, 14)).join(", ")}`;
    s.innerHTML = `<div class="tl-ttp">${tt}</div>`;
    bar.appendChild(s);
  });
  const pills = document.getElementById("tl-pills");
  if (!pills) return;
  pills.innerHTML = getScheduleBlocks(pat)
    .map(
      (b) =>
        `<span class="tl-pill ${b.type}"><i class="bi ${b.type === "power" ? "bi-lightning-charge-fill" : "bi-plug-fill"}"></i> ${fmtHour(b.start)}–${fmtHour(b.end)}</span>`,
    )
    .join("");
}

function renderTodayPlan(pat) {
  const el = document.getElementById("today-plan");
  if (!el) return;
  const tasks = S.tasks.filter((t) => !t.done).sort(byTime);
  if (!tasks.length) {
    el.innerHTML = emptyState(
      "bi-calendar-x",
      "No tasks yet — add your first task above.",
    );
    return;
  }
  el.innerHTML = tasks.map((t) => taskHTML(t, isConflict(t, pat))).join("");
}

function checkConflicts(pat) {
  const cc = S.tasks.filter((t) => !t.done && isConflict(t, pat));
  const el = document.getElementById("conflict-card");
  if (!el) return;
  if (cc.length) {
    el.classList.remove("hidden");
    setText(
      "cf-msg",
      `${cc.length} task${cc.length > 1 ? "s" : ""} overlap with outage: ${cc.map((t) => t.name.slice(0, 18)).join(", ")}`,
    );
  } else el.classList.add("hidden");
}

function isConflict(t, pat) {
  if (!t.needsPower || !t.scheduledTime) return false;
  const sh = +t.scheduledTime,
    eh = Math.min(Math.ceil(sh + t.duration / 60), 24);
  for (let h = sh; h < eh; h++) if (pat[h] === 0) return true;
  return false;
}

// ── TASK HTML ──
function taskHTML(t, conflict = false) {
  const ico =
    {
      study: "bi-book",
      online: "bi-laptop",
      writing: "bi-pencil",
      video: "bi-play-circle-fill",
      practice: "bi-journal-text",
      other: "bi-bookmark",
    }[t.subject] || "bi-bookmark";
  const pwr = t.needsPower
    ? conflict
      ? `<span class="ttag ttag-con"><i class="bi bi-exclamation-triangle-fill"></i>Conflict</span>`
      : `<span class="ttag ttag-pwr"><i class="bi bi-plug-fill"></i>Needs power</span>`
    : `<span class="ttag ttag-off"><i class="bi bi-book"></i>Offline ok</span>`;
  const timeStr = t.scheduledTime ? fmtHour(+t.scheduledTime) : "—";
  return `<div class="task-item ${t.needsPower ? "needs-power" : "no-power"}${t.done ? " done" : ""}${conflict ? " conflict" : ""}" data-id="${t.id}">
    <div class="t-check ${t.done ? "checked" : ""}" onclick="toggleDone('${t.id}')">${t.done ? '<i class="bi bi-check-lg"></i>' : ""}</div>
    <div class="t-body">
      <div class="t-name"><i class="bi ${ico}" style="margin-right:5px;opacity:0.55"></i>${esc(t.name)}</div>
      <div class="t-meta">${pwr}<span><i class="bi bi-clock"></i> ${t.duration}min</span></div>
    </div>
    <div class="t-time">${timeStr}</div>
    <button class="t-del" onclick="deleteTask('${t.id}')" title="Delete"><i class="bi bi-trash3"></i></button>
  </div>`;
}

// ── SCHEDULE PAGE ──
function renderSched() {
  const grid = document.getElementById("wk-grid");
  if (!grid) return;
  const today = new Date();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const start = new Date(today);
  const dow = today.getDay();
  start.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + S.weekOffset * 7);
  grid.innerHTML = "";
  let wins = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + d);
    const isT = dt.toDateString() === today.toDateString();
    const pat = getGroupPattern(
      S.user.city,
      ((S.user.group + (d % 3) - 1) % 8) + 1,
    );
    const st = getPowerStats(pat);
    const blks = getScheduleBlocks(pat);
    const card = document.createElement("div");
    card.className = "day-card" + (isT ? " today" : "");
    card.innerHTML = `<div class="day-nm">${DAYS[dt.getDay()]}</div>
      <div class="day-dt">${dt.getDate()}<span style="font-size:8px;color:var(--t3)"> ${MON[dt.getMonth()]}</span></div>
      <div class="day-minibar">${blks.map((b) => `<div class="mini-s ${b.type}" style="height:${Math.max(3, (b.end - b.start) * 1.4)}px"></div>`).join("")}</div>
      <div class="day-hrs"><span>${st.power}h</span> on</div>`;
    grid.appendChild(card);
    getBestWindows(pat, 2)
      .slice(0, 1)
      .forEach((w) =>
        wins.push({
          day: DAYS[dt.getDay()],
          date: `${dt.getDate()} ${MON[dt.getMonth()]}`,
          w,
        }),
      );
  }
  wins.sort((a, b) => b.w.end - b.w.start - (a.w.end - a.w.start));
  const wl = document.getElementById("best-wins");
  if (!wl) return;
  wl.innerHTML = wins
    .slice(0, 5)
    .map(
      (item, i) => `
    <div class="win-item">
      <span class="win-badge">${i === 0 ? '<i class="bi bi-star-fill"></i> Best' : "#" + (i + 1)}</span>
      <div><div class="win-time">${fmtHour(item.w.start)} – ${fmtHour(item.w.end)}</div><div class="win-day">${item.day}, ${item.date}</div></div>
      <span class="win-dur">${item.w.end - item.w.start}h <i class="bi bi-lightning-charge-fill"></i></span>
    </div>`,
    )
    .join("");
  const wkl = document.getElementById("wk-lbl");
  if (wkl)
    wkl.textContent =
      S.weekOffset === 0
        ? "This week"
        : S.weekOffset === 1
          ? "Next week"
          : S.weekOffset === -1
            ? "Last week"
            : `Week ${S.weekOffset > 0 ? "+" : ""}${S.weekOffset}`;
}
function shiftWeek(d) {
  S.weekOffset += d;
  renderSched();
}

// ── TASKS PAGE ──
function renderTasks() {
  const el = document.getElementById("tasks-list");
  if (!el) return;
  const pat = getPattern();
  let tasks = [...S.tasks];
  if (S.taskFilter === "power")
    tasks = tasks.filter((t) => t.needsPower && !t.done);
  else if (S.taskFilter === "offline")
    tasks = tasks.filter((t) => !t.needsPower && !t.done);
  else if (S.taskFilter === "done") tasks = tasks.filter((t) => t.done);
  else tasks = tasks.filter((t) => !t.done);
  tasks.sort(byTime);
  if (!tasks.length) {
    el.innerHTML = emptyState("bi-inbox", "No tasks here yet.");
    return;
  }
  el.innerHTML = tasks.map((t) => taskHTML(t, isConflict(t, pat))).join("");
}
function flt(f, btn) {
  S.taskFilter = f;
  document
    .querySelectorAll(".flt-btn")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderTasks();
}
function toggleDone(id) {
  const t = S.tasks.find((t) => t.id === id);
  if (!t) return;
  t.done = !t.done;
  save();
  renderDash();
  renderTasks();
}
function deleteTask(id) {
  S.tasks = S.tasks.filter((t) => t.id !== id);
  save();
  renderDash();
  renderTasks();
}

// ── CITIES ──
function renderCities() {
  const g = document.getElementById("cities-grid");
  if (!g) return;
  g.innerHTML = Object.entries(CITIES)
    .map(([k, c]) => {
      const pat = getGroupPattern(k, 1);
      const st = getPowerStats(pat);
      const slots = pat
        .map(
          (v) =>
            `<div class="mini-s ${v ? "power" : "off"}" style="flex:1;height:16px"></div>`,
        )
        .join("");
      return `<div class="city-card" onclick="cityInfo('${k}')">
      <div class="city-card-hd"><span class="city-nm-lbl">${c.name}</span><span class="city-util-badge">${c.utility}</span></div>
      <div class="city-mini-tl">${slots}</div>
      <div class="city-info-row">
        <div class="ci-itm"><div class="ci-dot g"></div>${st.power}h power</div>
        <div class="ci-itm"><div class="ci-dot o"></div>${st.outage}h outage</div>
      </div>
      <div class="city-peak"><i class="bi bi-clock-history"></i> Peak: ${c.peak}</div>
    </div>`;
    })
    .join("");
}
function filterCities(q) {
  document.querySelectorAll(".city-card").forEach((c) => {
    c.style.display = c
      .querySelector(".city-nm-lbl")
      .textContent.toLowerCase()
      .includes(q.toLowerCase())
      ? ""
      : "none";
  });
}
function cityInfo(k) {
  const c = CITIES[k];
  const st = getPowerStats(getGroupPattern(k, 1));
  alert(
    `${c.name} (${c.utility})\nProvince: ${c.province}\nAvg power: ${st.power}h/day  |  Outage: ${st.outage}h/day\nPeak outage times: ${c.peak}\n\nTip: To use this city, go to Settings (gear icon).`,
  );
}

// ── AUTO SCHEDULE ──
function autoSchedule() {
  const pat = getPattern();
  const occ = {};
  S.tasks.forEach((t) => {
    if (t.done) return;
    if (t.preferredTime) {
      t.scheduledTime = t.preferredTime.split(":")[0];
      markOcc(occ, t);
      return;
    }
    const slot = findSlot(t, pat, occ);
    t.scheduledTime = slot !== null ? String(slot) : "";
    if (slot !== null) markOcc(occ, t);
  });
  save();
}
function markOcc(occ, t) {
  const sh = +t.scheduledTime,
    eh = Math.min(Math.ceil(sh + t.duration / 60), 24);
  for (let h = sh; h < eh; h++) occ[h] = true;
}
function findSlot(task, pat, occ) {
  const now = new Date().getHours();
  const order = [...Array(24).keys()].sort(
    (a, b) => Math.abs(a - 10) - Math.abs(b - 10),
  );
  for (const sh of order) {
    if (sh < now) continue;
    if (!fits(task, pat, occ, sh)) continue;
    return sh;
  }
  for (let sh = 0; sh < 24; sh++) {
    if (fits(task, pat, occ, sh)) return sh;
  }
  return null;
}
function fits(task, pat, occ, sh) {
  const eh = Math.min(Math.ceil(sh + task.duration / 60), 24);
  for (let h = sh; h < eh; h++) {
    if (task.needsPower && pat[h] === 0) return false;
    if (occ[h]) return false;
  }
  return true;
}
function autoReschedule() {
  S.tasks.forEach((t) => {
    t.scheduledTime = "";
    t.preferredTime = "";
  });
  autoSchedule();
  renderDash();
  renderTasks();
}

// ── TASK MODAL ──
function openTaskModal(id = null) {
  S.editId = id;
  document.getElementById("modal-ttl").textContent = id
    ? "Edit Task"
    : "Add Task";
  if (id) {
    const t = S.tasks.find((t) => t.id === id);
    if (!t) return;
    document.getElementById("t-name").value = t.name;
    document.getElementById("t-subj").value = t.subject;
    document.getElementById("t-dur").value = t.duration;
    document.querySelector(
      `input[name="npwr"][value="${t.needsPower ? "yes" : "no"}"]`,
    ).checked = true;
    document.getElementById("t-time").value = t.preferredTime || "";
  } else {
    document.getElementById("t-name").value = "";
    document.getElementById("t-subj").value = "study";
    document.getElementById("t-dur").value = "60";
    document.querySelector('input[name="npwr"][value="yes"]').checked = true;
    document.getElementById("t-time").value = "";
  }
  refreshSmartTip();
  document.getElementById("task-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("t-name").focus(), 80);
}
function refreshSmartTip() {
  const np =
    document.querySelector('input[name="npwr"]:checked')?.value === "yes";
  const dur = parseInt(document.getElementById("t-dur").value) || 60;
  const pat = getPattern();
  const occ = {};
  S.tasks.forEach((t) => {
    if (t.scheduledTime) markOcc(occ, t);
  });
  const slot = findSlot({ needsPower: np, duration: dur }, pat, occ);
  const tip = document.getElementById("smart-tip");
  if (slot !== null) {
    tip.classList.remove("hidden");
    setText(
      "smart-tip-txt",
      `Best slot: ${fmtHour(slot)} – ${fmtHour(slot + Math.ceil(dur / 60))} (${pat[slot] ? "Power available" : "Offline window"})`,
    );
  } else tip.classList.add("hidden");
}
function modalBgClick(e, id) {
  if (e.target === document.getElementById(id)) closeById(id);
}
function closeById(id) {
  document.getElementById(id).classList.add("hidden");
}
function closeTaskModal() {
  closeById("task-modal");
  S.editId = null;
}
function saveTask() {
  const name = document.getElementById("t-name").value.trim();
  if (!name) {
    highlight("t-name");
    return;
  }
  const task = {
    id: S.editId || uid(),
    name,
    subject: document.getElementById("t-subj").value,
    duration: parseInt(document.getElementById("t-dur").value),
    needsPower:
      document.querySelector('input[name="npwr"]:checked').value === "yes",
    preferredTime: document.getElementById("t-time").value,
    done: false,
    scheduledTime: "",
  };
  if (S.editId) {
    const i = S.tasks.findIndex((t) => t.id === S.editId);
    if (i > -1) S.tasks[i] = task;
  } else S.tasks.push(task);
  save();
  autoSchedule();
  renderDash();
  renderTasks();
  closeTaskModal();
}

// ── SETTINGS ──
function openSettings() {
  document.getElementById("set-city").value = S.user.city;
  document.getElementById("set-group").value = S.user.group;
  document.getElementById("set-name").value = S.user.name;
  document.getElementById("settings-modal").classList.remove("hidden");
}
function closeSettings() {
  closeById("settings-modal");
}
function saveSettings() {
  S.user.city = document.getElementById("set-city").value;
  S.user.group = parseInt(document.getElementById("set-group").value);
  S.user.name = document.getElementById("set-name").value.trim() || S.user.name;
  S.aiPattern = null;
  S.aiSource = "";
  save();
  refreshUI();
  autoSchedule();
  renderDash();
  renderSched();
  renderTasks();
  renderCities();
  closeSettings();
}
function resetApp() {
  if (!confirm("Reset all data? This cannot be undone.")) return;
  localStorage.removeItem("ss_v3");
  location.reload();
}

// ── NAV ──
function goTo(pg, btn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".sn-btn,.bn-btn")
    .forEach((b) => b.classList.remove("active"));
  const el = document.getElementById("pg-" + pg);
  if (el) el.classList.remove("hidden");
  document
    .querySelectorAll(`[data-pg="${pg}"]`)
    .forEach((b) => b.classList.add("active"));
  if (pg === "schedule") renderSched();
  if (pg === "tasks") renderTasks();
  if (pg === "dashboard") renderDash();
  closeSidebar();
}
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sb-overlay").classList.add("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sb-overlay").classList.remove("open");
}

// ── CLAUDE API PROXY ──
// All calls go to /api/claude which routes to:
//   Local:   server.py proxy  (run: python3 server.py)
//   Netlify: netlify/functions/claude-proxy.js (key set in Netlify env vars)
// The API key is NEVER exposed in the browser.

async function callClaude(messages, system, webSearch = false) {
  const cfg = window.STUDYSHIFT_CONFIG || {};
  const body = {
    model: cfg.MODEL || "claude-sonnet-4-20250514",
    max_tokens: webSearch ? 2048 : cfg.MAX_TOKENS || 1024,
    system,
    messages,
  };
  if (webSearch)
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = e?.error?.message || `API error ${res.status}`;
    if (res.status === 401)
      throw new Error("Invalid API key — check config.js or Netlify env vars");
    if (res.status === 429)
      throw new Error("Rate limit hit. Wait a moment and try again.");
    if (msg.includes("CLAUDE_API_KEY"))
      throw new Error(
        "API key not set. Add CLAUDE_API_KEY in Netlify → Site Settings → Environment Variables.",
      );
    throw new Error(msg);
  }

  const data = await res.json();
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function callClaude(messages, system, webSearch = false) {
  const cfg = window.STUDYSHIFT_CONFIG || {};
  const endpoint = "/api/claude";
  const isProxy = endpoint === "/api/claude";

  const body = {
    model: cfg.MODEL || "claude-sonnet-4-20250514",
    max_tokens: webSearch ? 2048 : cfg.MAX_TOKENS || 1024,
    system,
    messages,
  };
  if (webSearch)
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  // Proxy doesn't need auth headers (server.py adds the key server-side)
  // Direct call needs them (deployed HTTPS)
  const headers = { "Content-Type": "application/json" };
  if (!isProxy) {
    const key = getApiKey();
    if (!key) throw new Error("No API key found. Add your key to config.js");
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-calls"] = "true";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const msg = e?.error?.message || `API error ${res.status}`;
    // Give a helpful message for common errors
    if (res.status === 401) throw new Error("Invalid API key. Check config.js");
    if (res.status === 429)
      throw new Error("Rate limit reached. Wait a moment and try again.");
    if (res.status === 400 && msg.includes("web_search"))
      throw new Error(
        "Web search not available on this API plan. Try without web search.",
      );
    throw new Error(msg);
  }

  const data = await res.json();
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ── AI SCHEDULE FETCH ──
async function fetchAISchedule() {
  if (S.busy) return;
  // if (!aiAvailable()) {
  //   setAIBarSub("Add your Claude API key to config.js, then refresh.");
  //   return;
  // }
  S.busy = true;
  const btn = document.getElementById("ai-bar-btn");
  const ico = document.getElementById("ai-bar-icon");
  btn.disabled = true;
  ico.className = "bi bi-arrow-clockwise spinning";
  setAIBarSub("Searching the web for today's live schedule...");
  const c = CITIES[S.user.city];
  const SYS = `You are a load shedding data extractor for Pakistan.
Search for today's load shedding schedule and return ONLY a JSON object — no markdown, no explanation, no code fences.
Format exactly: {"hours":[...],"source":"brief source","note":"brief note"}
"hours" must be exactly 24 integers: 0=outage, 1=power available, one per hour 0–23.
If exact data not found, use the best available data for that city/utility.`;
  const MSG = `Find today's load shedding schedule for ${c.name}, Pakistan.
Utility: ${c.utility}. Group: ${S.user.group}.
Search: "${c.utility} load shedding schedule today 2026 ${c.name} group ${S.user.group}"
Return 24 hourly values (0=outage,1=power) as JSON.`;
  try {
    const raw = await callGemini([{ role: "user", content: MSG }], SYS, true);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match)
      throw new Error("Could not parse schedule JSON from AI response");
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.hours) || parsed.hours.length !== 24)
      throw new Error("Invalid schedule format (need 24 values)");
    if (!parsed.hours.every((v) => v === 0 || v === 1))
      throw new Error("Invalid values (must be 0 or 1)");
    S.aiPattern = parsed.hours;
    S.aiSource = parsed.note || parsed.source || `${c.utility} via AI`;
    save();
    autoSchedule();
    renderDash();
    setAIBarSub(`Live data loaded — ${S.aiSource}`);
    ico.className = "bi bi-check-circle-fill";
    btn.style.background = "var(--green)";
    btn.style.color = "#0d0c0a";
    setTimeout(() => {
      ico.className = "bi bi-arrow-clockwise";
      btn.style.background = "";
      btn.style.color = "";
      btn.disabled = false;
    }, 3500);
  } catch (e) {
    setAIBarSub(`Error: ${e.message}. Using static schedule.`);
    ico.className = "bi bi-exclamation-circle-fill";
    btn.style.background = "var(--orange)";
    setTimeout(() => {
      ico.className = "bi bi-arrow-clockwise";
      btn.style.background = "";
      btn.disabled = false;
      setAIBarSub("Click to fetch real-time schedule");
    }, 4500);
  } finally {
    S.busy = false;
    btn.disabled = false;
  }
}
function setAIBarSub(txt) {
  const el = document.getElementById("ai-bar-sub");
  if (el) el.textContent = txt;
}

// ── AI CHAT ──
function chatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}
function sendQP(btn) {
  document.getElementById("chat-inp").value = btn.textContent.trim();
  sendMsg();
}

async function sendMsg() {
  if (S.chatBusy) return;
  const inp = document.getElementById("chat-inp");
  const msg = inp.value.trim();
  if (!msg) return;
  if (!aiAvailable()) {
    addMsg(
      "assistant",
      '<i class="bi bi-exclamation-triangle-fill"></i> No API key set in config.js. Add your key and refresh the page.',
    );
    return;
  }
  inp.value = "";
  inp.style.height = "auto";
  S.chatBusy = true;
  document.getElementById("chat-send").disabled = true;
  addMsg("user", esc(msg));
  const thinking = addThinking();
  S.chatHistory.push({ role: "user", content: msg });
  const c = CITIES[S.user.city];
  const pat = getPattern();
  const st = getPowerStats(pat);
  const blks = getScheduleBlocks(pat);
  const pwrBlks =
    blks
      .filter((b) => b.type === "power")
      .map((b) => `${fmtHour(b.start)}-${fmtHour(b.end)}`)
      .join(", ") || "—";
  const outBlks =
    blks
      .filter((b) => b.type === "off")
      .map((b) => `${fmtHour(b.start)}-${fmtHour(b.end)}`)
      .join(", ") || "—";
  const SYS = `You are StudyShift AI — a friendly, helpful assistant for Pakistani students dealing with load shedding.

User: ${S.user.name} | City: ${c.name} (${c.utility}) | Group: ${S.user.group}
Today: Power ${st.power}h (${pwrBlks}) | Outage ${st.outage}h (${outBlks})
Tasks: ${
    S.tasks
      .filter((t) => !t.done)
      .map((t) => t.name)
      .join(", ") || "None"
  }

Be concise, helpful, specific to Pakistan. Use web search for current schedules. Format clearly. Under 220 words unless asked for more.`;
  try {
    const reply = await callGemini(S.chatHistory.slice(-10), SYS, true);
    thinking.remove();
    S.chatHistory.push({ role: "assistant", content: reply });
    addMsg("assistant", formatMsg(reply));
  } catch (e) {
    thinking.remove();
    addMsg(
      "assistant",
      `Sorry, something went wrong: <em>${e.message}</em>. Check that your API key in config.js is valid and has credits.`,
    );
  } finally {
    S.chatBusy = false;
    document.getElementById("chat-send").disabled = false;
  }
}

function addMsg(role, html) {
  const msgs = document.getElementById("chat-msgs");
  const d = document.createElement("div");
  d.className = "cmsg " + role;
  const avIcon = role === "assistant" ? "bi-robot" : "bi-person-fill";
  const av = `<div class="cmsg-av"><i class="bi ${avIcon}"></i></div>`;
  d.innerHTML =
    role === "user"
      ? `<div class="cmsg-bbl">${html}</div>${av}`
      : `${av}<div class="cmsg-bbl">${html}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}
function addThinking() {
  const msgs = document.getElementById("chat-msgs");
  const d = document.createElement("div");
  d.className = "cmsg assistant";
  d.innerHTML = `<div class="cmsg-av"><i class="bi bi-robot"></i></div><div class="cmsg-bbl"><div class="thinking-dots"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}
function formatMsg(txt) {
  return txt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

// ── HELPERS ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function setText(id, v) {
  const e = document.getElementById(id);
  if (e) e.textContent = v;
}
function setWidth(id, v) {
  const e = document.getElementById(id);
  if (e) e.style.width = v;
}
function byTime(a, b) {
  return (a.scheduledTime || "99").localeCompare(b.scheduledTime || "99");
}
function emptyState(ico, txt) {
  return `<div class="empty-st"><i class="bi ${ico}"></i>${txt}</div>`;
}
function highlight(id) {
  const e = document.getElementById(id);
  if (!e) return;
  e.style.borderColor = "var(--red)";
  e.focus();
  setTimeout(() => (e.style.borderColor = ""), 2000);
}
async function callGemini(prompt) {
  const key = window.STUDYSHIFT_CONFIG.GEMINI_API_KEY;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`API Error ${res.status}`);
  }

  const data = await res.json();

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
