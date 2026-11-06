// Versión web (GitHub Pages) en Chrome de PC y de celular, con Supabase simulado por fixtures.
// Antes: VITE_SUPABASE_URL=https://demo.supabase.co VITE_SUPABASE_ANON_KEY=demo-llave npm run build:web
// Uso: node tests/web.mjs <carpeta_salida>
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node-tools/node_modules/playwright/index.js");
const sh = promisify(execFile);
const BD = process.env.BD_LOCAL ?? "host=/home/user/.pgrun port=5433 user=dev dbname=hemco";

const RAIZ = new URL("..", import.meta.url).pathname;
const SITIO = join(RAIZ, "dist-web");
const SALIDA = process.argv[2] ?? join(RAIZ, "capturas");
const fixture = (n) => JSON.parse(readFileSync(join(RAIZ, "tests/fixtures", `${n}.json`), "utf8"));
const TABLAS = ["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
  "v_lecturas", "registros_pm", "parametros", "columnas_control", "v_registros_pm", "v_cumplimiento_pm",
  "v_utilizacion_mensual", "unidades", "v_ultima_lectura"];
const resultados = [];

// Servidor estático del sitio compilado, en una subcarpeta como en GitHub Pages.
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const BASE = "/Control-de-preventivos-Dimelco/";
const servidor = createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!ruta.startsWith(BASE)) { res.writeHead(404); return res.end(); }
  ruta = ruta.slice(BASE.length) || "index.html";
  const archivo = join(SITIO, ruta);
  if (!archivo.startsWith(SITIO) || !existsSync(archivo)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TIPOS[extname(archivo)] ?? "application/octet-stream" });
  res.end(readFileSync(archivo));
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const URL_SITIO = `http://127.0.0.1:${servidor.address().port}${BASE}`;

function datosPara(rol) {
  const datos = Object.fromEntries(TABLAS.map((n) => [n, fixture(n)]));
  const hemco = datos.unidades.find((u) => u.nombre === "HEMCO").id;
  if (rol !== "admin") {
    datos.equipos = datos.equipos.filter((e) => e.unidad_id === hemco);
    const eqs = new Set(datos.equipos.map((e) => e.id));
    datos.componentes = datos.componentes.filter((c) => eqs.has(c.equipo_id));
    const comps = new Set(datos.componentes.map((c) => c.id));
    for (const t of ["v_control_pm", "v_control_40", "v_cumplimiento_pm", "v_utilizacion_mensual"])
      datos[t] = datos[t].filter((f) => f.unidad_id === hemco);
    for (const t of ["v_lecturas", "registros_pm", "v_registros_pm", "cambios_horometro", "v_ultima_lectura"])
      datos[t] = datos[t].filter((f) => comps.has(f.componente_id));
  }
  const nombres = { admin: "Samuel Zapata", capturador: "Planeador Martha 850", invitado: "Invitado HEMCO" };
  datos.perfiles = [{ user_id: "00000000-0000-0000-0000-000000000002", nombre: nombres[rol],
    correo: "planeador.martha@grupodimelco.com", rol, activo: true, unidad_id: rol === "admin" ? null : hemco }];
  return datos;
}

