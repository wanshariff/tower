/* Tower: a Reminders-style front end for the "Tower Data" Google Sheet.
   The sheet is the master data; this page only reads and writes it with your Google sign-in. */
(function () {
"use strict";

/* ================= config ================= */
const CFG = Object.assign({ clientId: "", sheetId: "" }, window.TOWER_CONFIG || {});
try { const o = JSON.parse(localStorage.getItem("tower-config") || "{}"); if (o.clientId) CFG.clientId = o.clientId; if (o.sheetId) CFG.sheetId = o.sheetId; } catch (e) {}
const DEMO = /[?&]demo\b/.test(location.search);
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const API = "https://sheets.googleapis.com/v4/spreadsheets/";
const SHEET_URL = () => "https://docs.google.com/spreadsheets/d/" + CFG.sheetId + "/edit";

const SCHEMA = {
  Projects: ["ID", "Name", "Color", "Status", "Type", "Client", "Home", "Milestone", "Notes", "Order"],
  Tasks: ["ID", "List", "Title", "Done", "Flagged", "Due", "Priority", "Notes", "Link", "Estimate", "Source", "Created", "Completed", "Updated", "Log"],
  Files: ["ID", "List", "Title", "Kind", "URL", "Notes"],
  Decisions: ["ID", "List", "Decision", "Status", "Source", "Date", "Replaces"]
};
const PREFIX = { Projects: "P", Tasks: "T", Files: "D", Decisions: "L" };
const COLORS = ["blue", "orange", "green", "pink", "yellow", "teal", "purple", "olive"];
const PSTATUS = ["Active", "Idea", "Waiting", "Paused", "Done", "Dropped"];
const PARKED = ["Paused", "Done", "Dropped"];
const PRIS = ["None", "Low", "Medium", "High"];
const KINDS = ["Doc", "Slides", "Sheet", "Folder", "Video", "Site", "PDF", "Other"];

/* ================= helpers ================= */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "";
const pad = (n, w) => String(n).padStart(w, "0");
const isoOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
const dayDiff = iso => iso ? Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 864e5) : null;
const stamp = () => { const d = new Date(); return isoOf(d) + " " + pad(d.getHours(), 2) + ":" + pad(d.getMinutes(), 2); };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOWL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function dateLabel(iso, long) {
  const n = dayDiff(iso); if (n === null) return "";
  if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
  const d = new Date(iso + "T00:00:00");
  if (n > 1 && n < 7) return long ? DOWL[d.getDay()] : DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
  return (long ? DOWL[d.getDay()] + ", " : DOW[d.getDay()] + " ") + d.getDate() + " " + MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
}
function normDate(v) {
  if (v === "" || v == null) return "";
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1, 2) + "-" + pad(d.getUTCDate(), 2); }
  const s = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return m[1] + "-" + pad(m[2], 2) + "-" + pad(m[3], 2);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) return m[3] + "-" + pad(m[2], 2) + "-" + pad(m[1], 2);
  const d = new Date(s); return isNaN(d) ? "" : isoOf(d);
}
const truthy = v => v === true || /^(true|yes|1|y|x)$/i.test(String(v || "").trim());
const lc = name => "var(--c-" + (COLORS.includes(name) ? name : "gray") + ")";

/* ================= icons ================= */
const I = {
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="9" r="6"/><path d="M13.5 13.5L17 17"/></svg>',
  cal: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="14" height="12.5" rx="2.5"/><path d="M3 8.5h14M7 2.8v3M13 2.8v3"/></svg>',
  flag: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 2.5a1 1 0 0 1 1 1V4h9.2a.8.8 0 0 1 .6 1.3l-2 2.7 2 2.7a.8.8 0 0 1-.6 1.3H5.5v5a1 1 0 1 1-2 0v-13a1 1 0 0 1 1-1z"/></svg>',
  tray: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5l2-7h10l2 7v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5z"/><path d="M3 11.5h4l1 2h4l1-2h4"/></svg>',
  list: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="5.5" r="1.6"/><circle cx="4.5" cy="10" r="1.6"/><circle cx="4.5" cy="14.5" r="1.6"/><rect x="8" y="4.6" width="9" height="1.8" rx=".9"/><rect x="8" y="9.1" width="9" height="1.8" rx=".9"/><rect x="8" y="13.6" width="9" height="1.8" rx=".9"/></svg>',
  plus: '<svg viewBox="0 0 22 22" fill="currentColor"><circle cx="11" cy="11" r="10"/><path d="M11 6.5v9M6.5 11h9" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="9"/><path d="M11 10v5.5" stroke-linecap="round"/><circle cx="11" cy="7" r=".6" fill="currentColor"/></svg>',
  more: '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="9"/><circle cx="7" cy="11" r=".9" fill="currentColor"/><circle cx="11" cy="11" r=".9" fill="currentColor"/><circle cx="15" cy="11" r=".9" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L2 10l8 8"/></svg>',
  chev: '<svg viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5L6.5 6.5l-5 5"/></svg>',
  link: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
  trash: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/></svg>',
  check: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
  logo: '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="9" cy="10" r="4.5"/><path d="M18 10h12M18 24h12"/><circle cx="9" cy="24" r="4.5" fill="currentColor"/></svg>',
  done: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><path d="M15 24.5l6 6 12-13"/></svg>'
};
function todayIcon() { return '<span class="daynum">' + new Date().getDate() + '</span>'; }

/* ================= backends ================= */
let TOKEN = null, TOKEN_EXP = 0;
function authError() { const e = new Error("auth"); e.auth = true; return e; }
async function gapi(method, path, body) {
  if (!TOKEN || Date.now() > TOKEN_EXP) throw authError();
  const r = await fetch(API + encodeURIComponent(CFG.sheetId) + path, {
    method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 401) throw authError();
  if (!r.ok) {
    let msg = ""; try { msg = (await r.json()).error.message; } catch (_) {}
    const e = new Error(msg || "Google Sheets returned " + r.status); e.status = r.status; throw e;
  }
  return r.status === 204 ? null : r.json();
}
const R = s => encodeURIComponent(s);
const sheetsBackend = {
  sheetIds: {}, title: "",
  async load() {
    const meta = await gapi("GET", "?fields=properties.title,sheets.properties(sheetId,title)");
    this.title = meta.properties && meta.properties.title || "";
    this.sheetIds = {}; (meta.sheets || []).forEach(s => this.sheetIds[s.properties.title] = s.properties.sheetId);
    const names = Object.keys(SCHEMA).filter(n => n in this.sheetIds);
    if (!names.includes("Tasks")) { const e = new Error('This sheet has no "Tasks" tab. Check the sheet ID.'); e.fatal = true; throw e; }
    const q = names.map(n => "ranges=" + R(n + "!A1:Z5000")).join("&");
    const res = await gapi("GET", "/values:batchGet?" + q + "&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING");
    const out = {}; names.forEach((n, i) => out[n] = (res.valueRanges[i] && res.valueRanges[i].values) || []);
    return out;
  },
  async readCell(sheet, row) { const r = await gapi("GET", "/values/" + R(sheet + "!A" + row) + "?valueRenderOption=UNFORMATTED_VALUE"); return r.values && r.values[0] ? String(r.values[0][0]) : ""; },
  async readIds(sheet) { const r = await gapi("GET", "/values/" + R(sheet + "!A1:A5000") + "?valueRenderOption=UNFORMATTED_VALUE"); return (r.values || []).map(v => String(v[0] == null ? "" : v[0])); },
  async update(sheet, row, values) { await gapi("PUT", "/values/" + R(sheet + "!A" + row) + "?valueInputOption=RAW", { values: [values] }); },
  async append(sheet, values) {
    const r = await gapi("POST", "/values/" + R(sheet + "!A1") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", { values: [values] });
    const m = /!A(\d+)/.exec((r.updates && r.updates.updatedRange) || ""); return m ? +m[1] : null;
  },
  async del(sheet, row) {
    if (!(sheet in this.sheetIds)) throw new Error("Missing tab " + sheet);
    await gapi("POST", ":batchUpdate", { requests: [{ deleteDimension: { range: { sheetId: this.sheetIds[sheet], dimension: "ROWS", startIndex: row - 1, endIndex: row } } }] });
  },
  async ensureTab(sheet) {
    if (sheet in this.sheetIds) return;
    const r = await gapi("POST", ":batchUpdate", { requests: [{ addSheet: { properties: { title: sheet } } }] });
    this.sheetIds[sheet] = r.replies[0].addSheet.properties.sheetId;
    await this.update(sheet, 1, SCHEMA[sheet]);
  }
};
const memBackend = (() => {
  const t = todayISO();
  const data = {
    Projects: [SCHEMA.Projects, ["P01", "Website refresh", "blue", "Active", "Client", "Sample client", "", "Homepage review on Friday", "", 1], ["P02", "Side project", "green", "Active", "Own product", "", "", "Ship the landing page", "", 2], ["P03", "Home", "orange", "Active", "Admin", "", "", "", "", 3], ["P04", "Old idea", "purple", "Paused", "Own product", "", "", "", "", 4]],
    Tasks: [SCHEMA.Tasks,
      ["T001", "Website refresh", "Send homepage wireframes", false, true, t, "High", "Two options, mobile first", "", 2, "Self", "", "", "", ""],
      ["T002", "Website refresh", "Collect feedback from client", false, false, addDays(t, 2), "Medium", "", "", "", "Self", "", "", "", ""],
      ["T003", "Side project", "Write landing page copy", false, true, addDays(t, -1), "Medium", "", "https://example.com", 1.5, "Self", "", "", "", ""],
      ["T004", "Side project", "Pick a pricing model", false, false, "", "High", "", "", "", "Seed", "", "", "", ""],
      ["T005", "Home", "Renew car insurance", false, false, addDays(t, 5), "None", "", "", "", "Self", "", "", "", ""],
      ["T006", "Website refresh", "Kickoff call", true, false, addDays(t, -3), "None", "", "", "", "Self", "", "", "", ""]],
    Files: [SCHEMA.Files, ["D001", "Website refresh", "Brief", "Doc", "https://example.com/brief", ""]],
    Decisions: [SCHEMA.Decisions, ["L001", "Side project", "Web app first, no native app", "Locked", "Me", t, ""]]
  };
  return {
    title: "Sample data",
    async load() { return JSON.parse(JSON.stringify(data)); },
    async readCell(s, r) { return String((data[s][r - 1] || [])[0] || ""); },
    async readIds(s) { return data[s].map(r => String(r[0] || "")); },
    async update(s, r, v) { data[s][r - 1] = v.slice(); },
    async append(s, v) { data[s].push(v.slice()); return data[s].length; },
    async del(s, r) { data[s].splice(r - 1, 1); },
    async ensureTab(s) { if (!data[s]) data[s] = [SCHEMA[s]]; }
  };
})();
const backend = DEMO ? memBackend : sheetsBackend;

/* ================= store ================= */
const DB = { Projects: null, Tasks: null, Files: null, Decisions: null };
function table(sheet, rows) {
  const header = (rows[0] || []).map(h => String(h).trim());
  const hdr = header.length ? header : SCHEMA[sheet].slice();
  const items = [];
  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i] || [];
    if (!raw.length || raw.every(v => v === "" || v == null)) continue;
    const o = { _row: i + 1, _raw: raw.slice() };
    hdr.forEach((h, j) => o[h] = raw[j] == null ? "" : raw[j]);
    o.ID = String(o.ID || "");
    if (!o.ID) continue;
    if (sheet === "Tasks") { o.Done = truthy(o.Done); o.Flagged = truthy(o.Flagged); o.Due = normDate(o.Due); o.Priority = PRIS.includes(o.Priority) ? o.Priority : (o.Priority ? o.Priority : "None"); o.Title = String(o.Title || ""); o.List = String(o.List || ""); o.Log = String(o.Log || ""); }
    if (sheet === "Projects") { o.Name = String(o.Name || ""); o.Order = +o.Order || 999; }
    items.push(o);
  }
  return { header: hdr, items, missing: !rows.length };
}
function toRow(sheet, o) {
  const hdr = DB[sheet].header;
  return hdr.map((h, i) => {
    if (h in o && !h.startsWith("_")) { const v = o[h]; return typeof v === "boolean" ? v : (v == null ? "" : v); }
    return o._raw && o._raw[i] != null ? o._raw[i] : "";
  });
}
const T = () => DB.Tasks ? DB.Tasks.items : [];
const Pj = () => DB.Projects ? DB.Projects.items : [];
const byId = (sheet, id) => DB[sheet].items.find(o => o.ID === id);
function nextId(sheet) { let n = 0; DB[sheet].items.forEach(o => { const m = /(\d+)$/.exec(o.ID); if (m) n = Math.max(n, +m[1]); }); return PREFIX[sheet] + pad(n + 1, sheet === "Projects" ? 2 : 3); }
function lists() { return Pj().slice().sort((a, b) => a.Order - b.Order || a.Name.localeCompare(b.Name)); }
function listOf(name) { return Pj().find(p => p.Name === name); }
function colorOf(name) { const p = listOf(name); return lc(p ? p.Color : "gray"); }
function addLog(t, text) { t.Log = (t.Log ? t.Log + "\n" : "") + stamp() + " · " + text; }

