import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { labels, eligible, totals, csv, parseRoster } from "./report.js";
const $ = (id) => document.getElementById(id),
  show = (id, yes = true) => ($(id).hidden = !yes);
const config = window.ATTENDANCE_CONFIG || {};
let incoming = new URLSearchParams(location.hash.slice(1)).get("token");
// Keep the challenge in memory, never in browser history or persistent storage.
if (incoming)
  history.replaceState(null, "", location.pathname + location.search);
window.addEventListener("hashchange", () => {
  const next = new URLSearchParams(location.hash.slice(1)).get("token");
  if (next) {
    incoming = next;
    history.replaceState(null, "", location.pathname + location.search);
    $("scan-result").textContent = "";
    show("scan-panel", !staff);
  }
});
let client,
  staff = false,
  data = { sessions: [], roster: [], records: [] },
  email = "",
  rotator,
  ticker,
  projecting = false,
  projectSession = "",
  reportRows = [],
  reportRequest = 0;
function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
}
async function api(action, payload = {}) {
  const { data, error } = await client.rpc("attendance_api", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return data;
}
function bind(id, handler, event = "click") {
  $(id).addEventListener(event, async (e) => {
    e.preventDefault();
    const button = e.submitter || e.currentTarget;
    button.disabled = true;
    try {
      await handler(e);
    } catch (error) {
      notice(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}
function option(value, text) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = text;
  return el;
}
function table(headers, rows) {
  const t = document.createElement("table"),
    h = document.createElement("thead"),
    tr = document.createElement("tr");
  for (const title of headers) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = title;
    tr.append(th);
  }
  h.append(tr);
  t.append(h);
  const b = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value of row) {
      const td = document.createElement("td");
      if (value instanceof Node) td.append(value);
      else td.textContent = value;
      tr.append(td);
    }
    b.append(tr);
  }
  t.append(b);
  return t;
}
const sem = () => $("semester").value;
const sid = () => $("session").value;
function requireSemester() {
  if (!sem()) throw new Error("Zgjidhni ose krijoni semestrin.");
  return sem();
}
async function boot() {
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) throw error;
  show("login", !session);
  show("app", !!session);
  if (!session) return;
  const user = await api("bootstrap");
  staff = user.staff;
  $("identity").textContent =
    `${user.email} · ${staff ? "Pedagog" : "Student"}`;
  show("staff", staff);
  show("student-help", !staff);
  show("scan-panel", !!incoming && !staff);
  const previous = sem();
  $("semester").replaceChildren(
    ...user.semesters.map((s) => option(s.id, s.title)),
  );
  if (user.semesters.some((s) => s.id === previous))
    $("semester").value = previous;
  if (!user.semesters.length)
    notice(
      staff
        ? "Krijoni semestrin dhe shtoni listën e studentëve."
        : "Emaili juaj nuk është ende në listën e kursit. Kontaktoni pedagogun.",
    );
  await refresh();
}
async function refresh() {
  const request = ++reportRequest;
  const previous = sid();
  $("session").replaceChildren();
  data = { sessions: [], roster: [], records: [] };
  if (!sem()) return;
  reportRows = [];
  $("report").textContent = "Duke lexuar evidencën nga serveri…";
  $("history").replaceChildren();
  $("verification").replaceChildren();
  const loaded = await api("report", { semester_id: sem() });
  if (request !== reportRequest) return;
  data = loaded;
  $("session").replaceChildren(
    ...data.sessions.map((s) =>
      option(
        s.id,
        `Java ${s.week} · ${labels[s.kind]} · ${s.group_name} · ${s.title} (${labels[s.state]})`,
      ),
    ),
  );
  if (data.sessions.some((s) => s.id === previous))
    $("session").value = previous;
  else if (data.sessions.length) $("session").value = data.sessions.at(-1).id;
  render();
}
function render() {
  reportRows = [
    [
      "Nr. studenti",
      "Emri",
      "Grupi",
      "Ligjërata",
      "Ushtrime",
      ...data.sessions.map(
        (s) => `J${s.week} ${labels[s.kind]} · ${s.title} · ${labels[s.state]}`,
      ),
    ],
  ];
  for (const p of data.roster) {
    reportRows.push([
      p.student_number,
      p.name,
      p.group_name,
      totals(p, data.sessions, data.records, "lecture"),
      totals(p, data.sessions, data.records, "lab"),
      ...data.sessions.map((s) => {
        if (!eligible(p, s)) return "Nuk aplikohet";
        if (s.state === "cancelled") return "Anuluar";
        const status = data.records.find(
          (r) => r.session_id === s.id && r.roster_id === p.id,
        )?.status;
        return status
          ? labels[status]
          : s.state === "finalized"
            ? "Mungesë"
            : "Në proces";
      }),
    ]);
  }
  $("report").replaceChildren(table(reportRows[0], reportRows.slice(1)));
  if (!data.roster.length)
    $("report").textContent = "Nuk ka studentë në këtë semestër.";
  if (!staff) {
    const summary = document.createElement("div");
    summary.className = "grid";
    for (const p of data.roster) {
      for (const kind of ["lecture", "lab"]) {
        const box = document.createElement("div"),
          title = document.createElement("h3"),
          value = document.createElement("p");
        title.textContent = labels[kind];
        value.textContent = totals(p, data.sessions, data.records, kind);
        value.className = "attendance-total";
        box.append(title, value);
        summary.append(box);
      }
    }
    $("report").replaceChildren(summary);
    $("history").replaceChildren();
    for (const session of [...data.sessions].reverse()) {
      const card = document.createElement("article"),
        title = document.createElement("h3"),
        detail = document.createElement("p");
      card.className = "history-card";
      title.textContent = `Java ${session.week} · ${labels[session.kind]} · ${session.title}`;
      const status = data.records.find(
        (r) => r.session_id === session.id,
      )?.status;
      detail.textContent = `${new Date(session.created_at).toLocaleDateString("sq-AL")} · ${labels[session.state]} · ${session.state === "cancelled" ? "Nuk llogaritet" : status ? labels[status] : session.state === "finalized" ? "Mungesë" : "Në proces"}`;
      card.append(title, detail);
      $("history").append(card);
    }
    if (!data.sessions.length)
      $("history").textContent = "Ende nuk ka sesione për grupin tuaj.";
    return;
  }

  const session = data.sessions.find((s) => s.id === sid());
  $("verification").replaceChildren();
  if (!session) return;
  const rows = data.roster
    .filter((p) => eligible(p, session))
    .map((p) => {
      const record = data.records.find(
        (r) => r.session_id === session.id && r.roster_id === p.id,
      );
      const actions = document.createElement("div");
      for (const [status, label] of [
        ["present", "Konfirmo në sallë"],
        ["rejected", "Refuzo"],
        ["excused", "Arsyeto"],
      ]) {
        const button = document.createElement("button");
        button.textContent = label;
        button.className = "secondary";
        button.disabled = session.state === "cancelled";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await api("verify", {
              session_id: session.id,
              roster_id: p.id,
              status,
              reason: $("reason").value.trim(),
            });
            notice("Evidenca u përditësua në server.");
            await refresh();
          } catch (e) {
            notice(e.message, true);
            button.disabled = false;
          }
        });
        actions.append(button);
      }
      return [
        p.student_number,
        p.name,
        labels[record?.status] || "Pa skanim",
        actions,
      ];
    });
  $("verification").append(
    table(
      ["Nr. studenti", "Studenti", "Statusi", "Verifikimi i pedagogut"],
      rows,
    ),
  );
}
function stopProjector() {
  projecting = false;
  clearTimeout(rotator);
  clearInterval(ticker);
  $("qr").getContext("2d").clearRect(0, 0, $("qr").width, $("qr").height);
  show("projector", false);
  document.body.classList.remove("projecting");
  $("project").focus();
}
async function rotate() {
  if (!projecting) return;
  const started = performance.now();
  try {
    const challenge = await api("challenge", { session_id: projectSession });
    if (!projecting) return;
    const url = new URL("attendance.html", location.href);
    url.hash = new URLSearchParams({ token: challenge.token }).toString();
    $("scan-link").href = url.href;
    await QRCode.toCanvas($("qr"), url.href, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    $("projector-title").textContent =
      `Java ${challenge.week} · ${labels[challenge.kind]} · ${challenge.title}`;
    const until =
      performance.now() +
      Math.max(
        0,
        Date.parse(challenge.expires_at) -
          Date.parse(challenge.server_time) -
          (performance.now() - started) -
          500,
      );
    clearInterval(ticker);
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((until - performance.now()) / 1000),
      );
      $("scan-link").hidden = !seconds;
      $("countdown").textContent = seconds
        ? `QR i vlefshëm edhe ${seconds} sekonda`
        : "QR ka skaduar";
      if (!seconds)
        $("qr").getContext("2d").clearRect(0, 0, $("qr").width, $("qr").height);
    };
    tick();
    ticker = setInterval(tick, 1000);
    rotator = setTimeout(rotate, 25000);
  } catch (e) {
    // A network error must never expose the private register on the projector.
    clearInterval(ticker);
    $("qr").getContext("2d").clearRect(0, 0, $("qr").width, $("qr").height);
    $("scan-link").hidden = true;
    $("countdown").textContent =
      "Skanimi u ndal. Pedagogu duhet të rihapë QR-në.";
    notice(`QR u ndal: ${e.message}`, true);
  }
}
if (!config.supabaseUrl || !config.publishableKey) {
  show("setup");
} else {
  client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: { detectSessionInUrl: false },
  });
  bind(
    "email-form",
    async () => {
      email = $("email").value.trim().toLowerCase();
      const { error } = await client.auth.signInWithOtp({ email });
      if (error) throw error;
      show("otp-form");
      notice("Kodi u kërkua. Kontrollo emailin dhe dosjen Spam.");
      $("otp").focus();
    },
    "submit",
  );
  bind(
    "otp-form",
    async () => {
      const { error } = await client.auth.verifyOtp({
        email,
        token: $("otp").value.trim(),
        type: "email",
      });
      if (error) throw error;
      notice("Hyrja u verifikua.");
      await boot();
    },
    "submit",
  );
  bind("logout", async () => {
    stopProjector();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    data = { sessions: [], roster: [], records: [] };
    $("report").replaceChildren();
    $("verification").replaceChildren();
    notice("Dolët nga llogaria.");
    await boot();
  });
  bind("refresh", async () => {
    await refresh();
    notice("Evidenca u lexua nga serveri.");
  });
  bind("semester", refresh, "change");
  bind("session", render, "change");
  bind(
    "semester-form",
    async (e) => {
      const p = Object.fromEntries(new FormData(e.target));
      const created = await api("semester", p);
      await boot();
      $("semester").value = created.id;
      await refresh();
      notice("Semestri u krijua.");
    },
    "submit",
  );
  bind(
    "roster-form",
    async () => {
      await api("roster", {
        semester_id: requireSemester(),
        students: parseRoster($("roster-input").value),
      });
      $("roster-input").value = "";
      await refresh();
      notice("Lista u ruajt në server.");
    },
    "submit",
  );
  bind(
    "session-form",
    async (e) => {
      const p = Object.fromEntries(new FormData(e.target));
      await api("session", { ...p, semester_id: requireSemester() });
      await refresh();
      notice("Sesioni u hap. Shfaqni QR në projektor.");
    },
    "submit",
  );
  bind("scan", async () => {
    const result = await api("scan", { token: incoming });
    $("scan-result").textContent =
      `${result.title}: skanimi u ruajt. Statusin aktual e gjeni në historikun poshtë.`;
    if (result.semester_id) $("semester").value = result.semester_id;
    notice(
      result.status === "pending"
        ? "Skanimi është në pritje të verifikimit në sallë."
        : labels[result.status],
    );
    await refresh();
  });
  for (const [id, state] of [
    ["close", "closed"],
    ["finalize", "finalized"],
    ["cancel", "cancelled"],
  ])
    bind(id, async () => {
      if (!sid()) throw new Error("Zgjidhni sesionin.");
      if (
        !confirm(
          state === "cancelled"
            ? "Të anulohet kjo orë dhe të përjashtohet nga raporti?"
            : "Të ndryshohet gjendja e sesionit të zgjedhur?",
        )
      )
        return;
      await api("state", { session_id: sid(), state });
      stopProjector();
      await refresh();
      notice("Gjendja u ruajt në server.");
    });
  bind("project", async () => {
    if (!sid()) throw new Error("Zgjidhni një sesion të hapur.");
    projectSession = sid();
    projecting = true;
    document.body.classList.add("projecting");
    show("projector");
    $("exit-projector").focus();
    await rotate();
  });
  bind("exit-projector", stopProjector);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && projecting) stopProjector();
  });
  bind("export", () => {
    if (!reportRows.length)
      throw new Error("Lexoni fillimisht raportin nga serveri.");
    const blob = new Blob([csv(reportRows)], {
        type: "text/csv;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "vijueshmeria-semestrale.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  boot().catch((e) => notice(e.message, true));
}
