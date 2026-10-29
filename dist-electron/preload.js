"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("appInfo", {
  version: process.env.npm_package_version ?? "",
  plataforma: process.platform,
  guardarPdf: (html, nombre) => import_electron.ipcRenderer.invoke("guardar-pdf", html, nombre),
  guardarArchivo: (datos, nombre) => import_electron.ipcRenderer.invoke("guardar-archivo", datos, nombre),
  // Actualización automática: versión ya descargada (o null) y reinicio para instalarla.
  versionLista: () => import_electron.ipcRenderer.invoke("version-lista"),
  alActualizacionLista: (fn) => {
    const oyente = (_e, version) => fn(version);
    import_electron.ipcRenderer.on("actualizacion-lista", oyente);
    return () => import_electron.ipcRenderer.removeListener("actualizacion-lista", oyente);
  },
  instalarActualizacion: () => import_electron.ipcRenderer.invoke("instalar-actualizacion")
});
