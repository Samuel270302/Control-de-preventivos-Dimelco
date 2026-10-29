import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";

// El renderer no puede abrir ventanas nuevas (ver setWindowOpenHandler); los
// reportes se convierten a PDF aquí, en una ventana oculta sin JavaScript.
ipcMain.handle("guardar-pdf", async (evento, html: string, nombre: string) => {
  const padre = BrowserWindow.fromWebContents(evento.sender) ?? undefined;
  const opciones = {
    title: "Guardar reporte",
    defaultPath: path.join(app.getPath("documents"), nombre),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  };
  const { canceled, filePath } = padre
    ? await dialog.showSaveDialog(padre, opciones)
    : await dialog.showSaveDialog(opciones);
  if (canceled || !filePath) return null;
  const oculta = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await oculta.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdf = await oculta.webContents.printToPDF({
      landscape: true,
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    await writeFile(filePath, pdf);
  } finally {
    oculta.destroy();
  }
  await shell.openPath(filePath);
  return filePath;
});

// Electron ignora el atributo download de los enlaces (guarda "download" sin
// extensión), así que los archivos exportados se guardan desde aquí.
ipcMain.handle("guardar-archivo", async (evento, datos: Uint8Array, nombre: string) => {
  const padre = BrowserWindow.fromWebContents(evento.sender) ?? undefined;
  const extension = path.extname(nombre).slice(1).toLowerCase();
  const opciones = {
    title: "Guardar archivo",
    defaultPath: path.join(app.getPath("documents"), nombre),
    filters: extension === "xlsx" ? [{ name: "Libro de Excel", extensions: ["xlsx"] }] : [],
  };
  const { canceled, filePath } = padre
    ? await dialog.showSaveDialog(padre, opciones)
    : await dialog.showSaveDialog(opciones);
  if (canceled || !filePath) return null;
  await writeFile(filePath, Buffer.from(datos));
  return filePath;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#111518",
    title: "Preventivos HEMCO",
    icon: path.join(__dirname, "../dist/icono.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  // La pantalla de lecturas bloquea el cierre si hay valores sin grabar
  // (beforeunload); aquí se le pregunta al usuario en vez de ignorar el cierre.
  win.webContents.on("will-prevent-unload", (evento) => {
    const respuesta = dialog.showMessageBoxSync(win, {
      type: "question",
      buttons: ["Salir sin grabar", "Seguir capturando"],
      defaultId: 1,
      cancelId: 1,
      title: "Preventivos HEMCO",
      message: "Hay lecturas sin grabar",
      detail: "Si cierras la app, las lecturas escritas y no grabadas se pierden.",
    });
    if (respuesta === 0) evento.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
