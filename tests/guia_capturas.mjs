// Capturas de pantalla para la guía de capturadores, con la sesión de un capturador.
// Supabase se simula con fixtures; los controles de lecturas y de PM se resuelven con
// las funciones reales de la base local.
// Uso: xvfb-run -a node tests/guia_capturas.mjs <carpeta_fixtures> <carpeta_salida>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const { _electron } = require("/opt/node-tools/node_modules/playwright/index.js");
const sh = promisify(execFile);

const RAIZ = new URL("..", import.meta.url).pathname;
const [FIX, SALIDA] = process.argv.slice(2);
const BD = process.env.BD_LOCAL ?? "host=/home/user/.pgrun port=5433 user=dev dbname=hemco";
const HOY = "2026-10-22";
const TABLAS = ["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
  "v_lecturas", "registros_pm", "parametros", "columnas_control", "v_registros_pm", "v_cumplimiento_pm", "v_utilizacion_mensual", "unidades", "v_ultima_lectura"];
const datos = Object.fromEntries(TABLAS.map((n) => [n, JSON.parse(readFileSync(join(FIX, `${n}.json`), "utf8"))]));
const ID = "00000000-0000-0000-0000-000000000002";
datos.perfiles = [
  { user_id: ID, nombre: "Planeador Martha 850", correo: "planeador.martha@grupodimelco.com", rol: "capturador", activo: true },
  { user_id: "00000000-0000-0000-0000-000000000001", nombre: "Samuel Zapata", correo: "samuel@grupodimelco.com", rol: "admin", activo: true },
];
// Lo capturado en la app aparece a nombre del capturador.
for (const l of datos.v_lecturas) if (l.origen === "app" && !l.creado_por) l.creado_por = ID;
// Una lectura anulada para mostrar "Ver anulados".
const base = datos.v_lecturas.find((l) => l.fecha === "2026-10-20");
datos.lecturas = [{ ...base, id: "anulada-1", anulada: true, creado_por: ID, origen: "app",
  motivo_anulacion: "Se cargó el acumulado en vez del contador", anulado_por: "00000000-0000-0000-0000-000000000001",
  anulado_en: "2026-10-21T14:10:00Z" }];

const sql = async (q) => (await sh("psql", [BD, "-tAc", q])).stdout.trim();
const usuario = { id: ID, email: "planeador.martha@grupodimelco.com", aud: "authenticated", role: "authenticated",
  app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };

const app = await _electron.launch({ executablePath: join(RAIZ, "node_modules/electron/dist/electron"),
  args: [join(RAIZ, "dist-electron/main.js"), "--no-sandbox", "--lang=es-419"], cwd: RAIZ });
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1440, 900));
const ctx = app.context();
await ctx.clock.install({ time: new Date(`${HOY}T19:30:00`) });
await ctx.clock.resume();

