// Prueba visual: sirve la app construida, simula Supabase con los fixtures
// exportados de la base local y toma capturas de todas las pantallas.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright/index.js");
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname;
const FIX = join(RAIZ, "tests/fixtures");
const SALIDA = join(RAIZ, "capturas");
mkdirSync(SALIDA, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const servidor = createServer((req, res) => {
  let ruta = req.url.split("?")[0];
  if (ruta === "/") ruta = "/index.html";
  const archivo = join(RAIZ, "dist", ruta);
  if (existsSync(archivo)) {
    res.writeHead(200, { "content-type": MIME[extname(archivo)] ?? "application/octet-stream" });
    res.end(readFileSync(archivo));
  } else {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => servidor.listen(5188, r));

const fixture = (n) => JSON.parse(readFileSync(join(FIX, `${n}.json`), "utf8"));
const datos = Object.fromEntries(
  [
    "v_control_pm", "v_control_40", "equipos", "componentes", "planes_mp",
    "cambios_horometro", "v_lecturas", "registros_pm", "parametros", "perfiles",
  ].map((n) => [n, fixture(n)])
);

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
const pagina = await ctx.newPage();

// Supabase simulado: REST devuelve los fixtures; auth y realtime responden vacío.
await pagina.route("**/rest/v1/**", (route) => {
  const url = new URL(route.request().url());
  const tabla = url.pathname.split("/rest/v1/")[1];
  let filas = datos[tabla] ?? [];
  const quiereObjeto = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
  if (route.request().method() !== "GET") {
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(quiereObjeto ? { id: "nuevo" } : [{ id: "nuevo" }]) });
  }
  // filtros sencillos eq./in. que usa la app
  for (const [clave, valor] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(clave)) continue;
    if (valor.startsWith("eq.")) {
      const v = valor.slice(3);
      filas = filas.filter((f) => String(f[clave]) === v);
    } else if (valor.startsWith("in.")) {
      const lista = valor.slice(4, -1).split(",").map((s) => s.replaceAll('"', ""));
      filas = filas.filter((f) => lista.includes(String(f[clave])));
    } else if (valor.startsWith("gte.")) {
      filas = filas.filter((f) => String(f[clave]) >= valor.slice(4));
    } else if (valor.startsWith("lte.")) {
      filas = filas.filter((f) => String(f[clave]) <= valor.slice(4));
    }
  }
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(quiereObjeto ? (filas[0] ?? null) : filas),
  });
});
await pagina.route("**/auth/v1/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
);
await pagina.route("**/realtime/**", (route) => route.abort());

// Conexión y sesión pre-sembradas (la app las lee de localStorage)
const sesion = {
  access_token: "demo",
  refresh_token: "demo",
  token_type: "bearer",
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  expires_in: 86400,
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "demo@hemco.local",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};
await pagina.addInitScript((s) => {
  localStorage.setItem("preventivos.conexion", JSON.stringify({ url: "https://demo.supabase.co", anonKey: "demo-llave-anon-0123456789" }));
  localStorage.setItem("sb-demo-auth-token", JSON.stringify(s));
}, sesion);

const pantallas = [
  ["control", "#/control"],
  ["rutina40", "#/rutina40"],
  ["lecturas", "#/lecturas"],
  ["registro-pm", "#/registro-pm"],
  ["cambios", "#/cambios"],
  ["historial", "#/historial"],
  ["equipos", "#/equipos"],
  ["plan", "#/plan"],
  ["usuarios", "#/usuarios"],
];

await pagina.goto("http://localhost:5188/" + pantallas[0][1]);
await pagina.waitForTimeout(2500);
for (const [nombre, hash] of pantallas) {
  await pagina.goto("http://localhost:5188/" + hash);
  await pagina.waitForTimeout(1200);
  await pagina.screenshot({ path: join(SALIDA, `${nombre}.png`) });
  console.log("captura:", nombre);
}

const errores = [];
pagina.on("pageerror", (e) => errores.push(String(e)));
await navegador.close();
servidor.close();
if (errores.length) {
  console.error("Errores de página:", errores);
  process.exit(1);
}