/* ================= sync queue ================= */
let chain = Promise.resolve(), pending = 0, lastSync = null, retry = [], needAuth = false, syncErr = "";
function setSync() {
  const el = $("#sync"); if (!el) return;
  el.className = "sync" + (pending ? " saving" : syncErr || needAuth ? " err" : "");
  el.innerHTML = "<i></i><span>" + esc(needAuth ? "Signed out. Changes are waiting." : syncErr ? syncErr : pending ? "Saving…" : lastSync ? "Synced " + pad(lastSync.getHours(), 2) + ":" + pad(lastSync.getMinutes(), 2) : "") + "</span>";
  const rc = $("#reconnect"); if (rc) rc.hidden = !needAuth;
}
function enqueue(fn) {
  pending++; setSync();
  const run = () => fn().then(() => { lastSync = new Date(); syncErr = ""; }).catch(err => {
    if (err && err.auth) { needAuth = true; retry.push(fn); }
    else { syncErr = "Couldn't save: " + (err && err.message || "error"); toast(syncErr + " Reload to see the sheet's current state."); }
  }).finally(() => { pending--; setSync(); });
  chain = chain.then(run); return chain;
}
function flushRetry() { const fns = retry; retry = []; needAuth = false; setSync(); fns.forEach(enqueue); }
async function locate(sheet, o) {
  if (o._row) { const v = await backend.readCell(sheet, o._row); if (v === o.ID) return o._row; }
  const ids = await backend.readIds(sheet);
  ids.forEach((id, i) => { const it = DB[sheet].items.find(x => x.ID === id); if (it) it._row = i + 1; });
  const i = ids.indexOf(o.ID);
  if (i < 1) throw new Error(o.ID + " is no longer in the sheet");
  o._row = i + 1; return o._row;
}
function save(sheet, o) { if (sheet === "Tasks") o.Updated = stamp(); render(); enqueue(async () => { const r = await locate(sheet, o); await backend.update(sheet, r, toRow(sheet, o)); o._raw = toRow(sheet, o); }); }
function insert(sheet, o) {
  o._row = null; DB[sheet].items.push(o); render();
  enqueue(async () => { if (backend.ensureTab && DB[sheet].missing) { await backend.ensureTab(sheet); DB[sheet].missing = false; } const r = await backend.append(sheet, toRow(sheet, o)); o._row = r; o._raw = toRow(sheet, o); });
}
function remove(sheet, o) {
  DB[sheet].items = DB[sheet].items.filter(x => x !== o); render();
  enqueue(async () => { const r = await locate(sheet, o); await backend.del(sheet, r); DB[sheet].items.forEach(x => { if (x._row && x._row > r) x._row--; }); });
}

async function loadAll(silent) {
  const data = await backend.load();
  Object.keys(SCHEMA).forEach(n => DB[n] = table(n, data[n] || []));
  lastSync = new Date(); syncErr = ""; setSync();
  if (!silent) render();
}
let pollT = null;
function startPolling() {
  clearInterval(pollT);
  pollT = setInterval(refreshIfIdle, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshIfIdle(); });
  window.addEventListener("focus", refreshIfIdle);
}
let lastPoll = 0;
async function refreshIfIdle() {
  if (pending || needAuth || document.hidden || Date.now() - lastPoll < 15000) return;
  if (UI.sheet || isEditing()) return;
  lastPoll = Date.now();
  try { await loadAll(true); render(); } catch (e) { if (e.auth) { needAuth = true; setSync(); } }
}
function isEditing() { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== "q"; }

/* ================= auth ================= */
let tokenClient = null;
function gisReady() {
  return new Promise(res => {
    const ok = () => window.google && google.accounts && google.accounts.oauth2;
    if (ok()) return res(true);
    const t0 = Date.now(); const iv = setInterval(() => { if (ok()) { clearInterval(iv); res(true); } else if (Date.now() - t0 > 12000) { clearInterval(iv); res(false); } }, 100);
  });
}
async function initAuth() {
  if (!(await gisReady())) return false;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.clientId, scope: SCOPE,
    callback: onToken,
    error_callback: err => { const m = err && err.type === "popup_failed_to_open" ? "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again." : err && err.type === "popup_closed" ? "Sign-in was closed before it finished." : "Google sign-in failed."; showGateError(m); toast(m); }
  });
  return true;
}
let afterToken = null;
function signIn(prompt) {
  if (!tokenClient) { showGateError("Google sign-in hasn't loaded. Check your connection and reload."); return; }
  tokenClient.requestAccessToken({ prompt: prompt == null ? (localStorage.getItem("tower-auth") ? "" : "consent") : prompt });
}
function onToken(resp) {
  if (!resp || resp.error) { showGateError("Google sign-in failed: " + (resp && (resp.error_description || resp.error) || "unknown error")); return; }
  if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) { showGateError("Tower needs permission to edit your sheets. Try again and tick the Sheets permission."); return; }
  TOKEN = resp.access_token; TOKEN_EXP = Date.now() + ((+resp.expires_in || 3600) - 60) * 1000;
  try { localStorage.setItem("tower-auth", "1"); } catch (e) {}
  const f = afterToken; afterToken = null;
  if (f) f(); else if (needAuth) flushRetry();
}
function signOut() {
  try { if (TOKEN && window.google) google.accounts.oauth2.revoke(TOKEN, () => {}); } catch (e) {}
  TOKEN = null; try { localStorage.removeItem("tower-auth"); } catch (e) {}
  location.hash = ""; location.reload();
}

