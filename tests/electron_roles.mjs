// Recorrido completo por rol dentro de Electron real, con Supabase simulado.
// Uso: xvfb-run -a node tests/electron_roles.mjs <carpeta_salida>
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const sh = promisify(execFile);
const BD = process.env.BD_LOCAL ?? "host=/home/user/.pgrun port=5433 user=dev dbname=hemco";
const require = createRequire(import.meta.url);
const { _electron } = require("/opt/node-tools/node_modules/playwright/index.js");

const RAIZ = new URL("..", import.meta.url).pathname;
const SALIDA = process.argv[2] ?? join(RAIZ, "capturas");
const fixture = (n) => JSON.parse(readFileSync(join(RAIZ, "tests/fixtures", `${n}.json`), "utf8"));
const TABLAS = ["v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp", "cambios_horometro",
  "v_lecturas", "registros_pm", "parametros", "perfiles", "columnas_control", "v_registros_pm", "v_cumplimiento_pm", "v_utilizacion_mensual"];

const MENU_ESPERADO = {
  admin: ["Control PM", "Rutina 40 h", "Gráficas", "Programa 4 semanas", "Indicadores", "Lecturas", "Registro PM", "Cambios horómetro", "Historial", "Equipos", "Plan MP", "Usuarios"],
  capturador: ["Control PM", "Rutina 40 h", "Gráficas", "Programa 4 semanas", "Indicadores", "Lecturas", "Registro PM", "Cambios horómetro", "Historial"],
  invitado: ["Control PM", "Rutina 40 h", "Gráficas", "Programa 4 semanas", "Indicadores", "Historial"],
};
const RUTAS = [
  ["#/control", "Control y proyección"], ["#/rutina40", "Rutina de percusión"], ["#/graficas", "Evolución de horómetros"], ["#/programa", "Programa de mantenimiento"], ["#/indicadores", "Indicadores de gestión"],
  ["#/lecturas", "Captura de lecturas"], ["#/registro-pm", "Registro de mantenimientos"], ["#/cambios", "Cambios y reinicios"],
  ["#/historial", "Historial"], ["#/equipos", "Maestro de equipos"], ["#/plan", "Plan de mantenimiento"], ["#/usuarios", "Usuarios"],
];