await ctx.route("**/rest/v1/**", async (route) => {
  const req = route.request(); const url = new URL(req.url()); const tabla = url.pathname.split("/rest/v1/")[1];
  if (req.method() !== "GET") {
    const a = req.postData() ? JSON.parse(req.postData()) : {};
    if (tabla === "rpc/validar_lectura") {
      const r = await sql(`select validar_lectura('${a.p_componente}', '${a.p_fecha}', '${a.p_turno}', ${Number(a.p_lectura)})`);
      return route.fulfill({ status: 200, contentType: "application/json", body: r || "null" });
    }
    if (tabla === "rpc/validar_registro_pm") {
      const r = await sql(`select to_json(validar_registro_pm('${a.p_componente}', '${a.p_fecha}', ${Number(a.p_lectura)}))`);
      return route.fulfill({ status: 200, contentType: "application/json", body: r || "null" });
    }
    if (tabla.startsWith("rpc/")) return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([{ id: "nuevo" }]) });
  }
  let filas = datos[tabla] ?? [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    if (v.startsWith("eq.")) filas = filas.filter((f) => String(f[k]) === v.slice(3));
    else if (v.startsWith("gte.")) filas = filas.filter((f) => String(f[k]) >= v.slice(4));
    else if (v.startsWith("lte.")) filas = filas.filter((f) => String(f[k]) <= v.slice(4));
    else if (v.startsWith("in.")) {
      const lista = v.slice(4, -1).split(",").map((x) => x.replaceAll('"', ""));
      filas = filas.filter((f) => lista.includes(String(f[k])));
    }
  }
  const objeto = (req.headers()["accept"] ?? "").includes("pgrst.object");
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(objeto ? (filas[0] ?? null) : filas) });
});
await ctx.route("**/auth/v1/**", (rt) => {
  const u = new URL(rt.request().url());
  if (u.pathname.endsWith("/token"))
    return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "demo", refresh_token: "demo",
      token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: usuario }) });
  return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(usuario) });
});
// Tiempo real: se responde el ingreso al canal para que el pie muestre "En línea".
await ctx.routeWebSocket(/realtime/, (ws) => {
  ws.onMessage((m) => {
    const msg = JSON.parse(String(m));
    if (Array.isArray(msg)) {
      const [joinRef, ref, topic, evento] = msg;
      if (evento === "phx_join" || evento === "heartbeat")
        ws.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: {} }]));
    } else if (msg.event === "phx_join" || msg.event === "heartbeat") {
      ws.send(JSON.stringify({ topic: msg.topic, event: "phx_reply", ref: msg.ref, payload: { status: "ok", response: {} } }));
    }
  });
});

const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");
// Cierra los avisos emergentes que quedan de un paso anterior.
const cerrarAvisos = async () => {
  for (const b of await win.locator(".aviso button").all()) await b.click().catch(() => {});
};
const foto = async (n, loc, conAvisos = false) => {
  if (!conAvisos) await cerrarAvisos();
  await win.waitForTimeout(250);
  if (loc) await loc.screenshot({ path: join(SALIDA, `${n}.png`) });
  else await win.screenshot({ path: join(SALIDA, `${n}.png`) });
  console.log("captura", n);
};
const ir = async (h) => { await win.evaluate((x) => { location.hash = x; }, h); await win.waitForTimeout(1400); };

// 1. Entrada
await win.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
});
await win.reload(); await win.waitForTimeout(1200);
await win.locator('input[type="email"], input[autocomplete="username"], input').first().fill("planeador.martha@grupodimelco.com");
await win.locator('input[type="password"]').fill("contraseña");
await foto("01_entrada");
await win.getByRole("button", { name: /Entrar/ }).click(); await win.waitForTimeout(2500);

// 2. Consulta
await ir("#/control"); await foto("02_control_pm");
await win.locator(".chip.vencido").click(); await win.waitForTimeout(300);
await foto("03_control_filtro");
await win.locator(".chip.vencido").click();
await ir("#/rutina40"); await foto("04_rutina40");
await ir("#/graficas"); await foto("05_graficas");
await ir("#/programa"); await foto("06_programa_lista");
await win.getByRole("button", { name: "Calendario" }).click(); await foto("07_programa_calendario");
await ir("#/indicadores"); await foto("08_indicadores");
await ir("#/control");
await win.locator("tbody a.enlace-equipo", { hasText: "Boomer #1" }).first().click(); await win.waitForTimeout(1400);
await foto("09_ficha_equipo");