/* ================= UI state ================= */
const UI = { view: "today", list: null, q: "", showDone: false, sel: null, editing: null, adding: false, newText: "", newOpts: null, sheet: null, screen: "home", openSwipe: null, menu: false, ignoreParse: false };
try { const s = JSON.parse(localStorage.getItem("tower-ui") || "{}"); if (s.view) UI.view = s.view; if (s.list) UI.list = s.list; if (s.showDone) UI.showDone = true; } catch (e) {}
(function readHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (["today", "scheduled", "flagged", "all", "check"].includes(h)) { UI.view = h; UI.screen = "list"; }
  else if (h.startsWith("list/")) { UI.view = "list"; UI.list = h.slice(5); UI.screen = "list"; }
})();
function persist() { try { localStorage.setItem("tower-ui", JSON.stringify({ view: UI.view, list: UI.list, showDone: UI.showDone })); } catch (e) {} }
function go(view, list) {
  UI.view = view; UI.list = list || null; UI.q = ""; const q = $("#q"); if (q) q.value = "";
  UI.sel = null; UI.editing = null; UI.adding = false; UI.menu = false; UI.screen = "list"; UI.openSwipe = null;
  persist(); try { history.replaceState(null, "", "#" + (view === "list" ? "list/" + encodeURIComponent(list) : view)); } catch (e) {}
  render(); const ps = $(".pane-scroll"); if (ps) ps.scrollTop = 0;
}

/* ================= views ================= */
const lingering = new Set();
const open = t => !t.Done || lingering.has(t.ID);
const closed = t => t.Done && !lingering.has(t.ID);
const sortT = (a, b) => (a.Due || "9999") < (b.Due || "9999") ? -1 : (a.Due || "9999") > (b.Due || "9999") ? 1 : PRIS.indexOf(b.Priority) - PRIS.indexOf(a.Priority) || a.ID.localeCompare(b.ID);
const SMART = {
  today: { label: "Today", color: "var(--c-blue)", icon: () => todayIcon(), filter: t => open(t) && t.Due && dayDiff(t.Due) <= 0 },
  scheduled: { label: "Scheduled", color: "var(--red)", icon: () => I.cal, filter: t => open(t) && t.Due },
  flagged: { label: "Flagged", color: "var(--flag)", icon: () => I.flag, filter: t => open(t) && t.Flagged },
  all: { label: "All", color: "var(--c-gray)", icon: () => I.tray, filter: t => open(t) }
};
function countFor(k) { return T().filter(SMART[k].filter).length; }
function viewTitle() {
  if (UI.q) return { title: "Results", color: "var(--label)" };
  if (UI.view === "list") return { title: UI.list, color: colorOf(UI.list) };
  if (UI.view === "check") return { title: "To check", color: "var(--flag)" };
  return { title: SMART[UI.view].label, color: SMART[UI.view].color };
}
/* returns [{label, cls, color, tasks, list}] */
function groups() {
  const all = T();
  if (UI.q) {
    const q = UI.q.toLowerCase();
    const hits = all.filter(t => (t.Title + " " + t.Notes + " " + t.List + " " + t.Log).toLowerCase().includes(q)).sort(sortT);
    return byList(hits.filter(open)).concat(hits.some(closed) ? [{ label: "Completed", tasks: hits.filter(closed) }] : []);
  }
  if (UI.view === "today") {
    const ts = all.filter(SMART.today.filter).sort(sortT);
    const out = [], late = ts.filter(t => dayDiff(t.Due) < 0), now = ts.filter(t => dayDiff(t.Due) === 0);
    if (late.length) out.push({ label: "Overdue", cls: "red", tasks: late });
    out.push({ label: late.length ? "Today" : "", tasks: now, addHere: true });
    if (UI.showDone) { const d = all.filter(t => closed(t) && t.Due === todayISO()); if (d.length) out.push({ label: "Completed", tasks: d }); }
    return out;
  }
  if (UI.view === "scheduled") {
    const ts = all.filter(SMART.scheduled.filter).sort(sortT); const out = []; const m = new Map();
    ts.forEach(t => { const n = dayDiff(t.Due); const key = n < 0 ? "Overdue" : n <= 6 ? dateLabel(t.Due, true) : MON[new Date(t.Due + "T00:00:00").getMonth()] + " " + new Date(t.Due + "T00:00:00").getFullYear(); if (!m.has(key)) m.set(key, { label: key, cls: n < 0 ? "red" : "", tasks: [] }); m.get(key).tasks.push(t); });
    m.forEach(g => out.push(g));
    out.push({ label: out.length ? "" : "", tasks: [], addHere: true });
    return out;
  }
  if (UI.view === "flagged") { const ts = all.filter(SMART.flagged.filter).sort(sortT); return [{ label: "", tasks: ts, addHere: true }]; }
  if (UI.view === "all") { const g = byList(all.filter(open).sort(sortT)); if (UI.showDone) { const d = all.filter(closed); if (d.length) g.push({ label: "Completed", tasks: d.sort((a, b) => String(b.Completed).localeCompare(String(a.Completed))) }); } return g.concat([{ label: "", tasks: [], addHere: true }]); }
  if (UI.view === "check") { return [{ label: "", tasks: all.filter(t => open(t) && t.Source === "Seed").sort(sortT), check: true }]; }
  // list
  const ts = all.filter(t => t.List === UI.list);
  const out = [{ label: "", tasks: ts.filter(open).sort(sortT), addHere: true }];
  if (UI.showDone) { const d = ts.filter(closed); if (d.length) out.push({ label: "Completed", tasks: d.sort((a, b) => String(b.Completed).localeCompare(String(a.Completed))) }); }
  return out;
}
function byList(ts) {
  const out = [];
  lists().forEach(p => { const g = ts.filter(t => t.List === p.Name); if (g.length) out.push({ label: p.Name, list: p.Name, tasks: g }); });
  const orphan = ts.filter(t => !listOf(t.List)); if (orphan.length) out.push({ label: "No list", tasks: orphan });
  return out;
}
function visibleOrder() { const ids = []; groups().forEach(g => g.tasks.forEach(t => ids.push(t.ID))); return ids; }

