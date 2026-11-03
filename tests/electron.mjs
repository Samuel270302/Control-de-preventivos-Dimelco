// Prueba de humo dentro de Electron real (el motor de la app instalada), con
// Supabase simulado por los fixtures. Uso: xvfb-run -a node tests/electron.mjs <carpeta_salida>
import { createRequire } from "node:module";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { _electron } = require("/opt/node-tools/node_modules/playwright/index.js");

const RAIZ = new URL("..", import.meta.url).pathname;
const SALIDA = process.argv[2] ?? join(RAIZ, "capturas");
const fixture = (n) => JSON.parse(readFileSync(join(RAIZ, "tests/fixtures", `${n}.json`), "utf8"));
const datos = Object.fromEntries(
  ["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
   "v_lecturas", "registros_pm", "parametros", "perfiles", "columnas_control", "v_registros_pm", "v_cumplimiento_pm", "v_utilizacion_mensual", "unidades", "v_ultima_lectura"].map((n) => [n, fixture(n)])
);
const resultados = [];
const ok = (nombre, cond, detalle = "") => resultados.push(`${cond ? "OK   " : "FALLA"} ${nombre}${detalle ? " · " + detalle : ""}`);

const app = await _electron.launch({
  executablePath: join(RAIZ, "node_modules/electron/dist/electron"),
  args: [join(RAIZ, "dist-electron/main.js"), "--no-sandbox"],
  cwd: RAIZ,
});
const pdfRuta = join(SALIDA, "reporte_prueba.pdf");
const xlsxCarpeta = SALIDA;
await app.evaluate(({ dialog, shell, session }, { pdfRuta, xlsxCarpeta }) => {
  // Simula la elección del usuario en el diálogo Guardar: usa el nombre propuesto.
  dialog.showSaveDialog = async (...a) => {
    const op = a[a.length - 1];
    const propuesto = op.defaultPath.split("/").pop();
    return { canceled: false, filePath: propuesto.endsWith(".pdf") ? pdfRuta : xlsxCarpeta + "/" + propuesto };
  };
  shell.openPath = async () => "";
  session.defaultSession.on("will-download", (_e, item) => item.setSavePath(xlsxCarpeta + "/" + item.getFilename()));
}, { pdfRuta, xlsxCarpeta });

const ctx = app.context();
const patches = [];
await ctx.route("**/rest/v1/**", (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const tabla = url.pathname.split("/rest/v1/")[1];
  if (req.method() === "PATCH") { patches.push({ tabla, body: req.postData() }); return route.fulfill({ status: 204, body: "" }); }
  if (req.method() === "POST" && tabla.startsWith("rpc/")) return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  let filas = datos[tabla] ?? [];
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    if (v.startsWith("eq.")) filas = filas.filter((f) => String(f[k]) === v.slice(3));
    else if (v.startsWith("gte.")) filas = filas.filter((f) => String(f[k]) >= v.slice(4));
    else if (v.startsWith("lte.")) filas = filas.filter((f) => String(f[k]) <= v.slice(4));
  }
  const objeto = (req.headers()["accept"] ?? "").includes("pgrst.object");
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(objeto ? (filas[0] ?? null) : filas) });
});
await ctx.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await ctx.route("**/realtime/**", (r) => r.abort());

const win = await app.firstWindow();
await win.waitForLoadState("domcontentloaded");
await win.evaluate(() => {
  localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
  localStorage.setItem("sb-demo-auth-token", JSON.stringify({
    access_token: "demo", refresh_token: "demo", token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
    user: { id: "00000000-0000-0000-0000-000000000001", email: "demo@hemco.local", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }));
});
await win.reload();
await win.waitForTimeout(2500);
const vista = await win.evaluate(() => ({ w: innerWidth, h: innerHeight }));
const ir = async (hash) => { await win.evaluate((h) => { location.hash = h; }, hash); await win.waitForTimeout(1500); };

// 1. Plan MP: editar y guardar
await ir("#/plan");
await win.getByRole("button", { name: "Editar" }).first().click();
await win.waitForTimeout(500);
const caja = await win.locator("dialog[open]").boundingBox();
ok("Plan MP: el editor abre dentro de la ventana", !!caja && caja.y >= 0 && caja.y + caja.height <= vista.h, JSON.stringify(caja));
await win.screenshot({ path: join(SALIDA, "electron_plan_editor.png") });
await win.locator('dialog label:has-text("Programar") input').fill("12");
await win.getByRole("button", { name: "Guardar" }).click();
await win.waitForTimeout(600);
ok("Plan MP: guardar envía el cambio", patches.some((p) => p.tabla.startsWith("planes_mp") && p.body.includes('"dias_programar":12')));

// 2. Anular en Registro PM y en Historial
await ir("#/registro-pm");
await win.getByRole("button", { name: "Anular" }).first().click();
await win.waitForTimeout(400);
await win.locator("dialog textarea").fill("prueba en Electron");
await win.getByRole("button", { name: "Anular registro" }).click();
await win.waitForTimeout(600);
ok("Registro PM: Anular envía el motivo", patches.some((p) => p.tabla.startsWith("registros_pm") && p.body.includes("prueba en Electron")));
await ir("#/historial");
await win.getByRole("button", { name: "Anular" }).first().click();
await win.locator("dialog textarea").fill("lectura en Electron");
await win.getByRole("button", { name: "Anular registro" }).click();
await win.waitForTimeout(600);
ok("Historial: Anular lectura envía el motivo", patches.some((p) => p.tabla.startsWith("lecturas") && p.body.includes("lectura en Electron")));

// 3. Reporte semanal PDF
await ir("#/control");
await win.getByRole("button", { name: "Reporte semanal (PDF)" }).click();
await win.waitForTimeout(3000);
const pdfOk = existsSync(pdfRuta) && readFileSync(pdfRuta).subarray(0, 5).toString() === "%PDF-";
ok("Control PM: el reporte semanal genera un PDF", pdfOk, pdfOk ? `${statSync(pdfRuta).size} bytes` : "no se creó");

// 4. Exportar a Excel
await win.getByRole("button", { name: "Exportar a Excel" }).click();
await win.waitForTimeout(2500);
const xlsx = require("node:fs").readdirSync(xlsxCarpeta).filter((f) => f.endsWith(".xlsx"));
ok("Control PM: exportar a Excel descarga el archivo", xlsx.length > 0, xlsx.join(", "));

// 5. Columnas, gráficas y captura de lecturas
await win.getByRole("button", { name: "Columnas" }).click();
await win.waitForTimeout(400);
ok("Control PM: el diálogo de columnas abre", (await win.locator("dialog[open]").count()) === 1);
await win.keyboard.press("Escape");
await ir("#/graficas");
ok("Gráficas: se dibujan", (await win.locator(".grafica svg").count()) > 0);
await win.screenshot({ path: join(SALIDA, "electron_graficas.png") });
await ir("#/lecturas");
ok("Lecturas: la pantalla carga la flota", (await win.locator("tbody tr").count()) > 20);

await app.close();
console.log(resultados.join("\n"));
process.exit(resultados.some((r) => r.startsWith("FALLA")) ? 1 : 0);