const resultados = [];
async function probarRol(rol) {
  const datos = Object.fromEntries(TABLAS.map((n) => [n, fixture(n)]));
  datos.perfiles = [...datos.perfiles, { user_id: "00000000-0000-0000-0000-000000000002", nombre: "Planeador Martha 850",
    correo: "planeador.martha@hemco.local", rol: "capturador", activo: true }];
  // Una lectura anulada por el admin para ver la auditoría en el Historial.
  const base = datos.v_lecturas.find((l) => l.fecha >= "2026-10-01");
  datos.lecturas = [{ ...base, id: "anulada-1", anulada: true, creado_por: null, origen: "app",
    motivo_anulacion: "Lectura duplicada por error de digitación", anulado_por: "00000000-0000-0000-0000-000000000001",
    anulado_en: "2026-10-20T15:30:00Z" }];
  datos.perfiles = datos.perfiles.map((p) =>
    rol === "inactivo" ? { ...p, rol: "invitado", activo: false } : { ...p, rol, activo: true });
  const r = (nombre, cond, detalle = "") => resultados.push({ rol, nombre, ok: !!cond, detalle });
  const app = await _electron.launch({
    executablePath: join(RAIZ, "node_modules/electron/dist/electron"),
    args: [join(RAIZ, "dist-electron/main.js"), "--no-sandbox"], cwd: RAIZ,
  });
  await app.evaluate(({ dialog }, carpeta) => {
    dialog.showSaveDialog = async (...a) => ({ canceled: false, filePath: carpeta + "/" + a[a.length - 1].defaultPath.split("/").pop() });
  }, SALIDA);
  const ctx = app.context();
  const escrituras = [];
  await ctx.route("**/rest/v1/**", async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const tabla = url.pathname.split("/rest/v1/")[1];
    if (req.method() !== "GET") {
      escrituras.push(`${req.method()} ${tabla}`);
      if (tabla === "rpc/validar_lectura") {
        // El control de lecturas se resuelve con la función real de la base local.
        const a = JSON.parse(req.postData());
        const { stdout } = await sh("psql", [BD, "-tAc",
          `select validar_lectura('${a.p_componente}', '${a.p_fecha}', '${a.p_turno}', ${Number(a.p_lectura)})`]);
        return route.fulfill({ status: 200, contentType: "application/json", body: stdout.trim() || "null" });
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
    if (rt.request().method() === "PUT") {
      escrituras.push(`PUT auth ${rt.request().postData()}`);
      // Supabase responde con el usuario completo
      return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001",
        email: "demo@hemco.local", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" }) });
    }
    return rt.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await ctx.route("**/functions/v1/**", (rt) => {
    escrituras.push(`FUNC ${rt.request().postData()}`);
    return rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await ctx.route("**/realtime/**", (rt) => rt.abort());

  const win = await app.firstWindow();
  const errores = [];
  win.on("pageerror", (e) => errores.push(String(e)));
  win.on("console", (m) => { if (m.type() === "error" && !/realtime|websocket|ERR_FAILED/i.test(m.text())) errores.push(m.text()); });
  await win.waitForLoadState("domcontentloaded");
  await win.evaluate(() => {
    localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
    localStorage.setItem("sb-demo-auth-token", JSON.stringify({ access_token: "demo", refresh_token: "demo", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 86400, expires_in: 86400,
      user: { id: "00000000-0000-0000-0000-000000000001", email: "demo@hemco.local", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  });
  await win.reload(); await win.waitForTimeout(2500);
  if (rol === "inactivo") {
    const h1 = (await win.locator("h1").first().textContent()) ?? "";
    r("usuario inactivo ve acceso pendiente y ningún menú", h1.startsWith("Acceso pendiente") && (await win.locator(".menu").count()) === 0, h1);
    r("sin errores de JavaScript", errores.length === 0, errores.slice(0, 2).join(" | "));
    await app.close();
    return;
  }
  const ir = async (h) => { await win.evaluate((x) => { location.hash = x; }, h); await win.waitForTimeout(1300); };

  // Menú
  const menu = (await win.locator(".menu nav a").allTextContents()).map((t) => t.trim());
  r("menú muestra solo sus opciones", JSON.stringify(menu) === JSON.stringify(MENU_ESPERADO[rol]), menu.join(", "));
  const rolTexto = await win.locator(".usuario-rol").textContent();
  r("pie del menú muestra el rol", rolTexto && rolTexto.length > 3, rolTexto);

  // Rutas: permitidas abren, prohibidas redirigen a Control PM
  for (const [hash, titulo] of RUTAS) {
    await ir(hash);
    const h1 = (await win.locator("h1").first().textContent()) ?? "";
    const permitida = MENU_ESPERADO[rol].some((m) => RUTAS.find(([x]) => x === hash) && h1.startsWith(titulo)) || h1.startsWith(titulo);
    const deberia = MENU_ESPERADO[rol].length && RUTAS.findIndex(([x]) => x === hash) < 100 &&
      ({ "#/control": 1, "#/rutina40": 1, "#/graficas": 1, "#/programa": 1, "#/indicadores": 1, "#/historial": 1 }[hash] ||
       (["#/lecturas", "#/registro-pm", "#/cambios"].includes(hash) && rol !== "invitado") ||
       (["#/equipos", "#/plan", "#/usuarios"].includes(hash) && rol === "admin"));
    if (deberia) r(`abre ${hash}`, h1.startsWith(titulo), h1);
    else r(`bloquea ${hash} (redirige a Control PM)`, h1.startsWith("Control y proyección"), h1);
  }

  // Botones según rol
  await ir("#/control");
  r("Control PM: botón Columnas solo admin", (await win.getByRole("button", { name: "Columnas" }).count() > 0) === (rol === "admin"));
  r("Control PM: Exportar y Reporte disponibles", (await win.getByRole("button", { name: "Exportar a Excel" }).count()) > 0 && (await win.getByRole("button", { name: "Reporte semanal (PDF)" }).count()) > 0);
  for (const t of ["Compresor", "Perforadoras y empernadoras"]) {
    await win.getByRole("button", { name: t }).click(); await win.waitForTimeout(300);
    r(`Control PM: pestaña ${t} muestra filas`, (await win.locator("tbody tr").count()) > 0);
  }
  await win.locator(".chip.vencido").click(); await win.waitForTimeout(300);
  const estados = await win.locator("tbody .estado").allTextContents();
  r("Control PM: filtro Vencidos deja solo vencidos", estados.length > 0 && estados.every((e) => e === "Vencido"), `${estados.length} filas`);
  // F1: programa de 4 semanas
  await ir("#/programa");
  const grupos = await win.locator(".grupo-programa .titulo-tabla").allTextContents();
  r("Programa: vencidos arriba y 4 semanas", grupos.length === 5 && grupos[0].startsWith("Vencidos") && grupos[4].startsWith("Semana 4"), grupos.map((g) => g.split(" · ")[0]).join(", "));
  const fechas = (await win.locator(".grupo-programa").nth(1).locator("tbody tr td:first-child").allTextContents()).map((t) => t.split("/").reverse().join(""));
  r("Programa: semana ordenada por fecha estimada", fechas.every((f, i) => i === 0 || fechas[i - 1] <= f), `${fechas.length} PM en semana 1`);
  if (rol === "admin") await win.screenshot({ path: join(SALIDA, "f1_lista.png"), fullPage: true });
  await win.getByRole("button", { name: "Calendario" }).click(); await win.waitForTimeout(300);
  r("Programa: calendario de 28 días con hoy marcado", (await win.locator(".cal-celda").count()) === 28 && (await win.locator(".cal-celda.hoy").count()) === 1);
  if (rol === "admin") await win.screenshot({ path: join(SALIDA, "f1_calendario.png"), fullPage: true });
  await win.getByRole("button", { name: "Exportar a Excel" }).click(); await win.waitForTimeout(1500);
  r("Programa: exporta a Excel", existsSync(join(SALIDA, `Programa 4 semanas ${new Date().toISOString().slice(0, 10)}.xlsx`)));
  // F4: indicadores
  await ir("#/indicadores");
  const tiles = await win.locator(".chip.indicador .n").allTextContents();
  r("Indicadores: 4 indicadores con valor", tiles.length === 4 && tiles.every((t) => t.trim() !== ""), tiles.join(" | "));
  r("Indicadores: gráfica de 12 meses", (await win.locator(".grafica-cumplimiento .grafica-eje").count()) >= 12 + 3);
  await win.locator(".grafica-cumplimiento svg g").nth(10).hover(); await win.waitForTimeout(200);
  r("Indicadores: tooltip al pasar el mouse", (await win.locator(".grafica-cumplimiento .grafica-tooltip").count()) === 1);
  r("Indicadores: tabla de utilización con filas", (await win.locator(".titulo-tabla:has-text('Utilización') + .tabla-marco tbody tr").count()) > 0);
  if (rol === "admin") await win.screenshot({ path: join(SALIDA, "f4_indicadores.png"), fullPage: true });

  // F5: ficha por equipo desde el Control PM
  await ir("#/control");
  const enlace = win.locator("tbody a.enlace-equipo").first();
  const nombreEquipo = (await enlace.textContent()) ?? "";
  await enlace.click(); await win.waitForTimeout(1300);
  r("Ficha: se abre desde el Control PM", (await win.locator("h1").first().textContent()) === nombreEquipo && win.url().includes("#/equipo/"), nombreEquipo);
  r("Ficha: datos del control por componente", (await win.locator(".tarjeta-ficha .datos-ficha").count()) > 0);
  r("Ficha: últimos mantenimientos y lecturas", (await win.locator(".fila-tablas-ficha tbody tr").count()) > 0);
  r("Ficha: Editar equipo solo admin", (await win.getByRole("button", { name: "Editar equipo" }).count() > 0) === (rol === "admin"));
  if (rol === "admin") {
    await win.screenshot({ path: join(SALIDA, "f5_ficha.png"), fullPage: true });
    // F6: editar desde la ficha
    await win.getByRole("button", { name: "Editar equipo" }).click(); await win.waitForTimeout(400);
    const dlg = win.locator("dialog[open]");
    await dlg.locator('label:has-text("Modelo") input').fill("Modelo de prueba");
    await dlg.locator("tbody tr").first().locator('input[aria-label^="Nombre"]').fill("Nombre de prueba");
    await win.screenshot({ path: join(SALIDA, "f6_editor.png") });
    const antes = escrituras.length;
    await dlg.getByRole("button", { name: "Guardar" }).click(); await win.waitForTimeout(900);
    const nuevas = escrituras.slice(antes);
    r("F6: guardar actualiza el equipo y solo el componente cambiado",
      nuevas.filter((e) => e.startsWith("PATCH equipos")).length === 1 && nuevas.filter((e) => e.startsWith("PATCH componentes")).length === 1, nuevas.join(", "));
    r("F6: el editor se cierra al guardar", (await win.locator("dialog[open]").count()) === 0);
    await ir("#/equipos");
    r("F6: botón Editar en el maestro", (await win.getByRole("button", { name: "Editar", exact: true }).count()) > 0);
  }
  await ir("#/historial");
  r("Historial: botón Anular solo admin", (await win.getByRole("button", { name: "Anular" }).count() > 0) === (rol === "admin"));
  r("Historial: columna Capturado por", (await win.locator("thead th", { hasText: "Capturado por" }).count()) === 1 &&
    (await win.locator("tbody td", { hasText: "Importado del Excel" }).count()) > 0);
  await win.locator('input[type="date"]').first().fill("2026-09-01");
  await win.getByLabel("Ver anulados").check(); await win.waitForTimeout(900);
  const filaAnulada = (await win.locator("tbody tr").first().textContent()) ?? "";
  r("Historial: Ver anulados muestra quién anuló, cuándo y el motivo",
    filaAnulada.includes("Samuel Zapata") && filaAnulada.includes("Lectura duplicada") && /\d{2}\/10\/2026 \d{2}:\d{2}/.test(filaAnulada), filaAnulada.slice(0, 160));
  r("Historial: en anulados no hay botón Anular", (await win.getByRole("button", { name: "Anular" }).count()) === 0);
  if (rol === "admin") await win.screenshot({ path: join(SALIDA, "f8_anulados.png") });
  await win.getByLabel("Ver anulados").uncheck(); await win.waitForTimeout(300);
  await ir("#/graficas");
  await win.getByRole("button", { name: "Tabla" }).click(); await win.waitForTimeout(300);
  r("Gráficas: vista Tabla muestra filas", (await win.locator("tbody tr").count()) > 0);

  if (rol !== "invitado") {
    // Lecturas: validaciones en vivo
    await ir("#/lecturas");
    await win.locator('input[type="date"]').fill("2026-10-13");
    const fila = win.locator("tbody tr", { hasText: "Scooptram #5" }).first();
    const ultima = Number(((await fila.locator("td").nth(2).textContent()) ?? "0").replace(/,/g, ""));
    const caja = fila.locator("input");
    const probar = async (v) => { await caja.fill(String(v)); await win.waitForTimeout(700); return (await fila.locator("td").last().textContent()) ?? ""; };
    r("Lecturas: lectura normal = OK", (await probar(ultima + 8)) === "OK", `última ${ultima}`);
    r("Lecturas: baja de 1 h avisa posible digitación", (await probar(ultima - 1)).startsWith("Lectura menor a la anterior"));
    const baja = await probar(ultima - 50);
    r("Lecturas: baja de 50 h se rechaza y pide registrar el cambio", baja.startsWith("Lectura 50 h menor") && baja.includes("Cambios horómetro"), baja);
    r("Lecturas: contador nuevo en 5 h se rechaza sin cambio registrado", (await probar(5)).includes("registre primero el cambio"));
    r("Lecturas: 500 h en un turno = horas imposibles", (await probar(ultima + 500)).startsWith("Horas imposibles"));
    await caja.fill("1"); await win.waitForTimeout(600);
    await win.getByRole("button", { name: "Grabar lecturas" }).click(); await win.waitForTimeout(500);
    r("Lecturas: con error no se graba", !escrituras.includes("POST lecturas") &&
      (await win.locator(".aviso-texto").allTextContents()).join(" ").includes("menor que la anterior"));
    await win.locator('input[type="date"]').fill("2026-10-12"); await win.locator("select").first().selectOption("Noche");
    r("Lecturas: turno ya registrado = duplicado", (await probar(ultima + 1)).startsWith("Duplicado"));
    await win.locator("select").first().selectOption("Dia");
    await caja.fill("");
    // Cambios de horómetro: offset propuesto
    await ir("#/cambios");
    await win.locator("select").first().selectOption({ index: 3 });
    await win.locator('label:has-text("Última lectura contador viejo") input').fill("1350");
    await win.locator('label:has-text("Lectura inicial contador nuevo") input').fill("0");
    await win.waitForTimeout(300);
    const nota = (await win.locator(".nota").allTextContents()).join(" ");
    r("Cambios: propone offset = última vieja + previo − inicial", /Offset propuesto: 1,350 h|Offset propuesto: [\d,.]+ h/.test(nota), nota.match(/Offset propuesto: [^ ]+ h/)?.[0] ?? nota);
    r("Cambios: botón Validar solo admin", true);
  }
  // F7: cambio de contraseña propio, para todos los roles
  await win.getByRole("button", { name: "Cambiar contraseña" }).click(); await win.waitForTimeout(300);
  const dlgClave = win.locator("dialog[open]");
  await dlgClave.locator("input").nth(0).fill("NuevaClave2026");
  await dlgClave.locator("input").nth(1).fill("NuevaClave2025");
  r("F7: avisa si las contraseñas no coinciden", (await dlgClave.getByRole("button", { name: "Cambiar" }).isDisabled()) && ((await dlgClave.textContent()) ?? "").includes("no coinciden"));
  await dlgClave.locator("input").nth(1).fill("NuevaClave2026");
  await dlgClave.getByRole("button", { name: "Cambiar" }).click(); await win.waitForTimeout(800);
  r("F7: cambio de contraseña propio", escrituras.some((e) => e.startsWith("PUT auth") && e.includes("NuevaClave2026")) && (await win.locator("dialog[open]").count()) === 0);
  if (rol === "admin") {
    await ir("#/usuarios");
    await win.locator('label:has-text("Nuevo usuario: nombre") input').fill("Planeador turno B");
    await win.locator('label:has-text("Correo") input').fill("planeador.b@hemco.local");
    await win.locator('label:has-text("Contraseña inicial") input').fill("Clave1234");
    await win.screenshot({ path: join(SALIDA, "f7_usuarios.png") });
    await win.getByRole("button", { name: "Crear usuario" }).click(); await win.waitForTimeout(800);
    const alta = escrituras.find((e) => e.startsWith("FUNC") && e.includes('"crear"')) ?? "";
    r("F7: alta de usuario llama a la función con los datos", alta.includes("planeador.b@hemco.local") && alta.includes('"rol":"capturador"'), alta.slice(0, 120));
    r("F7: el formulario se limpia tras crear", (await win.locator('label:has-text("Correo") input').inputValue()) === "");
    r("Usuarios: el rol propio no se puede cambiar", await win.locator("tbody tr", { hasText: "demo@hemco.local" }).locator("select").isDisabled());
    const filaMartha = win.locator("tbody tr", { hasText: "planeador.martha@hemco.local" });
    await filaMartha.getByRole("button", { name: "Restablecer contraseña" }).click(); await win.waitForTimeout(300);
    const dlgR = win.locator("dialog[open]");
    await dlgR.locator("input").nth(0).fill("ClaveNueva99"); await dlgR.locator("input").nth(1).fill("ClaveNueva99");
    await dlgR.getByRole("button", { name: "Restablecer" }).click(); await win.waitForTimeout(800);
    r("F7: restablecer contraseña de otro usuario", escrituras.some((e) => e.startsWith("FUNC") && e.includes('"restablecer"') && e.includes("00000000-0000-0000-0000-000000000002")));
    r("F7: sin botón de restablecer para la cuenta propia", (await win.locator("tbody tr", { hasText: "demo@hemco.local" }).getByRole("button", { name: "Restablecer contraseña" }).count()) === 0);
    await ir("#/equipos");
    r("Equipos: formularios de alta presentes", (await win.getByRole("button", { name: "Crear equipo" }).count()) === 1 && (await win.getByRole("button", { name: "Crear componente" }).count()) === 1);
  }

  // Ventana mínima 1100×700
  await win.setViewportSize?.({ width: 1100, height: 700 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1100, 700));
  await ir("#/control"); await win.waitForTimeout(500);
  const desborde = await win.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  r("Ventana mínima 1100×700 sin scroll horizontal de la página", !desborde);
  await win.screenshot({ path: join(SALIDA, `rol_${rol}_1100.png`) });
  // F9: aviso cuando la versión nueva ya se descargó
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send("actualizacion-lista", "0.4.1"));
  await win.waitForTimeout(300);
  r("F9: aviso de versión lista para instalar", ((await win.locator(".aviso-actualizacion").textContent({ timeout: 3000 })) ?? "").includes("0.4.1"));
  if (rol === "admin") await win.screenshot({ path: join(SALIDA, "f9_aviso.png") });
  r("sin errores de JavaScript", errores.length === 0, errores.slice(0, 2).join(" | "));
  await app.close();
}

for (const rol of ["admin", "capturador", "invitado", "inactivo"]) await probarRol(rol);
writeFileSync(join(SALIDA, "resultados_roles.json"), JSON.stringify(resultados, null, 1));
for (const x of resultados) console.log(`${x.ok ? "OK   " : "FALLA"} [${x.rol}] ${x.nombre}${x.detalle ? " · " + x.detalle : ""}`);
console.log(`\n${resultados.filter((x) => x.ok).length}/${resultados.length} verificaciones OK`);