/* ================= render ================= */
function render() {
  if (!DB.Tasks) return;
  const root = $("#root");
  if (!$(".app", root)) {
    root.innerHTML = '<div class="app"><aside class="side" aria-label="Lists"><div class="side-scroll" id="side"></div><div class="side-foot"><div class="sync" id="sync"></div><button class="btn tint" id="reconnect" hidden>Reconnect</button></div></aside><main class="pane" id="pane"></main></div>';
  }
  $(".app").dataset.screen = UI.screen;
  renderSide();
  if (isEditing() && $("#pane").contains(document.activeElement) && !renderPane.force) { renderPane.dirty = true; }
  else renderPane();
  renderPane.force = false;
  setSync();
  if (UI.sheet) refreshSheet();
}
function renderSide() {
  const side = $("#side"); const qv = $("#q") ? $("#q").value : "";
  const qFocus = document.activeElement && document.activeElement.id === "q";
  const ls = lists(); const live = ls.filter(p => !PARKED.includes(p.Status)), parked = ls.filter(p => PARKED.includes(p.Status));
  const cnt = n => T().filter(t => t.List === n && open(t)).length;
  const lrow = p => '<button class="lrow' + (PARKED.includes(p.Status) ? " dim" : "") + '" data-go="list" data-list="' + esc(p.Name) + '" aria-current="' + (UI.view === "list" && UI.list === p.Name && !UI.q) + '" style="--lc:' + lc(p.Color) + '"><span class="lic">' + I.list + '</span><span class="nm">' + esc(p.Name) + '</span><span class="ct">' + cnt(p.Name) + '</span><span class="chev">' + I.chev + '</span></button>';
  const tile = k => '<button class="tile" data-go="' + k + '" aria-current="' + (UI.view === k && !UI.q) + '" style="--tc:' + SMART[k].color + '"><span class="ic">' + SMART[k].icon() + '</span><span class="n">' + countFor(k) + '</span><span class="l">' + SMART[k].label + '</span></button>';
  const nCheck = T().filter(t => open(t) && t.Source === "Seed").length;
  side.innerHTML =
    '<label class="search"><span class="sr">Search</span>' + I.search + '<input id="q" type="search" placeholder="Search" autocomplete="off" value="' + esc(qv) + '"></label>' +
    '<div class="tiles">' + ["today", "scheduled", "flagged", "all"].map(tile).join("") + '</div>' +
    (nCheck ? '<button class="check-banner" data-go="check" aria-current="' + (UI.view === "check" && !UI.q) + '"><span class="dotw">' + I.check + '</span><span style="flex:1;min-width:0"><b>' + nCheck + ' to check</b><br><span>Tasks from past chats you haven\'t confirmed</span></span><span class="chev" style="width:8px;height:13px;color:var(--label3)">' + I.chev + '</span></button>' : "") +
    '<div><div class="sect-h"><h2>My Lists</h2></div><div class="group">' + (live.length ? live.map(lrow).join("") : '<div class="lrow" style="color:var(--label2)">No lists yet</div>') + '</div></div>' +
    (parked.length ? '<div><div class="sect-h"><h2 style="font-size:15px;color:var(--label2)">Parked</h2></div><div class="group">' + parked.map(lrow).join("") + '</div></div>' : "") +
    '<button class="addlist" data-act="newlist">' + I.plus + 'Add List</button>';
  if (qFocus) { const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function taskRow(t, ctx) {
  const late = open(t) && t.Due && dayDiff(t.Due) < 0;
  const meta = [];
  if (ctx.showList) meta.push('<span class="lname" style="--lc:' + colorOf(t.List) + '">' + esc(t.List || "No list") + '</span>');
  if (t.Due) meta.push('<span class="' + (late ? "late" : "") + '">' + esc(dateLabel(t.Due)) + '</span>');
  if (t.Estimate !== "" && t.Estimate != null) meta.push('<span>' + esc(t.Estimate) + 'h</span>');
  if (safeUrl(t.Link)) meta.push('<span>' + I.link + '</span>');
  if (t.Source === "Seed" && !ctx.check) meta.push('<span class="seed">Unchecked</span>');
  const note = String(t.Notes || "").split("\n")[0];
  if (note) meta.push('<span class="note">' + esc(note) + '</span>');
  const sel = UI.sel === t.ID;
  const title = UI.editing === t.ID
    ? '<input class="ttitle-edit" id="edit-' + esc(t.ID) + '" value="' + esc(t.Title) + '" aria-label="Task title">'
    : '<span class="ttitle" data-edit="' + esc(t.ID) + '">' + (t.Priority === "High" ? '<span class="pri" aria-label="High priority">!!!</span>' : "") + esc(t.Title) + '</span>';
  return '<div class="task' + (t.Done ? " done" : "") + (lingering.has(t.ID) ? " completing" : "") + (sel ? " sel" : "") + '" data-id="' + esc(t.ID) + '" style="--lc:' + colorOf(t.List) + '">' +
    '<div class="swipe-acts" aria-hidden="true"><button class="sa-flag" data-act="flag" tabindex="-1">' + I.flag + (t.Flagged ? "Unflag" : "Flag") + '</button><button class="sa-del" data-act="delete" tabindex="-1">' + I.trash + 'Delete</button></div>' +
    '<div class="task-inner"><button class="circle" data-act="toggle" role="checkbox" aria-checked="' + t.Done + '" aria-label="' + (t.Done ? "Mark not done: " : "Complete: ") + esc(t.Title) + '"><i></i></button>' +
    '<div class="tbody">' + title + (meta.length ? '<div class="tmeta">' + meta.join("") + '</div>' : "") +
    (ctx.check ? '<div class="quick" style="padding:6px 0 0"><button class="btn tint" data-act="keep">Looks right</button><button class="btn" data-act="details">Edit</button><button class="btn red" data-act="drop">Drop</button></div>' : "") +
    '</div><div class="tright">' + (t.Flagged ? '<span class="flagmark" aria-label="Flagged">' + I.flag + '</span>' : "") + '<button class="info" data-act="details" aria-label="Details for ' + esc(t.Title) + '">' + I.info + '</button></div></div></div>';
}
function renderPane() {
  renderPane.dirty = false;
  const pane = $("#pane"); const v = viewTitle();
  const gs = groups(); const total = gs.reduce((s, g) => s + g.tasks.filter(open).length, 0);
  const isList = UI.view === "list" && !UI.q; const p = isList ? listOf(UI.list) : null;
  if (isList && !p && DB.Projects) { UI.view = "today"; return renderPane(); }
  const showList = UI.view !== "list" || !!UI.q;
  let sub = total + (total === 1 ? " task" : " tasks");
  if (p && p.Milestone) sub += " · Next: " + esc(p.Milestone);
  if (p && safeUrl(p.Home)) sub += ' · <a href="' + esc(safeUrl(p.Home)) + '" target="_blank" rel="noopener">Open home ↗</a>';
  let h = '<header class="phead" style="--hc:' + v.color + '"><div class="bar"><button class="back" data-act="home">' + I.back + 'Lists</button><span class="sp"></span>' +
    '<div class="menu"><button class="iconbtn" data-act="menu" aria-haspopup="true" aria-expanded="' + UI.menu + '" aria-label="More">' + I.more + '</button>' +
    (UI.menu ? '<div class="menu-pop" role="menu">' +
      (UI.view !== "check" && UI.view !== "flagged" && UI.view !== "scheduled" ? '<button role="menuitem" data-act="toggledone">' + (UI.showDone ? "Hide Completed" : "Show Completed") + '</button>' : "") +
      (isList ? '<button role="menuitem" data-act="listinfo">List Info</button>' : "") +
      '<hr><button role="menuitem" data-act="copy-plan">Copy “Plan my week” for Claude</button><button role="menuitem" data-act="copy-wrap">Copy “Wrap up today” for Claude</button>' +
      '<hr><button role="menuitem" data-act="opensheet">Open Tower Data sheet ↗</button>' + (DEMO ? "" : '<button role="menuitem" data-act="signout">Sign out</button>') +
      '</div>' : "") + '</div></div>' +
    '<h1>' + esc(v.title) + '</h1><div class="sub">' + sub + '</div></header><div class="pane-scroll" id="pscroll">';
  let rows = "";
  gs.forEach(g => {
    if (!g.tasks.length && !g.addHere) return;
    if (g.label) rows += '<div class="section-label ' + (g.cls || "") + '">' + (g.list ? '<span><span class="lc-dot" style="--lc:' + colorOf(g.list) + '"></span>' + esc(g.label) + '</span>' : '<span>' + esc(g.label) + '</span>') + '<span class="c">' + g.tasks.length + '</span></div>';
    rows += '<div class="rows">' + g.tasks.map(t => taskRow(t, { showList, check: g.check })).join("") + '</div>';
  });
  const anyTasks = gs.some(g => g.tasks.length);
  const canAdd = !UI.q && UI.view !== "check";
  if (!anyTasks && !UI.adding) {
    const msg = UI.q ? ["No results", "Nothing matches “" + UI.q + "”."] : UI.view === "check" ? ["All checked", "Every task from past chats has been confirmed."] : UI.view === "today" ? ["Nothing due today", "Enjoy the evening, or flag something to work on."] : UI.view === "flagged" ? ["No flagged tasks", "Flag what you want to work on next. It shows up here."] : UI.view === "scheduled" ? ["Nothing scheduled", "Tasks with a date show up here, grouped by day."] : ["No tasks", "Add your first task below."];
    rows += '<div class="empty">' + I.done + '<strong>' + esc(msg[0]) + '</strong><span>' + esc(msg[1]) + '</span></div>';
  }
  h += rows;
  if (canAdd) h += UI.adding ? newRowHtml() : '<button class="newadd" data-act="add" style="--lc:' + (isList ? colorOf(UI.list) : "var(--tint)") + '">' + I.plus + 'New Task</button>';
  if (isList && UI.view === "list" && T().some(t => t.List === UI.list && t.Done) && !UI.showDone) h += '<button class="showdone" data-act="toggledone">Show ' + T().filter(t => t.List === UI.list && t.Done).length + ' completed</button>';
  if (isList) h += extrasHtml(p);
  h += '</div>';
  pane.innerHTML = h;
  if (UI.editing) { const e = $("#edit-" + CSS.escape(UI.editing)); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }
  if (UI.adding) { const n = $("#newin"); if (n) { n.value = UI.newText; n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }
}

/* ---------- new task row ---------- */
function defaultsForView() {
  const o = { due: null, flag: false, pri: "None", list: null };
  if (UI.view === "list") o.list = UI.list;
  if (UI.view === "today" || UI.view === "scheduled") o.due = todayISO();
  if (UI.view === "flagged") o.flag = true;
  if (!o.list) { const ls = lists().filter(p => !PARKED.includes(p.Status)); const last = localStorage.getItem("tower-lastlist"); o.list = (last && listOf(last) && last) || (ls[0] && ls[0].Name) || null; }
  return o;
}
function newRowHtml() {
  const o = UI.newOpts; const parsed = UI.ignoreParse ? null : parseNL(UI.newText);
  const due = parsed && parsed.due ? parsed.due : o.due;
  const pri = parsed && parsed.pri ? parsed.pri : o.pri;
  const sat = (() => { const d = new Date(); const diff = (6 - d.getDay() + 7) % 7; return addDays(todayISO(), d.getDay() === 0 ? 0 : diff); })();
  const nextMon = addDays(todayISO(), ((8 - new Date().getDay()) % 7) || 7);
  const dchip = (label, iso) => '<button class="chip' + (!parsed || !parsed.due ? (o.due === iso ? " on" : "") : "") + '" data-nd="' + iso + '">' + label + '</button>';
  let chips = "";
  if (parsed && parsed.due) chips += '<button class="chip det" data-act="unparse" aria-label="Keep the date words in the title">' + I.cal + esc(dateLabel(parsed.due)) + '<span class="x">✕</span></button>';
  else chips += dchip("Today", todayISO()) + dchip("Tomorrow", addDays(todayISO(), 1)) + dchip("This Weekend", sat) + dchip("Next Week", nextMon);
  chips += '<button class="chip' + (o.flag ? " flagon" : "") + '" data-act="nflag">' + I.flag + (o.flag ? "Flagged" : "Flag") + '</button>';
  chips += '<button class="chip' + (pri !== "None" ? " on" : "") + '" data-act="npri">' + (pri === "None" ? "Priority" : pri === "High" ? "!!! High" : pri === "Medium" ? "!! Medium" : "! Low") + '</button>';
  if (UI.view !== "list") chips += '<label class="chip" style="padding-right:4px">List <select id="nlist" style="border:0;background:none;font-weight:600;outline:none;max-width:150px">' + lists().filter(p => !PARKED.includes(p.Status) || p.Name === o.list).map(p => '<option' + (p.Name === o.list ? " selected" : "") + '>' + esc(p.Name) + '</option>').join("") + '</select></label>';
  return '<div class="newrow" style="--lc:' + colorOf(o.list) + '"><span class="circle" aria-hidden="true"><i></i></span><input id="newin" placeholder="New task" aria-label="New task. Type a date like friday or 12 oct" autocomplete="off" enterkeyhint="done"></div>' +
    '<div class="chips">' + chips + '</div><div class="hint">Return to add · Esc to finish · Type “fri”, “tomorrow” or “12 oct” for a date, “!!!” for high priority</div>';
}
const WD = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
function parseNL(text) {
  let s = " " + text + " ", due = null, pri = null, m;
  const cut = re => { s = s.replace(re, " "); };
  if ((m = /\s(!{1,3})(?=\s)/.exec(s))) { pri = ["", "Low", "Medium", "High"][m[1].length]; cut(m[0]); }
  const pre = "(?:\\s(?:on|by|due|before))?";
  const tries = [
    [new RegExp(pre + "\\s(today|tonight|tdy)(?=[\\s,.])", "i"), () => todayISO()],
    [new RegExp(pre + "\\s(tomorrow|tmrw|tmr|tml)(?=[\\s,.])", "i"), () => addDays(todayISO(), 1)],
    [new RegExp(pre + "\\sthis weekend(?=[\\s,.])", "i"), () => { const d = new Date().getDay(); return d === 6 || d === 0 ? todayISO() : addDays(todayISO(), 6 - d); }],
    [new RegExp(pre + "\\snext week(?=[\\s,.])", "i"), () => addDays(todayISO(), ((8 - new Date().getDay()) % 7) || 7)],
    [/\sin (\d{1,2}) (days?|weeks?)(?=[\s,.])/i, mm => addDays(todayISO(), (+mm[1]) * (/^w/i.test(mm[2]) ? 7 : 1))],
    [new RegExp(pre + "\\s(\\d{4})-(\\d{1,2})-(\\d{1,2})(?=[\\s,.])", "i"), mm => mm[1] + "-" + pad(mm[2], 2) + "-" + pad(mm[3], 2)],
    [new RegExp(pre + "\\s(\\d{1,2})(?:st|nd|rd|th)?\\s(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*(?=[\\s,.])", "i"), mm => futureDate(+mm[1], MONTHS[mm[2].toLowerCase().slice(0, mm[2].toLowerCase() === "sept" ? 4 : 3)])],
    [new RegExp(pre + "\\s(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\s(\\d{1,2})(?:st|nd|rd|th)?(?=[\\s,.])", "i"), mm => futureDate(+mm[2], MONTHS[mm[1].toLowerCase().slice(0, mm[1].toLowerCase() === "sept" ? 4 : 3)])],
    [new RegExp(pre + "\\s(\\d{1,2})\\/(\\d{1,2})(?=[\\s,.])", "i"), mm => futureDate(+mm[1], +mm[2] - 1)],
    [new RegExp(pre + "\\s(?:next\\s)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?=[\\s,.])", "i"), mm => nextDow(WD[mm[1].toLowerCase()], /next/i.test(mm[0]))],
    [/\s(?:on|by|due)\s(mon|tues?|wed|thur?s?|fri|sat|sun)(?=[\s,.])/i, mm => nextDow(WD[mm[1].toLowerCase()], false)],
    [/\s(mon|tues?|wed|thur?s?|fri|sat|sun)\s*$/i, mm => nextDow(WD[mm[1].toLowerCase()], false)]
  ];
  for (const [re, fn] of tries) { const mm = re.exec(s); if (mm) { const d = fn(mm); if (d) { due = d; cut(mm[0]); break; } } }
  return { title: s.replace(/\s+/g, " ").trim(), due, pri };
}
function futureDate(day, month) { if (!(month >= 0 && month <= 11) || !(day >= 1 && day <= 31)) return null; const now = new Date(); let d = new Date(now.getFullYear(), month, day); if (d.getMonth() !== month) return null; if (isoOf(d) < todayISO()) d = new Date(now.getFullYear() + 1, month, day); return isoOf(d); }
function nextDow(dow, forceNext) { if (dow == null) return null; let diff = (dow - new Date().getDay() + 7) % 7; if (forceNext && diff === 0) diff = 7; return addDays(todayISO(), diff); }
function commitNew() {
  const raw = $("#newin") ? $("#newin").value : UI.newText; if (!raw.trim()) return false;
  const o = UI.newOpts; const listName = ($("#nlist") && $("#nlist").value) || o.list;
  if (!listName) { toast("Add a list first."); openListSheet(null); return false; }
  const parsed = UI.ignoreParse ? { title: raw.trim(), due: null, pri: null } : parseNL(raw);
  if (!parsed.title) return false;
  const t = { ID: nextId("Tasks"), List: listName, Title: parsed.title, Done: false, Flagged: !!o.flag, Due: parsed.due || o.due || "", Priority: parsed.pri || o.pri || "None", Notes: "", Link: "", Estimate: "", Source: "Self", Created: stamp(), Completed: "", Updated: stamp(), Log: "" };
  try { localStorage.setItem("tower-lastlist", listName); } catch (e) {}
  UI.newText = ""; UI.ignoreParse = false; UI.newOpts = defaultsForView(); if (UI.view !== "list") UI.newOpts.list = listName;
  insert("Tasks", t);
  return true;
}

/* ---------- files & decisions inside a list ---------- */
function extrasHtml(p) {
  if (!p) return "";
  const files = (DB.Files ? DB.Files.items : []).filter(f => f.List === p.Name);
  const decs = (DB.Decisions ? DB.Decisions.items : []).filter(d => d.List === p.Name);
  const fr = files.map(f => { const u = safeUrl(f.URL); return '<div class="xrow"><span class="k">' + esc(f.Kind || "Link") + '</span>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(f.Title) + ' ↗</a>' : '<span class="txt">' + esc(f.Title) + '</span>') + '<button class="iconbtn" style="color:var(--label3)" data-xdel="Files" data-xid="' + esc(f.ID) + '" aria-label="Remove ' + esc(f.Title) + '">' + I.trash + '</button></div>'; }).join("");
  const dr = decs.map(d => '<div class="xrow"><button class="st ' + esc(d.Status) + '" data-cyc="' + esc(d.ID) + '" title="Click to change">' + esc(d.Status || "Assumed") + '</button><span class="txt">' + esc(d.Decision) + '</span><button class="iconbtn" style="color:var(--label3)" data-xdel="Decisions" data-xid="' + esc(d.ID) + '" aria-label="Remove decision">' + I.trash + '</button></div>').join("");
  const assumed = decs.filter(d => d.Status === "Assumed").length;
  return '<div class="extras">' +
    '<details class="disc"' + (localStorage.getItem("tower-open-files") === "1" ? " open" : "") + ' data-disc="files"><summary><svg class="chev2" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1.5 1.5L6.5 6.5l-5 5"/></svg>Files<span class="c">' + files.length + '</span></summary>' + fr +
    '<form class="xadd" data-xadd="Files"><input id="xf-t" placeholder="Title" required><input id="xf-u" type="url" placeholder="https://… link"><select id="xf-k" class="btn">' + KINDS.map(k => '<option>' + k + '</option>').join("") + '</select><button class="btn tint" type="submit">Add</button></form></details>' +
    '<details class="disc"' + (localStorage.getItem("tower-open-decisions") === "1" || assumed ? " open" : "") + ' data-disc="decisions"><summary><svg class="chev2" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2"><path d="M1.5 1.5L6.5 6.5l-5 5"/></svg>Decisions<span class="c">' + (assumed ? assumed + " assumed · " : "") + decs.length + '</span></summary>' + dr +
    '<form class="xadd" data-xadd="Decisions"><input id="xd-t" placeholder="What did you decide?" required><select id="xd-s" class="btn"><option>Locked</option><option>Assumed</option></select><button class="btn tint" type="submit">Add</button></form></details>' +
    '</div>';
}

/* ================= sheets (modals) ================= */
let sheetOpener = null;
function openSheet(kind, id) { sheetOpener = document.activeElement; UI.sheet = { kind, id, armed: false }; UI.menu = false; buildSheet(); }
function closeSheet() { UI.sheet = null; const s = $("#sheetRoot"); if (s) s.remove(); if (renderPane.dirty) { renderPane.force = true; } render(); if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus(); }
function buildSheet() {
  let el = $("#sheetRoot"); if (!el) { el = document.createElement("div"); el.id = "sheetRoot"; document.body.appendChild(el); }
  const s = UI.sheet;
  if (s.kind === "task") el.innerHTML = taskSheetHtml(byId("Tasks", s.id));
  else if (s.kind === "list") el.innerHTML = listSheetHtml(s.id ? listOf(s.id) : null);
  const f = el.querySelector("[data-autofocus]") || el.querySelector(".sheet-h .r"); if (f) f.focus();
}
function refreshSheet() {
  const s = UI.sheet; if (!s) return;
  if (s.kind === "task") {
    const t = byId("Tasks", s.id); if (!t) { closeSheet(); return; }
    const log = $("#tlog"); if (log) log.innerHTML = logHtml(t);
    const fl = $("#sw-flag"); if (fl) fl.setAttribute("aria-checked", String(!!t.Flagged));
  }
}
function logHtml(t) {
  const lines = String(t.Log || "").split("\n").filter(Boolean).reverse();
  return lines.length ? lines.map(l => { const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (.*)$/.exec(l); return '<div class="le"><time>' + esc(m ? dateLabel(m[1].slice(0, 10)) + " " + m[1].slice(11) : "") + '</time><span>' + esc(m ? m[2] : l) + '</span></div>'; }).join("") : '<div class="none">No updates yet. Post one to remember where you left off.</div>';
}
function taskSheetHtml(t) {
  if (!t) return "";
  const listOpts = lists().map(p => '<option' + (p.Name === t.List ? " selected" : "") + '>' + esc(p.Name) + '</option>').join("") + (listOf(t.List) ? "" : '<option selected>' + esc(t.List) + '</option>');
  return '<div class="scrim" data-close><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-title" data-stop>' +
    '<div class="sheet-h"><span></span><h2 id="sh-title">Details</h2><button class="r" data-close>Done</button></div><div class="sheet-b">' +
    (t.Source === "Seed" ? '<div class="banner"><span>This came from an earlier chat with Claude. Check it, then confirm.</span><button class="btn tint" data-act="keep-sheet">Looks right</button></div>' : "") +
    '<div class="ig"><div class="ig-row"><input class="big" type="text" data-tf="Title" value="' + esc(t.Title) + '" aria-label="Title" data-autofocus></div>' +
    '<div class="ig-row"><textarea data-tf="Notes" placeholder="Notes" aria-label="Notes">' + esc(t.Notes) + '</textarea></div>' +
    '<div class="ig-row"><input type="url" data-tf="Link" value="' + esc(t.Link) + '" placeholder="URL" aria-label="Link">' + (safeUrl(t.Link) ? '<a class="btn" href="' + esc(safeUrl(t.Link)) + '" target="_blank" rel="noopener">Open</a>' : "") + '</div></div>' +
    '<div class="ig"><div class="ig-row ic"><span class="ricon" style="background:var(--red)">' + I.cal + '</span><span class="rl">Date' + (t.Due ? '<span class="sub2">' + esc(dateLabel(t.Due, true)) + '</span>' : "") + '</span>' + (t.Due ? '<input type="date" data-tf="Due" value="' + esc(t.Due) + '" aria-label="Due date">' : "") + '<button class="switch" role="switch" id="sw-date" aria-checked="' + !!t.Due + '" aria-label="Has a date"></button></div>' +
    '<div class="ig-row ic"><span class="ricon" style="background:var(--flag)">' + I.flag + '</span><span class="rl">Flag</span><button class="switch" role="switch" id="sw-flag" aria-checked="' + !!t.Flagged + '" aria-label="Flagged"></button></div></div>' +
    '<div class="ig"><div class="ig-row"><span class="rl">Priority</span><select data-tf="Priority" aria-label="Priority">' + PRIS.map(p => '<option' + (p === t.Priority ? " selected" : "") + '>' + p + '</option>').join("") + '</select></div>' +
    '<div class="ig-row"><span class="rl">List</span><select data-tf="List" aria-label="List">' + listOpts + '</select></div>' +
    '<div class="ig-row"><span class="rl">Estimate (hours)</span><input type="number" min="0" step="0.5" inputmode="decimal" data-tf="Estimate" value="' + esc(t.Estimate) + '" style="max-width:90px;text-align:right" aria-label="Estimate in hours"></div></div>' +
    '<div><div class="ig-cap">Updates</div><div class="ig"><div class="ig-row"><input type="text" id="upd" placeholder="Add an update and press Return" aria-label="Add an update"></div><div class="log" id="tlog">' + logHtml(t) + '</div></div></div>' +
    '<div class="ig"><button class="ig-row delete-row" id="del-task">' + (UI.sheet && UI.sheet.armed ? "Tap again to delete" : "Delete Task") + '</button></div>' +
    '<div style="font-size:13px;color:var(--label3);text-align:center">' + esc(t.ID) + (t.Created ? " · Created " + esc(t.Created) : "") + (t.Updated ? " · Updated " + esc(t.Updated) : "") + '</div>' +
    '</div></div></div>';
}
function listSheetHtml(p) {
  const isNew = !p; const color = p ? p.Color : COLORS[lists().length % COLORS.length];
  const n = p ? T().filter(t => t.List === p.Name).length : 0;
  return '<div class="scrim" data-close><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-title" data-stop>' +
    '<div class="sheet-h"><button class="l" data-close>Cancel</button><h2 id="sh-title">' + (isNew ? "New List" : "List Info") + '</h2><button class="r" id="list-save">' + (isNew ? "Add" : "Done") + '</button></div><div class="sheet-b">' +
    '<div class="ig"><div class="ig-row"><input class="big" type="text" id="lf-name" value="' + esc(p ? p.Name : "") + '" placeholder="List name" aria-label="List name" data-autofocus></div>' +
    '<div class="swatches" role="radiogroup" aria-label="Colour">' + COLORS.map(c => '<button class="sw" role="radio" data-color="' + c + '" aria-checked="' + (c === color) + '" aria-label="' + c + '" style="--sc:' + lc(c) + '"></button>').join("") + '</div></div>' +
    (isNew ? "" :
      '<div class="ig"><div class="ig-row"><span class="rl">Status</span><select id="lf-status">' + PSTATUS.map(s => '<option' + (s === p.Status ? " selected" : "") + '>' + s + '</option>').join("") + '</select></div>' +
      '<div class="ig-row"><span class="rl">Type</span><input type="text" id="lf-type" value="' + esc(p.Type) + '" style="text-align:right;max-width:60%"></div>' +
      '<div class="ig-row"><span class="rl">Client</span><input type="text" id="lf-client" value="' + esc(p.Client) + '" style="text-align:right;max-width:60%"></div></div>' +
      '<div class="ig"><div class="ig-row"><input type="text" id="lf-milestone" value="' + esc(p.Milestone) + '" placeholder="Next milestone"></div>' +
      '<div class="ig-row"><input type="url" id="lf-home" value="' + esc(p.Home) + '" placeholder="Home link (Drive folder or site)"></div>' +
      '<div class="ig-row"><textarea id="lf-notes" placeholder="Notes">' + esc(p.Notes) + '</textarea></div></div>' +
      '<div class="ig"><button class="ig-row delete-row" id="del-list"' + (n ? " disabled" : "") + '>' + (n ? "Move or delete its " + n + " tasks before deleting this list" : "Delete List") + '</button></div>') +
    '</div></div></div>';
}

/* ================= events ================= */
document.addEventListener("click", e => {
  const tgt = e.target;
  // sheet layer
  if (UI.sheet && $("#sheetRoot") && $("#sheetRoot").contains(tgt)) { sheetClick(e); return; }
  if (UI.menu && !tgt.closest(".menu")) { UI.menu = false; renderPane(); }
  const gEl = tgt.closest("[data-go]"); if (gEl) { if (gEl.dataset.go === "list") goList(gEl.dataset.list); else go(gEl.dataset.go); return; }
  const act = tgt.closest("[data-act]"); const row = tgt.closest(".task"); const t = row ? byId("Tasks", row.dataset.id) : null;
  if (UI.openSwipe && (!row || row.dataset.id !== UI.openSwipe) && !(act && act.closest(".swipe-acts"))) closeSwipe();
  if (act) {
    const a = act.dataset.act;
    if (a === "toggle" && t) return toggleDone(t);
    if (a === "details" && t) return openSheet("task", t.ID);
    if (a === "flag" && t) { t.Flagged = !t.Flagged; addLog(t, t.Flagged ? "Flagged" : "Unflagged"); closeSwipe(); return save("Tasks", t); }
    if (a === "delete" && t) return deleteTask(t);
    if (a === "keep" && t) { t.Source = "Self"; addLog(t, "Checked"); save("Tasks", t); return toast("Confirmed “" + t.Title + "”", () => { t.Source = "Seed"; save("Tasks", t); }); }
    if (a === "drop" && t) { t.Done = true; t.Source = "Self"; t.Completed = stamp(); addLog(t, "Dropped while checking"); save("Tasks", t); return toast("Dropped “" + t.Title + "”", () => { t.Done = false; t.Source = "Seed"; t.Completed = ""; save("Tasks", t); }); }
    if (a === "add") { UI.adding = true; UI.newText = ""; UI.ignoreParse = false; UI.newOpts = defaultsForView(); return renderPane(); }
    if (a === "unparse") { UI.ignoreParse = true; return rerenderNew(); }
    if (a === "nflag") { UI.newOpts.flag = !UI.newOpts.flag; return rerenderNew(); }
    if (a === "npri") { const i = PRIS.indexOf(UI.newOpts.pri); UI.newOpts.pri = PRIS[(i + 1) % 4]; return rerenderNew(); }
    if (a === "home") { UI.screen = "home"; UI.adding = false; return render(); }
    if (a === "menu") { UI.menu = !UI.menu; return renderPane(); }
    if (a === "toggledone") { UI.showDone = !UI.showDone; UI.menu = false; persist(); return renderPane(); }
    if (a === "listinfo") { return openSheet("list", UI.list); }
    if (a === "newlist") { return openListSheet(null); }
    if (a === "opensheet") { UI.menu = false; renderPane(); window.open(SHEET_URL(), "_blank", "noopener"); return; }
    if (a === "signout") return signOut();
    if (a === "copy-plan" || a === "copy-wrap") { UI.menu = false; renderPane(); return copyPrompt(a); }
  }
  const nd = tgt.closest("[data-nd]"); if (nd) { UI.newOpts.due = UI.newOpts.due === nd.dataset.nd ? null : nd.dataset.nd; return rerenderNew(); }
  const ed = tgt.closest("[data-edit]"); if (ed && t) { UI.editing = t.ID; UI.sel = t.ID; return renderPane(); }
  const cyc = tgt.closest("[data-cyc]"); if (cyc) { const d = byId("Decisions", cyc.dataset.cyc); if (d) { d.Status = { Assumed: "Locked", Locked: "Revised", Revised: "Assumed" }[d.Status] || "Locked"; save("Decisions", d); } return; }
  const xd = tgt.closest("[data-xdel]"); if (xd) { const s = xd.dataset.xdel, o = byId(s, xd.dataset.xid); if (o) { remove(s, o); toast("Removed", () => { const c = Object.assign({}, o); delete c._row; insert(s, c); }); } return; }
  if (row && t && !tgt.closest("button,a,input")) { UI.sel = t.ID; renderPane(); }
  if (tgt.id === "reconnect") { signIn(""); }
});
function goList(name) { go("list", name); }
function rerenderNew() { UI.newText = $("#newin") ? $("#newin").value : UI.newText; renderPane(); }
document.addEventListener("toggle", e => { const d = e.target.closest && e.target.closest("[data-disc]"); if (d) try { localStorage.setItem("tower-open-" + d.dataset.disc, d.open ? "1" : "0"); } catch (_) {} }, true);
document.addEventListener("input", e => {
  if (e.target.id === "q") { UI.q = e.target.value.trim(); UI.screen = "list"; renderPane(); renderSide(); return; }
  if (e.target.id === "newin") { UI.newText = e.target.value; UI.ignoreParse = UI.ignoreParse && !!UI.newText; const c = $(".chips"); if (c) { const tmp = document.createElement("div"); tmp.innerHTML = newRowHtml(); c.replaceWith(tmp.querySelector(".chips")); } }
});
document.addEventListener("change", e => {
  if (e.target.id === "nlist") { UI.newOpts.list = e.target.value; return; }
  if (UI.sheet) sheetChange(e);
});
document.addEventListener("submit", e => {
  const f = e.target.closest("[data-xadd]"); if (!f) return; e.preventDefault();
  if (f.dataset.xadd === "Files") { const title = $("#xf-t").value.trim(); if (!title) return; insert("Files", { ID: nextId("Files"), List: UI.list, Title: title, Kind: $("#xf-k").value, URL: $("#xf-u").value.trim(), Notes: "" }); }
  else { const txt = $("#xd-t").value.trim(); if (!txt) return; insert("Decisions", { ID: nextId("Decisions"), List: UI.list, Decision: txt, Status: $("#xd-s").value, Source: "Me", Date: todayISO(), Replaces: "" }); }
  renderPane.force = true; document.activeElement.blur(); render();
});
document.addEventListener("focusout", e => {
  if (e.target.classList && e.target.classList.contains("ttitle-edit")) commitEdit(e.target);
  if (e.target.id === "newin") setTimeout(() => { const a = document.activeElement; if (UI.adding && !(a && (a.id === "newin" || a.closest(".chips")))) { if (!UI.newText.trim()) { UI.adding = false; renderPane(); } } }, 150);
  if (renderPane.dirty) setTimeout(() => { if (!isEditing() || !$("#pane").contains(document.activeElement)) { renderPane.force = true; render(); } }, 0);
});
function commitEdit(input) {
  const t = byId("Tasks", UI.editing); UI.editing = null; if (!t) return renderPane();
  const v = input.value.replace(/\s+/g, " ").trim();
  if (v && v !== t.Title) { t.Title = v; save("Tasks", t); } else renderPane();
}
document.addEventListener("keydown", e => {
  const a = document.activeElement;
  if (UI.sheet) {
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); return; }
    if (e.key === "Enter" && a && a.id === "upd") { e.preventDefault(); const t = byId("Tasks", UI.sheet.id); const v = a.value.trim(); if (t && v) { addLog(t, v); a.value = ""; save("Tasks", t); } return; }
    if (e.key === "Enter" && a && a.matches("input[data-tf]")) { a.blur(); return; }
    if (e.key === "Tab") trapFocus(e);
    return;
  }
  if (a && a.id === "newin") {
    if (e.key === "Enter") { e.preventDefault(); if (!commitNew()) { UI.adding = false; renderPane(); } else renderPane(); return; }
    if (e.key === "Escape") { e.preventDefault(); if (a.value.trim()) commitNew(); UI.adding = false; renderPane(); return; }
    return;
  }
  if (a && a.classList.contains("ttitle-edit")) {
    if (e.key === "Enter") { e.preventDefault(); a.blur(); }
    if (e.key === "Escape") { e.preventDefault(); UI.editing = null; renderPane(); }
    return;
  }
  if (a && a.id === "q") { if (e.key === "Escape") { a.value = ""; UI.q = ""; a.blur(); render(); } return; }
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  const mod = e.metaKey || e.ctrlKey;
  if ((mod && e.key.toLowerCase() === "n") || (!mod && e.key === "n")) { e.preventDefault(); if (!UI.q && UI.view !== "check") { UI.screen = "list"; UI.adding = true; UI.newText = ""; UI.newOpts = defaultsForView(); render(); } return; }
  if ((mod && e.key.toLowerCase() === "f") || e.key === "/") { e.preventDefault(); const q = $("#q"); if (q) { UI.screen = "home"; render(); $("#q").focus(); } return; }
  if (e.key === "Escape") { if (UI.menu) { UI.menu = false; return renderPane(); } if (UI.sel) { UI.sel = null; return renderPane(); } }
  const ids = visibleOrder();
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); let i = ids.indexOf(UI.sel); i = e.key === "ArrowDown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1); UI.sel = ids[i] || null; renderPane(); const r = UI.sel && document.querySelector('.task[data-id="' + CSS.escape(UI.sel) + '"]'); if (r) r.scrollIntoView({ block: "nearest" }); return; }
  const t = UI.sel && byId("Tasks", UI.sel); if (!t) return;
  if (e.key === " ") { e.preventDefault(); toggleDone(t); }
  else if (e.key === "Enter") { e.preventDefault(); UI.editing = t.ID; renderPane(); }
  else if (e.key === "i" || (mod && e.key.toLowerCase() === "i")) { e.preventDefault(); openSheet("task", t.ID); }
  else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); deleteTask(t); }
  else if (e.key === "f") { e.preventDefault(); t.Flagged = !t.Flagged; addLog(t, t.Flagged ? "Flagged" : "Unflagged"); save("Tasks", t); }
});
function trapFocus(e) {
  const box = $("#sheetRoot .sheet"); if (!box) return;
  const f = [...box.querySelectorAll("button:not([disabled]),input,select,textarea,a[href]")].filter(x => x.offsetParent !== null);
  if (!f.length) return; const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* task actions */
function toggleDone(t) {
  t.Done = !t.Done;
  if (t.Done) { t.Completed = stamp(); addLog(t, "Completed"); lingering.add(t.ID); setTimeout(() => { lingering.delete(t.ID); render(); }, 1600); toast("Completed “" + t.Title + "”", () => { t.Done = false; t.Completed = ""; addLog(t, "Reopened"); save("Tasks", t); }); }
  else { t.Completed = ""; addLog(t, "Reopened"); lingering.delete(t.ID); }
  save("Tasks", t);
}
function deleteTask(t) {
  const copy = Object.assign({}, t); delete copy._row;
  closeSwipe(); if (UI.sel === t.ID) UI.sel = null;
  remove("Tasks", t);
  toast("Deleted “" + t.Title + "”", () => insert("Tasks", copy));
}

/* sheet interactions */
function sheetClick(e) {
  const tgt = e.target; const s = UI.sheet;
  if (tgt.classList.contains("scrim") || tgt.closest(".sheet-h [data-close]")) { flushSheetInputs(); closeSheet(); return; }
  if (s.kind === "task") {
    const t = byId("Tasks", s.id); if (!t) return;
    if (tgt.closest("#sw-flag")) { t.Flagged = !t.Flagged; addLog(t, t.Flagged ? "Flagged" : "Unflagged"); save("Tasks", t); tgt.closest("#sw-flag").setAttribute("aria-checked", String(t.Flagged)); return; }
    if (tgt.closest("#sw-date")) { flushSheetInputs(); t.Due = t.Due ? "" : todayISO(); addLog(t, t.Due ? "Date set to " + dateLabel(t.Due) : "Date removed"); save("Tasks", t); buildSheet(); return; }
    if (tgt.closest("[data-act='keep-sheet']")) { t.Source = "Self"; addLog(t, "Checked"); save("Tasks", t); buildSheet(); return; }
    if (tgt.closest("#del-task")) { if (!s.armed) { s.armed = true; tgt.closest("#del-task").textContent = "Tap again to delete"; return; } closeSheet(); deleteTask(t); return; }
  }
  if (s.kind === "list") {
    const sw = tgt.closest("[data-color]"); if (sw) { document.querySelectorAll("#sheetRoot .sw").forEach(b => b.setAttribute("aria-checked", String(b === sw))); return; }
    if (tgt.closest("#list-save")) { saveListSheet(); return; }
    if (tgt.closest("#del-list")) { const p = listOf(s.id); if (!p) return; if (!s.armed) { s.armed = true; tgt.closest("#del-list").textContent = "Tap again to delete “" + p.Name + "”"; return; } closeSheet(); remove("Projects", p); go("today"); toast("Deleted list “" + p.Name + "”"); return; }
  }
}
function flushSheetInputs() { const a = document.activeElement; if (a && a.matches && a.matches("[data-tf]")) sheetChange({ target: a }); }
function sheetChange(e) {
  const el = e.target; const s = UI.sheet; if (!s || s.kind !== "task" || !el.dataset || !el.dataset.tf) return;
  const t = byId("Tasks", s.id); if (!t) return; const f = el.dataset.tf; let v = el.value;
  if (f === "Title") { v = v.replace(/\s+/g, " ").trim(); if (!v) { el.value = t.Title; return; } }
  if (f === "Estimate") v = v === "" ? "" : Math.max(0, parseFloat(v) || 0);
  if (f === "Due") v = normDate(v);
  if (String(t[f] == null ? "" : t[f]) === String(v)) return;
  const old = t[f]; t[f] = v;
  if (f === "List") addLog(t, "Moved from " + old + " to " + v);
  if (f === "Due") addLog(t, v ? "Date set to " + dateLabel(v) : "Date removed");
  if (f === "Priority") addLog(t, "Priority " + v);
  save("Tasks", t);
  if (f === "Due" || f === "Link") buildSheet();
}
document.addEventListener("focusout", e => { if (UI.sheet && e.target.matches && e.target.matches("textarea[data-tf],input[data-tf][type=text],input[data-tf][type=url],input[data-tf][type=number]")) sheetChange(e); }, true);
function openListSheet(name) { openSheet("list", name); }
function saveListSheet() {
  const s = UI.sheet; const name = $("#lf-name").value.replace(/\s+/g, " ").trim();
  const color = (document.querySelector("#sheetRoot .sw[aria-checked='true']") || {}).dataset?.color || "blue";
  if (!name) { $("#lf-name").focus(); toast("Give the list a name."); return; }
  const clash = listOf(name);
  if (!s.id) {
    if (clash) { toast("A list called “" + name + "” already exists."); return; }
    const order = Math.max(0, ...Pj().map(p => +p.Order || 0)) + 1;
    insert("Projects", { ID: nextId("Projects"), Name: name, Color: color, Status: "Active", Type: "", Client: "", Home: "", Milestone: "", Notes: "", Order: order });
    closeSheet(); go("list", name); return;
  }
  const p = listOf(s.id); if (!p) { closeSheet(); return; }
  if (clash && clash !== p) { toast("A list called “" + name + "” already exists."); return; }
  const oldName = p.Name;
  Object.assign(p, { Name: name, Color: color, Status: $("#lf-status").value, Type: $("#lf-type").value.trim(), Client: $("#lf-client").value.trim(), Milestone: $("#lf-milestone").value.trim(), Home: $("#lf-home").value.trim(), Notes: $("#lf-notes").value.trim() });
  save("Projects", p);
  if (oldName !== name) {
    ["Tasks", "Files", "Decisions"].forEach(sh => DB[sh] && DB[sh].items.filter(o => o.List === oldName).forEach(o => { o.List = name; save(sh, o); }));
    UI.list = name; persist();
  }
  closeSheet();
}

/* swipe (touch) */
let sw = null;
document.addEventListener("pointerdown", e => {
  if (e.pointerType !== "touch") return; const inner = e.target.closest(".task-inner"); if (!inner || e.target.closest(".circle,.info,input")) return;
  sw = { el: inner, row: inner.closest(".task"), x0: e.clientX, y0: e.clientY, dx: 0, active: false, base: UI.openSwipe === inner.closest(".task").dataset.id ? -152 : 0 };
}, { passive: true });
document.addEventListener("pointermove", e => {
  if (!sw) return; const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
  if (!sw.active) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { sw.active = true; sw.el.style.transition = "none"; } else if (Math.abs(dy) > 10) { sw = null; return; } else return; }
  sw.dx = dx; const x = Math.max(-190, Math.min(0, sw.base + dx)); sw.el.style.transform = "translateX(" + x + "px)";
}, { passive: true });
document.addEventListener("pointerup", () => {
  if (!sw) return; const s = sw; sw = null; if (!s.active) return;
  s.el.style.transition = ""; const x = s.base + s.dx;
  if (x < -170) { const t = byId("Tasks", s.row.dataset.id); s.el.style.transform = ""; if (t) deleteTask(t); return; }
  if (x < -60) { s.el.style.transform = "translateX(-152px)"; UI.openSwipe = s.row.dataset.id; } else { s.el.style.transform = ""; UI.openSwipe = null; }
  const blocker = ev => { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener("click", blocker, true); };
  document.addEventListener("click", blocker, true); setTimeout(() => document.removeEventListener("click", blocker, true), 50);
});
function closeSwipe() { if (!UI.openSwipe) return; const r = document.querySelector('.task[data-id="' + CSS.escape(UI.openSwipe) + '"] .task-inner'); if (r) r.style.transform = ""; UI.openSwipe = null; }

