"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("appInfo", {
  version: process.env.npm_package_version ?? "",
  plataforma: process.platform,
  guardarPdf: (html, nombre) => import_electron.ipcRenderer.invoke("guardar-pdf", html, nombre),
  guardarArchivo: (datos, nombre) => import_electron.ipcRenderer.invoke("guardar-archivo", datos, nombre)
});