async function probar(caso, rol, dispositivo) {
  const r = (nombre, cond, detalle = "") => resultados.push({ caso, nombre, ok: !!cond, detalle });
  const datos = datosPara(rol);
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ ...dispositivo, locale: "es-419", acceptDownloads: true });
  const usuario = { id: "00000000-0000-0000-0000-000000000002", email: "planeador.martha@grupodimelco.com",
    aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };
  const escrituras = [];
  const errores = [];
  await ctx.route("**/rest/v1/**", async (route) => {
    const req = route.request(); const url = new URL(req.url()); const tabla = url.pathname.split("/rest/v1/")[1];
    if (req.method() !== "GET") {
      if (tabla === "rpc/validar_lectura") {
        const a = JSON.parse(req.postData());
        const { stdout } = await sh("psql", [BD, "-tAc",
          `select validar_lectura('${a.p_componente}', '${a.p_fecha}', '${a.p_turno}', ${Number(a.p_lectura)})`]);
        return route.fulfill({ status: 200, contentType: "application/json", body: stdout.trim() || "null" });
      }
      escrituras.push(`${req.method()} ${tabla}`);
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
      return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "demo",
        refresh_token: "demo", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: usuario }) });
    return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(usuario) });
  });
  await ctx.route(/realtime/, (rt) => rt.abort());
  const win = await ctx.newPage();
  win.on("pageerror", (e) => errores.push(String(e)));
  const ir = async (h) => { await win.evaluate((x) => { location.hash = x; }, h); await win.waitForTimeout(1200); };
  const sinDesborde = async () => win.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  const movil = !!dispositivo.isMobile;

  // Entrada: conexión fija, sin botón para cambiarla
  await win.goto(URL_SITIO); await win.waitForTimeout(1500);
  r("Entrada sin \"Cambiar conexión a la base\" ni pantalla de configuración",
    (await win.getByRole("button", { name: "Entrar" }).count()) === 1 &&
    (await win.getByRole("button", { name: "Cambiar conexión a la base" }).count()) === 0);
  await win.screenshot({ path: join(SALIDA, `w_${caso}_entrada.png`) });
  await win.locator('input[type="email"]').fill("planeador.martha@grupodimelco.com");
  await win.locator('input[type="password"]').fill("Clave1234");
  await win.getByRole("button", { name: "Entrar" }).click(); await win.waitForTimeout(2500);
  r("Entra con usuario y contraseña y abre el Control PM", ((await win.locator("h1").first().textContent()) ?? "").includes("Control y proyección"));
  r("Sin franja de actualización (solo escritorio)", (await win.locator(".aviso-actualizacion, .franja-actualizacion").count()) === 0);
  await win.screenshot({ path: join(SALIDA, `w_${caso}_control.png`) });
  r("Control PM sin desplazamiento lateral de la página", await sinDesborde());

  if (!movil) {
    r("PC: menú lateral visible y sin barra inferior", await win.locator(".menu").isVisible() && !(await win.locator(".barra-inferior").isVisible()));
    const [descarga] = await Promise.all([win.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      win.getByRole("button", { name: "Exportar a Excel" }).first().click()]);
    r("PC: Exportar a Excel descarga el archivo", descarga && descarga.suggestedFilename().endsWith(".xlsx"), descarga?.suggestedFilename() ?? "sin descarga");
  } else {
    const barra = (await win.locator(".barra-inferior a, .barra-inferior button").allTextContents()).map((t) => t.trim());
    const esperado = rol === "invitado" ? ["Control PM", "Programa", "Indicadores", "Más"] : ["Control PM", "Lecturas", "PM", "Más"];
    r("Celular: barra inferior con sus accesos", JSON.stringify(barra) === JSON.stringify(esperado), barra.join(" | "));
    const cajaMenu = await win.locator(".menu").boundingBox();
    r("Celular: el menú lateral está oculto", !cajaMenu || cajaMenu.x + cajaMenu.width <= 0);
    await win.getByRole("button", { name: "Más" }).click(); await win.waitForTimeout(400);
    r("Celular: Más abre el menú completo", (await win.locator(".menu.abierto").count()) === 1 &&
      (await win.locator(".menu nav a", { hasText: "Historial" }).isVisible()));
    await win.screenshot({ path: join(SALIDA, `w_${caso}_menu.png`) });
    await win.locator(".menu nav a", { hasText: "Historial" }).click(); await win.waitForTimeout(1200);
    r("Celular: al elegir una opción el menú se cierra y cambia el título", (await win.locator(".menu.abierto").count()) === 0 &&
      ((await win.locator(".cabecera-movil").textContent()) ?? "").includes("Historial"));
    r("Historial sin desplazamiento lateral de la página", await sinDesborde());
    for (const [h, n] of [["#/programa", "Programa"], ["#/indicadores", "Indicadores"], ["#/graficas", "Gráficas"], ["#/rutina40", "Rutina 40 h"]]) {
      await ir(h);
      r(`${n} sin desplazamiento lateral de la página`, await sinDesborde());
    }
    await ir("#/programa"); await win.screenshot({ path: join(SALIDA, `w_${caso}_programa.png`) });
    await ir("#/indicadores"); await win.screenshot({ path: join(SALIDA, `w_${caso}_indicadores.png`) });

    if (rol !== "invitado") {
      await win.locator(".barra-inferior a", { hasText: "Lecturas" }).click(); await win.waitForTimeout(1500);
      r("Lecturas sin desplazamiento lateral de la página", await sinDesborde());
      r("Lecturas: cada horómetro como tarjeta, sin encabezado de tabla", !(await win.locator(".tabla-lecturas thead").isVisible()));
      const fila = win.locator(".tabla-lecturas tbody tr", { hasText: "Boltec #1" }).filter({ hasText: "Diesel" }).first();
      const ultima = Number(((await fila.locator(".c-ultima").textContent()) ?? "0").replace(/[^0-9.]/g, ""));
      const casilla = fila.locator("input");
      r("Lecturas: la casilla abre el teclado numérico", (await casilla.getAttribute("inputmode")) === "decimal");
      await win.locator('input[type="date"]').fill("2026-10-22");
      await casilla.fill(String(Math.round((ultima + 9.4) * 10) / 10)); await win.waitForTimeout(1500);
      r("Lecturas: el control de la base responde en la tarjeta", ((await fila.locator(".c-control").textContent()) ?? "").trim() === "OK");
      await win.screenshot({ path: join(SALIDA, `w_${caso}_lecturas.png`) });
      await win.locator(".contenido").evaluate((e) => e.scrollTo(0, 2000)); await win.waitForTimeout(300);
      r("Lecturas: Grabar lecturas sigue a la vista al bajar", await win.getByRole("button", { name: "Grabar lecturas" }).isVisible());
      await win.getByRole("button", { name: "Grabar lecturas" }).click(); await win.waitForTimeout(1200);
      r("Lecturas: graba la lectura", escrituras.includes("POST lecturas"), escrituras.join(", "));
      await win.locator('.barra-inferior a[href="#/registro-pm"]').click(); await win.waitForTimeout(1500);
      r("Registro PM sin desplazamiento lateral de la página", await sinDesborde());
      await win.screenshot({ path: join(SALIDA, `w_${caso}_registro_pm.png`) });
    }
  }
  r("Sin errores de JavaScript", errores.length === 0, errores.join(" | ").slice(0, 200));
  await navegador.close();
}

await probar("pc_admin", "admin", { viewport: { width: 1366, height: 768 } });
await probar("movil_capturador", "capturador", devices["Pixel 7"]);
await probar("movil_invitado", "invitado", devices["iPhone 13"]);
servidor.close();
for (const x of resultados) console.log(`${x.ok ? "OK   " : "FALLA"} [${x.caso}] ${x.nombre}${x.detalle ? " · " + x.detalle : ""}`);
console.log(`\n${resultados.filter((x) => x.ok).length}/${resultados.length} verificaciones OK`);