/* toast */
let toastT;
function toast(msg, undo) {
  const el = $("#toast"); el.innerHTML = "<span>" + esc(msg) + "</span>" + (undo ? '<button type="button" id="undo">Undo</button>' : "");
  el.hidden = false; clearTimeout(toastT);
  if (undo) $("#undo").onclick = () => { el.hidden = true; undo(); };
  toastT = setTimeout(() => el.hidden = true, undo ? 5000 : 3500);
}

/* Claude prompts */
async function copyPrompt(kind) {
  const flagged = T().filter(t => open(t) && t.Flagged).map(t => t.ID + " " + t.Title).join("; ") || "none";
  const doneToday = T().filter(t => t.Done && String(t.Completed).startsWith(todayISO())).map(t => t.ID + " " + t.Title).join("; ") || "none";
  const base = "Use personal-partner. My master data is the Tower Data sheet: " + SHEET_URL() + "\n";
  const txt = kind === "copy-plan"
    ? base + "Plan my week. Read the Tasks and Projects tabs and my Google Calendar. Rank open tasks, propose evening work blocks, suggest due dates for undated tasks, and flag what won't fit. Ask before changing anything."
    : base + "Wrap up today. Flagged: " + flagged + ". Completed today: " + doneToday + ". Ask me two short questions about what moved, then add update lines to the Log column, set dates for next steps and record any decisions.";
  try { await navigator.clipboard.writeText(txt); toast("Copied. Paste it into a new Claude chat."); }
  catch (e) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Copied. Paste it into a new Claude chat."); } catch (_) { toast("Couldn't copy. Your browser blocked it."); } ta.remove(); }
}

