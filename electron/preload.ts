import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("appInfo", {
  version: process.env.npm_package_version ?? "",
  plataforma: process.platform,
});
