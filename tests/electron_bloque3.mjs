// Verifica las mejoras visuales del bloque 3 dentro de Electron y toma capturas.
// Uso: xvfb-run -a node tests/electron_bloque3.mjs <carpeta_salida>
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { _electron } = require("/opt/node-tools/node_modules/playwright/index.js");

const RAIZ = new URL("..", import.meta.url).pathname;
const SALIDA = process.argv[2] ?? join(RAIZ, "capturas");
const fixture = (n) => JSON.parse(readFileSync(join(RAIZ, "tests/fixtures", `${n}.json`), "utf8"));
const datos = Object.fromEntries(["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
  "v_lecturas", "registros_pm", "parametros", "perfiles", "columnas_control", "v_registros_pm"].map((n) => [n, fixture(n)]));
const res = [];
const ok = (n, c, d = "") => res.push(`${c ? "OK   " : "FALLA"} ${n}${d ? " · " + d : ""}`);

const app = await _electron.launch({ executablePath: join(RAIZ, "node_modules/electron/dist/electron"),
  args: [join(RAIZ, "dist-electron/main.js"), "--no-sandbox"], cwd: RAIZ });
await app.evaluate(({ dialog }, carpeta) => {
  dialog.showSaveDialog = async (...a) => ({ canceled: false, filePath: carpeta + "/" + a[a.length - 1].defaultPath.split("/").pop() });
}, SALIDA);
let lento = true;
const ctx = app.context();
await ctx.route("**/rest/v1/**", async (route) => {
  const req = route.request(); const url = new URL(req.url()); const tabla = url.pathname.split("/rest/v1/")[1];
  if (req.method() !== "GET") {
    if (tabla.startsWith("rpc/")) return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    if (tabla.startsWith("columnas_control")) {
      const col = url.searchParams.get("columna").slice(3); const cambio = JSON.parse(req.postData());
      datos.columnas_control = datos.columnas_control.map((c) => (c.columna === col ? { ...c, ...cambio } : c));
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([{ id: "nuevo" }]) });
  }
  if (lento && tabla === "v_control_pm") await new Promise((r) => setTimeout(r, 2500));
  let filas = datos[tabla] ?? [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    if (v.startsWith("eq.")) filas = filas.filter((f) => String(f[k]) === v.slice(3));
    else if (v.startsWith("gte.")) filas = filas.filter((f) => String(f[k]) >= v.slice(4));
  }
  const obj = (req.headers()["accept"] ?? "").includes("pgrst.object");
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(obj ? (filas[0] ?? null) : filas) });
});
await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route("**/realtime/**", (r) => r.abort());
const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");
await win.evaluate(() => {
  localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
  localStorage.setItem("sb-demo-auth-token", JSON.stringify({ access_token: "demo", refresh_token: "demo", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
    user: { id: "00000000-0000-0000-0000-000000000001", email: "demo@hemco.local", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
});
await win.reload(); await win.waitForTimeout(900);
// V8: silueta mientras carga (v_control_pm demora 2,5 s)
ok("V8 silueta de carga visible mientras llegan datos", (await win.locator(".esqueleto").count()) === 1);
await win.screenshot({ path: join(SALIDA, "b3_v8_cargando.png") });
await win.waitForTimeout(2500); lento = false;
const ir = async (h) => { await win.evaluate((x) => { location.hash = x; }, h); await win.waitForTimeout(1200); };

// V9 y V1: franjas y columna fija
ok("V9 cada fila lleva clase de estado", (await win.locator("tbody tr.fila-vencido, tbody tr.fila-normal, tbody tr.fila-programar, tbody tr.fila-repuestos, tbody tr.fila-sindatos").count()) === (await win.locator("tbody tr").count()));
const posicion = await win.locator("tbody td.col-fija").first().evaluate((e) => getComputedStyle(e).position);
ok("V1 columna Equipo fija (sticky)", posicion === "sticky");
// V2: observación en una línea
const obs = win.locator(".aviso-obs").first();
ok("V2 observación en una línea con texto completo al pasar el mouse", (await obs.evaluate((e) => getComputedStyle(e).whiteSpace)) === "nowrap" && !!(await obs.getAttribute("title")));
const alturas = await win.locator("tbody tr").evaluateAll((trs) => trs.map((t) => Math.round(t.getBoundingClientRect().height)));
ok("V2 filas de altura pareja", Math.max(...alturas) - Math.min(...alturas) <= 2, `${Math.min(...alturas)}–${Math.max(...alturas)} px`);
await win.screenshot({ path: join(SALIDA, "b3_control.png") });

// V3: ordenar por Hrs faltantes y quitar filtros
await win.locator("th", { hasText: "Hrs faltantes" }).click(); await win.waitForTimeout(300);
const idx = await win.locator("thead th").evaluateAll((ths) => ths.findIndex((t) => t.textContent.startsWith("Hrs faltantes")));
const valores = (await win.locator(`tbody tr td:nth-child(${idx + 1})`).allTextContents()).filter((t) => t !== "").map((t) => Number(t.replace(/,/g, "")));
ok("V3 ordenar por Hrs faltantes ascendente", valores.every((v, i) => i === 0 || valores[i - 1] <= v), valores.slice(0, 4).join(", "));
ok("V3 aparece Quitar filtros", (await win.getByRole("button", { name: "Quitar filtros" }).count()) === 1);
await win.screenshot({ path: join(SALIDA, "b3_v3_orden.png") });
await win.getByRole("button", { name: "Quitar filtros" }).click(); await win.waitForTimeout(200);
ok("V3 Quitar filtros limpia el orden", (await win.locator(".flecha-orden.activa").count()) === 0);

// V1: orden de columnas por el admin
await win.getByRole("button", { name: "Columnas" }).click(); await win.waitForTimeout(300);
const antes = (await win.locator("thead th").allTextContents()).map((t) => t.replace(/[▲▼↕]/g, "").trim());
const filaEstado = win.locator(".fila-orden", { hasText: "Estado" });
for (let i = 0; i < 14; i++) { await filaEstado.getByTitle("Subir").click(); await win.waitForTimeout(120); }
await win.screenshot({ path: join(SALIDA, "b3_v1_columnas.png") });
await win.getByRole("button", { name: "Cerrar", exact: true }).click(); await win.waitForTimeout(800);
const despues = (await win.locator("thead th").allTextContents()).map((t) => t.replace(/[▲▼↕]/g, "").trim());
ok("V1 el admin sube Estado y la tabla cambia de orden", despues.indexOf("Estado") < antes.indexOf("Estado"), `posición ${antes.indexOf("Estado")} → ${despues.indexOf("Estado")}`);
await win.screenshot({ path: join(SALIDA, "b3_v1_tabla_reordenada.png") });

// V16: Excel con las mismas columnas y orden
await win.getByRole("button", { name: "Exportar a Excel" }).click(); await win.waitForTimeout(2500);
const xlsx = readdirSync(SALIDA).filter((f) => f.endsWith(".xlsx")).sort().pop();
res.push(`INFO  V16 encabezados de la tabla: ${despues.join(" | ")}`);
res.push(`INFO  V16 archivo exportado: ${xlsx}`);

// V4 y V5: aviso emergente y pie con conexión y versión
const pie = (await win.locator(".pie-estado").textContent()) ?? "";
ok("V5 pie del menú con estado de conexión y versión", /(En línea|Reconectando|Sin conexión)/.test(pie) && /v\d+\.\d+\.\d+/.test(pie), pie);
await win.getByRole("button", { name: "Reporte semanal (PDF)" }).click(); await win.waitForTimeout(3000);
ok("V4 aviso emergente al guardar el reporte", (await win.locator(".aviso").count()) > 0, (await win.locator(".aviso-texto").first().textContent()) ?? "");
await win.screenshot({ path: join(SALIDA, "b3_v4_v5_aviso.png") });

// V7: Enter, resaltado y aviso al salir sin grabar
await ir("#/lecturas");
const casillas = win.locator("input.casilla-lectura");
await casillas.nth(0).fill("3500"); await casillas.nth(0).press("Enter");
const foco = await win.evaluate(() => Array.from(document.querySelectorAll("input.casilla-lectura")).indexOf(document.activeElement));
ok("V7 Enter pasa a la casilla siguiente", foco === 1, `foco en casilla ${foco}`);
ok("V7 fila con valor resaltada", (await win.locator("tr.fila-con-valor").count()) === 1);
await win.screenshot({ path: join(SALIDA, "b3_v7_lecturas.png") });
await win.locator(".menu nav a", { hasText: "Control PM" }).click(); await win.waitForTimeout(500);
ok("V7 aviso al salir con lecturas sin grabar", (await win.locator("dialog[open]", { hasText: "Hay lecturas sin grabar" }).count()) === 1);
await win.screenshot({ path: join(SALIDA, "b3_v7_salir.png") });
await win.getByRole("button", { name: "Seguir capturando" }).click(); await win.waitForTimeout(300);
ok("V7 Seguir capturando conserva lo escrito", (await casillas.nth(0).inputValue()) === "3500");
await win.getByRole("button", { name: "Grabar lecturas" }).click(); await win.waitForTimeout(1200);
ok("V4 aviso emergente al grabar lecturas", ((await win.locator(".aviso-texto").allTextContents()).join(" ")).includes("grabada"));
await win.locator(".menu nav a", { hasText: "Control PM" }).click(); await win.waitForTimeout(600);
ok("V7 tras grabar se sale sin aviso", (await win.locator("dialog[open]").count()) === 0);

// V14: PM ejecutados en gráficas
await ir("#/graficas");
ok("V14 marcadores de PM en las gráficas", (await win.locator(".grafica-pm").count()) > 0, `${await win.locator(".grafica-pm").count()} marcadores`);
const tarjeta = win.locator(".tarjeta-grafica", { has: win.locator(".grafica-pm") }).first();
if (await tarjeta.count()) {
  await tarjeta.scrollIntoViewIfNeeded();
  await tarjeta.screenshot({ path: join(SALIDA, "b3_v14_pm.png") });
}
await app.close();
console.log(res.join("\n"));
