"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"));
import_electron.ipcMain.handle("guardar-pdf", async (evento, html, nombre) => {
  const padre = import_electron.BrowserWindow.fromWebContents(evento.sender) ?? void 0;
  const opciones = {
    title: "Guardar reporte",
    defaultPath: import_node_path.default.join(import_electron.app.getPath("documents"), nombre),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  };
  const { canceled, filePath } = padre ? await import_electron.dialog.showSaveDialog(padre, opciones) : await import_electron.dialog.showSaveDialog(opciones);
  if (canceled || !filePath) return null;
  const oculta = new import_electron.BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await oculta.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    const pdf = await oculta.webContents.printToPDF({
      landscape: true,
      pageSize: "A4",
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    });
    await (0, import_promises.writeFile)(filePath, pdf);
  } finally {
    oculta.destroy();
  }
  await import_electron.shell.openPath(filePath);
  return filePath;
});
import_electron.ipcMain.handle("guardar-archivo", async (evento, datos, nombre) => {
  const padre = import_electron.BrowserWindow.fromWebContents(evento.sender) ?? void 0;
  const extension = import_node_path.default.extname(nombre).slice(1).toLowerCase();
  const opciones = {
    title: "Guardar archivo",
    defaultPath: import_node_path.default.join(import_electron.app.getPath("documents"), nombre),
    filters: extension === "xlsx" ? [{ name: "Libro de Excel", extensions: ["xlsx"] }] : []
  };
  const { canceled, filePath } = padre ? await import_electron.dialog.showSaveDialog(padre, opciones) : await import_electron.dialog.showSaveDialog(opciones);
  if (canceled || !filePath) return null;
  await (0, import_promises.writeFile)(filePath, Buffer.from(datos));
  return filePath;
});
function createWindow() {
  const win = new import_electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#111518",
    title: "Preventivos HEMCO",
    icon: import_node_path.default.join(__dirname, "../dist/icono.png"),
    webPreferences: {
      preload: import_node_path.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(import_node_path.default.join(__dirname, "../dist/index.html"));
  }
  win.webContents.on("will-prevent-unload", (evento) => {
    const respuesta = import_electron.dialog.showMessageBoxSync(win, {
      type: "question",
      buttons: ["Salir sin grabar", "Seguir capturando"],
      defaultId: 1,
      cancelId: 1,
      title: "Preventivos HEMCO",
      message: "Hay lecturas sin grabar",
      detail: "Si cierras la app, las lecturas escritas y no grabadas se pierden."
    });
    if (respuesta === 0) evento.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
import_electron.app.whenReady().then(() => {
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