// 3. Lecturas
await ir("#/lecturas"); await foto("10_lecturas");
const fila = (eq, tipo) => win.locator("tbody tr", { hasText: eq }).filter({ hasText: tipo }).first();
const ultima = async (f) => Number(((await f.locator("td").nth(2).textContent()) ?? "0").replace(/,/g, ""));
const filas = [fila("Boltec #1", "Diesel"), fila("Boltec #1", "Motor Eléctrico"), fila("Boltec #1", "Percusión #1"), fila("Boltec #2", "Diesel")];
const valores = [await ultima(filas[0]) + 9.4, await ultima(filas[1]) + 6.2, await ultima(filas[2]) - 1, await ultima(filas[3]) - 60];
for (let i = 0; i < filas.length; i++) await filas[i].locator("input").fill(String(Math.round(valores[i] * 10) / 10));
await win.waitForTimeout(1500);
const caja = await win.locator(".tabla-marco").boundingBox();
await cerrarAvisos();
await win.screenshot({ path: join(SALIDA, "11_lecturas_control.png"), clip: { x: caja.x, y: caja.y, width: caja.width, height: 300 } });
console.log("captura", "11_lecturas_control");
await win.getByRole("button", { name: "Grabar lecturas" }).click(); await win.waitForTimeout(800);
await foto("12_lecturas_rechazo", null, true);
await filas[3].locator("input").fill(""); await win.waitForTimeout(1200);
await win.locator(".menu nav a", { hasText: "Control PM" }).click(); await win.waitForTimeout(500);
await foto("13_lecturas_salir");
await win.getByRole("button", { name: "Seguir capturando" }).click();
for (const f of filas) await f.locator("input").fill("");
await win.waitForTimeout(800);

// 4. Registro PM
await ir("#/registro-pm");
const sel = (etiqueta) => win.locator(`label:has-text("${etiqueta}") select`).first();
await sel("Equipo").selectOption({ label: "Boomer #1" }); await win.waitForTimeout(300);
await win.locator('label:has-text("Responsable") input').fill("Mecánico Juan Pérez");
await sel("Componente intervenido").selectOption({ index: 1 }); await win.waitForTimeout(300);
await sel("Gama (h)").selectOption({ index: 1 });
const ayuda = (await win.locator(".pm-ayuda b").first().textContent()) ?? "0";
const contador = Number(ayuda.replace(/[^\d.]/g, ""));
await win.locator('label:has-text("Lectura del contador") input').fill(String(contador + 4));
await win.waitForTimeout(1200);
await foto("14_registro_pm");
await win.locator('label:has-text("Lectura del contador") input').fill(String(Math.max(contador - 300, 1)));
await win.waitForTimeout(1500);
await foto("15_registro_pm_rechazo", win.locator(".panel-formulario"));

// 5. Cambios de horómetro
await ir("#/cambios");
await win.locator('label:has-text("Componente") select').selectOption({ label: "Boltec #1 · Diesel" });
await win.locator('label:has-text("Vigente desde") input').fill(HOY);
await win.locator('label:has-text("Última lectura contador viejo") input').fill("3487");
await win.locator('label:has-text("Lectura inicial contador nuevo") input').fill("0");
await win.locator('label:has-text("Fuente") input').fill("Cambio de tablero, OT 4512");
await win.waitForTimeout(400);
await foto("16_cambios");

// 6. Historial
await ir("#/historial"); await foto("17_historial");
await win.locator('input[type="date"]').first().fill("2026-10-01");
await win.getByLabel("Ver anulados").check(); await win.waitForTimeout(1000);
await foto("18_historial_anulados");
await win.getByLabel("Ver anulados").uncheck();

// 7. Contraseña y actualización
await ir("#/control");
await win.getByRole("button", { name: "Cambiar contraseña" }).click(); await win.waitForTimeout(300);
await win.locator("dialog[open] input").nth(0).fill("ClaveNueva2026");
await win.locator("dialog[open] input").nth(1).fill("ClaveNueva2026");
await foto("19_cambiar_contrasena");
await win.getByRole("button", { name: "Cancelar" }).click();
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("actualizacion-lista", "0.4.1"));
await win.waitForTimeout(400);
await foto("20_actualizacion", win.locator(".aviso-actualizacion"));
await foto("21_menu", win.locator(".menu"));
await app.close();
