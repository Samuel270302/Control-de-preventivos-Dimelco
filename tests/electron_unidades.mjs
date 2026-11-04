// Unidades mineras: selector del admin y capturador restringido a su unidad.
// Uso: xvfb-run -a node tests/electron_unidades.mjs <carpeta_salida>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const { _electron } = require("/opt/node-tools/node_modules/playwright/index.js");
const sh = promisify(execFile);
const BD = process.env.BD_LOCAL ?? "host=/home/user/.pgrun port=5433 user=dev dbname=hemco";

const RAIZ = new URL("..", import.meta.url).pathname;
const SALIDA = process.argv[2] ?? join(RAIZ, "capturas");
const fixture = (n) => JSON.parse(readFileSync(join(RAIZ, "tests/fixtures", `${n}.json`), "utf8"));
const TABLAS = ["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
  "v_lecturas", "registros_pm", "parametros", "perfiles", "columnas_control", "v_registros_pm",
  "v_cumplimiento_pm", "v_utilizacion_mensual", "unidades", "v_ultima_lectura"];
const resultados = [];

function filtrarUnidad(datos, unidad) {
  datos.equipos = datos.equipos.filter((e) => e.unidad_id === unidad);
  const eqs = new Set(datos.equipos.map((e) => e.id));
  datos.componentes = datos.componentes.filter((c) => eqs.has(c.equipo_id));
  const comps = new Set(datos.componentes.map((c) => c.id));
  for (const t of ["v_control_pm", "v_control_40", "v_cumplimiento_pm", "v_utilizacion_mensual"])
    datos[t] = datos[t].filter((f) => f.unidad_id === unidad);
  for (const t of ["v_lecturas", "registros_pm", "v_registros_pm", "cambios_horometro", "v_ultima_lectura"])
    datos[t] = datos[t].filter((f) => comps.has(f.componente_id));
}