/* ================= gate screens ================= */
function showGateError(m) { const el = $("#gate-err"); if (el) { el.textContent = m; el.hidden = !m; } }
function gateSetup() {
  $("#root").innerHTML = '<div class="gate"><div class="gate-card"><div class="gate-logo">' + I.logo + '</div><h1>Set up Tower</h1>' +
    '<p>Tower keeps your tasks in your own Google Sheet. Connect it once with a Google sign-in key for this site. It takes about 10 minutes.</p>' +
    '<ol><li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console</a> and create a project called <code>Tower</code>.</li>' +
    '<li>Go to <b>APIs &amp; Services → Library</b>, search <b>Google Sheets API</b> and click <b>Enable</b>.</li>' +
    '<li>Go to <b>Google Auth Platform → Branding</b> (or <b>OAuth consent screen</b>), choose <b>External</b>, name it <code>Tower</code> and add your email. Under <b>Audience → Test users</b>, add your own Gmail address.</li>' +
    '<li>Go to <b>Clients</b> (or <b>Credentials</b>) → <b>Create client</b> → <b>Web application</b>. Under <b>Authorized JavaScript origins</b> add <code>' + esc(location.origin) + '</code>. Save and copy the <b>Client ID</b>.</li>' +
    '<li>Paste it below.</li></ol>' +
    '<div style="display:flex;flex-direction:column;gap:6px"><label for="cid">Client ID</label><input id="cid" placeholder="1234…apps.googleusercontent.com" autocomplete="off"></div>' +
    '<div style="display:flex;flex-direction:column;gap:6px"><label for="sid">Sheet ID</label><input id="sid" value="' + esc(CFG.sheetId) + '" autocomplete="off"></div>' +
    '<div class="err" id="gate-err" hidden></div>' +
    '<button class="gbtn" id="save-cfg">Save and continue</button><a class="gbtn alt" href="?demo" style="display:grid;place-items:center;text-decoration:none">Try it with sample data</a></div></div>';
  $("#save-cfg").onclick = () => {
    const cid = $("#cid").value.trim(), sid = $("#sid").value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(cid)) { showGateError("That doesn't look like a client ID. It ends in .apps.googleusercontent.com."); return; }
    if (!/^[A-Za-z0-9_-]{20,}$/.test(sid)) { showGateError("The sheet ID is the long code in the sheet's URL, between /d/ and /edit."); return; }
    try { localStorage.setItem("tower-config", JSON.stringify({ clientId: cid, sheetId: sid })); } catch (e) {}
    CFG.clientId = cid; CFG.sheetId = sid; boot();
  };
}
function gateSignIn() {
  $("#root").innerHTML = '<div class="gate"><div class="gate-card"><div class="gate-logo">' + I.logo + '</div><h1>Tower</h1>' +
    '<p>Your tasks live in your <b>Tower Data</b> Google Sheet. Sign in with the Google account that owns it.</p>' +
    '<div class="err" id="gate-err" hidden></div>' +
    '<button class="gbtn" id="signin">Continue with Google</button>' +
    '<p style="font-size:13.5px">Tower only asks for access to Google Sheets. Nothing is stored on this site.</p></div></div>';
  $("#signin").onclick = () => { showGateError(""); afterToken = startApp; signIn(); };
}
function gateLoading(msg) { $("#root").innerHTML = '<div class="gate"><div class="gate-card" style="align-items:center;text-align:center"><div class="gate-logo">' + I.logo + '</div><p>' + esc(msg) + '</p></div></div>'; }
async function startApp() {
  gateLoading("Loading your tasks…");
  try { await loadAll(true); }
  catch (e) {
    if (e.auth) { gateSignIn(); showGateError("Your Google session ended. Sign in again."); return; }
    $("#root").innerHTML = ""; gateSignIn();
    showGateError(e.status === 403 ? "Google says this account can't open the sheet. Sign in with the account that owns Tower Data." : e.status === 404 ? "Couldn't find the sheet. Check the sheet ID in config.js." : "Couldn't load the sheet: " + e.message);
    return;
  }
  $("#root").innerHTML = "";
  if (window.innerWidth > 760) UI.screen = "list";
  render(); startPolling();
}
async function boot() {
  if (DEMO) { await loadAll(true); if (window.innerWidth > 760) UI.screen = "list"; render(); toast("You're looking at sample data. Nothing is saved to Google."); return; }
  if (!CFG.clientId || !CFG.sheetId) { gateSetup(); return; }
  gateLoading("Starting…");
  const ok = await initAuth();
  if (!ok) { gateSignIn(); showGateError("Google sign-in couldn't load. Check your connection or ad blocker, then reload."); return; }
  gateSignIn();
}
window.addEventListener("beforeunload", e => { if (pending || retry.length) { e.preventDefault(); e.returnValue = ""; } });
boot();
})();
