(() => {
  // materials/week-12/cases.json
  var cases_default = ["Pranimi i vlefsh\xEBm", "Serveri refuzon veprimin e palejuar", "Vendi i fundit, vet\xEBm nj\xEB fitues"];

  // materials/week-12/validation-model.mjs
  function initialState(number = 1) {
    const seats = number === 3 ? 1 : 2;
    return { number, actor: number === 2 ? "arta" : "dritoni", payload: { requestId: "K-42" }, server: { seats, version: 1, requests: { "K-42": { passenger: "arta", status: "pending" }, "K-43": { passenger: "lira", status: "pending" } } }, views: { arta: { seats, status: "pending" }, lira: { seats, status: "pending" } }, response: null, log: [] };
  }
  function attempt(input, actor, payload, { failWrite = false } = {}) {
    const server = structuredClone(input);
    const done = (status, message, repeated = false) => ({ server, response: { status, message, repeated } });
    if (!actor || !["dritoni", "arta", "lira", "other-driver"].includes(actor)) return done(401, "Hyr n\xEB llogari p\xEBr ta kryer veprimin.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof payload.requestId !== "string" || !/^K-[1-9]\d*$/.test(payload.requestId)) return done(400, "ID-ja e k\xEBrkes\xEBs nuk ka format t\xEB vlefsh\xEBm.");
    if (actor !== "dritoni") return done(403, "Vet\xEBm shoferi pronar mund ta pranoj\xEB k\xEBt\xEB k\xEBrkes\xEB.");
    const request = server.requests[payload.requestId];
    if (!request) return done(404, "K\xEBrkesa nuk u gjet.");
    if (request.status === "accepted") return done(200, "Ky pranim \xEBsht\xEB ruajtur m\xEB par\xEB. Vendet nuk u ndryshuan.", true);
    if (server.seats < 1) return done(409, "Nuk ka m\xEB vende t\xEB lira. K\xEBrkesa nuk u konfirmua.");
    if (failWrite) return done(503, "Ruajtja d\xEBshtoi. As vendet, as k\xEBrkesa nuk u ndryshuan.");
    server.seats--;
    request.status = "accepted";
    server.version++;
    return done(200, "Pranimi u ruajt dhe vendet u p\xEBrdit\xEBsuan.");
  }
  function transition(input, event) {
    const state2 = structuredClone(input);
    function submit(id, actor = state2.actor, payload = { requestId: id }) {
      const result = attempt(state2.server, actor, payload, { failWrite: !!event.failWrite });
      state2.server = result.server;
      state2.response = result.response;
      state2.log.push({ requestId: typeof payload?.requestId === "string" ? payload.requestId : "?", status: result.response.status, repeated: result.response.repeated });
    }
    if (event.type === "submit") submit(state2.payload.requestId, state2.actor, event.payload ?? state2.payload);
    if (event.type === "race") for (const id of event.order ?? ["K-42", "K-43"]) submit(id, "dritoni");
    if (event.type === "sync") for (const name of ["arta", "lira"]) {
      if (event.role && event.role !== name) continue;
      const id = name === "arta" ? "K-42" : "K-43";
      state2.views[name] = { seats: state2.server.seats, status: state2.server.requests[id].status };
    }
    if (event.type === "probe") {
      const probes = { passenger: { actor: "arta", id: "K-42" }, anonymous: { actor: null, id: "K-42" }, invalid: { actor: "dritoni", id: "" }, other: { actor: "other-driver", id: "K-42" } };
      const p = probes[event.value] ?? probes.passenger;
      state2.actor = p.actor;
      state2.payload = { requestId: p.id };
      state2.response = null;
    }
    return state2;
  }

  // materials/week-12/phone-ui.mjs
  var escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function renderPair(state2, { interactive = false } = {}) {
    const driver = state2.number !== 3;
    const phone = (role) => {
      const isDriver = role === "dritoni", name = isDriver ? "Dritoni" : role === "arta" ? "Arta" : "Lira", id = role === "lira" ? "K-43" : "K-42";
      const seats = isDriver ? state2.server.seats : state2.views[role].seats, status = isDriver ? state2.server.requests[id].status : state2.views[role].status;
      const text = status === "accepted" ? "E pranuar" : "N\xEB pritje";
      const forbidden = state2.number === 2 && !isDriver && state2.actor === role && state2.response?.status === 403;
      const action = isDriver ? `<button class="phone-action" data-action="accept" ${!interactive || state2.number === 2 || status === "accepted" ? "disabled" : ""}>Prano K-42</button>` : interactive ? `<button class="phone-action" data-action="read-${role}">Rilexo k\xEBrkes\xEBn</button>` : '<div class="phone-action">Gjendja e lexuar</div>';
      return `<div><h3 class="role-title">${isDriver ? "Shoferi" : "Udh\xEBtarja"} \xB7 ${name}</h3><div class="phone" data-phone="${role}"><div class="notch"></div><header><strong>RideShare</strong><span>${name} \xB7 ${isDriver ? "Shofer" : "Udh\xEBtare"}</span></header><div class="phone-label">UDH\xCBTIMI 2 \xB7 SIMULIM</div><div class="ride"><small>FERIZAJ \u2192 AAB</small><h3>Nisja 08:15</h3><p>Dritoni \xB7 Automjet privat</p><div class="ride-meta"><span>Vende t\xEB lira<strong>${seats}</strong></span><span>K\xEBrkesa<strong>${id}</strong></span></div></div><div class="request ${status === "accepted" ? "success" : "pending"}"><small>${isDriver ? "K\xCBRKESA E ART\xCBS" : "K\xCBRKESA IME"}</small><strong>${text}</strong></div>${action}<p class="phone-status ${forbidden ? "error" : status === "accepted" ? "success" : ""}">${forbidden ? "403 \xB7 Pranimi k\xEBrkon shoferin pronar." : status === "accepted" ? "Vendi u konfirmua." : "Ende pa konfirmim."}</p><small class="phone-foot">${isDriver ? "Gjendja e serverit t\xEB simuluar" : "Pamja pas leximit t\xEB fundit"}</small><div class="homebar"></div></div></div>`;
    };
    return `<div class="pair">${phone(driver ? "dritoni" : "arta")}${phone(driver ? "arta" : "lira")}</div>`;
  }

  // materials/week-12/demo.mjs
  var state = initialState(1);
  var narrations = ["Shoferi pranon K-42. Pastaj Arta e rilexon: vendet kalojn\xEB nga 2 n\xEB 1. Provo edhe p\xEBrs\xEBritjen.", "Ky panel simulon nj\xEB thirrje jasht\xEB nd\xEBrfaqes normale. Serveri e refuzon; statusi dhe vendet mbeten t\xEB nj\xEBjta.", "Dritoni provon dy pranime p\xEBr 1 vend. Modeli zbaton rendin e p\xEBrfundimit: vet\xEBm nj\xEBra k\xEBrkes\xEB pranohet."];
  function draw() {
    document.querySelector("[data-case-title]").textContent = `Rasti ${state.number} \xB7 ${cases_default[state.number - 1]}`;
    document.querySelector("[data-phones]").innerHTML = renderPair(state, { interactive: true });
    document.querySelectorAll("[data-case]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.case) === state.number)));
    document.querySelector("[data-narration]").textContent = narrations[state.number - 1];
    document.querySelector("[data-server]").textContent = `${state.server.seats} vende \xB7 K-42: ${state.server.requests["K-42"].status === "accepted" ? "e pranuar" : "n\xEB pritje"} \xB7 K-43: ${state.server.requests["K-43"].status === "accepted" ? "e pranuar" : "n\xEB pritje"}`;
    document.querySelector("[data-response]").textContent = state.response ? `${state.response.status} \xB7 ${state.response.message}` : "Ende pa veprim.";
    document.querySelector("[data-log]").innerHTML = state.log.slice(-4).map((r) => `<li>${escapeHTML(r.requestId)} \u2192 ${r.status}${r.repeated ? " \xB7 p\xEBrs\xEBritje" : ""}</li>`).join("");
    document.querySelector("[data-probes]").hidden = state.number !== 2;
    document.querySelector("[data-race]").hidden = state.number !== 3;
    document.querySelector("[data-repeat]").hidden = state.number !== 1;
    document.querySelector("[data-repeat]").disabled = state.server.requests["K-42"].status !== "accepted";
    document.querySelector("[data-probe]").value = state.actor === null ? "anonymous" : state.actor === "other-driver" ? "other" : state.actor === "dritoni" ? "invalid" : "passenger";
  }
  function reset(number) {
    state = initialState(number);
    history.replaceState(null, "", `#rast-${number}`);
    draw();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-case")) return reset(Number(button.dataset.case));
    const action = button.dataset.action;
    if (action === "accept") state = transition(state, { type: "submit" });
    if (action?.startsWith("read-")) state = transition(state, { type: "sync", role: action.slice(5) });
    if (button.hasAttribute("data-reset")) return reset(state.number);
    if (button.hasAttribute("data-sync")) state = transition(state, { type: "sync" });
    if (button.hasAttribute("data-repeat")) state = transition(state, { type: "submit" });
    if (button.hasAttribute("data-test")) state = transition(state, { type: "submit" });
    if (button.hasAttribute("data-race-order")) {
      state = initialState(3);
      state = transition(state, { type: "race", order: button.dataset.raceOrder === "lira" ? ["K-43", "K-42"] : ["K-42", "K-43"] });
    }
    if (button.hasAttribute("data-demo-mode")) {
      document.body.classList.toggle("demo-projector");
      button.textContent = document.body.classList.contains("demo-projector") ? "Mbyll projektorin" : "Hap n\xEB projektor";
      window.scrollTo(0, 0);
      return;
    }
    draw();
  });
  document.querySelector("[data-probe]").addEventListener("change", (e) => {
    state = transition(initialState(2), { type: "probe", value: e.target.value });
    draw();
  });
  window.addEventListener("hashchange", () => {
    const number = Number(location.hash.match(/rast-([123])/)?.[1] ?? 1);
    if (number !== state.number) {
      state = initialState(number);
      draw();
    }
  });
  state = initialState(Number(location.hash.match(/rast-([123])/)?.[1] ?? 1));
  draw();
})();
