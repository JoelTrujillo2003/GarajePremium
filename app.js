import { API } from "./api.js";
import { CATALOG, CURRENT_YEAR, formatKm, parseMileage } from "./catalog.js";
const app = document.querySelector("#app"),
  modal = document.querySelector("#modal");
let user = null,
  profile = null,
  vehicles = [],
  records = [],
  selected = null,
  view = "dashboard",
  authMode = "login",
  plan = null,
  recovery =
    new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";
let loadVersion = 0,
  toastTimer,
  generating = false;
const $ = (s) => document.querySelector(s);
const arrow =
  '<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
const date = (s) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(s.length === 10 ? s + "T12:00:00-03:00" : s));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const premium = () =>
  profile?.premium_until && Date.parse(profile.premium_until) > Date.now();
const vehicle = () => vehicles.find((v) => v.id === selected);
const brand = () =>
  '<div class="brand"><span class="mark">G<span class="visually-hidden">araje</span></span><div>garaje<span class="light">premium</span><small>DRIVE WITH CONFIDENCE</small></div></div>';
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 5000);
}
function fail(error) {
  toast(error.message || "No se pudo completar la operación.");
}
function theme() {
  const next =
    document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("garaje-theme", next);
}
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("garaje-theme") || "dark";
} catch {}
function renderAuth() {
  const signup = authMode === "signup";
  app.innerHTML = `<main class="auth"><section class="auth-story">${brand()}<div><span class="eyebrow">MENOS INCERTIDUMBRE. MÁS CAMINO.</span><h1 style="margin-top:20px">Tu próximo viaje<br>empieza con<br><span class="accent">tranquilidad.</span></h1><p>Todo el cuidado de tu vehículo, en un solo lugar. Conoce su historia y anticipa su próxima mantención.</p><div class="road-art" style="margin-top:30px" aria-hidden="true"><span class="stamp">EL CAMINO ES TUYO.</span><span class="car">${vehicleArt("Automóvil")}</span></div></div><div class="story-bottom"><span class="tag"><span class="dot"></span> DISEÑADO PARA CHILE</span><p style="font-size:11px;margin:14px 0 0">Automóviles · Camionetas · Motocicletas</p></div></section><section class="auth-form"><div class="auth-box"><div class="row between"><span class="eyebrow">BIENVENIDO A TU GARAJE</span><button class="btn small theme" data-action="theme" aria-label="Cambiar tema">◐</button></div><h2 style="margin-top:17px">${signup ? "Comienza a cuidar mejor." : "Qué bueno verte de nuevo."}</h2><p class="muted">${signup ? "Crea tu cuenta. Tu vehículo te lo agradecerá." : "Ingresa para tener todo bajo control."}</p><div class="tabs" role="tablist" aria-label="Acceso"><button role="tab" aria-selected="${!signup}" class="${!signup ? "active" : ""}" data-auth="login">Iniciar sesión</button><button role="tab" aria-selected="${signup}" class="${signup ? "active" : ""}" data-auth="signup">Crear cuenta</button></div><form id="auth-form">${signup ? '<div class="field"><label for="name">Tu nombre</label><input class="input" id="name" name="name" autocomplete="name" maxlength="80" required placeholder="¿Cómo te llamas?"></div>' : ""}<div class="field"><label for="email">Correo electrónico</label><input class="input" id="email" name="email" type="email" maxlength="254" autocomplete="email" required placeholder="tu@correo.cl"></div><div class="field"><div class="row between"><label for="password">Contraseña</label>${!signup ? '<button type="button" class="close" style="font-size:11px" data-action="forgot">¿La olvidaste?</button>' : ""}</div><input class="input" id="password" name="password" type="password" minlength="8" maxlength="128" required autocomplete="${signup ? "new-password" : "current-password"}" placeholder="Mínimo 8 caracteres"></div><p class="error" id="auth-error" role="alert"></p><button class="btn primary full" type="submit">${signup ? "Crear mi cuenta" : "Entrar a mi garaje"} <span aria-hidden="true">${arrow}</span></button></form><div class="divider">o continúa con</div><div class="oauth"><button class="btn" data-oauth="google">G · Google</button><button class="btn" data-oauth="apple">● · Apple</button><button class="btn" data-oauth="azure">▦ · Microsoft</button></div>${API.demo ? '<div class="demo-note"><strong>Modo demostración · sin conexión a Supabase</strong><br>Usa un correo de prueba y una contraseña exclusiva para esta demo. Los datos se guardan en este navegador; no se envían correos ni se realizan cobros.</div>' : ""}<p class="auth-footer">Tus datos, tu control. <button class="close" style="font-size:11px;text-decoration:underline" data-action="privacy">Privacidad y condiciones</button></p></div></section></main>`;
  $("#auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target,
      b = f.querySelector("[type=submit]");
    b.disabled = true;
    $("#auth-error").textContent = "";
    try {
      const d = new FormData(f);
      if (signup && !d.get("name").trim())
        throw new Error("Ingresa tu nombre.");
      user = signup
        ? await API.signUp(
            d.get("name").trim(),
            d.get("email").trim(),
            d.get("password"),
          )
        : await API.signIn(d.get("email").trim(), d.get("password"));
      if (!user) {
        toast("Revisa tu correo y confirma la cuenta antes de iniciar sesión.");
        authMode = "login";
        renderAuth();
        return;
      }
      await load();
    } catch (e) {
      if ($("#auth-error")) $("#auth-error").textContent = e.message;
    } finally {
      b.disabled = false;
    }
  });
}
function shell(body) {
  app.innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<div class="nav-title">TU ESPACIO</div><nav class="nav" aria-label="Principal"><button data-view="dashboard" class="${view === "dashboard" ? "active" : ""}">▦ <span>Vista general</span></button><button data-view="garage" class="${view === "garage" ? "active" : ""}">◇ <span>Mis vehículos</span></button><button data-view="records" class="${view === "records" ? "active" : ""}">☷ <span>Bitácora</span></button><button data-view="account" class="${view === "account" ? "active" : ""}">⚙ <span>Mi cuenta</span></button></nav><div class="sidebar-bottom"><div class="membership"><span class="tag">✦ ${premium() ? "PREMIUM ACTIVO" : "TU PLAN PREMIUM"}</span><p>${premium() ? `Vigente hasta ${date(profile.premium_until)}` : "Desbloquea una mejor forma de cuidar tu vehículo."}</p></div><div class="row user"><div class="avatar">${esc((profile?.full_name || user.email || "U").slice(0, 2).toUpperCase())}</div><div class="user-details"><strong>${esc(profile?.full_name || "Mi cuenta")}</strong><span class="muted" style="font-size:10px">${API.demo ? "Cuenta de demostración" : "Conectado a Supabase"}</span></div><button class="close" data-action="logout" aria-label="Cerrar sesión">↪</button></div></div></aside><main class="main"><header class="topbar"><span class="breadcrumb">Mi espacio <span style="margin:0 10px">/</span> <strong style="color:var(--text)">${{ dashboard: "Vista general", garage: "Mis vehículos", records: "Bitácora", account: "Mi cuenta" }[view]}</strong></span><div class="row"><span class="tag"><span class="dot"></span> ${API.demo ? "DEMO LOCAL" : "CHILE · CLP"}</span><button class="btn small theme" data-action="theme" aria-label="Cambiar tema">◐</button><button class="btn small ghost" data-action="logout" aria-label="Cerrar sesión">Salir</button></div></header><div class="content">${body}<footer class="footer"><span>© 2026 Garaje Premium · Hecho para los caminos de Chile</span><button class="close" style="font-size:10px" data-action="privacy">Privacidad y condiciones</button></footer></div></main></div>`;
}
function renderPayment() {
  shell(
    `<section class="premium-page"><p class="eyebrow">UN BUEN CUIDADO COMIENZA AQUÍ</p><h1>Más que una bitácora.<br><span class="accent">Tranquilidad en cada kilómetro.</span></h1><p class="muted">Hola, ${esc(profile?.full_name?.split(" ")[0] || "bienvenido")}. Activa tu membresía para abrir tu garaje.</p><div class="pricing"><div class="card"><span class="eyebrow">TU COMPAÑERO EN EL CAMINO</span><h2 style="margin-top:20px">Cuida hoy.<br>Anticipa mañana.</h2><ul class="features"><li>Varios vehículos en un solo lugar</li><li>Historial de servicios y gastos en CLP</li><li>Plan de mantenciones personalizado</li><li>Consejos para las condiciones de Chile</li><li>Exportación de tu bitácora en CSV</li></ul><p class="disclaimer">Los planes son orientativos y no reemplazan el manual ni una inspección profesional.</p></div><div class="card premium-card"><div class="row between"><h3 style="margin:0">Garaje Premium</h3><span class="tag">PLAN MENSUAL</span></div><div class="price">$4.990 <small>CLP / mes</small></div><p class="muted">Un pequeño hábito. Una gran diferencia para tu vehículo.</p><div class="notice">${window.GARAJE_CONFIG.enablePaymentSimulation ? "Pago simulado: activa 30 días de acceso, sin cobros, tarjetas ni renovación automática." : "Los pagos aún no están habilitados. El administrador debe conectar una pasarela."}</div><button class="btn primary full" data-action="subscribe" ${window.GARAJE_CONFIG.enablePaymentSimulation ? "" : "disabled"}>Activar suscripción de prueba ${arrow}</button><p class="disclaimer">${API.demo ? "En esta demo el análisis utiliza reglas de referencia, no un modelo de IA." : "El análisis de IA requiere desplegar la función maintenance-plan."} El precio es ilustrativo.</p></div></div></section>`,
  );
}
function render() {
  if (!user) {
    renderAuth();
    return;
  }
  if (recovery) {
    renderRecovery();
    return;
  }
  if (!premium() && view !== "account") {
    renderPayment();
    return;
  }
  if (view === "account") {
    renderAccount();
    return;
  }
  if (view === "garage") {
    renderGarage();
    return;
  }
  if (view === "records") {
    renderRecords();
    return;
  }
  renderDashboard();
}
function vehicleArt(type) {
  return type === "Moto"
    ? `<svg viewBox="0 0 400 160" fill="none" aria-hidden="true"><circle cx="86" cy="114" r="31" stroke="currentColor" stroke-width="8"/><circle cx="310" cy="114" r="31" stroke="currentColor" stroke-width="8"/><path d="M86 114l66-58 53 58H86zm119 0 62-49 43 49M267 65l-16-38h-27M147 58l-9-15h49l26 14-8 57" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M213 57l43 7-16-35-31-6-26 20M115 53l37 6-2 16-63 1" fill="currentColor"/></svg>`
    : `<svg viewBox="0 0 400 160" fill="none" aria-hidden="true"><path d="M44 107l12-31 66-12 48-39h${type === "Camioneta" ? "80l35 44h56l24 17" : "93l53 39 38 15 10 28"}v24H44z" fill="currentColor" opacity=".75"/><path d="M144 63l35-28h67l31 28z" fill="#17292b"/><path d="M211 34v30" stroke="currentColor" stroke-width="5"/><circle cx="106" cy="116" r="26" fill="#142022" stroke="currentColor" stroke-width="6"/><circle cx="304" cy="116" r="26" fill="#142022" stroke="currentColor" stroke-width="6"/><circle cx="106" cy="116" r="11" fill="currentColor"/><circle cx="304" cy="116" r="11" fill="currentColor"/><path d="M44 93h25M337 86h18" stroke="#b9f582" stroke-width="5"/></svg>`;
}
function tabs() {
  return `<div class="vehicle-tabs" aria-label="Vehículo seleccionado">${vehicles.map((v) => `<button class="btn small ${v.id === selected ? "selected" : ""}" data-vehicle="${esc(v.id)}" aria-pressed="${v.id === selected}">${v.type === "Moto" ? arrow : "◇"} ${esc(v.brand)} ${esc(v.model)}</button>`).join("")}</div>`;
}
function vehicleCard(v) {
  return `<section class="card vehicle-card"><div class="row between vehicle-head"><div><span class="tag">${esc(v.type.toUpperCase())}</span><h2>${esc(v.brand)} ${esc(v.model)}</h2><span class="muted" style="font-size:12px">Modelo ${v.year} · Tu compañero de ruta</span></div><button class="btn small ghost" data-action="mileage" aria-label="Actualizar kilometraje">${arrow} Actualizar km</button></div><div class="vehicle-visual">${vehicleArt(v.type)}</div><div class="vehicle-meta"><div><small>KILOMETRAJE ACTUAL</small><strong>${formatKm(v.mileage)} <span class="muted">km</span></strong></div><div><small>ÚLTIMA MANTENCIÓN</small><strong>${records.length ? date(records[0].service_date) : "Sin registros"}</strong></div><div><small>SEGUIMIENTO</small><strong style="color:var(--gold)">${plan ? (plan.immediate.length ? "Revisiones sugeridas" : "Al día según registros") : "Por analizar"}</strong></div></div></section>`;
}
function planTasks(items, upcoming = false) {
  return items.length
    ? items
        .map(
          (t) =>
            `<div class="task"><span class="check">${upcoming ? arrow : "!"}</span><div class="task-body"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><small>${upcoming ? "Referencia:" : "Verificar desde:"} ${formatKm(t.targetKm)} km</small></div></div>`,
        )
        .join("")
    : '<p class="muted" style="font-size:12px">Sin tareas en esta categoría. Revisa también los intervalos por tiempo del manual.</p>';
}
function renderDashboard() {
  const v = vehicle();
  const total = records.reduce((sum, r) => sum + r.cost, 0);
  shell(
    `<div class="row between wrap welcome"><div><span class="eyebrow">TU VEHÍCULO, BAJO CONTROL</span><h1>Hola, ${esc(profile.full_name?.split(" ")[0] || "conductor")} <span class="light">${arrow}</span></h1><p>Un vistazo a tu garaje. Y a todo lo que viene.</p></div><button class="btn primary" data-action="add-vehicle">＋ Agregar vehículo</button></div><div class="stats"><div class="card stat"><span class="icon">◇</span><div><strong>${vehicles.length.toString().padStart(2, "0")}</strong><span>Vehículos en tu garaje</span></div></div><div class="card stat"><span class="icon">☷</span><div><strong>${records.length.toString().padStart(2, "0")}</strong><span>Servicios del vehículo</span></div></div><div class="card stat"><span class="icon">＄</span><div><strong style="font-size:22px">${money(total)}</strong><span>Inversión registrada</span></div></div></div>${v ? `${tabs()}<div class="dashboard-grid"><div>${vehicleCard(v)}<div class="plan-banner"><div class="row between"><h3>✦ ${API.demo ? "Plan orientativo de demostración" : "Tu copiloto con IA"}</h3><span class="tag">PREMIUM</span></div><p>${API.demo ? "Explora recomendaciones de referencia con tu kilometraje e historial." : "Analiza tu vehículo y sus registros para anticipar el siguiente servicio."}</p><button class="btn primary small" data-action="generate" ${generating ? "disabled" : ""}>${generating ? "Analizando…" : "Generar plan de mantenciones"} ${arrow}</button></div>${plan ? `<section class="card"><div class="row between section-heading"><h2>Para revisar ahora</h2><span class="tag gold">${plan.immediate.length} SUGERENCIAS</span></div>${planTasks(plan.immediate)}<p class="disclaimer">${esc(plan.summary)}</p></section>` : '<section class="card empty"><span class="icon">✦</span><h3>Anticípate al próximo kilómetro.</h3><p>Genera un plan para ver qué revisar ahora y qué se aproxima. Aún no hemos evaluado el vehículo.</p></section>'}</div><aside class="right-column stack"><section class="card"><div class="row between section-heading"><h2>En el horizonte</h2><span class="muted">${arrow}</span></div>${plan ? planTasks(plan.upcoming, true) : '<p class="muted">Tu próximo servicio empieza con un plan. Genera el análisis para ver las sugerencias.</p>'}<p class="disclaimer">Intervalos orientativos. El kilometraje por sí solo no determina el estado mecánico.</p></section><section class="card"><span class="eyebrow">CUIDADO INTELIGENTE</span><h2 style="margin-top:10px">Pequeños hábitos.<br>Grandes recorridos.</h2>${(plan?.tips || ["Mantén la presión recomendada en frío y revisa los niveles antes de viajes largos.", "Guarda cada servicio: un buen historial permite tomar mejores decisiones."]).map((t) => `<div class="tip"><span class="tag">CHILE · PREVENTIVO</span><p>${esc(t)}</p></div>`).join("")}</section><button class="btn full" data-action="add-record">＋ Registrar mantención</button></aside></div>` : `<section class="card empty"><div class="icon">◇</div><h2>Tu garaje está esperando.</h2><p>Agrega tu automóvil, camioneta o moto para empezar a construir su historia.</p><button class="btn primary" data-action="add-vehicle">Agregar mi primer vehículo ${arrow}</button></section>`}`,
  );
}
function renderGarage() {
  shell(
    `<div class="row between wrap welcome"><div><span class="eyebrow">CADA VEHÍCULO TIENE UNA HISTORIA</span><h1>Mis vehículos</h1><p>Elige cuál quieres cuidar hoy.</p></div><button class="btn primary" data-action="add-vehicle">＋ Agregar vehículo</button></div><div class="grid2">${vehicles.length ? vehicles.map((v) => `<article class="card"><div class="row between"><span class="tag">${esc(v.type)}</span><button class="btn small danger" data-delete-vehicle="${esc(v.id)}">Eliminar</button></div><div class="vehicle-visual">${vehicleArt(v.type)}</div><h2>${esc(v.brand)} ${esc(v.model)}</h2><p class="muted">${v.year} · ${formatKm(v.mileage)} km</p><button class="btn primary full" data-open-vehicle="${esc(v.id)}">Ver mi vehículo ${arrow}</button></article>`).join("") : '<section class="card empty"><h2>Aún no tienes vehículos.</h2><p>Agrega uno para comenzar.</p></section>'}</div>`,
  );
}
function renderRecords() {
  const v = vehicle();
  shell(
    `<div class="row between wrap welcome"><div><span class="eyebrow">SU HISTORIA, SIEMPRE A MANO</span><h1>Bitácora de mantenciones</h1><p>Servicios, kilómetros e inversión. Todo ordenado.</p></div>${v ? '<div class="row wrap"><button class="btn" data-action="export">↓ Exportar CSV</button><button class="btn primary" data-action="add-record">＋ Registrar servicio</button></div>' : ""}</div>${tabs()}${v ? `<p class="muted">${esc(v.brand)} ${esc(v.model)} · ${records.length} registros · ${money(records.reduce((s, r) => s + r.cost, 0))} en servicios</p><div class="timeline">${records.length ? records.map((r) => `<article class="card record"><span class="icon">✓</span><div><h3>${esc(r.category)}</h3><p>${date(r.service_date)} · ${formatKm(r.mileage)} km · ${money(r.cost)}</p>${r.workshop ? `<p>Taller: ${esc(r.workshop)}</p>` : ""}${r.notes ? `<p style="margin-top:10px;white-space:pre-wrap">${esc(r.notes)}</p>` : ""}</div><div class="actions"><button class="btn small danger" data-delete-record="${esc(r.id)}">Eliminar</button></div></article>`).join("") : '<div class="card empty"><h2>El primer registro hace la diferencia.</h2><p>Registra un servicio anterior o una nueva mantención para comenzar.</p><button class="btn primary" data-action="add-record">Registrar mantención</button></div>'}</div>` : '<div class="card empty"><h2>Primero agrega un vehículo.</h2><button class="btn primary" data-action="add-vehicle">Agregar vehículo</button></div>'}`,
  );
}
function renderAccount() {
  shell(
    `<div class="welcome"><span class="eyebrow">TU ESPACIO PERSONAL</span><h1>Mi cuenta</h1><p>Tus datos y tu membresía.</p></div><div class="grid2"><section class="card"><h2>${esc(profile.full_name || "Mi cuenta")}</h2><p class="muted">${esc(user.email)}</p><span class="tag">${API.demo ? "DEMO · DATOS LOCALES" : "SUPABASE · SESIÓN AUTENTICADA"}</span><p class="disclaimer">${API.demo ? "La demo no ofrece seguridad de servidor y sus datos pueden modificarse desde el navegador. Usa únicamente información ficticia." : "Cada usuario accede a sus propios vehículos y registros mediante políticas RLS."}</p><button class="btn" data-action="logout" style="margin-top:20px">Cerrar sesión</button></section><section class="card"><h2>Tu membresía</h2><span class="tag">${premium() ? "PREMIUM ACTIVO" : "INACTIVA"}</span><p class="muted" style="margin-top:15px">${premium() ? `Vence el ${date(profile.premium_until)}. La prueba no se renueva automáticamente.` : "Activa la suscripción simulada para empezar."}</p>${!premium() ? '<button class="btn primary" data-action="subscribe">Activar prueba por 30 días</button>' : ""}<p class="disclaimer">No se procesa dinero. Para producción se necesita una pasarela y confirmación mediante webhook de servidor.</p></section></div>`,
  );
}
function openModal(title, body) {
  if (modal.open) modal.close();
  modal.innerHTML = `<div class="row between modal-head"><h2 id="modal-title">${title}</h2><button class="close" data-action="close" aria-label="Cerrar ventana">×</button></div>${body}`;
  modal.showModal();
}
function requirePremium() {
  if (!premium()) {
    view = "dashboard";
    renderPayment();
    throw new Error("Tu membresía está inactiva. Actívala para continuar.");
  }
}
function vehicleForm() {
  requirePremium();
  openModal(
    "Un nuevo compañero de ruta",
    `<p class="muted">Completa los datos de tu vehículo para abrir su bitácora.</p><form id="vehicle-form"><div class="grid2"><div class="field"><label for="type">Tipo de vehículo</label><select id="type" name="type" required><option value="">Selecciona un tipo</option>${Object.keys(
      CATALOG,
    )
      .map((t) => `<option>${t}</option>`)
      .join(
        "",
      )}</select></div><div class="field"><label for="brand">Marca</label><select id="brand" name="brand" required disabled><option value="">Primero elige un tipo</option></select></div></div><div class="field"><label for="model">Modelo</label><select id="model" name="model" required disabled><option value="">Primero elige una marca</option></select></div><div class="grid2"><div class="field"><label for="year">Año</label><select id="year" name="year" required disabled><option value="">Primero elige un modelo</option></select></div><div class="field"><label for="mileage">Kilometraje actual</label><input class="input" id="mileage" name="mileage" inputmode="numeric" autocomplete="off" required maxlength="7" placeholder="Ej. 15.000"><p class="help">Entre 0 y 999.999 km.</p></div></div><p class="help">Catálogo acotado. Los rangos iniciales son referencias de disponibilidad y requieren validación documental local; si tu modelo/año no aparece, no selecciones uno incorrecto.</p><p class="error" id="form-error" role="alert"></p><div class="modal-footer"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Agregar a mi garaje ${arrow}</button></div></form>`,
  );
  const set = (id, entries, hint) => {
    const s = $(id);
    s.innerHTML =
      `<option value="">${hint}</option>` +
      entries
        .map((x) => `<option value="${esc(x)}">${esc(x)}</option>`)
        .join("");
    s.disabled = !entries.length;
  };
  $("#type").onchange = () => {
    set(
      "#brand",
      Object.keys(CATALOG[$("#type").value] || {}),
      "Selecciona una marca",
    );
    set("#model", [], "Primero elige una marca");
    set("#year", [], "Primero elige un modelo");
  };
  $("#brand").onchange = () => {
    set(
      "#model",
      (CATALOG[$("#type").value]?.[$("#brand").value] || []).map((m) => m.name),
      "Selecciona un modelo",
    );
    set("#year", [], "Primero elige un modelo");
  };
  $("#model").onchange = () => {
    const m = CATALOG[$("#type").value]?.[$("#brand").value]?.find(
      (m) => m.name === $("#model").value,
    );
    set(
      "#year",
      m
        ? Array.from({ length: CURRENT_YEAR - m.firstYear + 1 }, (_, i) =>
            String(CURRENT_YEAR - i),
          )
        : [],
      "Selecciona un año",
    );
  };
  mask($("#mileage"));
  bindForm("#vehicle-form", async (f) => {
    const d = new FormData(f);
    const v = await API.addVehicle({
      type: d.get("type"),
      brand: d.get("brand"),
      model: d.get("model"),
      year: Number(d.get("year")),
      mileage: parseMileage(d.get("mileage")),
    });
    selected = v.id;
    view = "dashboard";
    plan = null;
    modal.close();
    await load();
    toast("Tu vehículo ya tiene un lugar en el garaje.");
  });
}
function mask(input) {
  input.addEventListener("beforeinput", (e) => {
    if (e.inputType === "insertText" && e.data && !/^\d+$/.test(e.data))
      e.preventDefault();
  });
  input.addEventListener("paste", (e) => {
    const t = e.clipboardData.getData("text");
    if (!/^\d{1,6}$|^\d{1,3}(\.\d{3})+$/.test(t.trim())) {
      e.preventDefault();
      toast("Pega un kilometraje entero, sin negativos ni decimales.");
    }
  });
  input.addEventListener("input", () => {
    const digits = input.value.replaceAll(".", "");
    if (!/^\d*$/.test(digits)) {
      input.setCustomValidity("Usa solo números enteros.");
      return;
    }
    input.setCustomValidity(digits.length > 6 ? "Máximo 999.999 km." : "");
    if (digits.length <= 6)
      input.value = digits ? formatKm(Number(digits)) : "";
  });
}
function bindForm(selector, fn) {
  $(selector).onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("[type=submit]");
    b.disabled = true;
    $("#form-error").textContent = "";
    try {
      await fn(e.target);
    } catch (e) {
      if ($("#form-error")) $("#form-error").textContent = e.message;
      else fail(e);
    } finally {
      b.disabled = false;
    }
  };
}
function mileageForm() {
  const v = vehicle();
  requirePremium();
  openModal(
    "Actualizar kilometraje",
    `<p class="muted">${esc(v.brand)} ${esc(v.model)} · Actual: ${formatKm(v.mileage)} km</p><form id="mileage-form"><label for="mileage">Nuevo kilometraje</label><input class="input" id="mileage" name="mileage" inputmode="numeric" required maxlength="7" value="${formatKm(v.mileage)}"><p class="help">El odómetro no puede disminuir.</p><p class="error" id="form-error" role="alert"></p><div class="modal-footer"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Guardar</button></div></form>`,
  );
  mask($("#mileage"));
  bindForm("#mileage-form", async (f) => {
    await API.updateMileage(v.id, parseMileage(new FormData(f).get("mileage")));
    plan = null;
    modal.close();
    await load();
    toast("Kilometraje actualizado. Genera un nuevo plan.");
  });
}
const categories = [
  "Aceite y filtro",
  "Transmisión y cadena",
  "Frenos y neumáticos",
  "Filtro de aire y bujía",
  "Filtro de aire y habitáculo",
  "Refrigeración y correas",
  "Batería y sistema eléctrico",
  "Revisión general",
  "Otro servicio",
];
function recordForm() {
  requirePremium();
  const v = vehicle();
  if (!v) return vehicleForm();
  openModal(
    "Cada servicio cuenta",
    `<p class="muted">${esc(v.brand)} ${esc(v.model)} · Guarda los detalles de la mantención.</p><form id="record-form"><div class="field"><label for="category">Servicio realizado</label><select id="category" name="category" required>${categories.map((c) => `<option>${c}</option>`).join("")}</select></div><div class="grid2"><div class="field"><label for="service-date">Fecha del servicio</label><input class="input" type="date" id="service-date" name="service_date" required min="${v.year}-01-01" max="${today()}" value="${today()}"></div><div class="field"><label for="mileage">Kilometraje del servicio</label><input class="input" id="mileage" name="mileage" inputmode="numeric" maxlength="7" required value="${formatKm(v.mileage)}"></div></div><div class="grid2"><div class="field"><label for="cost">Costo total (CLP)</label><input class="input" id="cost" name="cost" type="number" min="0" max="99999999" step="1" required placeholder="Ej. 45000"></div><div class="field"><label for="workshop">Taller (opcional)</label><input class="input" id="workshop" name="workshop" maxlength="100" placeholder="Nombre del taller"></div></div><div class="field"><label for="notes">Detalles (opcional)</label><textarea id="notes" name="notes" maxlength="1500" rows="3" placeholder="Repuestos, observaciones o recomendaciones del taller"></textarea></div><p class="help">Si el servicio tiene más kilómetros que el odómetro registrado, se actualizará el vehículo. Los servicios históricos no lo disminuyen.</p><p class="error" id="form-error" role="alert"></p><div class="modal-footer"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Guardar mantención</button></div></form>`,
  );
  mask($("#mileage"));
  bindForm("#record-form", async (f) => {
    const d = new FormData(f),
      cost = Number(d.get("cost")),
      day = d.get("service_date");
    if (!Number.isInteger(cost) || cost < 0 || cost > 99999999)
      throw new Error("Costo inválido.");
    if (day < `${v.year}-01-01` || day > today())
      throw new Error("Selecciona una fecha entre el año del vehículo y hoy.");
    await API.addRecord(v.id, {
      category: d.get("category"),
      service_date: day,
      mileage: parseMileage(d.get("mileage")),
      cost,
      workshop: d.get("workshop").trim(),
      notes: d.get("notes").trim(),
    });
    plan = null;
    modal.close();
    await load();
    toast("Mantención registrada. Tu historial está al día.");
  });
}
function confirmDialog(title, text, action) {
  openModal(
    title,
    `<p class="muted">${esc(text)}</p><div class="modal-footer"><button class="btn" data-action="close">Cancelar</button><button class="btn danger" id="confirm-delete">Sí, eliminar</button></div>`,
  );
  $("#confirm-delete").onclick = async (e) => {
    e.target.disabled = true;
    try {
      await action();
      modal.close();
      plan = null;
      await load();
      toast("El registro se eliminó.");
    } catch (e) {
      fail(e);
      $("#confirm-delete").disabled = false;
    }
  };
}
function renderRecovery() {
  shell(
    '<section class="card" style="max-width:500px"><h2>Elige una nueva contraseña</h2><form id="recovery-form"><label for="new-password">Nueva contraseña</label><input id="new-password" name="password" class="input" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><p class="error" id="form-error" role="alert"></p><button type="submit" class="btn primary">Guardar contraseña</button></form></section>',
  );
  bindForm("#recovery-form", async (f) => {
    await API.changePassword(new FormData(f).get("password"));
    recovery = false;
    await load();
    toast("Contraseña actualizada.");
  });
}
function exportCSV() {
  const rows = [
    ["Servicio", "Fecha", "Kilometraje", "Costo CLP", "Taller", "Notas"],
    ...records.map((r) => [
      r.category,
      r.service_date,
      r.mileage,
      r.cost,
      r.workshop,
      r.notes,
    ]),
  ];
  const safe = (x) => {
    let s = String(x ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((r) => r.map(safe).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "bitacora-garaje.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function load() {
  const ticket = ++loadVersion;
  const [p, vs] = await Promise.all([API.profile(), API.vehicles()]);
  if (ticket !== loadVersion) return;
  profile = p;
  vehicles = vs;
  if (!vehicles.some((v) => v.id === selected))
    selected = vehicles[0]?.id || null;
  const rs = selected ? await API.records(selected) : [];
  if (ticket !== loadVersion) return;
  records = rs;
  render();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  try {
    if (b.dataset.auth) {
      authMode = b.dataset.auth;
      renderAuth();
      return;
    }
    if (b.dataset.oauth) {
      b.disabled = true;
      try {
        await API.oauth(b.dataset.oauth);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.dataset.view) {
      view = b.dataset.view;
      render();
      return;
    }
    if (b.dataset.vehicle || b.dataset.openVehicle) {
      selected = b.dataset.vehicle || b.dataset.openVehicle;
      if (b.dataset.openVehicle) view = "dashboard";
      plan = null;
      await load();
      return;
    }
    if (b.dataset.deleteVehicle) {
      const id = b.dataset.deleteVehicle;
      confirmDialog(
        "Eliminar vehículo",
        "Se eliminarán el vehículo y todas sus mantenciones. Esta acción no se puede deshacer.",
        () => API.removeVehicle(id),
      );
      return;
    }
    if (b.dataset.deleteRecord) {
      confirmDialog(
        "Eliminar mantención",
        "Se eliminará este servicio. El kilometraje actual del vehículo se conservará.",
        () => API.removeRecord(b.dataset.deleteRecord),
      );
      return;
    }
    switch (b.dataset.action) {
      case "theme":
        theme();
        break;
      case "close":
        modal.close();
        break;
      case "logout":
        await API.signOut();
        user = null;
        profile = null;
        vehicles = [];
        records = [];
        selected = null;
        plan = null;
        recovery = false;
        ++loadVersion;
        view = "dashboard";
        if (modal.open) modal.close();
        render();
        break;
      case "subscribe":
        b.disabled = true;
        try {
          await API.subscribe();
          view = "dashboard";
          await load();
          toast(
            "Prueba activada por 30 días. No se ha realizado ningún cobro.",
          );
        } finally {
          b.disabled = false;
        }
        break;
      case "add-vehicle":
        vehicleForm();
        break;
      case "mileage":
        mileageForm();
        break;
      case "add-record":
        recordForm();
        break;
      case "generate": {
        requirePremium();
        const v = vehicle();
        if (!v) return;
        const id = v.id,
          version = loadVersion;
        generating = true;
        render();
        try {
          const next = await API.plan(v, records);
          if (user && selected === id && version === loadVersion) {
            plan = next;
            toast(
              API.demo
                ? "Plan de referencia generado."
                : "Análisis de IA generado.",
            );
          }
        } finally {
          generating = false;
          render();
        }
        break;
      }
      case "export":
        exportCSV();
        break;
      case "forgot": {
        const email = $("#email")?.value;
        if (!email || !$("#email").checkValidity())
          throw new Error("Escribe primero un correo válido en el formulario.");
        await API.reset(email);
        toast("Si la cuenta existe, recibirás un enlace de recuperación.");
        break;
      }
      case "privacy":
        openModal(
          "Privacidad y condiciones",
          `<p>Garaje Premium es una aplicación de seguimiento de mantenciones. Los planes orientativos no sustituyen el manual del fabricante ni una evaluación mecánica.</p><p>En modo demo, los datos permanecen en este navegador. No se realizan cobros ni se envían correos. Evita datos personales reales.</p><p>Al conectar Supabase, los datos de cuenta, vehículos y servicios se almacenan en tu proyecto. Al generar un análisis de IA, se envían al proveedor el tipo, marca, modelo, año, kilometraje y categorías de servicios; no el correo, nombre, taller ni notas libres.</p><p>La suscripción disponible es una simulación de 30 días, sin renovación. La política comercial, identidad del responsable y política de privacidad definitiva deben configurarse antes de ofrecer el servicio al público.</p><button class="btn full" data-action="close">Entendido</button>`,
        );
        break;
    }
  } catch (e) {
    fail(e);
  }
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
window.addEventListener("storage", async (e) => {
  if (API.demo && e.key === "garaje-premium-demo-v1") {
    try {
      user = await API.session();
      plan = null;
      if (user) await load();
      else render();
    } catch (e) {
      fail(e);
    }
  }
});
async function start() {
  try {
    user = await API.init();
    API.onAuth(async (event) => {
      try {
        user = await API.session();
        if (event === "PASSWORD_RECOVERY") recovery = true;
        if (!user) {
          ++loadVersion;
          profile = null;
          vehicles = [];
          records = [];
          selected = null;
          plan = null;
          view = "dashboard";
          render();
        } else await load();
      } catch (e) {
        fail(e);
      }
    });
    if (user) await load();
    else render();
  } catch (e) {
    app.innerHTML = `<main class="loading"><section class="card" style="max-width:520px;margin:20px"><h2>Falta un paso de configuración</h2><p>${esc(e.message)}</p><p class="muted">Revisa config.js y las instrucciones del README. La aplicación no permite entrar sin una sesión válida.</p><button class="btn primary" data-action="reload">Volver a intentar</button></section></main>`;
    app.querySelector("button").onclick = () => location.reload();
  }
}
start();
