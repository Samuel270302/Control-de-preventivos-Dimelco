import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("appInfo", {
  version: process.env.npm_package_version ?? "",
  plataforma: process.platform,
  guardarPdf: (html: string, nombre: string): Promise<string | null> =>
    ipcRenderer.invoke("guardar-pdf", html, nombre),
  guardarArchivo: (datos: Uint8Array, nombre: string): Promise<string | null> =>
    ipcRenderer.invoke("guardar-archivo", datos, nombre),
});