async function probar(caso) {
  const datos = Object.fromEntries(TABLAS.map((n) => [n, fixture(n)]));
  const unidad = (n) => datos.unidades.find((u) => u.nombre === n).id;
  const r = (nombre, cond, detalle = "") => resultados.push({ caso, nombre, ok: !!cond, detalle });
  const esAdmin = caso === "admin";
  const propia = esAdmin ? null : unidad("Explotec");
  datos.perfiles = datos.perfiles.map((p) => ({ ...p, nombre: esAdmin ? p.nombre : "Planeador Explotec",
    rol: esAdmin ? "admin" : "capturador", activo: true, unidad_id: propia }));
  if (!esAdmin) filtrarUnidad(datos, propia);

  const app = await _electron.launch({ executablePath: join(RAIZ, "node_modules/electron/dist/electron"),
    args: [join(RAIZ, "dist-electron/main.js"), "--no-sandbox", "--lang=es-419"], cwd: RAIZ });
  const ctx = app.context();
  const escrituras = [];
  await ctx.route("**/rest/v1/**", async (route) => {
    const req = route.request(); const url = new URL(req.url()); const tabla = url.pathname.split("/rest/v1/")[1];
    if (req.method() !== "GET") {
      if (tabla === "rpc/validar_lectura") {
        const a = JSON.parse(req.postData());
        const { stdout } = await sh("psql", [BD, "-tAc",
          `select validar_lectura('${a.p_componente}', '${a.p_fecha}', '${a.p_turno}', ${Number(a.p_lectura)})`]);
        return route.fulfill({ status: 200, contentType: "application/json", body: stdout.trim() || "null" });
      }
      escrituras.push(`${req.method()} ${tabla} ${req.postData() ?? ""}`);
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
  await ctx.route("**/auth/v1/**", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await ctx.route("**/realtime/**", (rt) => rt.abort());
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  await win.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
    localStorage.setItem("sb-demo-auth-token", JSON.stringify({ access_token: "demo", refresh_token: "demo", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
      user: { id: "00000000-0000-0000-0000-000000000001", email: "demo@grupodimelco.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  });
  await win.reload(); await win.waitForTimeout(2500);
  const ir = async (h) => { await win.evaluate((x) => { location.hash = x; }, h); await win.waitForTimeout(1300); };
  const equiposControl = async () => {
    const cods = new Set();
    for (const s of [1, 2, 3]) {
      await win.locator(".pestania").nth(s - 1).click(); await win.waitForTimeout(250);
      for (const t of await win.locator("tbody td.col-fija").allTextContents()) cods.add(t.trim());
    }
    await win.locator(".pestania").first().click();
    return [...cods];
  };

  if (esAdmin) {
    const opciones = await win.locator(".selector-unidad option").allTextContents();
    r("Selector con Todas y las 4 unidades", opciones.length === 5 && opciones[0] === "Todas las unidades", opciones.join(", "));
    await ir("#/control");
    const todas = await equiposControl();
    r("Todas: Control PM con equipos de HEMCO, Explotec y Veta Nueva",
      todas.includes("Boltec #1") && todas.includes("B1-37") && todas.includes("PS009"), `${todas.length} equipos`);
    await win.locator(".selector-unidad select").selectOption({ label: "Explotec" }); await win.waitForTimeout(600);
    const exp = await equiposControl();
    r("Explotec: solo equipos B1- activos (B1-24 inactivo)", exp.length === 12 && !exp.includes("B1-24") && exp.every((c) => c.startsWith("B1-")), exp.join(" "));
    r("Explotec: el subtítulo nombra la unidad", ((await win.locator(".subtitulo").first().textContent()) ?? "").startsWith("Explotec"));
    await win.screenshot({ path: join(SALIDA, "u_admin_explotec.png") });
    await ir("#/equipos");
    r("Explotec: el maestro muestra los 13 equipos, con B1-24 inactivo, sin columna Unidad",
      (await win.locator("tbody tr").count()) === 13 && (await win.locator("thead th", { hasText: "Unidad" }).count()) === 0);
    await win.locator(".selector-unidad select").selectOption({ label: "Veta Nueva" }); await win.waitForTimeout(600);
    await ir("#/control");
    const vn = await equiposControl();
    r("Veta Nueva: 18 equipos", vn.length === 18, vn.join(" "));
    await win.screenshot({ path: join(SALIDA, "u_admin_veta_nueva.png") });
    await ir("#/programa");
    await win.screenshot({ path: join(SALIDA, "u_admin_vn_programa.png") });
    await win.locator(".selector-unidad select").selectOption({ label: "Mina La India" }); await win.waitForTimeout(600);
    await ir("#/control");
    r("Mina La India: sin equipos todavía", (await equiposControl()).length === 0);
    await win.locator(".selector-unidad select").selectOption({ index: 0 }); await win.waitForTimeout(600);
    await ir("#/equipos");
    r("Todas: el maestro muestra la columna Unidad", (await win.locator("thead th", { hasText: "Unidad" }).count()) === 1);
    await win.reload(); await win.waitForTimeout(2000);
    r("La elección de unidad se recuerda al reabrir", (await win.locator(".selector-unidad select").inputValue()) === "");
  } else {
    r("Capturador: sin selector, con su unidad fija", (await win.locator(".selector-unidad").count()) === 0 &&
      ((await win.locator(".unidad-fija").textContent()) ?? "").includes("Explotec"));
    await ir("#/control");
    const exp = await equiposControl();
    r("Capturador Explotec: solo sus 12 equipos activos", exp.length === 12 && exp.every((c) => c.startsWith("B1-")));
    await win.screenshot({ path: join(SALIDA, "u_capturador_explotec.png") });
    await ir("#/lecturas");
    const filas = await win.locator("tbody tr").count();
    r("Lecturas: un renglón por horómetro activo de Explotec (24)", filas === 24, `${filas}`);
    const fila = win.locator("tbody tr", { hasText: "B1-37" }).filter({ hasText: "Diesel" }).first();
    const ultima = Number(((await fila.locator("td").nth(2).textContent()) ?? "0").replace(/,/g, ""));
    r("Lecturas: última lectura de B1-37 desde v_ultima_lectura", ultima > 1000, `${ultima}`);
    await win.locator('input[type="date"]').fill("2026-10-28");
    await fila.locator("input").fill(String(ultima + 9)); await win.waitForTimeout(1200);
    r("Lecturas: control de la base sobre Explotec", ((await fila.locator("td").last().textContent()) ?? "") === "OK");
    await win.screenshot({ path: join(SALIDA, "u_capturador_lecturas.png") });
    await fila.locator("input").fill(""); await win.waitForTimeout(300);
  }
  await app.close();
}

await probar("admin");
await probar("capturador_explotec");
for (const x of resultados) console.log(`${x.ok ? "OK   " : "FALLA"} [${x.caso}] ${x.nombre}${x.detalle ? " · " + x.detalle : ""}`);
console.log(`\n${resultados.filter((x) => x.ok).length}/${resultados.length} verificaciones OK`);
